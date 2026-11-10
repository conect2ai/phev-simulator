// SUV híbrido plug-in original, modelado de forma procedural com as dimensões de referência
// (4.740 x 1.905 x 1.685 mm, entre-eixos 2.755 mm). Eixo x aponta para a frente, y para cima.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const L = 2.37, WMAX = 0.935;
export const AXLE_F = 1.33, AXLE_R = -1.425, TRACK = 0.81, WHEEL_R = 0.359;

// Interpolação Catmull-Rom 1D por pontos de controle [x, y]
function curve1d(pts) {
  return x => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

const bottomBase = curve1d([[-2.37, 0.56], [-2.25, 0.4], [-2.0, 0.24], [-1.7, 0.2], [1.75, 0.2], [2.05, 0.26], [2.28, 0.38], [2.37, 0.5]]);
const topLine = curve1d([[-2.37, 0.98], [-2.3, 1.06], [-2.1, 1.1], [-1.4, 1.085], [-0.4, 1.06], [0.9, 1.02], [1.45, 0.985], [1.95, 0.95], [2.2, 0.9], [2.33, 0.82], [2.37, 0.72]]);
const roofLine = curve1d([[-2.27, 1.1], [-2.18, 1.3], [-2.0, 1.5], [-1.7, 1.6], [-1.1, 1.655], [-0.3, 1.665], [0.15, 1.6], [0.55, 1.36], [0.92, 1.03]]);
const XG0 = -2.27, XG1 = 0.92;

function archLift(x) {
  let y = -1;
  for (const ax of [AXLE_F, AXLE_R]) {
    const dx = Math.abs(x - ax), r = 0.455;
    if (dx < r) y = Math.max(y, WHEEL_R + Math.sqrt(r * r - dx * dx) * 1.0);
  }
  return y;
}
export function planW(x) {
  const p = x > 0 ? 4.4 : 6.5;
  const u = Math.min(1, Math.abs(x) / L);
  return WMAX * Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
}
function bottomAt(x) { return Math.max(bottomBase(x), archLift(x)); }
const NEXP = 5;
function sectionParams(x) { const b = bottomAt(x), t = topLine(x); return { b, t, yc: (b + t) / 2, H: Math.max(0.01, (t - b) / 2), W: planW(x) }; }
function tumble(y, b, t) { const k = (y - b) / Math.max(0.01, t - b); return 1 - 0.075 * Math.pow(Math.max(0, (k - 0.55) / 0.45), 2) - 0.03 * Math.pow(Math.max(0, (0.25 - k) / 0.25), 2); }

// Meia-largura da carroceria inferior na altura y, na estação x
export function halfWidthAt(x, y) {
  const { b, t, yc, H, W } = sectionParams(x);
  const r = Math.abs((y - yc) / H);
  if (r >= 1) return 0;
  return W * Math.pow(1 - Math.pow(r, NEXP), 1 / NEXP) * tumble(y, b, t);
}
export function surfacePoint(x, y, side = -1, off = 0.004) { return V3(x, y, side * (halfWidthAt(x, y) + off)); }
function frontX(z, y, front = true) { // procura x da superfície frontal/traseira para (y, z)
  let a = front ? 1.4 : -2.37, b = front ? 2.37 : -1.4;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2, w = halfWidthAt(m, y);
    if (front) { if (w > Math.abs(z)) a = m; else b = m; } else { if (w > Math.abs(z)) b = m; else a = m; }
  }
  return (a + b) / 2;
}

function stations(n, x0, x1) {
  const out = [];
  for (let i = 0; i <= n; i++) { const u = i / n; out.push(x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * u))); }
  return out;
}

// Malha por seções: secFn(x) devolve pontos [z, y] de um anel completo
function loft(xs, secFn, closed = true) {
  const rings = xs.map(x => secFn(x)), m = rings[0].length;
  const pos = [], uv = [], idx = [];
  rings.forEach((ring, i) => ring.forEach(([z, y], j) => { pos.push(xs[i], y, z); uv.push(i / (xs.length - 1), j / (m - 1)); }));
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < (closed ? m : m - 1); j++) {
    const a = i * m + j, b = i * m + (j + 1) % m, c = (i + 1) * m + j, d = (i + 1) * m + (j + 1) % m;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function lowerSection(x) {
  const { b, t, yc, H, W } = sectionParams(x), M = 36, half = [];
  for (let k = 0; k <= M; k++) {
    const th = -Math.PI / 2 + Math.PI * k / M;
    const c = Math.cos(th), s = Math.sin(th);
    const y = yc + H * Math.sign(s) * Math.pow(Math.abs(s), 2 / NEXP);
    const z = W * Math.pow(Math.abs(c), 2 / NEXP) * tumble(y, b, t);
    half.push([z, y + (k === M ? 0.012 * (1 - Math.pow(Math.abs(x) / L, 2)) : 0)]);
  }
  const ring = half.slice();
  for (let k = M - 1; k > 0; k--) ring.push([-half[k][0], half[k][1]]);
  return ring;
}
function greenhouseHalf(x, inset = 0, roofOnly = false) {
  const yb = topLine(x) - 0.006, yr = Math.max(yb, roofLine(x));
  const W = planW(x), Wb = W * 0.95 - inset, Wt = W * 0.74 - inset;
  const hgt = yr - yb, rad = Math.min(0.06, hgt * 0.45);
  const half = [];
  if (!roofOnly) for (let k = 0; k <= 10; k++) { const s = k / 10; half.push([Wb + (Wt - Wb) * Math.pow(s, 1.25), yb + (yr - rad - yb) * s]); }
  for (let k = roofOnly ? 0 : 1; k <= 12; k++) {
    const a = k / 12;
    half.push([Wt * Math.pow(Math.cos(a * Math.PI / 2), 0.55), yr - rad + (rad + 0.02) * Math.pow(Math.sin(a * Math.PI / 2), 0.6) + inset * 0.6]);
  }
  return half;
}
function greenhouseBand(x, s0, inset) {
  const full = greenhouseHalf(x, inset); return full.slice(Math.round(s0 * 10));
}
function sideStrip(x, s0, s1, side, inset) {
  const yb = topLine(x) - 0.006, yr = Math.max(yb, roofLine(x));
  const W = planW(x), Wb = W * 0.95 - inset, Wt = W * 0.74 - inset, rad = Math.min(0.06, (yr - yb) * 0.45);
  const pts = [];
  for (let k = 0; k <= 8; k++) { const s = s0 + (s1 - s0) * k / 8; pts.push([side * (Wb + (Wt - Wb) * Math.pow(s, 1.25)), yb + (yr - rad - yb) * s]); }
  return side > 0 ? pts : pts.reverse();
}
function mirrorRing(half) { const r = half.slice(); for (let k = half.length - 2; k >= 0; k--) r.push([-half[k][0], half[k][1]]); return r; }

// Fresnel para o modo raio-X
export function xrayMaterial(color = 0x8fd9ea) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 2.4); float a = (0.012 + f*0.42)*uOpacity; gl_FragColor = vec4(uColor*(0.3+f*1.9), a); }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide
  });
}

function tube(points, r, mat, seg = 64, rs = 10) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), seg, r, rs), mat); }
function rbox(w, h, d, r, mat, s = 3) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, s, r), mat); }
function ribbon(pathA, pathB, mat) {
  const pos = [], idx = [], n = pathA.length;
  for (let i = 0; i < n; i++) { pos.push(...pathA[i].toArray(), ...pathB[i].toArray()); }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function frontRow(y, z0, z1, n, front, off) {
  const out = [];
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; out.push(V3(frontX(z, y, front) + (front ? off : -off), y, z)); }
  return out;
}

function tireGeometry() {
  const R = WHEEL_R, w = 0.118, pts = [];
  const prof = [[0.244, -0.104], [0.27, -0.112], [0.31, -0.117], [0.338, -0.114], [0.351, -0.106], [0.357, -0.094], [0.359, -0.07], [0.3595, 0]];
  prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r * R / 0.359, y * w / 0.117)));
  for (let i = prof.length - 2; i >= 0; i--) pts.push(new THREE.Vector2(prof[i][0], -prof[i][1] * w / 0.117));
  const g = new THREE.LatheGeometry(pts, 72); g.rotateX(Math.PI / 2); return g;
}
function rimGeometry() {
  const s = new THREE.Shape(); s.absarc(0, 0, 0.236, 0, Math.PI * 2, false);
  const r1 = 0.078, r2 = 0.205;
  for (let k = 0; k < 5; k++) {
    const a0 = k * Math.PI * 2 / 5 + Math.PI / 2, span = Math.PI * 2 / 5;
    const din = 0.27, dout = 0.115, h = new THREE.Path();
    h.absarc(0, 0, r2, a0 + dout, a0 + span - dout, false);
    h.lineTo(Math.cos(a0 + span - din) * r1, Math.sin(a0 + span - din) * r1);
    h.absarc(0, 0, r1, a0 + span - din, a0 + din, true);
    h.lineTo(Math.cos(a0 + dout) * r2, Math.sin(a0 + dout) * r2);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 48 });
  return g;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export const PAINTS = { silver: 0xb9bec4, blue: 0x2c4d6e, white: 0xe9ebec, graphite: 0x3a3e43 };

export function buildVehicle() {
  const car = new THREE.Group(); car.name = 'vehicle';
  const exterior = new THREE.Group(), interior = new THREE.Group(), powertrain = new THREE.Group(), electronics = new THREE.Group();
  car.add(exterior, interior, powertrain, electronics);
  const fadeables = []; // materiais externos que desaparecem no raio-X
  const reg = (mesh, opts = {}) => { mesh.castShadow = opts.cast !== false; mesh.receiveShadow = !!opts.receive; return mesh; };

  // Materiais
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: PAINTS.silver, metalness: 0.75, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x10171c, metalness: 0.45, roughness: 0.02, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.8, depthWrite: false }),
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, metalness: 0.35, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.72, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd6dade, roughness: 0.12, metalness: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.88, metalness: 0 }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0xc7cbd0, roughness: 0.22, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.45, metalness: 0.9 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6d7074, roughness: 0.38, metalness: 1 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.4, metalness: 0.6 }),
    drl: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(1.6) }),
    lamp: new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.05, 0.04).multiplyScalar(1.6) }),
    liner: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.95, side: THREE.DoubleSide }),
    seat: new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x1b1a1a, roughness: 0.55 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.32, metalness: 1 }),
    cast: new THREE.MeshStandardMaterial({ color: 0x4a4e53, roughness: 0.5, metalness: 0.85 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.6, metalness: 0.05 }),
    hv: new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.42, metalness: 0.05, emissive: 0xff5a00, emissiveIntensity: 0.0 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb8733a, roughness: 0.35, metalness: 1 }),
    ecu: new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.45, metalness: 0.6, emissive: 0xa99bff, emissiveIntensity: 0 }),
    can: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa99bff), transparent: true, opacity: 0.0, depthWrite: false })
  };

  // Carroceria
  const bodyGeo = loft(stations(140, -L, L), lowerSection);
  const body = reg(new THREE.Mesh(bodyGeo, M.paint)); exterior.add(body);
  const bodyX = new THREE.Mesh(bodyGeo, xrayMaterial()); bodyX.renderOrder = 10; car.add(bodyX);
  const ghXs = stations(90, XG0, XG1);
  const ghGeo = loft(ghXs, x => mirrorRing(greenhouseHalf(x)), false);
  const glass = new THREE.Mesh(ghGeo, M.glass); glass.renderOrder = 5; exterior.add(glass);
  const glassX = new THREE.Mesh(ghGeo, xrayMaterial()); glassX.renderOrder = 11; car.add(glassX);
  const roofGeo = loft(stations(70, -2.02, 0.32), x => mirrorRing(greenhouseBand(x, 0.86, -0.004)), false);
  const roof = reg(new THREE.Mesh(roofGeo, M.gloss)); exterior.add(roof);
  [-1, 1].forEach(side => {
    const band = (x0, x1, s0, s1, n, mat) => { const g = loft(stations(n, x0, x1), x => sideStrip(x, s0, s1, side, -0.005), false); const m = reg(new THREE.Mesh(g, mat)); exterior.add(m); };
    band(0.3, 0.9, 0.7, 1.0, 30, M.gloss);           // coluna A
    band(-0.44, -0.33, 0, 1.0, 6, M.gloss);          // coluna B
    band(-2.24, -1.7, 0, 1.0, 30, M.paint);          // coluna D
    band(-1.7, -1.62, 0, 1.0, 4, M.gloss);           // moldura traseira
  });

  // Linha cromada da janela e barras de teto
  [-1, 1].forEach(side => {
    const pts = []; for (let i = 0; i <= 40; i++) { const x = XG0 + 0.18 + (XG1 - 0.12 - XG0 - 0.18) * i / 40; pts.push(V3(x, topLine(x) - 0.004, side * (planW(x) * 0.95 + 0.004))); }
    exterior.add(tube(pts, 0.007, M.chrome, 80, 6));
    const rr = []; for (let i = 0; i <= 20; i++) { const x = -1.75 + 1.85 * i / 20; rr.push(V3(x, roofLine(x) + 0.035, side * planW(x) * 0.62)); }
    exterior.add(reg(tube(rr, 0.016, M.trim, 40, 8)));
    // Vincos das portas
    [0.93, -0.38, -1.42].forEach(xs => {
      const d = []; for (let i = 0; i <= 16; i++) { const y = bottomAt(xs) + 0.06 + (topLine(xs) - 0.03 - bottomAt(xs) - 0.06) * i / 16; d.push(surfacePoint(xs, y, side, 0.0015)); }
      exterior.add(tube(d, 0.0028, M.liner, 24, 4));
    });
    // Maçanetas embutidas
    [0.32, -0.72].forEach(xh => { const h = rbox(0.17, 0.025, 0.012, 0.006, M.chrome); h.position.copy(surfacePoint(xh, 0.99, side, 0.004)); exterior.add(h); });
    // Retrovisores
    const mx = 0.78, my = 1.1, mz = side * (planW(mx) * 0.95 + 0.11);
    const mirror = reg(rbox(0.18, 0.11, 0.2, 0.045, M.gloss)); mirror.position.set(mx, my, mz); exterior.add(mirror);
    const arm = rbox(0.08, 0.03, 0.12, 0.012, M.trim); arm.position.set(mx + 0.02, my - 0.04, side * (planW(mx) * 0.95 + 0.03)); exterior.add(arm);
    const turn = rbox(0.12, 0.008, 0.02, 0.003, M.drl); turn.position.set(mx + 0.04, my - 0.05, mz + side * 0.09); exterior.add(turn);
    // Revestimento das caixas de roda e soleira
    [AXLE_F, AXLE_R].forEach(ax => {
      const arc = []; for (let i = 0; i <= 30; i++) { const a = Math.PI * 0.06 + Math.PI * 0.88 * i / 30; const x = ax + Math.cos(a) * 0.47, y = WHEEL_R + Math.sin(a) * 0.47; arc.push(V3(x, y, side * (halfWidthAt(x, Math.max(y, bottomAt(x) + 0.02)) + 0.006))); }
      exterior.add(reg(tube(arc, 0.03, M.trim, 50, 8)));
      const lin = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 32, 1, true, 0, Math.PI), M.liner);
      lin.rotation.x = Math.PI / 2; lin.rotation.y = Math.PI / 2; lin.position.set(ax, WHEEL_R, side * 0.76); exterior.add(lin);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32, 0, Math.PI), M.liner); disc.position.set(ax, WHEEL_R, side * 0.59); exterior.add(disc);
    });
    const sill = []; const sillB = [];
    for (let i = 0; i <= 30; i++) { const x = AXLE_R + 0.47 + (AXLE_F - 0.47 - AXLE_R - 0.47) * i / 30; sill.push(surfacePoint(x, bottomAt(x) + 0.045, side, 0.004)); sillB.push(surfacePoint(x, bottomAt(x) + 0.16, side, 0.004)); }
    const sm = ribbon(side < 0 ? sillB : sill, side < 0 ? sill : sillB, M.trim); exterior.add(sm);
  });
  // Assoalho/proteção entre as rodas (fecha o vão visto de baixo)
  [AXLE_F, AXLE_R].forEach(ax => { const ut = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 1.18), M.liner); ut.position.set(ax, 0.2, 0); exterior.add(ut); });

  // Iluminação frontal e traseira
  const drlPts = frontRow(0.865, -0.84, 0.84, 50, true, 0.006);
  exterior.add(tube(drlPts, 0.0055, M.drl, 100, 6));
  [-1, 1].forEach(side => {
    const hl0 = frontRow(0.8, side * 0.86, side * 0.56, 12, true, 0.004), hl1 = frontRow(0.84, side * 0.86, side * 0.56, 12, true, 0.004);
    exterior.add(ribbon(side > 0 ? hl1 : hl0, side > 0 ? hl0 : hl1, M.lamp));
    for (let k = 0; k < 3; k++) { const z = side * (0.62 + k * 0.075); const p = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), M.drl); p.position.set(frontX(z, 0.818, true) + 0.008, 0.818, z); p.rotation.y = Math.PI / 2; exterior.add(p); }
  });
  const g0 = frontRow(0.44, -0.64, 0.64, 30, true, 0.004), g1 = frontRow(0.7, -0.64, 0.64, 30, true, 0.004);
  const grilleTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#060708'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2d31'; g.lineWidth = 2; for (let x = 0; x < w; x += 10) for (let y = 0; y < h; y += 10) { g.beginPath(); g.moveTo(x + (y / 10 % 2) * 5, y); g.lineTo(x + 5 + (y / 10 % 2) * 5, y + 5); g.stroke(); } }, [6, 1]);
  const grille = ribbon(g1, g0, new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.4, metalness: 0.4 })); exterior.add(grille);
  const lip0 = frontRow(0.27, -0.74, 0.74, 30, true, 0.004), lip1 = frontRow(0.38, -0.74, 0.74, 30, true, 0.004);
  exterior.add(ribbon(lip1, lip0, M.trim));
  const tl = frontRow(1.0, -0.86, 0.86, 50, false, 0.006);
  exterior.add(tube(tl, 0.011, M.tail, 100, 6));
  const tl0 = frontRow(0.965, -0.88, 0.88, 40, false, 0.003), tl1 = frontRow(1.035, -0.88, 0.88, 40, false, 0.003);
  exterior.add(ribbon(tl0, tl1, M.lamp));
  const rb0 = frontRow(0.3, -0.8, 0.8, 30, false, 0.004), rb1 = frontRow(0.44, -0.8, 0.8, 30, false, 0.004);
  exterior.add(ribbon(rb0, rb1, M.trim));

  // Rodas
  const tireGeo = tireGeometry(), rimGeo = rimGeometry();
  const wheels = [];
  [[AXLE_F, -1], [AXLE_F, 1], [AXLE_R, -1], [AXLE_R, 1]].forEach(([x, side]) => {
    const w = new THREE.Group(); w.position.set(x, WHEEL_R, side * TRACK);
    const spin = new THREE.Group(); w.add(spin);
    spin.add(reg(new THREE.Mesh(tireGeo, M.tire)));
    const rim = reg(new THREE.Mesh(rimGeo, M.rim)); rim.position.z = side * 0.062; if (side < 0) rim.rotation.y = Math.PI; spin.add(rim);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.237, 0.237, 0.2, 48, 1, true), M.rimDark); barrel.rotation.x = Math.PI / 2; spin.add(barrel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 32), M.rimDark); hub.rotation.x = Math.PI / 2; hub.position.z = side * 0.07; spin.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24), M.chrome); cap.rotation.x = Math.PI / 2; cap.position.z = side * 0.098; spin.add(cap);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 10), M.chrome); n.rotation.x = Math.PI / 2; n.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, side * 0.092); spin.add(n); }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.026, 48), M.disc); disc.rotation.x = Math.PI / 2; disc.position.z = side * 0.0; spin.add(disc);
    const cal = rbox(0.1, 0.16, 0.07, 0.02, M.caliper); cal.position.set(-0.12, 0.09, side * 0.01); w.add(cal);
    car.add(w); wheels.push({ group: w, spin, side, x });
  });

  // Interior
  const dash = reg(rbox(0.42, 0.2, 1.62, 0.07, M.dash)); dash.position.set(0.74, 0.96, 0); interior.add(dash);
  const console_ = rbox(0.9, 0.18, 0.22, 0.05, M.dash); console_.position.set(0.05, 0.62, 0); interior.add(console_);
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 12, 48), M.dash); steer.position.set(0.47, 1.0, -0.4); steer.rotation.y = Math.PI / 2; steer.rotation.x = 0; steer.rotateX(-0.42); interior.add(steer);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 12), M.dash); column.position.set(0.58, 0.94, -0.4); column.rotation.z = Math.PI / 2 - 0.42; interior.add(column);
  [[-0.05, -0.4], [-0.05, 0.4]].forEach(([x, z]) => {
    const cush = rbox(0.52, 0.13, 0.5, 0.05, M.seat); cush.position.set(x, 0.6, z); interior.add(cush);
    const back = rbox(0.13, 0.66, 0.5, 0.05, M.seat); back.position.set(x - 0.28, 0.95, z); back.rotation.z = 0.2; interior.add(back);
    const head = rbox(0.1, 0.16, 0.26, 0.04, M.seat); head.position.set(x - 0.38, 1.38, z); head.rotation.z = 0.2; interior.add(head);
  });
  const bench = rbox(0.5, 0.13, 1.3, 0.05, M.seat); bench.position.set(-1.0, 0.6, 0); interior.add(bench);
  const benchB = rbox(0.13, 0.62, 1.3, 0.05, M.seat); benchB.position.set(-1.27, 0.93, 0); benchB.rotation.z = 0.18; interior.add(benchB);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 1.5), M.dash); floor.position.set(-0.3, 0.42, 0); interior.add(floor);

  // Tela da central multimídia (textura atualizada pela aplicação)
  const huCanvas = document.createElement('canvas'); huCanvas.width = 1280; huCanvas.height = 720;
  const huTex = new THREE.CanvasTexture(huCanvas); huTex.colorSpace = THREE.SRGBColorSpace; huTex.anisotropy = 8;
  const huScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2025), new THREE.MeshBasicMaterial({ map: huTex, toneMapped: true, color: 0xd0d0d0 }));
  huScreen.position.set(0.555, 1.16, 0.08); huScreen.rotation.y = -Math.PI / 2; huScreen.rotateX(-0.12); interior.add(huScreen);
  const huBezel = rbox(0.022, 0.215, 0.375, 0.008, M.gloss); huBezel.position.set(0.566, 1.16, 0.08); huBezel.rotation.z = -0.12; interior.add(huBezel);
  const clusterCanvas = document.createElement('canvas'); clusterCanvas.width = 640; clusterCanvas.height = 240;
  const clusterTex = new THREE.CanvasTexture(clusterCanvas); clusterTex.colorSpace = THREE.SRGBColorSpace;
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.1), new THREE.MeshBasicMaterial({ map: clusterTex, toneMapped: true }));
  cluster.position.set(0.62, 1.12, -0.4); cluster.rotation.y = -Math.PI / 2; cluster.rotateX(-0.2); interior.add(cluster);

  // Bateria de alta tensão
  const pack = new THREE.Group(); powertrain.add(pack);
  const packCase = reg(rbox(1.92, 0.13, 1.36, 0.03, M.alu)); packCase.position.set(-0.08, 0.27, 0); pack.add(packCase);
  const packLid = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.008, 1.3), new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.5, metalness: 0.9, transparent: true, opacity: 0.25 })); packLid.position.set(-0.08, 0.34, 0); pack.add(packLid);
  const modules = [];
  for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.205, 0.075, 0.6, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x1c3a44, roughness: 0.4, metalness: 0.5, emissive: 0x00aad0, emissiveIntensity: 0 }));
    m.position.set(-0.08 - 0.84 + i * 0.24, 0.3, k ? 0.33 : -0.33); m.userData.i = i; pack.add(m); modules.push(m);
  }
  const busbar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.012, 0.03), M.copper); busbar.position.set(-0.08, 0.345, 0); pack.add(busbar);
  const bms = rbox(0.16, 0.06, 0.2, 0.012, M.ecu.clone()); bms.position.set(-1.1, 0.33, 0.42); electronics.add(bms);

  // Trem de força dianteiro
  const engine = new THREE.Group(); engine.position.set(1.74, 0.6, 0.18); powertrain.add(engine);
  const block = reg(rbox(0.32, 0.34, 0.5, 0.03, M.alu)); engine.add(block);
  const head = reg(rbox(0.28, 0.12, 0.5, 0.03, M.cast)); head.position.y = 0.23; engine.add(head);
  const cover = rbox(0.24, 0.05, 0.46, 0.02, M.plastic); cover.position.y = 0.31; engine.add(cover);
  for (let k = 0; k < 4; k++) { const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), M.plastic); coil.position.set(0, 0.35, -0.18 + k * 0.12); engine.add(coil); }
  const plenum = rbox(0.1, 0.12, 0.46, 0.04, M.plastic); plenum.position.set(-0.24, 0.2, 0); engine.add(plenum);
  for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16, Math.PI * 0.6), M.plastic); r.position.set(-0.17, 0.2, -0.18 + k * 0.12); r.rotation.z = Math.PI * 0.2; engine.add(r); }
  const exhMan = []; for (let k = 0; k < 4; k++) exhMan.push(V3(1.9, 0.72, 0.0 + k * 0.12));
  const exhaust = tube([V3(1.92, 0.7, 0.18), V3(2.0, 0.5, 0.2), V3(1.85, 0.25, 0.3), V3(1.0, 0.17, 0.34), V3(-0.9, 0.17, 0.36), V3(-1.75, 0.2, 0.34), V3(-2.05, 0.26, 0.42), V3(-2.3, 0.3, 0.45)], 0.03, M.cast, 120, 10);
  powertrain.add(exhaust);
  const muffler = reg(rbox(0.42, 0.14, 0.3, 0.06, M.cast)); muffler.position.set(-1.95, 0.24, 0.42); powertrain.add(muffler);
  const dht = reg(rbox(0.42, 0.38, 0.36, 0.06, M.cast)); dht.position.set(1.36, 0.47, -0.26); powertrain.add(dht);
  const motor = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.24, 40), M.alu)); motor.rotation.x = Math.PI / 2; motor.position.set(1.33, 0.5, -0.56); powertrain.add(motor);
  const motorRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 10, 40), M.copper); motorRing.position.set(1.33, 0.5, -0.69); powertrain.add(motorRing);
  const gen = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 36), M.alu)); gen.rotation.x = Math.PI / 2; gen.position.set(1.45, 0.58, -0.02); powertrain.add(gen);
  const peu = reg(rbox(0.4, 0.12, 0.36, 0.02, M.alu)); peu.position.set(1.36, 0.8, -0.3); powertrain.add(peu);
  for (let k = 0; k < 3; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.01, 0.005), M.cast); fin.position.set(1.36, 0.865, -0.42 + k * 0.08); powertrain.add(fin); }
  [-1, 1].forEach(side => { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 12), M.cast); sh.rotation.x = Math.PI / 2; sh.position.set(AXLE_F, WHEEL_R, side * (side < 0 ? 0.6 : 0.42)); sh.scale.y = side < 0 ? 0.4 : 1; powertrain.add(sh); });
  const radiator = reg(rbox(0.05, 0.42, 1.08, 0.01, new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.7 }))); radiator.position.set(2.1, 0.55, 0); powertrain.add(radiator);
  const lv = rbox(0.24, 0.18, 0.16, 0.015, M.plastic); lv.position.set(1.95, 0.62, -0.58); powertrain.add(lv);
  const tank = reg(rbox(0.5, 0.24, 0.92, 0.06, new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.75 }))); tank.position.set(-1.43, 0.36, 0.05); powertrain.add(tank);
  const fuelLine = tube([V3(-1.2, 0.3, 0.5), V3(-0.4, 0.2, 0.62), V3(0.8, 0.2, 0.62), V3(1.5, 0.35, 0.5), V3(1.62, 0.62, 0.42)], 0.007, M.cast, 60, 6); powertrain.add(fuelLine);

  // Porta de recarga (traseira esquerda) e bocal de combustível (traseira direita)
  const portPos = surfacePoint(-1.8, 0.97, -1, 0.0);
  const portN = V3(-0.25, 0, -1).normalize();
  const portGroup = new THREE.Group(); portGroup.position.copy(portPos); portGroup.lookAt(portPos.clone().add(portN)); car.add(portGroup);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 32), M.plastic); socket.rotation.x = Math.PI / 2; socket.position.z = -0.01; portGroup.add(socket);
  for (let k = 0; k < 5; k++) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), M.chrome); pin.rotation.x = Math.PI / 2; const a = k * Math.PI * 2 / 5; pin.position.set(Math.cos(a) * 0.026, Math.sin(a) * 0.026 + 0.01, 0.006); portGroup.add(pin); }
  const doorPivot = new THREE.Group(); doorPivot.position.set(-0.07, 0, 0.004); portGroup.add(doorPivot);
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.13, 0.008, 2, 0.02), M.paint); door.position.x = 0.07; doorPivot.add(door);
  const plug = new THREE.Group(); portGroup.add(plug);
  const plugBody = rbox(0.08, 0.09, 0.14, 0.02, M.plastic); plugBody.position.set(0, -0.01, 0.08); plug.add(plugBody);
  const plugLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00aad0).multiplyScalar(3) })); plugLed.position.set(0, 0.038, 0.1); plug.add(plugLed);
  plug.visible = false;
  const fuelDoor = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.13, 0.008, 2, 0.02), M.paint);
  const fdPos = surfacePoint(-1.8, 0.97, 1, 0.002); fuelDoor.position.copy(fdPos); fuelDoor.lookAt(fdPos.clone().add(V3(-0.25, 0, 1))); exterior.add(fuelDoor);

  const obc = reg(rbox(0.3, 0.12, 0.26, 0.02, M.alu)); obc.position.set(-1.72, 0.66, -0.46); powertrain.add(obc);
  for (let k = 0; k < 4; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.008, 0.005), M.cast); fin.position.set(-1.72, 0.725, -0.56 + k * 0.065); powertrain.add(fin); }

  // Cabos de alta tensão (laranja)
  const A = {
    portIn: portPos.clone().add(V3(0.02, 0, 0.06)), obc: V3(-1.72, 0.66, -0.46), battRear: V3(-1.04, 0.3, -0.5), battRearDc: V3(-1.04, 0.3, -0.36),
    battFront: V3(0.88, 0.3, -0.25), battCenter: V3(-0.08, 0.32, 0), peu: V3(1.36, 0.8, -0.3), motor: V3(1.33, 0.5, -0.56), gen: V3(1.45, 0.58, -0.02),
    engine: V3(1.74, 0.72, 0.18), tank: V3(-1.43, 0.42, 0.05), dht: V3(1.36, 0.47, -0.26),
    wheelFL: V3(AXLE_F, WHEEL_R, -TRACK), wheelFR: V3(AXLE_F, WHEEL_R, TRACK), wheelRL: V3(AXLE_R, WHEEL_R, -TRACK), wheelRR: V3(AXLE_R, WHEEL_R, TRACK),
    bms: V3(-1.1, 0.33, 0.42), vcu: V3(1.02, 0.74, 0.46), gw: V3(0.62, 0.74, 0.14), obd: V3(0.56, 0.6, -0.44), dongle: V3(0.5, 0.6, -0.44), hu: V3(0.555, 1.16, 0.08), port: portPos.clone()
  };
  const hvPaths = {
    acIn: [A.portIn, V3(-1.82, 0.8, -0.62), A.obc],
    acOut: [A.obc, V3(-1.5, 0.48, -0.5), V3(-1.2, 0.34, -0.5), A.battRear],
    dcIn: [A.portIn, V3(-1.76, 0.75, -0.66), V3(-1.45, 0.42, -0.4), V3(-1.2, 0.33, -0.36), A.battRearDc],
    battPeuA: [V3(0.86, 0.3, -0.22), V3(1.06, 0.38, -0.2), V3(1.2, 0.62, -0.24), V3(1.28, 0.78, -0.28)],
    battPeuB: [V3(0.86, 0.3, -0.32), V3(1.08, 0.38, -0.32), V3(1.22, 0.62, -0.34), V3(1.3, 0.78, -0.36)],
    peuMotor: [V3(1.4, 0.76, -0.44), V3(1.38, 0.68, -0.56), A.motor],
    peuGen: [V3(1.42, 0.76, -0.18), V3(1.46, 0.68, -0.06), A.gen]
  };
  Object.values(hvPaths).forEach(pts => powertrain.add(tube(pts, 0.016, M.hv, 48, 10)));

  // ECUs e redes CAN
  const vcu = rbox(0.18, 0.06, 0.14, 0.012, M.ecu.clone()); vcu.position.copy(A.vcu); electronics.add(vcu);
  const gw = rbox(0.18, 0.06, 0.16, 0.012, M.ecu.clone()); gw.position.copy(A.gw); electronics.add(gw);
  const obd = rbox(0.06, 0.035, 0.09, 0.006, M.plastic); obd.position.copy(A.obd); electronics.add(obd);
  const dongle = new THREE.Group(); dongle.position.copy(A.dongle); electronics.add(dongle);
  const dBody = rbox(0.1, 0.045, 0.08, 0.012, new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 0.5, metalness: 0.4 })); dongle.add(dBody);
  const dLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa99bff).multiplyScalar(3) })); dLed.position.set(-0.03, 0.025, 0); dongle.add(dLed);
  const canPaths = {
    diag: [A.obd, V3(0.6, 0.66, -0.2), A.gw],
    pt1: [A.gw, V3(0.85, 0.78, 0.3), A.vcu],
    pt2: [A.gw, V3(0.4, 0.5, 0.3), V3(-0.4, 0.45, 0.45), V3(-0.9, 0.38, 0.45), A.bms],
    pt3: [A.gw, V3(1.0, 0.82, -0.1), A.peu],
    info: [A.gw, V3(0.6, 0.95, 0.12), V3(0.565, 1.08, 0.08)]
  };
  const canMeshes = {};
  Object.entries(canPaths).forEach(([k, pts]) => { const m = tube(pts, 0.0055, M.can.clone(), 48, 6); m.renderOrder = 12; electronics.add(m); canMeshes[k] = m; });
  const ecus = { bms, vcu, gw };

  car.traverse(o => { if (o.isMesh && o.parent !== exterior && !o.material.isShaderMaterial) { o.castShadow = o.castShadow || false; } });
  exterior.traverse(o => { if (o.isMesh) fadeables.push(o); });

  // Estados animáveis
  let xr = -1;
  function setXray(v) {
    if (Math.abs(v - xr) < 1e-4) return;
    xr = v;
    bodyX.material.uniforms.uOpacity.value = v; glassX.material.uniforms.uOpacity.value = v * 0.7;
    bodyX.visible = glassX.visible = v > 0.01;
    exterior.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
      const op = m.userData.baseOpacity * (1 - v);
      m.transparent = v > 0.001 || m.userData.baseTransparent; m.opacity = op; m.depthWrite = v < 0.5 && !m.userData.baseTransparent && m !== M.glass;
      if (o.userData.cast === undefined) o.userData.cast = o.castShadow;
      o.visible = op > 0.01; o.castShadow = v < 0.5 && o.userData.cast;
    });
  }
  function setPaint(name) { M.paint.color.setHex(PAINTS[name] || PAINTS.silver); }
  let doorAngle = 0;
  function setPort(open, plugged, dt) {
    const target = open ? 1.9 : 0;
    doorAngle += (target - doorAngle) * Math.min(1, dt * 4);
    doorPivot.rotation.y = -doorAngle; door.visible = true;
    plug.visible = plugged && doorAngle > 1.2;
  }
  function setModules(soc, charging, t) {
    const lit = soc * modules.length / 2;
    modules.forEach(m => {
      const i = m.userData.i; let e = i < Math.floor(lit) ? 1.1 : (i < lit ? 1.1 * (lit - i) : 0.05);
      if (charging && i < lit) e += 0.9 * Math.max(0, Math.sin(t * 5 - i * 0.7));
      m.material.emissiveIntensity = e * (0.25 + xr * 0.75);
    });
  }
  function setHvGlow(v) { M.hv.emissiveIntensity = v; }
  function setCan(active, t) { Object.entries(canMeshes).forEach(([k, m]) => { const on = active.includes(k); const target = on ? 0.85 : (xr > 0.5 ? 0.15 : 0); m.material.opacity += (target - m.material.opacity) * 0.1; m.material.color.setRGB(0.66, 0.6, 1).multiplyScalar(on ? 2.2 : 1); }); }
  function setEcuGlow(list, t) { Object.entries(ecus).forEach(([k, m]) => { const on = list.includes(k); m.material.emissiveIntensity += ((on ? 0.9 + 0.4 * Math.sin(t * 6) : 0) - m.material.emissiveIntensity) * 0.15; }); dLed.visible = true; }
  function spinWheels(ds) { wheels.forEach(w => { w.spin.rotation.z -= ds / WHEEL_R * (w.side < 0 ? 1 : 1); }); }
  setXray(0);
  xr = 0;

  return {
    group: car, anchors: A, hvPaths, canPaths, wheels, huCanvas, huTex, clusterCanvas, clusterTex, huScreen,
    setXray, setPaint, setPort, setModules, setHvGlow, setCan, setEcuGlow, spinWheels, materials: M,
    dims: { length: 4.74, width: 1.905, height: 1.685 }, portPos, portNormal: portN
  };
}
