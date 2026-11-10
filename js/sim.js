// Modelo simplificado de um SUV híbrido plug-in de arquitetura série-paralela.
// Valores de referência públicos do Geely EX5 EM-i (Brasil, 2026). Dinâmica e curvas são ilustrativas.

export const VERSIONS = {
  pro:   { id: 'pro',   name: 'Pro / Max', capKWh: 18.4, chem: 'LFP', acKW: 6.6, dcKW: 30, evRangeKm: 80 },
  ultra: { id: 'ultra', name: 'Ultra',     capKWh: 29.8, chem: 'LFP', acKW: 6.6, dcKW: 60, evRangeKm: 112 }
};

export const VEHICLE = {
  massKg: 1844, cd: 0.29, frontalM2: 2.62, crr: 0.010, wheelR: 0.359,
  motorKW: 160, motorNm: 262, engineKW: 73, engineL: 1.5,
  lengthMm: 4740, widthMm: 1905, heightMm: 1685, wheelbaseMm: 2755,
  cellsSeries: 104
};

export const SOURCES = {
  none:     { kind: 'none' },
  portable: { kind: 'ac', kw: 2.2, label: 'portable', volts: 220, amps: 10 },
  wallbox:  { kind: 'ac', kw: 7.4, label: 'wallbox', volts: 220, amps: 32 },
  dc:       { kind: 'dc', kw: 60, label: 'dc' }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Tensão de circuito aberto de uma célula LFP em função do SoC (curva típica, achatada no meio)
export function lfpOcv(soc) {
  const s = clamp(soc, 0, 1);
  if (s < 0.05) return lerp(2.9, 3.2, s / 0.05);
  if (s < 0.2) return lerp(3.2, 3.27, (s - 0.05) / 0.15);
  if (s < 0.9) return lerp(3.27, 3.33, (s - 0.2) / 0.7);
  return lerp(3.33, 3.5, (s - 0.9) / 0.1);
}

export class Sim {
  constructor() {
    this.p = {
      version: 'pro', source: 'none', dcStationKW: 60, chargeLimit: 90, ambientC: 30,
      driveMode: 'hybrid', targetKmh: 0, regen: 'medium', braking: false, timeScale: 1,
      gatewayBlocksDid: false, fault: 'none', huSignals: { soc: true, power: true, speed: true, charge: true, temp: true },
      bmsPeriodMs: 100
    };
    this.reset();
  }
  get v() { return VERSIONS[this.p.version]; }
  reset(soc = 0.42) {
    this.s = {
      t: 0, soc, packTempC: this.p.ambientC + 2, speed: 0, accel: 0,
      pBatt: 0, pMotor: 0, pGen: 0, pEngine: 0, pGrid: 0, pRegen: 0, pAux: 0.45,
      rpm: 0, engineOn: false, gear: 'D', fuelL: 42, fuelRateLh: 0, coolantC: this.p.ambientC,
      chargeState: 'idle', timeToTargetS: 0, energyInKWh: 0, sohPct: 97.6,
      portOpen: false, plugConnected: false, isolationOhm: 2.1e6, dtcs: [], mil: false,
      flow: { grid: 0, dc: 0, regen: 0, traction: 0, fuel: 0, gen: 0, parallel: 0 }
    };
  }
  setSoc(soc) { this.s.soc = clamp(soc, 0.02, 1); }
  packVoltage() { return VEHICLE.cellsSeries * lfpOcv(this.s.soc) + (this.s.pBatt > 0 ? 1 : -1) * Math.min(18, Math.abs(this.s.pBatt) * 0.18); }
  packCurrent() { return this.s.pBatt * 1000 / this.packVoltage(); }
  cellMinMax() { const v = this.packVoltage() / VEHICLE.cellsSeries; return [v - 0.006 - (this.p.fault === 'degraded' ? 0.04 : 0), v + 0.005]; }

  // Potência máxima aceita pela bateria em recarga DC (curva típica LFP), em kW
  dcAcceptKW() {
    const s = this.s.soc, cap = this.v.dcKW;
    let f = s < 0.8 ? 1 : s < 0.9 ? lerp(1, 0.45, (s - 0.8) / 0.1) : lerp(0.45, 0.12, (s - 0.9) / 0.1);
    const T = this.s.packTempC;
    if (T < 10) f *= 0.45; else if (T < 18) f *= lerp(0.45, 1, (T - 10) / 8);
    if (T > 45) f *= lerp(1, 0.5, clamp((T - 45) / 8, 0, 1));
    return cap * f;
  }
  roadLoadKW(v) { // v em m/s
    const aero = 0.5 * 1.18 * VEHICLE.cd * VEHICLE.frontalM2 * v * v * v;
    const roll = VEHICLE.crr * VEHICLE.massKg * 9.81 * v;
    return (aero + roll) / 1000;
  }

  step(dtReal) {
    const p = this.p, s = this.s, ver = this.v;
    const dt = dtReal * p.timeScale;
    s.t += dt;
    const src = SOURCES[p.source];
    const plugged = src.kind !== 'none';
    s.plugConnected = plugged; s.portOpen = plugged;
    const isoFault = p.fault === 'isolation';
    s.isolationOhm = isoFault ? 85e3 : 2.1e6;

    // Diagnóstico
    const dtcs = [];
    if (isoFault) dtcs.push('P0AA6');
    if (p.fault === 'degraded') dtcs.push('P0A80');
    if (p.fault === 'cell') dtcs.push('P0AFA');
    s.dtcs = dtcs; s.mil = dtcs.length > 0;
    s.sohPct = p.fault === 'degraded' ? 71.5 : 97.6;

    // Velocidade (rampas simples); conectado ao carregador o carro fica parado
    const target = plugged ? 0 : p.targetKmh / 3.6;
    const prevV = s.speed;
    if (p.braking && s.speed > 0) s.speed = Math.max(0, s.speed - 4.2 * dt);
    else if (s.speed < target) s.speed = Math.min(target, s.speed + 2.6 * dt);
    else if (s.speed > target) s.speed = Math.max(target, s.speed - (p.regen === 'high' ? 2.2 : p.regen === 'medium' ? 1.3 : 0.6) * dt);
    s.accel = dt > 0 ? (s.speed - prevV) / dt : 0;

    // Demanda nas rodas
    const v = s.speed;
    const inertiaKW = VEHICLE.massKg * 1.05 * s.accel * v / 1000;
    const wheelKW = this.roadLoadKW(v) + inertiaKW;

    let pBatt = 0, pMotor = 0, pGen = 0, pEngine = 0, pGrid = 0, pRegen = 0, parallel = 0;
    const flow = { grid: 0, dc: 0, regen: 0, traction: 0, fuel: 0, gen: 0, parallel: 0 };
    s.pAux = 0.35 + Math.max(0, (p.ambientC - 24)) * 0.05 + (plugged ? 0.1 : 0);

    if (plugged) {
      s.engineOn = false; s.rpm = 0;
      const limit = p.chargeLimit / 100;
      if (isoFault) { s.chargeState = 'fault'; }
      else if (s.soc >= limit - 0.001) { s.chargeState = 'done'; }
      else {
        s.chargeState = 'charging';
        if (src.kind === 'ac') {
          const inKW = Math.min(src.kw, ver.acKW);
          let acc = inKW * 0.93 - s.pAux;
          if (s.soc > 0.95) acc *= lerp(1, 0.35, (s.soc - 0.95) / 0.05);
          pBatt = Math.max(0, acc); pGrid = inKW; flow.grid = clamp(inKW / 7, 0.25, 1);
        } else {
          const kw = Math.min(p.dcStationKW, this.dcAcceptKW());
          pBatt = kw * 0.975 - s.pAux; pGrid = kw; flow.dc = clamp(kw / 60, 0.3, 1);
        }
      }
      if (s.chargeState !== 'charging') { pBatt = -s.pAux * 0.2; pGrid = 0; }
    } else {
      s.chargeState = 'idle';
      const minSoc = 0.15;
      if (wheelKW >= 0) {
        // Decide a fonte de tração conforme o modo
        const kmh = v * 3.6;
        let engine = false;
        if (p.driveMode === 'hybrid') engine = s.soc < 0.25 || wheelKW > 70 || kmh > 115;
        if (p.driveMode === 'charge') engine = v > 0.5 || s.soc < 0.8;
        if (p.driveMode === 'ev') engine = s.soc < minSoc - 0.02;
        if (v < 0.1 && p.driveMode !== 'charge') engine = false;
        s.engineOn = engine;
        if (engine) {
          // Motor a combustão perto do ponto ótimo; em alta velocidade acopla direto às rodas
          const wantCharge = p.driveMode === 'charge' ? 22 : s.soc < 0.25 ? 14 : 4;
          pEngine = clamp(wheelKW + wantCharge + s.pAux, 18, VEHICLE.engineKW);
          if (kmh > 80 && p.driveMode !== 'charge') { parallel = Math.min(wheelKW, pEngine * 0.85); }
          pGen = (pEngine - parallel / 0.97) * 0.9;
          pMotor = Math.max(0, wheelKW - parallel) / 0.92;
          pBatt = pGen - pMotor - s.pAux;
          s.rpm = 1300 + pEngine * 38 + (parallel > 0 ? kmh * 6 : 0);
        } else {
          s.rpm = 0;
          pMotor = wheelKW / 0.92;
          pBatt = -(pMotor + s.pAux);
        }
      } else {
        // Frenagem regenerativa
        s.engineOn = false; s.rpm = 0;
        const regenCap = p.regen === 'high' ? 80 : p.regen === 'medium' ? 45 : 18;
        pRegen = Math.min(-wheelKW * 0.88, regenCap);
        if (s.soc > 0.97) pRegen *= 0.2;
        pBatt = pRegen - s.pAux;
      }
      flow.traction = clamp(pMotor / 60, 0, 1);
      flow.regen = clamp(pRegen / 30, 0, 1);
      flow.fuel = s.engineOn ? clamp(pEngine / 50, 0.25, 1) : 0;
      flow.gen = s.engineOn ? clamp(pGen / 40, 0.15, 1) : 0;
      flow.parallel = clamp(parallel / 40, 0, 1);
    }

    // Integração de energia, combustível e temperatura
    const capKWh = ver.capKWh * (s.sohPct / 100);
    s.soc = clamp(s.soc + pBatt * dt / 3600 / capKWh, 0.02, 1);
    if (pBatt > 0 && plugged) s.energyInKWh += pBatt * dt / 3600;
    const bsfc = 235; // g/kWh
    s.fuelRateLh = s.engineOn ? pEngine * bsfc / 745 : 0;
    s.fuelL = Math.max(0, s.fuelL - s.fuelRateLh * dt / 3600);
    const I = Math.abs(pBatt * 1000 / this.packVoltage());
    const heat = I * I * 0.09 / 1000; // kW
    const cooling = (s.packTempC - p.ambientC) * (s.packTempC > 32 ? 0.12 : 0.05);
    s.packTempC += (heat - cooling) * dt / 28;
    s.coolantC += ((s.engineOn ? 88 : p.ambientC) - s.coolantC) * dt / 90;

    // Tempo estimado até o limite de recarga
    if (s.chargeState === 'charging' && pBatt > 0.05) {
      const need = Math.max(0, p.chargeLimit / 100 - s.soc) * capKWh;
      let rate = pBatt;
      if (src.kind === 'dc' && p.chargeLimit > 80) rate *= 0.82;
      s.timeToTargetS = need / rate * 3600;
    } else s.timeToTargetS = 0;

    Object.assign(s, { pBatt, pMotor, pGen, pEngine, pGrid, pRegen });
    s.flow = flow;
    return s;
  }

  evRangeKm() { return this.v.evRangeKm * this.s.soc * (this.s.sohPct / 100); }
  usableWh() { return this.s.soc * this.v.capKWh * (this.s.sohPct / 100) * 1000; }
}
