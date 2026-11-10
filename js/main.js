import * as THREE from 'three';
import { Stage } from './scene.js';
import { Sim, VERSIONS } from './sim.js';
import { Diagnostics, PIDS, DIDS } from './obd.js';
import { STR } from './i18n.js';
import { drawHU, drawCluster, drawDcScreen } from './hu.js';
import { PAINTS } from './vehicle.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = id => document.getElementById(id);
const hash = location.hash.replace('#', '');
const GIFM = hash.match(/^gif=(\d+)$/);
const CAPTURE = !!GIFM;
if (CAPTURE) document.body.classList.add('capture');

const prefs = (() => { try { return JSON.parse(localStorage.getItem('phev-sim') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('phev-sim', JSON.stringify({ lang: state.lang, quality: state.quality, color: state.color })); } catch { } };

const state = {
  module: 'overview', lang: prefs.lang || ((navigator.language || 'pt').startsWith('pt') ? 'pt' : 'en'), tech: false,
  xrayAuto: true, xrayOn: false, xr: 0, quality: prefs.quality || (matchMedia('(max-width: 900px)').matches ? 'medium' : 'high'), color: prefs.color || 'silver',
  tour: null, explainKey: 'overview', camKey: ''
};
if (hash === 'en') state.lang = 'en';
const S = () => STR[state.lang];
const fmt = (v, d = 1) => v.toLocaleString(state.lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const stage = new Stage($('stage'), { capture: CAPTURE });
const sim = new Sim();
const diag = new Diagnostics(sim);
stage.setSource('none');
stage.v.setPaint(state.color);
if (state.quality !== 'high') stage.setQuality(state.quality);

/* ---------------- i18n estático ---------------- */
function applyI18n() {
  document.documentElement.lang = state.lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = el.dataset.i18n.split('.').reduce((o, k) => o && o[k], S()); if (typeof v === 'string') el.textContent = v; });
  $('btnLang').textContent = S().lang;
  const leg = state.lang === 'pt' ? { e: 'Energia elétrica', f: 'Combustível', d: 'Dados', h: 'Cabos de alta tensão' } : { e: 'Electric energy', f: 'Fuel', d: 'Data', h: 'High-voltage cables' };
  document.querySelectorAll('[data-l]').forEach(el => el.textContent = leg[el.dataset.l]);
  $('btnTour').textContent = state.tour ? S().tourStop : S().tour;
  $('huModalTitle').textContent = S().h.zoom; $('huClose').textContent = S().h.close; $('huLimitLbl').textContent = S().h.limitWrite; $('huLimitHint').textContent = S().h.limitHint;
  document.title = `${S().title} · ${state.lang === 'pt' ? 'Simulador' : 'Simulator'}`;
  buildLabels(); renderPanel(); renderHud(true);
}

/* ---------------- Painel ---------------- */
const seg = (key, opts, cur, disabled = []) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}" ${disabled.includes(v) ? 'disabled' : ''}>${t}</button>`).join('')}</div>`;
const range = (id, key, min, max, step, val, out) => `<input type="range" id="${id}" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${val}" style="--p:${(val - min) / (max - min) * 100}%"><output id="${id}Out" hidden>${out}</output>`;
const field = (label, out, body, outId) => `<div class="field"><label><span>${label}</span><output ${outId ? `id="${outId}"` : ''}>${out}</output></label>${body}</div>`;

function renderPanel() {
  const L = S(), p = sim.p, plugged = p.source !== 'none';
  let h = '';
  const mod = state.module;
  if (mod === 'charging' || mod === 'overview') {
    h += `<div class="sec"><div class="sec-h"><h3>${L.tabs.charging}</h3><span class="hint">${L.simulated}</span></div>
      <div class="field"><div class="flabel">${L.c.source}</div>${seg('source', [['none', L.c.none], ['portable', L.c.portable], ['wallbox', L.c.wallbox], ['dc', L.c.dc]], p.source)}</div>
      ${p.source === 'dc' ? field(L.c.dcPower, `${p.dcStationKW} kW`, range('rDc', 'dcStationKW', 20, 150, 10, p.dcStationKW), 'oDc') : ''}
      ${field(L.c.limit, `${p.chargeLimit}%`, range('rLim', 'chargeLimit', 50, 100, 5, p.chargeLimit), 'oLim')}
      ${field(L.c.soc, `${Math.round(sim.s.soc * 100)}%`, range('rSoc', 'soc', 5, 100, 1, Math.round(sim.s.soc * 100)), 'oSoc')}
      ${field(L.c.ambient, `${p.ambientC} °C`, range('rAmb', 'ambientC', 0, 45, 1, p.ambientC), 'oAmb')}
    </div>
    <div class="sec"><div class="sec-h"><h3>${L.c.driving}</h3>${plugged ? `<span class="hint">${L.c.drivingHint}</span>` : ''}</div>
      <div class="field"><div class="flabel">${L.c.mode}</div>${seg('driveMode', [['ev', L.c.ev], ['hybrid', L.c.hybrid], ['charge', L.c.charge]], p.driveMode)}</div>
      ${field(L.c.speed, `${p.targetKmh} km/h`, range('rSpd', 'targetKmh', 0, 140, 5, p.targetKmh), 'oSpd')}
      <div class="field"><div class="flabel">${L.c.regen}</div>${seg('regen', [['low', L.c.low], ['medium', L.c.medium], ['high', L.c.high]], p.regen)}</div>
      <button class="btn hold" id="brake" ${plugged ? 'disabled' : ''}>${L.c.brake}</button>
    </div>`;
  }
  if (mod === 'obd') {
    const chip = (k, name, code, cls = '') => `<button class="chip ${cls}" data-req="${k}" aria-pressed="${diag.requests.includes(k)}">${name}<code>${code}</code></button>`;
    h += `<div class="sec"><div class="sec-h"><h3>${L.o.requests}</h3></div>
      <div class="field"><div class="flabel">${L.o.std}</div><div class="chips">${Object.keys(PIDS).map(k => chip(k, L.pid[PIDS[k].name], '0x' + k, 'cy')).join('')}</div></div>
      <div class="field"><div class="flabel">${L.o.uds}</div><div class="chips">${Object.keys(DIDS).map(k => chip(k, L.pid[DIDS[k].name], '0x' + k)).join('')}</div></div>
      ${field(L.o.rate, `${diag.rateHz} Hz`, range('rRate', 'rateHz', 1, 20, 1, diag.rateHz), 'oRate')}
      ${field(L.c.speed, `${p.targetKmh} km/h`, range('rSpd', 'targetKmh', 0, 140, 5, p.targetKmh), 'oSpd')}
    </div>
    <div class="sec"><div class="sec-h"><h3>${L.o.actions}</h3></div>
      <div class="btnrow"><button class="btn" data-shot="VIN">${L.o.vin}</button><button class="btn" data-shot="DTC">${L.o.read}</button><button class="btn" data-shot="CLR">${L.o.clear}</button></div>
      <label class="toggle" style="margin-top:12px">${L.o.gateway}<input type="checkbox" id="tGw" ${p.gatewayBlocksDid ? 'checked' : ''}></label>
      <div class="field" style="margin-top:10px"><div class="flabel">${L.o.fault}</div>${seg('fault', [['none', L.o.fNone], ['isolation', L.o.fIso], ['degraded', L.o.fDeg], ['cell', L.o.fCell]], p.fault)}</div>
    </div>
    <div class="sec"><div class="sec-h"><h3>${L.o.results}</h3><span class="hint mono" id="busLoad"></span></div><div class="kv" id="obdResults"></div></div>`;
  }
  if (mod === 'hu') {
    const sig = [['soc', L.h.sSoc], ['power', L.h.sPower], ['speed', L.h.sSpeed], ['charge', L.h.sCharge], ['temp', L.h.sTemp]];
    h += `<div class="sec"><div class="sec-h"><h3>${L.h.signals}</h3></div>
      ${sig.map(([k, t]) => `<label class="toggle">${t}<input type="checkbox" data-sig="${k}" ${p.huSignals[k] ? 'checked' : ''}></label>`).join('')}
    </div>
    <div class="sec">
      <div class="field"><div class="flabel"><span>${L.h.period}</span></div>${seg('bmsPeriodMs', [[10, '10 ms'], [100, '100 ms'], [1000, '1 s']], p.bmsPeriodMs)}</div>
      <p class="note">${L.h.latency} ≈ ${p.bmsPeriodMs >= 1000 ? '1 s' : p.bmsPeriodMs + ' ms'}</p>
      ${field(L.h.limitWrite, `${p.chargeLimit}%`, range('rLim', 'chargeLimit', 50, 100, 5, p.chargeLimit), 'oLim')}
      <div class="field">${seg('source', [['none', L.c.none], ['wallbox', L.c.wallbox], ['dc', L.c.dc]], p.source)}</div>
      ${field(L.c.speed, `${p.targetKmh} km/h`, range('rSpd', 'targetKmh', 0, 140, 5, p.targetKmh), 'oSpd')}
      <button class="btn" id="btnZoom" style="width:100%">${L.h.zoom}</button>
    </div>`;
  }
  h += `<div class="sec"><div class="sec-h"><h3>${state.lang === 'pt' ? 'Veículo e cena' : 'Vehicle and scene'}</h3></div>
    <div class="field"><div class="flabel">${L.g.version}</div>${seg('version', Object.values(VERSIONS).map(v => [v.id, `${v.name} · ${fmt(v.capKWh, 1)} kWh`]), p.version)}</div>
    <div class="field"><div class="flabel">${L.g.color}</div><div class="swatches">${Object.entries(PAINTS).map(([k, c]) => `<button class="sw" data-color="${k}" aria-label="${L.colors[k]}" title="${L.colors[k]}" aria-pressed="${state.color === k}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}</div></div>
    <div class="field"><div class="flabel">${L.g.timeScale}</div>${seg('timeScale', [[1, '1×'], [10, '10×'], [60, '60×']], p.timeScale)}</div>
    <div class="field"><div class="flabel">${L.g.quality}</div>${seg('quality', [['high', L.g.qHigh], ['medium', L.g.qMed], ['low', L.g.qLow]], state.quality)}</div>
    <button class="btn" id="btnReset">${L.reset}</button>
    <p class="note">${state.lang === 'pt' ? 'Referência pública do Geely EX5 EM-i vendido no Brasil (Renault Geely do Brasil). Modelo 3D original, ilustrativo. Curvas, identificadores CAN e DIDs são simulados.' : 'Public reference data of the Geely EX5 EM-i sold in Brazil (Renault Geely do Brasil). Original, illustrative 3D model. Curves, CAN IDs and DIDs are simulated.'}</p>
  </div>`;
  $('panel').innerHTML = h;
}

function setParam(key, v) {
  const p = sim.p;
  if (key === 'source') { p.source = v; stage.setSource(v); if (v !== 'none') { p.targetKmh = 0; sim.s.speed = 0; } }
  else if (key === 'version') { p.version = v; buildLabels(); }
  else if (key === 'quality') { state.quality = v; stage.setQuality(v); savePrefs(); }
  else if (key === 'timeScale' || key === 'bmsPeriodMs') p[key] = +v;
  else if (key === 'fault') { p.fault = v; if (v !== 'none' && !diag.requests.includes('DTC')) diag.requests.push('DTC'); }
  else p[key] = v;
  renderPanel(); refreshContext(true);
}
$('panel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.set) setParam(b.dataset.set, b.dataset.v);
  else if (b.dataset.req) { const k = b.dataset.req, r = diag.requests; const i = r.indexOf(k); if (i >= 0) r.splice(i, 1); else r.push(k); b.setAttribute('aria-pressed', String(i < 0)); refreshContext(); }
  else if (b.dataset.shot) { diag.oneShot(b.dataset.shot); pulseObd(b.dataset.shot); }
  else if (b.dataset.color) { state.color = b.dataset.color; stage.v.setPaint(state.color); savePrefs(); renderPanel(); }
  else if (b.id === 'btnReset') { sim.reset(); Object.assign(sim.p, { source: 'none', targetKmh: 0, fault: 'none', gatewayBlocksDid: false }); stage.setSource('none'); diag.log = []; renderPanel(); refreshContext(true); }
  else if (b.id === 'btnZoom') openHu();
});
$('panel').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.range) {
    const k = t.dataset.range, v = +t.value; t.style.setProperty('--p', `${(v - t.min) / (t.max - t.min) * 100}%`);
    if (k === 'soc') sim.setSoc(v / 100); else if (k === 'rateHz') diag.rateHz = v; else sim.p[k] = v;
    const out = t.closest('.field')?.querySelector('label output');
    if (out) out.textContent = k === 'soc' || k === 'chargeLimit' ? `${v}%` : k === 'ambientC' ? `${v} °C` : k === 'targetKmh' ? `${v} km/h` : k === 'rateHz' ? `${v} Hz` : `${v} kW`;
    if (k === 'targetKmh' && v > 0 && sim.p.source !== 'none') { sim.p.source = 'none'; stage.setSource('none'); renderPanel(); }
    refreshContext();
  }
  if (t.id === 'tGw') { sim.p.gatewayBlocksDid = t.checked; refreshContext(true); }
  if (t.dataset.sig) { sim.p.huSignals[t.dataset.sig] = t.checked; refreshContext(true); }
});
const brakeOn = v => { sim.p.braking = v; const b = $('brake'); if (b) b.classList.toggle('active', v); };
$('panel').addEventListener('pointerdown', e => { if (e.target.id === 'brake') { brakeOn(true); sim.p.targetKmh = Math.max(0, Math.round(sim.s.speed * 3.6 / 5) * 5 - 30); } });
window.addEventListener('pointerup', () => brakeOn(false));

/* ---------------- Barra superior ---------------- */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { stopTour(); setModule(b.dataset.tab); }));
$('btnLang').addEventListener('click', () => { state.lang = state.lang === 'pt' ? 'en' : 'pt'; savePrefs(); applyI18n(); refreshContext(true); });
$('btnTech').addEventListener('click', () => { state.tech = !state.tech; $('btnTech').setAttribute('aria-pressed', String(state.tech)); $('tech').hidden = !state.tech; });
$('btnXray').addEventListener('click', () => { state.xrayAuto = false; state.xrayOn = !state.xrayOn; $('btnXray').setAttribute('aria-pressed', String(state.xrayOn)); });
$('btnPanel').addEventListener('click', () => { const o = $('panel').classList.toggle('open'); $('btnPanel').setAttribute('aria-expanded', String(o)); });
$('btnTour').addEventListener('click', () => state.tour ? stopTour() : startTour(0));
$('tourPrev').addEventListener('click', () => state.tour && gotoStep(state.tour.i - 1));
$('tourNext').addEventListener('click', () => state.tour && gotoStep(state.tour.i + 1));
window.addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  if (state.tour && e.key === 'ArrowRight') gotoStep(state.tour.i + 1);
  if (state.tour && e.key === 'ArrowLeft') gotoStep(state.tour.i - 1);
  if (e.key === 'Escape') { $('huModal').hidden = true; }
});
stage.controls.addEventListener('start', () => { if (stage.camTween && !stage.camTween.lock) stage.camTween = null; userMovedAt = performance.now(); });
let userMovedAt = 0;

function setModule(m) {
  state.module = m;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === m)));
  if (m === 'obd' && sim.p.targetKmh === 0 && sim.p.source === 'none') sim.p.targetKmh = 50;
  renderPanel(); refreshContext(true);
}

/* ---------------- Rótulos ---------------- */
const labelEls = {};
function labelDefs() {
  const A = stage.v.anchors, L = S().lbl;
  return {
    batt: { a: V3(-0.5, 0.36, -0.68), t: L.batt, c: 'var(--cyan)' }, obc: { a: A.obc.clone().add(V3(0, 0.07, 0)), t: L.obc, c: 'var(--cyan)', left: true },
    port: { a: A.port.clone().add(V3(0, 0.06, -0.02)), t: L.port, c: 'var(--cyan)', h: 70 }, wallbox: { a: V3(-3.4, 1.4, -1.42), t: L.wallbox, c: 'var(--cyan)', left: true },
    portable: { a: V3(-3.45, 0.55, -1.42), t: L.portable, c: 'var(--cyan)', left: true }, dc: { a: V3(-3.55, 1.95, -1.4), t: L.dc, c: 'var(--cyan)', left: true },
    motor: { a: A.motor.clone().add(V3(0, 0.12, -0.1)), t: L.motor, c: 'var(--cyan)' }, gen: { a: A.gen.clone().add(V3(0, 0.12, 0)), t: L.gen, c: 'var(--cyan)', left: true },
    inv: { a: A.peu.clone().add(V3(0, 0.07, 0)), t: L.inv, c: 'var(--cyan)', h: 60 }, engine: { a: A.engine.clone().add(V3(0, 0.22, 0)), t: L.engine, c: 'var(--amber)' },
    tank: { a: A.tank.clone().add(V3(0, 0.12, 0)), t: L.tank, c: 'var(--amber)', left: true }, bms: { a: A.bms.clone().add(V3(0, 0.04, 0)), t: L.bms, c: 'var(--violet)' },
    vcu: { a: A.vcu.clone().add(V3(0, 0.04, 0)), t: L.vcu, c: 'var(--violet)' }, gw: { a: A.gw.clone().add(V3(0, 0.04, 0)), t: L.gw, c: 'var(--violet)', h: 56 },
    obd: { a: A.obd.clone().add(V3(0.02, 0.02, 0)), t: L.obd, c: 'var(--violet)', h: 74 }, dongle: { a: A.dongle.clone().add(V3(0, 0.03, 0)), t: L.dongle, c: 'var(--violet)', left: true },
    hu: { a: A.hu.clone().add(V3(0, 0.11, 0)), t: L.hu, c: 'var(--violet)' }, cable: { a: V3(1.2, 0.62, -0.25), t: L.cable, c: 'var(--hv)', left: true, h: 90 }
  };
}
function buildLabels() {
  const host = $('labels'); host.innerHTML = '';
  const defs = labelDefs(), cap = fmt(sim.v.capKWh, 1);
  Object.entries(defs).forEach(([k, d]) => {
    const el = document.createElement('div'); el.className = 'lbl' + (d.left ? ' left' : ''); el.style.setProperty('--c', d.c); if (d.h) el.style.setProperty('--h', d.h + 'px');
    el.innerHTML = `<span class="stem"></span><span class="dot"></span><div class="box"><div class="t">${d.t[0]}</div><div class="s">${d.t[1].replace('{cap}', cap).replace('{kw}', sim.p.dcStationKW)}</div></div>`;
    host.appendChild(el); labelEls[k] = { el, a: d.a, left: !!d.left };
  });
}
let activeLabels = [];
function updateLabels() {
  const w = innerWidth, h = innerHeight, p = new THREE.Vector3();
  Object.entries(labelEls).forEach(([k, l]) => {
    const on = activeLabels.includes(k);
    l.el.classList.toggle('on', on);
    if (!on) { if (!l.el._off) { l.el.style.transform = 'translate(-9999px,0)'; } return; }
    p.copy(l.a).project(stage.camera);
    if (p.z > 1) { l.el.style.transform = 'translate(-9999px,0)'; return; }
    const x = (p.x + 1) / 2 * w;
    if (!CAPTURE) { const wide = l.el.offsetWidth || 200; l.el.classList.toggle('left', l.left ? x > wide * 0 + 230 : x > w - 240); }
    l.el.style.transform = `translate(${x.toFixed(1)}px, ${((1 - p.y) / 2 * h).toFixed(1)}px)`;
  });
}

/* ---------------- Contexto: câmera, rótulos, fluxos, explicação ---------------- */
const CAMS = {
  overview: [V3(5.9, 1.9, 5.3), V3(0.1, 0.72, 0)],
  exterior: [V3(5.4, 1.45, 4.6), V3(0.2, 0.78, 0)],
  plug: [V3(-2.0, 3.1, -7.6), V3(-1.75, 0.65, -0.55)],
  drive: [V3(4.6, 2.3, -4.3), V3(0.7, 0.55, 0)],
  engine: [V3(4.3, 2.7, 3.9), V3(1.1, 0.55, 0.1)],
  obd: [V3(-1.0, 2.15, -3.7), V3(0.5, 0.72, -0.3)],
  obdNet: [V3(-3.1, 3.6, -3.4), V3(-0.05, 0.6, 0.0)],
  hu: [V3(-2.1, 3.3, 2.7), V3(0.3, 0.82, 0.1)],
  huClose: [V3(-0.42, 1.36, 0.1), V3(0.555, 1.15, 0.08)]
};
function camFor() {
  const m = state.module, p = sim.p, s = sim.s;
  if (state.tour && state.tour.cam) return state.tour.cam;
  if (m === 'overview') return 'overview';
  if (m === 'charging') return p.source !== 'none' ? 'plug' : s.engineOn || p.driveMode === 'charge' ? 'engine' : 'drive';
  if (m === 'obd') return 'obdNet';
  return 'hu';
}
function flyCam(key, force) {
  if (!force && key === state.camKey) return;
  state.camKey = key;
  if (performance.now() - userMovedAt < 4000 && !force && !state.tour) return;
  let [pos, tgt] = CAMS[key];
  const asp = innerWidth / innerHeight;
  if (asp < 1.2) pos = tgt.clone().add(pos.clone().sub(tgt).multiplyScalar(asp < 0.7 ? 2.1 : 1.5));
  if (CAPTURE) stage.snapTo(pos, tgt); else stage.flyTo(pos, tgt, 1.9);
}
function contextExplain() {
  const m = state.module, p = sim.p, s = sim.s;
  if (m === 'overview' && !state.tour) return 'overview';
  if (m === 'obd') return p.gatewayBlocksDid && diag.requests.some(k => DIDS[k]) ? 'obdBlocked' : s.dtcs.length ? 'obdFault' : 'obd';
  if (m === 'hu') return Object.values(p.huSignals).some(v => !v) ? 'huBlocked' : 'hu';
  if (p.source !== 'none') return s.chargeState === 'fault' ? 'fault' : s.chargeState === 'done' ? 'done' : p.source === 'dc' ? 'dc' : p.source === 'portable' ? 'portable' : 'ac';
  if (s.pRegen > 0.5) return 'regen';
  if (s.engineOn) return s.flow.parallel > 0.05 ? 'parallel' : 'series';
  if (s.speed > 0.5) return 'evDrive';
  return 'idle';
}
let exLock = 0;
function refreshContext(force) {
  const key = state.tour?.ex || contextExplain();
  if (force || key !== state.explainKey) {
    state.explainKey = key; const [t, x] = S().ex[key];
    $('exTitle').textContent = t; $('exText').textContent = x;
    $('exKicker').textContent = state.tour ? `${S().tabs[state.module]} · ${state.tour.i + 1}/${TOUR.length}` : S().tabs[state.module];
  }
  flyCam(camFor(), force && !CAPTURE ? false : false);
}

function computeLabels() {
  const m = state.module, p = sim.p, s = sim.s;
  if (state.tour?.labels) return state.tour.labels;
  if (m === 'overview') return ['batt', 'engine', 'hu'];
  if (m === 'charging') {
    if (p.source !== 'none') return p.source === 'dc' ? ['dc', 'port', 'batt', 'cable'] : [p.source, 'port', 'obc', 'batt'];
    return s.engineOn ? ['engine', 'gen', 'batt', 'tank'] : ['motor', 'inv', 'batt', 'cable'];
  }
  if (m === 'obd') { const bms = diag.requests.some(k => DIDS[k] || k === '5B'); return ['obd', 'dongle', 'gw', bms ? 'bms' : 'vcu']; }
  return ['bms', 'vcu', 'gw', 'hu'];
}

function setFlows() {
  const m = state.module, s = sim.s, p = sim.p, f = s.flow;
  const energy = m === 'overview' || m === 'charging' ? 1 : 0.35;
  const charging = s.chargeState === 'charging';
  stage.setFlow('ac', charging && p.source !== 'dc' ? energy : 0, f.grid);
  stage.setFlow('dc', charging && p.source === 'dc' ? energy : 0, f.dc);
  ['regenL', 'regenR'].forEach(k => stage.setFlow(k, f.regen > 0.02 ? energy : 0, f.regen));
  ['tractL', 'tractR'].forEach(k => stage.setFlow(k, f.traction > 0.02 && !(s.engineOn && s.pBatt > 0) ? energy : 0, f.traction));
  stage.setFlow('fuel', f.fuel > 0 ? energy : 0, f.fuel);
  stage.setFlow('gen', f.gen > 0.02 ? energy : 0, f.gen);
  stage.setFlow('parallel', f.parallel > 0.02 ? energy : 0, f.parallel); stage.setFlow('parallelL', f.parallel > 0.02 ? energy : 0, f.parallel);
  const obd = m === 'obd', toBms = diag.requests.some(k => DIDS[k] || k === '5B'), toVcu = diag.requests.some(k => PIDS[k] && k !== '5B') || diag.requests.includes('DTC');
  const blocked = p.gatewayBlocksDid && diag.requests.some(k => DIDS[k]);
  stage.setFlow('obdReqV', obd && toVcu ? 1 : 0, 0.6 + diag.rateHz / 30); stage.setFlow('obdRspV', obd && toVcu ? 1 : 0, 0.6 + diag.rateHz / 30);
  stage.setFlow('obdReqB', obd && toBms && !blocked ? 1 : 0); stage.setFlow('obdRspB', obd && toBms && !blocked ? 1 : 0);
  stage.setFlow('blockedDiag', obd && blocked ? 1 : 0);
  stage.setFlow('cloud', obd ? 0.9 : 0);
  const hu = m === 'hu', anyBlocked = Object.values(p.huSignals).some(v => !v);
  const rate = p.bmsPeriodMs <= 10 ? 1 : p.bmsPeriodMs <= 100 ? 0.7 : 0.25;
  stage.setFlow('bcastB', hu ? 1 : 0, rate); stage.setFlow('bcastV', hu && p.huSignals.speed ? 1 : 0, rate);
  stage.setFlow('blockedGw', hu && anyBlocked ? 1 : 0, rate);
  stage.v.setCan(obd ? ['diag', toVcu ? 'pt1' : '', toBms ? 'pt2' : ''] : hu ? ['pt1', 'pt2', 'info'] : [], 0);
  stage.v.setEcuGlow(obd ? ['gw', toVcu ? 'vcu' : '', toBms && !blocked ? 'bms' : ''] : hu ? ['gw', 'bms', 'vcu'] : [], simT);
}

/* ---------------- HUD e painel técnico ---------------- */
function stateLabel() {
  const s = sim.s, L = S().st;
  if (s.plugConnected) return [L[s.chargeState === 'idle' ? 'idle' : s.chargeState], s.chargeState === 'fault' ? 'r' : 'c'];
  if (s.pRegen > 0.5) return [L.regen, 'c'];
  if (s.engineOn) return [s.flow.parallel > 0.05 ? L.parallel : L.series, 'a'];
  if (s.speed > 0.5) return [L.evDrive, 'c'];
  return [L.idle, ''];
}
function hhmm(sec) { const m = Math.round(sec / 60); const h = Math.floor(m / 60); return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; }
function renderHud(force) {
  const s = sim.s, L = S().hud, [stTxt, stCls] = stateLabel();
  const tts = s.chargeState === 'charging' ? hhmm(s.timeToTargetS) : `${Math.round(sim.evRangeKm())} km`;
  const cells = [
    [L.soc, `${fmt(s.soc * 100, 1)} %`, 'c', `<div class="socbar"><i style="width:${(s.soc * 100).toFixed(1)}%"></i></div>`],
    [L.power, `${s.pBatt >= 0 ? '+' : '−'}${fmt(Math.abs(s.pBatt), 1)} kW`, s.pBatt > 0.05 ? 'c' : ''],
    [L.state, stTxt, stCls],
    [L.speed, `${Math.round(s.speed * 3.6)} km/h`, ''],
    [s.chargeState === 'charging' ? L.tts : L.range, tts, ''],
    [L.temp, `${fmt(s.packTempC, 1)} °C`, s.packTempC > 45 ? 'r' : ''],
    [L.engine, s.engineOn ? `${Math.round(s.rpm)} rpm` : S().off, s.engineOn ? 'a' : '']
  ];
  $('hud').innerHTML = cells.map(([k, v, c, extra]) => `<div class="m"><span>${k}</span><b class="${c}">${v}</b>${extra || ''}</div>`).join('');
}
function renderTech() {
  if (!state.tech) return;
  const m = state.module, L = S();
  let title = '', meta = '', body = '';
  if (m === 'obd' || m === 'hu') {
    title = m === 'obd' ? 'CAN · diagnóstico 500 kbit/s' : 'CAN · infotainment';
    if (state.lang === 'en') title = m === 'obd' ? 'CAN · diagnostics 500 kbit/s' : 'CAN · infotainment';
    meta = `${L.o.busLoad} ${fmt(diag.busLoadPct(), 0)}%`;
    const rows = diag.log.filter(e => m === 'obd' ? e.kind === 'diag' : e.kind === 'bcast').slice(-16);
    body = `<div class="log">${rows.map(e => {
      const cls = e.dir === 'tx' ? 'tx' : e.dir === 'bc' ? 'bc' : (e.decode.k === 'nrc' ? 'nrc' : 'rx');
      const arrow = e.dir === 'tx' ? '→' : e.dir === 'bc' ? '◆' : '←';
      let d = '';
      const dk = e.decode;
      if (dk.k === 'pid' || dk.k === 'did') d = `${L.pid[(PIDS[dk.pid] || DIDS[dk.did]).name]} ${dk.val}`;
      else if (dk.k === 'nrc') d = 'NRC 0x33 securityAccessDenied';
      else if (dk.k === 'dtc') d = `DTC ${dk.val}`;
      else if (dk.k === 'ff') d = 'ISO-TP first frame';
      else if (dk.k === 'fc') d = 'flow control';
      else if (dk.k === 'cfEnd') d = `VIN ${dk.val}`;
      else if (dk.k === 'clr') d = state.lang === 'pt' ? 'falhas apagadas' : 'DTCs cleared';
      else if (dk.k === 'bms') d = 'BMS'; else if (dk.k === 'chg') d = state.lang === 'pt' ? 'recarga' : 'charging'; else if (dk.k === 'vcu') d = 'VCU';
      return `<div><span class="${cls}">${arrow} ${e.id}</span>  ${Diagnostics.fmt(e.bytes).padEnd(24)} <span class="dec">${d}</span></div>`;
    }).join('')}</div>`;
    if (m === 'hu') {
      const b = diag.bcast, s = sim.s;
      const st = { idle: 'STATE_NOT_CHARGING', charging: 'STATE_CHARGING', done: 'STATE_FULLY_CHARGED', fault: 'STATE_ERROR' };
      const props = [
        ['EV_BATTERY_LEVEL', b.soc !== null ? fmt(b.soc * sim.v.capKWh * s.sohPct / 100 * 1000, 0) : '—', 'Wh'],
        ['EV_BATTERY_INSTANTANEOUS_CHARGE_RATE', b.power !== null ? fmt(b.power * 1e6, 0) : '—', 'mW'],
        ['EV_CHARGE_STATE', b.charge ? st[b.charge.state] : '—', ''],
        ['EV_CHARGE_PORT_CONNECTED', b.charge ? String(b.charge.plugged) : '—', ''],
        ['EV_CHARGE_TIME_REMAINING', b.charge && b.charge.state === 'charging' ? fmt(b.charge.tts, 0) : '—', 's'],
        ['EV_CHARGE_PERCENT_LIMIT', fmt(sim.p.chargeLimit, 0), '%'],
        ['PERF_VEHICLE_SPEED', b.speed !== null ? fmt(b.speed, 2) : '—', 'm/s'],
        ['INFO_EV_BATTERY_CAPACITY', fmt(sim.v.capKWh * 1000, 0), 'Wh'],
        ['ENV_OUTSIDE_TEMPERATURE', fmt(sim.p.ambientC, 1), '°C']
      ];
      body = `<table class="vt">${props.map(([k, v, u]) => `<tr><td>${k}</td><td>${v} <span class="u">${u}</span></td></tr>`).join('')}</table><div style="height:10px"></div>` + body;
    }
  } else {
    title = state.lang === 'pt' ? 'Bateria e energia' : 'Battery and energy';
    const s = sim.s, [cmin, cmax] = sim.cellMinMax();
    const rows = [
      [state.lang === 'pt' ? 'Tensão do pack' : 'Pack voltage', `${fmt(sim.packVoltage(), 1)} V`],
      [state.lang === 'pt' ? 'Corrente' : 'Current', `${fmt(sim.packCurrent(), 1)} A`],
      [state.lang === 'pt' ? 'Célula mín. / máx.' : 'Cell min / max', `${fmt(cmin, 3)} / ${fmt(cmax, 3)} V`],
      [state.lang === 'pt' ? 'Potência da rede' : 'Grid power', `${fmt(s.pGrid, 1)} kW`],
      [state.lang === 'pt' ? 'Aceitação DC atual' : 'Current DC acceptance', `${fmt(sim.dcAcceptKW(), 1)} kW`],
      [state.lang === 'pt' ? 'Energia recebida' : 'Energy received', `${fmt(s.energyInKWh, 2)} kWh`],
      [state.lang === 'pt' ? 'Motor elétrico' : 'Traction motor', `${fmt(s.pMotor, 1)} kW`],
      [state.lang === 'pt' ? 'Gerador' : 'Generator', `${fmt(s.pGen, 1)} kW`],
      [state.lang === 'pt' ? 'Regeneração' : 'Regeneration', `${fmt(s.pRegen, 1)} kW`],
      [state.lang === 'pt' ? 'Consumo de combustível' : 'Fuel rate', `${fmt(s.fuelRateLh, 1)} L/h`],
      [state.lang === 'pt' ? 'Isolamento HV' : 'HV isolation', `${fmt(s.isolationOhm / 1000, 0)} kΩ`],
      [state.lang === 'pt' ? 'Saúde da bateria' : 'State of health', `${fmt(s.sohPct, 1)} %`]
    ];
    body = `<table class="vt">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  }
  $('techTitle').textContent = title; $('techMeta').textContent = meta; $('techBody').innerHTML = body;
  const lg = $('techBody').querySelector('.log'); if (lg) lg.scrollIntoView({ block: 'end' });
}
function renderObdResults() {
  const el = $('obdResults'); if (!el) return;
  const L = S();
  const keys = [...diag.requests.filter(k => PIDS[k] || DIDS[k]), ...['DTC', 'VIN'].filter(k => diag.lastByKey[k])];
  el.innerHTML = keys.map(k => { const v = diag.lastByKey[k] ?? '…'; const n = PIDS[k] ? L.pid[PIDS[k].name] : DIDS[k] ? L.pid[DIDS[k].name] : k; return `<span>${n}</span><b class="${String(v).startsWith('NRC') ? 'nrc' : ''}">${v}</b>`; }).join('');
  const bl = $('busLoad'); if (bl) bl.textContent = `${S().o.busLoad.split(' ')[0]} ${fmt(diag.busLoadPct(), 0)}%`;
}
function pulseObd() { refreshContext(true); }

/* ---------------- Tela ampliada da central ---------------- */
function openHu() { $('huModal').hidden = false; $('huLimit').value = sim.p.chargeLimit; $('huLimitOut').textContent = `${sim.p.chargeLimit}%`; }
$('huClose').addEventListener('click', () => $('huModal').hidden = true);
$('huModal').addEventListener('click', e => { if (e.target.id === 'huModal') $('huModal').hidden = true; });
$('huLimit').addEventListener('input', e => { sim.p.chargeLimit = +e.target.value; $('huLimitOut').textContent = `${sim.p.chargeLimit}%`; renderPanel(); });

/* ---------------- Tour guiado ---------------- */
const TOUR = [
  { m: 'overview', cam: 'exterior', xr: 0, ex: 'overview', set: { source: 'none', targetKmh: 0 }, soc: 0.62, labels: [] },
  { m: 'charging', cam: 'plug', xr: 1, set: { source: 'wallbox', timeScale: 20 }, soc: 0.34 },
  { m: 'charging', cam: 'plug', xr: 1, set: { source: 'dc', dcStationKW: 60, timeScale: 10 }, soc: 0.3 },
  { m: 'charging', cam: 'drive', xr: 1, set: { source: 'none', driveMode: 'hybrid', targetKmh: 20, regen: 'high', timeScale: 1 }, soc: 0.5, speed: 95, ex: 'regen', labels: ['motor', 'inv', 'batt'] },
  { m: 'charging', cam: 'engine', xr: 1, set: { source: 'none', driveMode: 'charge', targetKmh: 60, timeScale: 1 }, soc: 0.3, speed: 60, ex: 'series', labels: ['engine', 'gen', 'batt', 'tank'] },
  { m: 'obd', cam: 'obd', xr: 1, set: { driveMode: 'hybrid', targetKmh: 50, timeScale: 1 }, req: ['0D'], rate: 2, speed: 50, labels: ['obd', 'dongle'], ex: 'obd' },
  { m: 'obd', cam: 'obdNet', xr: 1, set: { gatewayBlocksDid: false, fault: 'none' }, req: ['0D', '0C', '5B'], rate: 4, labels: ['dongle', 'gw', 'vcu'], ex: 'obd' },
  { m: 'obd', cam: 'obdNet', xr: 1, set: { gatewayBlocksDid: false }, req: ['0101', '0102', '0105'], rate: 4, labels: ['dongle', 'gw', 'bms'], ex: 'obd' },
  { m: 'obd', cam: 'obdNet', xr: 1, set: { fault: 'isolation' }, req: ['DTC', '0D'], rate: 3, labels: ['dongle', 'gw', 'vcu'], ex: 'obdFault' },
  { m: 'hu', cam: 'hu', xr: 1, set: { fault: 'none', huSignals: { soc: true, power: true, speed: true, charge: true, temp: true }, bmsPeriodMs: 100, targetKmh: 60 }, labels: ['bms', 'vcu', 'gw', 'hu'], ex: 'hu' },
  { m: 'hu', cam: 'hu', xr: 1, set: { huSignals: { soc: false, power: false, speed: true, charge: true, temp: true } }, labels: ['bms', 'gw', 'hu'], ex: 'huBlocked' },
  { m: 'hu', cam: 'huClose', xr: 1, set: { huSignals: { soc: true, power: true, speed: true, charge: true, temp: true }, source: 'wallbox', targetKmh: 0 }, soc: 0.55, labels: ['hu'], ex: 'hu' }
];
const STEP_S = 11;
function startTour(i) { state.tour = { i: 0, t: 0 }; $('tourBar').hidden = false; $('btnTour').classList.add('on'); $('btnTour').textContent = S().tourStop; gotoStep(i); }
function stopTour() {
  if (!state.tour) return; state.tour = null; $('tourBar').hidden = true; $('btnTour').classList.remove('on'); $('btnTour').textContent = S().tour;
  sim.p.timeScale = 1; state.xrayAuto = true; renderPanel(); refreshContext(true);
}
function gotoStep(i) {
  i = (i + TOUR.length) % TOUR.length; const st = TOUR[i];
  state.tour = Object.assign(state.tour || {}, { i, t: 0, cam: st.cam, ex: st.ex, labels: st.labels, xr: st.xr });
  const set = Object.assign({}, st.set);
  if (set.huSignals) { sim.p.huSignals = Object.assign({}, set.huSignals); delete set.huSignals; }
  Object.assign(sim.p, set);
  if ('source' in set) stage.setSource(sim.p.source);
  if (st.soc !== undefined) sim.setSoc(st.soc);
  if (st.speed !== undefined) sim.s.speed = st.speed / 3.6;
  if (st.req) { diag.requests = st.req.slice(); diag.rateHz = st.rate || 4; }
  state.module = st.m;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === st.m)));
  $('tourCount').textContent = `${i + 1}/${TOUR.length}`;
  renderPanel();
  state.camKey = ''; refreshContext(true);
  flyCam(st.cam, true);
}

/* ---------------- Loop ---------------- */
let simT = 0, lastHud = 0, lastTech = 0, lastHu = 0, lastObd = 0;
const tmpV = new THREE.Vector3();
function frame(dt) {
  simT += dt;
  if (state.tour && !CAPTURE) { state.tour.t += dt; $('tourProg').style.width = `${Math.min(100, state.tour.t / STEP_S * 100)}%`; if (state.tour.t > STEP_S) gotoStep(state.tour.i + 1); }
  sim.step(dt); diag.step(dt);
  const s = sim.s;
  // Raio-X
  const xrTarget = state.tour ? state.tour.xr : state.xrayAuto ? (state.module === 'overview' ? 0 : 1) : (state.xrayOn ? 1 : 0);
  if (state.xrayAuto && !state.tour) $('btnXray').setAttribute('aria-pressed', String(xrTarget > 0.5));
  state.xr += (xrTarget - state.xr) * Math.min(1, dt * 2.5); if (Math.abs(state.xr - xrTarget) < 0.002) state.xr = xrTarget;
  stage.v.setXray(state.xr);
  // Veículo
  stage.v.spinWheels(s.speed * dt);
  stage.roadTex.offset.x -= s.speed * dt / (9 / 2.2);
  stage.v.setPort(s.plugConnected, s.plugConnected, dt);
  stage.v.setModules(s.soc, s.chargeState === 'charging', simT);
  stage.v.setHvGlow(Math.min(1.2, Math.abs(s.pBatt) / 40) * state.xr);
  stage.showStation(sim.p.source, dt);
  activeLabels = computeLabels();
  setFlows();
  stage.updateFlows(simT, dt);
  if (!state.tour) { const ck = camFor(); if (ck !== state.camKey) flyCam(ck); }
  const ex = state.tour?.ex || contextExplain(); if (ex !== state.explainKey) refreshContext();
  if (simT - lastHu > 1 / 15 || CAPTURE) {
    lastHu = simT; drawHU(stage.v.huCanvas, sim, diag, state.lang, simT); stage.v.huTex.needsUpdate = true;
    drawCluster(stage.v.clusterCanvas, sim, state.lang); stage.v.clusterTex.needsUpdate = true;
    if (sim.p.source === 'dc') { drawDcScreen(stage.dcScreenCanvas, sim, state.lang); stage.dcScreenTex.needsUpdate = true; }
    if (!$('huModal').hidden) $('huBig').getContext('2d').drawImage(stage.v.huCanvas, 0, 0);
  }
  if (simT - lastHud > 0.2) { lastHud = simT; renderHud(); const o = $('oSoc'); if (o && document.activeElement?.id !== 'rSoc') { o.textContent = `${Math.round(s.soc * 100)}%`; const r = $('rSoc'); r.value = Math.round(s.soc * 100); r.style.setProperty('--p', `${(r.value - 5) / 95 * 100}%`); } }
  if (simT - lastTech > 0.25) { lastTech = simT; renderTech(); }
  if (simT - lastObd > 0.3) { lastObd = simT; renderObdResults(); }
  stage.update(dt);
  stage.render();
  updateLabels();
}

window.__dbg = { stage, sim, diag, state };
applyI18n();
setModule('overview');
stage.snapTo(...CAMS.overview.map(v => v.clone()));
state.camKey = 'overview';

if (CAPTURE) {
  const n = +GIFM[1];
  window.__frame = dt => frame(dt);
  startTour(n); state.tour.t = 0;
  const [pos, tgt] = CAMS[TOUR[n].cam]; stage.snapTo(pos, tgt);
  if (TOUR[n].xr !== undefined) { state.xr = TOUR[n].xr; }
  window.__labels = () => activeLabels.map(k => { const l = labelEls[k]; const d = l.el.querySelector('.dot').getBoundingClientRect(), b = l.el.querySelector('.box').getBoundingClientRect(); return { key: k, t: l.el.querySelector('.t').textContent, s: l.el.querySelector('.s').textContent, c: getComputedStyle(l.el).getPropertyValue('--c').trim(), left: l.el.classList.contains('left'), x: d.left + d.width / 2, y: d.top + d.height / 2, box: { l: b.left, t: b.top, w: b.width, h: b.height } }; });
  window.__snap = () => ({ step: n, module: state.module, tabs: S().tabs, kicker: $('exKicker').textContent, title: $('exTitle').textContent, text: $('exText').textContent, hud: [...$('hud').querySelectorAll('.m')].map(m => [m.querySelector('span').textContent, m.querySelector('b').textContent]), soc: sim.s.soc, tech: state.module === 'obd' ? diag.log.filter(e => e.kind === 'diag').slice(-6).map(e => `${e.dir === 'tx' ? '→' : '←'} ${e.id}  ${Diagnostics.fmt(e.bytes)}`) : [] });
  window.__ready = true;
} else {
  if (hash === 'tour') startTour(0);
  let last = performance.now();
  const loop = now => { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; frame(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
