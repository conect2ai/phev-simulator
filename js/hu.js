// Desenho da tela da central multimídia e do painel de instrumentos (canvas 2D usado como textura)
const F = { d: '"Sora", "Segoe UI", sans-serif', b: '"IBM Plex Sans", "Segoe UI", sans-serif', m: '"IBM Plex Mono", ui-monospace, monospace' };
const T = {
  pt: { energy: 'Energia', range: 'autonomia elétrica', battery: 'bateria', unavailable: 'sinal indisponível', charging: 'Recarregando', done: 'Limite atingido', fault: 'Recarga bloqueada', idle: 'Desconectado', plugged: 'Conectado',
    toLimit: 'até o limite', limit: 'Limite de recarga', grid: 'Rede', batt: 'Bateria', engine: 'Motor 1.5', motor: 'Motor elétrico', wheels: 'Rodas', ev: 'Elétrico', hybrid: 'Híbrido', charge: 'Recarga', packT: 'temp. da bateria', mil: 'Verifique o sistema híbrido' },
  en: { energy: 'Energy', range: 'electric range', battery: 'battery', unavailable: 'signal unavailable', charging: 'Charging', done: 'Limit reached', fault: 'Charging blocked', idle: 'Unplugged', plugged: 'Plugged in',
    toLimit: 'to limit', limit: 'Charge limit', grid: 'Grid', batt: 'Battery', engine: '1.5 engine', motor: 'E-motor', wheels: 'Wheels', ev: 'Electric', hybrid: 'Hybrid', charge: 'Charge', packT: 'battery temp.', mil: 'Check hybrid system' }
};
const fmt = (v, d, lang) => v.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hhmm(s) { const m = Math.max(0, Math.round(s / 60)); const h = Math.floor(m / 60); return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; }

export function drawHU(canvas, sim, diag, lang, t) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, L = T[lang];
  const b = diag.bcast, st = sim.s;
  g.fillStyle = '#070b0d'; g.fillRect(0, 0, W, H);
  const bgr = g.createRadialGradient(W * 0.25, H * 0.55, 20, W * 0.25, H * 0.55, 520); bgr.addColorStop(0, 'rgba(0,170,208,0.12)'); bgr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = bgr; g.fillRect(0, 0, W, H);
  // Barra de status
  g.fillStyle = '#0e1418'; g.fillRect(0, 0, W, 64);
  g.fillStyle = '#e6eef1'; g.font = `600 28px ${F.d}`; g.fillText(L.energy, 36, 43);
  g.font = `500 24px ${F.m}`; g.fillStyle = '#9fb2b9'; g.textAlign = 'right';
  g.fillText(`${Math.round(sim.p.ambientC)} °C`, W - 36, 42); g.textAlign = 'left';
  if (st.mil) { g.fillStyle = '#f0a43c'; g.font = `600 22px ${F.b}`; g.fillText('⚠ ' + L.mil, 260, 42); }
  // Anel de SoC
  const cx = 250, cy = 360, R = 170;
  g.lineWidth = 26; g.strokeStyle = '#16232a'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  if (b.soc !== null) {
    const grd = g.createLinearGradient(cx - R, cy, cx + R, cy); grd.addColorStop(0, '#0089a8'); grd.addColorStop(1, '#3fe0ff');
    g.strokeStyle = grd; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.soc); g.stroke(); g.lineCap = 'butt';
    if (b.charge && b.charge.state === 'charging') { const a = -Math.PI / 2 + Math.PI * 2 * b.soc; g.fillStyle = '#bff4ff'; g.beginPath(); g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 9 + 4 * Math.sin(t * 6), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#f2f8fa'; g.font = `700 92px ${F.d}`; g.textAlign = 'center'; g.fillText(`${Math.round(b.soc * 100)}%`, cx, cy + 22);
    g.font = `400 24px ${F.b}`; g.fillStyle = '#8fa6ad'; g.fillText(`${Math.round(sim.v.evRangeKm * b.soc * st.sohPct / 100)} km · ${L.range}`, cx, cy + 66);
  } else {
    g.fillStyle = '#5d6d72'; g.font = `700 92px ${F.d}`; g.textAlign = 'center'; g.fillText('—', cx, cy + 26);
    g.font = `400 22px ${F.b}`; g.fillText(L.unavailable, cx, cy + 66);
  }
  g.textAlign = 'left';
  // Diagrama de fluxo
  const N = { grid: [640, 170], batt: [640, 400], engine: [1000, 170], motor: [1000, 400], wheels: [1000, 600] };
  const links = [];
  const pw = b.power;
  if (b.charge && b.charge.plugged) links.push(['grid', 'batt', '#00aad0', b.charge.state === 'charging']);
  if (!st.plugConnected) {
    if (st.engineOn) { links.push(['engine', 'motor', '#f0a43c', true]); if (st.pGen > st.pMotor) links.push(['engine', 'batt', '#f0a43c', true]); }
    if (st.pRegen > 0.5) links.push(['wheels', 'motor', '#00aad0', true], ['motor', 'batt', '#00aad0', true]);
    else if (st.pMotor > 0.5) { if (!st.engineOn || st.pBatt < 0) links.push(['batt', 'motor', '#00aad0', true]); links.push(['motor', 'wheels', '#00aad0', true]); }
  }
  g.lineWidth = 5;
  links.forEach(([a, c, col, live]) => {
    const A = N[a], B = N[c]; const ok = pw !== null;
    g.strokeStyle = ok ? col + '66' : '#2a3338'; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    if (ok && live) for (let k = 0; k < 5; k++) { const u = (t * 0.7 + k / 5) % 1; g.fillStyle = col; g.beginPath(); g.arc(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, 8, 0, Math.PI * 2); g.fill(); }
  });
  const node = (k, label) => { const [x, y] = N[k]; g.fillStyle = '#101b20'; g.strokeStyle = '#27414a'; g.lineWidth = 2; rr(g, x - 110, y - 40, 220, 80, 16); g.fill(); g.stroke(); g.fillStyle = '#dbe7ea'; g.font = `500 26px ${F.b}`; g.textAlign = 'center'; g.fillText(label, x, y + 9); g.textAlign = 'left'; };
  node('grid', L.grid); node('batt', L.batt); node('engine', L.engine); node('motor', L.motor); node('wheels', L.wheels);
  g.font = `600 30px ${F.m}`; g.fillStyle = pw !== null ? '#f2f8fa' : '#5d6d72'; g.textAlign = 'center';
  g.fillText(pw !== null ? `${pw >= 0 ? '+' : '−'}${fmt(Math.abs(pw), 1, lang)} kW` : '—', 640, 478);
  g.textAlign = 'left';
  // Cartão de recarga
  const cy2 = 560; g.fillStyle = '#0e171b'; g.strokeStyle = '#21363d'; g.lineWidth = 2; rr(g, 470, cy2, 400, 130, 18); g.fill(); g.stroke();
  g.font = `600 24px ${F.b}`; g.fillStyle = '#e6eef1';
  const cs = b.charge;
  g.fillText(cs ? (cs.state === 'charging' ? L.charging : cs.state === 'done' ? L.done : cs.state === 'fault' ? L.fault : cs.plugged ? L.plugged : L.idle) : '—', 494, cy2 + 40);
  g.font = `400 21px ${F.b}`; g.fillStyle = '#8fa6ad';
  g.fillText(cs && cs.state === 'charging' ? `${hhmm(cs.tts)} ${L.toLimit}` : (b.temp !== null ? `${fmt(b.temp, 1, lang)} °C · ${L.packT}` : ''), 494, cy2 + 74);
  g.fillText(`${L.limit} ${sim.p.chargeLimit}%`, 494, cy2 + 108);
  g.fillStyle = '#1c2a30'; rr(g, 690, cy2 + 96, 150, 10, 5); g.fill(); g.fillStyle = '#00aad0'; rr(g, 690, cy2 + 96, 150 * sim.p.chargeLimit / 100, 10, 5); g.fill();
  // Velocidade
  g.font = `400 22px ${F.b}`; g.fillStyle = '#8fa6ad'; g.textAlign = 'right';
  g.fillText(b.speed !== null ? `${Math.round(b.speed * 3.6)} km/h` : '— km/h', W - 40, H - 30); g.textAlign = 'left';
}

export function drawCluster(canvas, sim, lang) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, st = sim.s, L = T[lang];
  g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2f8fa'; g.font = `700 104px ${F.d}`; g.textAlign = 'center'; g.fillText(Math.round(st.speed * 3.6), W / 2, 140);
  g.font = `400 26px ${F.b}`; g.fillStyle = '#8fa6ad'; g.fillText('km/h', W / 2, 180);
  g.textAlign = 'left'; g.fillStyle = '#1c2a30'; rr(g, 40, 200, 220, 14, 7); g.fill(); g.fillStyle = '#00aad0'; rr(g, 40, 200, 220 * st.soc, 14, 7); g.fill();
  g.font = `500 24px ${F.m}`; g.fillStyle = '#d8e4e8'; g.fillText(`${Math.round(st.soc * 100)}%`, 40, 190);
  g.textAlign = 'right'; g.fillText(sim.p.driveMode === 'ev' ? L.ev : sim.p.driveMode === 'charge' ? L.charge : L.hybrid, W - 40, 190);
  if (st.mil) { g.fillStyle = '#f0a43c'; g.beginPath(); g.arc(W - 70, 60, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#05080a'; g.font = `700 28px ${F.d}`; g.textAlign = 'center'; g.fillText('!', W - 70, 70); }
  g.textAlign = 'left';
}

export function drawDcScreen(canvas, sim, lang) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, st = sim.s;
  g.fillStyle = '#071318'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3fe0ff'; g.font = `700 64px ${F.d}`; g.textAlign = 'center'; g.fillText(`${Math.round(st.soc * 100)}%`, W / 2, 110);
  g.fillStyle = '#cfe6ec'; g.font = `500 34px ${F.m}`; g.fillText(`${fmt(Math.max(0, st.pGrid), 1, lang)} kW`, W / 2, 170);
  g.font = `400 24px ${F.b}`; g.fillStyle = '#86a3ab'; g.fillText(lang === 'pt' ? 'CCS2 · em recarga' : 'CCS2 · charging', W / 2, 215); g.textAlign = 'left';
}
