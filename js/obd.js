// Geração de quadros CAN de diagnóstico (SAE J1979 / ISO 15765-4) e de quadros periódicos.
// PIDs de modo 01 seguem o padrão; DIDs UDS 0x22 e IDs periódicos são ilustrativos (variam por fabricante).

const hx = (n, w = 2) => Math.max(0, Math.round(n)).toString(16).toUpperCase().padStart(w, '0');
const clampB = v => Math.max(0, Math.min(255, Math.round(v)));

export const PIDS = {
  '0D': { mode: '01', name: 'speed', bytes: s => [clampB(s.s.speed * 3.6)], dec: b => `${b[0]} km/h` },
  '0C': { mode: '01', name: 'rpm', bytes: s => { const r = Math.round(s.s.rpm * 4); return [(r >> 8) & 255, r & 255]; }, dec: b => `${Math.round((b[0] * 256 + b[1]) / 4)} rpm` },
  '5B': { mode: '01', name: 'hybBatt', bytes: s => [clampB(s.s.soc * 255)], dec: b => `${(b[0] * 100 / 255).toFixed(1)} %` },
  '05': { mode: '01', name: 'coolant', bytes: s => [clampB(s.s.coolantC + 40)], dec: b => `${b[0] - 40} °C` },
  '2F': { mode: '01', name: 'fuel', bytes: s => [clampB(s.s.fuelL / 51 * 255)], dec: b => `${(b[0] * 100 / 255).toFixed(1)} %` },
  '46': { mode: '01', name: 'ambient', bytes: s => [clampB(s.p.ambientC + 40)], dec: b => `${b[0] - 40} °C` }
};

export const DIDS = {
  '0101': { name: 'udsSoc', bytes: s => { const v = Math.round(s.s.soc * 1000); return [(v >> 8) & 255, v & 255]; }, dec: b => `${((b[0] * 256 + b[1]) / 10).toFixed(1)} %` },
  '0102': { name: 'udsVolt', bytes: s => { const v = Math.round(s.packVoltage() * 10); return [(v >> 8) & 255, v & 255]; }, dec: b => `${((b[0] * 256 + b[1]) / 10).toFixed(1)} V` },
  '0103': { name: 'udsCurr', bytes: s => { let v = Math.round(s.packCurrent() * 10); if (v < 0) v += 65536; return [(v >> 8) & 255, v & 255]; }, dec: b => { let v = b[0] * 256 + b[1]; if (v > 32767) v -= 65536; return `${(v / 10).toFixed(1)} A`; } },
  '0104': { name: 'udsTemp', bytes: s => [clampB(s.s.packTempC + 40)], dec: b => `${b[0] - 40} °C` },
  '0105': { name: 'udsCells', bytes: s => { const [a, c] = s.cellMinMax().map(v => Math.round(v * 1000)); return [(a >> 8) & 255, a & 255, (c >> 8) & 255, c & 255]; }, dec: b => `${((b[0] * 256 + b[1]) / 1000).toFixed(3)} / ${((b[2] * 256 + b[3]) / 1000).toFixed(3)} V` }
};

const DTC_BYTES = { P0AA6: [0x0A, 0xA6], P0A80: [0x0A, 0x80], P0AFA: [0x0A, 0xFA] };
const VIN = '9C2PHEV2SMU004213';

export class Diagnostics {
  constructor(sim) {
    this.sim = sim; this.log = []; this.t = 0; this.acc = 0; this.i = 0;
    this.requests = ['0D', '0C', '5B'];
    this.rateHz = 4; this.lastByKey = {}; this.sent = 0; this.cleared = false;
    this.bcastAcc = 0; this.bcast = { soc: null, power: null, speed: null, charge: null, temp: null, ts: 0 };
    this.frameCount = 0; this.busWindow = [];
  }
  push(dir, id, bytes, decode, kind = 'diag') {
    const e = { t: this.t, dir, id, bytes, decode, kind };
    this.log.push(e); if (this.log.length > 200) this.log.shift();
    this.frameCount++; this.busWindow.push(this.t);
    return e;
  }
  sf(payload) { return [payload.length, ...payload]; } // ISO-TP single frame
  request(key) {
    const s = this.sim;
    if (PIDS[key]) {
      const P = PIDS[key];
      this.push('tx', '7DF', this.sf([0x01, parseInt(key, 16)]), { k: 'req', pid: key });
      const data = P.bytes(s);
      const ecu = key === '5B' ? '7EC' : '7E8';
      this.push('rx', ecu, this.sf([0x41, parseInt(key, 16), ...data]), { k: 'pid', pid: key, val: P.dec(data) });
      this.lastByKey[key] = P.dec(data);
    } else if (DIDS[key]) {
      const D = DIDS[key]; const did = [parseInt(key.slice(0, 2), 16), parseInt(key.slice(2), 16)];
      this.push('tx', '7E4', this.sf([0x22, ...did]), { k: 'req', did: key });
      if (s.p.gatewayBlocksDid) {
        this.push('rx', '7EC', this.sf([0x7F, 0x22, 0x33]), { k: 'nrc', did: key });
        this.lastByKey[key] = 'NRC 0x33';
      } else {
        const data = D.bytes(s);
        this.push('rx', '7EC', this.sf([0x62, ...did, ...data]), { k: 'did', did: key, val: D.dec(data) });
        this.lastByKey[key] = D.dec(data);
      }
    } else if (key === 'DTC') {
      this.push('tx', '7DF', this.sf([0x03]), { k: 'req03' });
      const list = s.s.dtcs;
      const bytes = [0x43, list.length]; list.forEach(c => bytes.push(...DTC_BYTES[c]));
      this.push('rx', '7E8', this.sf(bytes.slice(0, 7)), { k: 'dtc', val: list.length ? list.join(', ') : '—' });
      this.lastByKey.DTC = list.length ? list.join(', ') : '—';
    } else if (key === 'CLR') {
      this.push('tx', '7DF', this.sf([0x04]), { k: 'req04' });
      this.push('rx', '7E8', this.sf([0x44]), { k: 'clr' });
    } else if (key === 'VIN') {
      this.push('tx', '7DF', this.sf([0x09, 0x02]), { k: 'reqvin' });
      const v = [...VIN].map(c => c.charCodeAt(0));
      const total = 3 + v.length; // 49 02 01 + VIN
      const all = [0x49, 0x02, 0x01, ...v];
      this.push('rx', '7E8', [0x10, total, ...all.slice(0, 6)], { k: 'ff' });
      this.push('tx', '7E0', [0x30, 0x00, 0x00], { k: 'fc' });
      let sn = 1, i = 6;
      while (i < all.length) { const chunk = all.slice(i, i + 7); this.push('rx', '7E8', [0x20 + (sn & 15), ...chunk], { k: i + 7 >= all.length ? 'cfEnd' : 'cf', val: i + 7 >= all.length ? VIN : null }); sn++; i += 7; }
      this.lastByKey.VIN = VIN;
    }
  }
  oneShot(key) { this.request(key); }
  step(dtReal) {
    this.t += dtReal;
    this.busWindow = this.busWindow.filter(t => this.t - t < 1);
    if (this.requests.length && this.rateHz > 0) {
      this.acc += dtReal;
      const period = 1 / this.rateHz;
      while (this.acc >= period) { this.acc -= period; this.request(this.requests[this.i % this.requests.length]); this.i++; }
    }
    // Quadros periódicos das ECUs, repassados pelo gateway à rede de infotainment
    const per = this.sim.p.bmsPeriodMs / 1000;
    this.bcastAcc += dtReal;
    if (this.bcastAcc >= per) {
      this.bcastAcc %= per;
      const s = this.sim, st = s.s, allow = s.p.huSignals;
      const soc10 = Math.round(st.soc * 1000), volt = Math.round(s.packVoltage() * 10);
      this.push('bc', '3A2', [soc10 >> 8, soc10 & 255, volt >> 8, volt & 255, clampB(st.packTempC + 40), 0, 0, 0], { k: 'bms' }, 'bcast');
      const pw = Math.round(st.pBatt * 10) + 32768;
      this.push('bc', '3B0', [pw >> 8, pw & 255, ['idle', 'charging', 'done', 'fault'].indexOf(st.chargeState), Math.min(255, Math.round(st.timeToTargetS / 60)), 0, 0, 0, 0], { k: 'chg' }, 'bcast');
      this.push('bc', '1F0', [clampB(st.speed * 3.6), st.engineOn ? 1 : 0, 0, 0, 0, 0, 0, 0], { k: 'vcu' }, 'bcast');
      this.bcast = {
        soc: allow.soc ? st.soc : null, power: allow.power ? st.pBatt : null, speed: allow.speed ? st.speed : null,
        charge: allow.charge ? { state: st.chargeState, tts: st.timeToTargetS, plugged: st.plugConnected } : null,
        temp: allow.temp ? st.packTempC : null, ts: this.t
      };
    }
  }
  busLoadPct() { return Math.min(100, this.busWindow.length * 111 / 500000 * 100 + 18); }
  static fmt(bytes) { return bytes.map(b => hx(b)).join(' '); }
}
