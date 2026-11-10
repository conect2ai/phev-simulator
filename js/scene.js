// Renderização: estúdio escuro com reflexos, sombras, bloom, estações de recarga, fluxos de energia e dados.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildVehicle, WHEEL_R } from './vehicle.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const COLORS = { cyan: 0x00aad0, amber: 0xf0a43c, violet: 0xa99bff, hv: 0xff6a13 };

function envScene() {
  // Ambiente para reflexos: sala escura com faixas de luz, como um estúdio automotivo
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(40, 16, 40), new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide })));
  const strip = (w, h, x, y, z, ry, rx, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  strip(14, 0.8, 0, 7.5, 0, 0, Math.PI / 2, 2.2);
  strip(14, 0.35, 0, 7.4, -4, 0, Math.PI / 2, 1.6);
  strip(14, 0.35, 0, 7.4, 4, 0, Math.PI / 2, 1.6);
  strip(0.4, 5, -12, 3, -6, Math.PI / 2, 0, 1.2);
  strip(0.4, 5, -12, 3, 6, Math.PI / 2, 0, 1.2);
  strip(0.4, 5, 12, 3, -3, Math.PI / 2, 0, 1.0);
  strip(8, 3, 0, 2.5, -19, 0, 0, 0.15);
  strip(8, 3, 0, 2.5, 19, 0, 0, 0.15);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x0a0b0d })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; s.add(ground);
  return s;
}

function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t; }

export class Stage {
  constructor(container, opts = {}) {
    this.container = container;
    this.capture = !!opts.capture;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: this.capture, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.85;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f12);
    scene.fog = new THREE.FogExp2(0x0d0f12, 0.055);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(envScene(), 0.03).texture;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 120);
    this.camera.position.set(6.2, 2.2, 5.4);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.07; c.minDistance = 0.6; c.maxDistance = 16; c.maxPolarAngle = Math.PI * 0.495; c.target.set(0, 0.7, 0);
    c.enablePan = true; c.panSpeed = 0.6;

    // Luzes
    scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x0a0a0c, 0.15));
    const key = this.key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(3, 8, 4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.camera.near = 1; key.shadow.camera.far = 20; key.shadow.bias = -0.0004; key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fd8ff, 0.6); rim.position.set(-6, 3, -5); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xfff1e0, 0.25); fill.position.set(-4, 2, 6); scene.add(fill);

    this.buildStudio();
    this.v = buildVehicle(); scene.add(this.v.group);
    this.buildStations();
    this.buildFlows();

    // Pós-processamento
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const comp = this.composer = new EffectComposer(r, rt);
    comp.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.45, 1.05);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.quality = 'high';
    this.camTween = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    r.shadowMap.enabled = q !== 'low';
    this.v.group.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.floor.material.needsUpdate = true;
    this.bloom.enabled = q !== 'low';
    this.resize();
  }
  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    const pr = this.capture ? 1 : Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.bloom.setSize(w * pr / 2, h * pr / 2);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 46 : 32; this.camera.updateProjectionMatrix();
    this.pointsMat && (this.pointsMat.uniforms.uPix.value = pr * Math.min(1.5, h / 800));
  }

  buildStudio() {
    const s = this.scene;
    // Piso polido escuro com textura sutil
    const rough = canvasTexture(512, 512, (g, w, h) => { const img = g.createImageData(w, h); for (let i = 0; i < img.data.length; i += 4) { const v = 120 + Math.random() * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); });
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(10, 10);
    const floor = this.floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.6, metalness: 0.05, roughnessMap: rough, envMapIntensity: 0.45 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    // Plataforma com faixas que rolam quando o veículo anda
    const roadTex = this.roadTex = canvasTexture(1024, 256, (g, w, h) => {
      g.fillStyle = '#121417'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = 'rgba(220,226,232,0.28)'; for (let x = 0; x < w; x += 128) { g.fillRect(x, h * 0.48, 64, h * 0.04); }
      g.fillStyle = 'rgba(0,170,208,0.18)'; g.fillRect(0, h * 0.06, w, 2); g.fillRect(0, h * 0.94 - 2, w, 2);
    });
    roadTex.wrapS = THREE.RepeatWrapping; roadTex.repeat.set(2.2, 1);
    const deck = this.deck = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.55, metalness: 0.1, transparent: true }));
    deck.rotation.x = -Math.PI / 2; deck.position.y = 0.004; deck.receiveShadow = true; s.add(deck);
    const deckFade = canvasTexture(512, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const fadeM = new THREE.Mesh(new THREE.PlaneGeometry(9.02, 2.62), new THREE.MeshBasicMaterial({ map: deckFade, transparent: true, depthWrite: false, color: 0x0c0d0f }));
    fadeM.rotation.x = -Math.PI / 2; fadeM.position.y = 0.006; s.add(fadeM);
    // Sombra de contato
    const ao = canvasTexture(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const aoM = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.5), new THREE.MeshBasicMaterial({ map: ao, transparent: true, depthWrite: false })); aoM.rotation.x = -Math.PI / 2; aoM.position.y = 0.008; s.add(aoM);
    // Parede curva com faixas de luz ao fundo
    const wallTex = canvasTexture(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#07080a'); gr.addColorStop(0.62, '#1a1e23'); gr.addColorStop(0.8, '#222830'); gr.addColorStop(1, '#16191d'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    wallTex.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 9, 96, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false }));
    wall.position.y = 4.5; s.add(wall);
    const stripM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 0.9).multiplyScalar(0.9), fog: true });
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.04), stripM); m.position.set(Math.cos(a) * 14.8, 1.6, Math.sin(a) * 14.8); s.add(m); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(0.6) })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 7, 0); s.add(ceil);
    // Anel de destaque no piso
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.57, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.cyan).multiplyScalar(0.9), transparent: true, opacity: 0.45 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.007; s.add(ring);
  }

  buildStations() {
    const s = this.scene, port = this.v.portPos;
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.2, clearcoat: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.5, metalness: 0.4 });
    const glow = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5) });
    const st = this.stations = {};
    // Wallbox em pilar
    const wb = new THREE.Group(); wb.position.set(-3.5, 0, -1.55); wb.rotation.y = 0.5;
    const pole = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.5, 0.16, 2, 0.03), dark); pole.position.y = 0.75; pole.castShadow = true; wb.add(pole);
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.46, 0.14, 4, 0.05), metal); box.position.set(0, 1.12, 0.12); box.castShadow = true; wb.add(box);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.01), glow(COLORS.cyan)); led.position.set(0, 1.25, 0.195); wb.add(led);
    const holster = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.12, 0.08, 2, 0.02), dark); holster.position.set(0, 0.92, 0.19); wb.add(holster);
    wb.userData.out = V3(-3.4, 1.0, -1.38); s.add(wb); st.wallbox = wb;
    // Carregador DC
    const dc = new THREE.Group(); dc.position.set(-3.55, 0, -1.4); dc.rotation.y = 0.55;
    const cab = new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.9, 0.42, 4, 0.06), metal); cab.position.y = 0.95; cab.castShadow = true; dc.add(cab);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0c2a33).multiplyScalar(1) })); scr.position.set(0, 1.42, 0.215); dc.add(scr);
    this.dcScreenCanvas = document.createElement('canvas'); this.dcScreenCanvas.width = 384; this.dcScreenCanvas.height = 256;
    this.dcScreenTex = new THREE.CanvasTexture(this.dcScreenCanvas); this.dcScreenTex.colorSpace = THREE.SRGBColorSpace; scr.material = new THREE.MeshBasicMaterial({ map: this.dcScreenTex, toneMapped: false });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.44), glow(COLORS.cyan)); band.position.y = 1.86; dc.add(band);
    const hol = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.16, 0.1, 2, 0.02), dark); hol.position.set(0.2, 0.95, 0.24); dc.add(hol);
    dc.userData.out = V3(-3.3, 0.95, -1.15); s.add(dc); st.dc = dc;
    // Tomada comum com carregador portátil
    const pt = new THREE.Group(); pt.position.set(-3.5, 0, -1.55); pt.rotation.y = 0.5;
    const outlet = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.12, 0.05, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.5 })); outlet.position.set(0, 0.45, 0.1); pt.add(outlet);
    const pPole = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.9, 0.16, 2, 0.03), dark); pPole.position.y = 0.45; pt.add(pPole);
    pt.userData.out = V3(-3.45, 0.45, -1.42); s.add(pt); st.portable = pt;
    this.iccb = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.07, 0.1, 2, 0.02), dark); this.iccb.castShadow = true; s.add(this.iccb);
    Object.values(st).forEach(g => { g.userData.k = 0; g.scale.setScalar(0.001); g.visible = false; });
    this.cableMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.6 });
    this.cable = null; this.cablePts = null;
  }
  cablePath(src) {
    const st = this.stations[src]; if (!st) return null;
    const o = st.userData.out, p = this.v.portPos.clone().add(V3(0.02, -0.01, -0.13));
    const mid1 = o.clone().lerp(p, 0.3); mid1.y = 0.04; const mid2 = o.clone().lerp(p, 0.72); mid2.y = 0.05;
    return [o, V3(o.x, Math.max(0.2, o.y - 0.5), o.z + 0.1), mid1, mid2, V3(p.x + 0.05, 0.5, p.z - 0.15), p];
  }
  setSource(src) {
    if (this.cable) { this.scene.remove(this.cable); this.cable.geometry.dispose(); this.cable = null; }
    this.iccb.visible = false;
    const pts = this.cablePath(src);
    this.cablePts = pts;
    if (pts) {
      this.cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 100, src === 'dc' ? 0.026 : 0.017, 10), this.cableMat);
      this.cable.castShadow = true; this.scene.add(this.cable);
      if (src === 'portable') { const c = new THREE.CatmullRomCurve3(pts); const q = c.getPoint(0.35); this.iccb.position.set(q.x, 0.04, q.z); this.iccb.visible = true; }
    }
    this.src = src;
    this.rebuildChargeFlows();
  }

  // Partículas com brilho (bloom) ao longo de caminhos
  buildFlows() {
    const A = this.v.anchors, P = this.v.hvPaths, C = this.v.canPaths;
    const j = (...arrs) => { const out = []; arrs.forEach(a => a.forEach(p => { if (!out.length || out[out.length - 1].distanceTo(p) > 1e-3) out.push(p.clone()); })); return out; };
    const rev = a => a.slice().reverse();
    const shaftL = [A.wheelFL, V3(1.33, WHEEL_R, -0.6), A.motor], shaftR = [A.wheelFR, V3(1.33, WHEEL_R, 0.3), A.dht];
    const battToPeu = j([A.battCenter, V3(0.5, 0.31, -0.2)], P.battPeuA, [A.peu]);
    this.flowDefs = {
      ac: { pts: null, color: COLORS.cyan, n: 260, speed: 0.55, size: 0.05 },
      dc: { pts: null, color: COLORS.cyan, n: 380, speed: 0.95, size: 0.06 },
      regenL: { pts: j(shaftL, [V3(1.36, 0.72, -0.5)], [A.peu], rev(P.battPeuB), [A.battCenter]), color: COLORS.cyan, n: 160, speed: 0.8, size: 0.045 },
      regenR: { pts: j(shaftR, [A.motor, V3(1.36, 0.72, -0.5), A.peu], rev(P.battPeuB), [A.battCenter]), color: COLORS.cyan, n: 160, speed: 0.8, size: 0.045 },
      tractL: { pts: j(battToPeu, [V3(1.36, 0.72, -0.5), A.motor], rev(shaftL)), color: COLORS.cyan, n: 150, speed: 0.75, size: 0.04 },
      tractR: { pts: j(battToPeu, [V3(1.36, 0.72, -0.5), A.motor, A.dht], rev(shaftR)), color: COLORS.cyan, n: 150, speed: 0.75, size: 0.04 },
      fuel: { pts: [A.tank, V3(-1.2, 0.3, 0.5), V3(-0.4, 0.2, 0.62), V3(0.8, 0.2, 0.62), V3(1.5, 0.35, 0.5), V3(1.62, 0.62, 0.42), A.engine], color: COLORS.amber, n: 120, speed: 0.6, size: 0.04 },
      gen: { pts: [A.engine, V3(1.6, 0.62, 0.05), A.gen, V3(1.44, 0.7, -0.1), A.peu, V3(1.22, 0.6, -0.3), V3(1.0, 0.36, -0.28), V3(0.6, 0.31, -0.2), A.battCenter], color: COLORS.amber, n: 200, speed: 0.7, size: 0.05, grad: COLORS.cyan },
      parallel: { pts: [A.engine, V3(1.55, 0.5, 0.0), A.dht, V3(1.33, WHEEL_R, 0.3), A.wheelFR], color: COLORS.amber, n: 90, speed: 0.9, size: 0.05 },
      parallelL: { pts: [A.engine, V3(1.55, 0.5, 0.0), A.dht, V3(1.33, WHEEL_R, -0.6), A.wheelFL], color: COLORS.amber, n: 90, speed: 0.9, size: 0.05 },
      obdReqV: { pts: j(C.diag, C.pt1), color: COLORS.violet, packet: true, n: 6, speed: 0.9, size: 0.09 },
      obdRspV: { pts: rev(j(C.diag, C.pt1)), color: COLORS.violet, packet: true, n: 6, speed: 0.9, size: 0.09, phase: 0.5 },
      obdReqB: { pts: j(C.diag, C.pt2), color: COLORS.violet, packet: true, n: 6, speed: 0.7, size: 0.09 },
      obdRspB: { pts: rev(j(C.diag, C.pt2)), color: COLORS.violet, packet: true, n: 6, speed: 0.7, size: 0.09, phase: 0.5 },
      cloud: { pts: [A.dongle, V3(0.3, 1.0, -0.8), V3(0.0, 2.0, -1.3), V3(-0.4, 2.9, -1.6)], color: COLORS.violet, packet: true, n: 8, speed: 0.6, size: 0.08 },
      bcastB: { pts: j(rev(C.pt2), C.info), color: COLORS.violet, packet: true, n: 8, speed: 0.8, size: 0.08 },
      bcastV: { pts: j(rev(C.pt1), C.info), color: COLORS.violet, packet: true, n: 8, speed: 0.8, size: 0.07, phase: 0.3 },
      blockedDiag: { pts: C.diag, color: 0xff5a5a, packet: true, n: 6, speed: 0.9, size: 0.09 },
      blockedGw: { pts: rev(C.pt2), color: 0xff5a5a, packet: true, n: 8, speed: 0.8, size: 0.07, phase: 0.6 }
    };
    let total = 0; Object.values(this.flowDefs).forEach(d => { d.start = total; total += d.n; d.vis = 0; d.target = 0; d.rate = 1; d.jit = []; for (let i = 0; i < d.n; i++) d.jit.push([(Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, Math.random()]); });
    this.total = total;
    const g = this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(total * 3); this.pCol = new Float32Array(total * 3); this.pSize = new Float32Array(total); this.pA = new Float32Array(total);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1)); g.setAttribute('aA', new THREE.BufferAttribute(this.pA, 1));
    this.pointsMat = new THREE.ShaderMaterial({
      uniforms: { uPix: { value: 1 } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aA; varying vec3 vC; varying float vA; uniform float uPix;
        void main(){ vC=aColor; vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPix*(1900.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float c=smoothstep(0.5,0.0,r); gl_FragColor=vec4(vC*(0.8+c*2.6), pow(c,1.5)*vA); }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(g, this.pointsMat); pts.frustumCulled = false; pts.renderOrder = 20; this.scene.add(pts);
    Object.keys(this.flowDefs).forEach(k => this.setLut(k));
  }
  setLut(k) {
    const d = this.flowDefs[k];
    if (!d.pts) { d.lut = null; return; }
    const curve = new THREE.CatmullRomCurve3(d.pts, false, 'centripetal');
    d.lut = curve.getSpacedPoints(200); d.len = curve.getLength();
    const c1 = new THREE.Color(d.color), c2 = new THREE.Color(d.grad ?? d.color);
    for (let i = 0; i < d.n; i++) { const j = d.start + i; this.pSize[j] = d.size * (d.packet ? 1 : 0.6 + d.jit[i][3] * 0.8); d.c1 = c1; d.c2 = c2; }
  }
  rebuildChargeFlows() {
    const A = this.v.anchors, P = this.v.hvPaths;
    const cab = this.cablePts;
    this.flowDefs.ac.pts = cab && this.src !== 'dc' ? [...cab.slice(0, -1), A.portIn, ...P.acIn.slice(1), ...P.acOut.slice(1), A.battCenter] : null;
    this.flowDefs.dc.pts = cab && this.src === 'dc' ? [...cab.slice(0, -1), A.portIn, ...P.dcIn.slice(1), A.battCenter] : null;
    this.setLut('ac'); this.setLut('dc');
  }
  setFlow(k, v, rate = 1) { const d = this.flowDefs[k]; if (d) { d.target = v; d.rate = rate; } }
  updateFlows(t, dt) {
    const tmp = new THREE.Vector3(), col = new THREE.Color();
    Object.values(this.flowDefs).forEach(d => {
      d.vis += (d.target - d.vis) * Math.min(1, dt * 3);
      d.clock = (d.clock || 0) + dt * d.speed * (0.4 + 0.6 * d.rate);
      for (let i = 0; i < d.n; i++) {
        const j = d.start + i;
        if (d.vis < 0.01 || !d.lut) { this.pA[j] = 0; continue; }
        let u;
        if (d.packet) u = (d.clock * 0.6 + (d.phase || 0) + i * 0.035) % 1; else u = (d.jit[i][3] + d.clock * 2.4 / d.len) % 1;
        u = ((u % 1) + 1) % 1;
        const x = u * 200, a = Math.max(0, Math.min(199, Math.floor(x))); tmp.copy(d.lut[a]).lerp(d.lut[a + 1], x - a);
        const jj = d.packet ? 0 : 1;
        this.pPos[j * 3] = tmp.x + d.jit[i][0] * jj; this.pPos[j * 3 + 1] = tmp.y + d.jit[i][1] * jj; this.pPos[j * 3 + 2] = tmp.z + d.jit[i][2] * jj;
        col.copy(d.c1).lerp(d.c2, u); this.pCol[j * 3] = col.r; this.pCol[j * 3 + 1] = col.g; this.pCol[j * 3 + 2] = col.b;
        const edge = Math.min(1, u / 0.04, (1 - u) / 0.04);
        const density = d.packet ? (i < 3 ? 1 : 0) : (d.jit[i][3] < 0.25 + 0.75 * d.rate ? 1 : 0);
        this.pA[j] = d.vis * edge * density;
        if (d.packet) this.pSize[j] = d.size * (i === 0 ? 1.4 : i === 1 ? 1 : 0.7);
      }
    });
    this.pGeo.attributes.position.needsUpdate = true; this.pGeo.attributes.aA.needsUpdate = true; this.pGeo.attributes.aColor.needsUpdate = true; this.pGeo.attributes.aSize.needsUpdate = true;
  }
  showStation(src, dt) {
    Object.entries(this.stations).forEach(([k, g]) => {
      const on = k === src || (src === 'portable' && k === 'portable');
      g.userData.k += ((on ? 1 : 0) - g.userData.k) * Math.min(1, dt * 4);
      g.scale.setScalar(Math.max(0.001, g.userData.k)); g.visible = g.userData.k > 0.01;
    });
  }
  flyTo(pos, target, dur = 1.8) {
    if (this.camTween && this.camTween.lock) return;
    this.camTween = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: target.clone(), k: 0, dur };
  }
  snapTo(pos, target) { this.camera.position.copy(pos); this.controls.target.copy(target); this.camTween = null; this.controls.update(); }
  update(dt) {
    if (this.camTween) {
      const c = this.camTween; c.k = Math.min(1, c.k + dt / c.dur);
      const e = c.k < 0.5 ? 4 * c.k ** 3 : 1 - Math.pow(-2 * c.k + 2, 3) / 2;
      this.camera.position.lerpVectors(c.p0, c.p1, e); this.controls.target.lerpVectors(c.t0, c.t1, e);
      if (c.k >= 1) this.camTween = null;
    }
    this.controls.update();
  }
  render() { this.composer.render(); }
}
