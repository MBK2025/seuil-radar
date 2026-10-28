// Moteur commun des vidéos « science du quotidien » (1080x1920, 3D three.js + surcouches 2D).
// Un épisode = episodes/NNN-slug/scene.js qui exporte build(E) et renvoie { shots: [...] }.
// Voir README.md pour l'API complète.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as P from './props.js';

const W = 1080, H = 1920;
const RS = Number(new URLSearchParams(location.search).get('rs') || 0.7);   // échelle du rendu 3D
const out = document.getElementById('out'), o = out.getContext('2d');

// ---------------- maths ----------------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIO = t => { t = clamp(t); return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; };
const easeBack = t => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const rand = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W * RS, H * RS, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 1200);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
const composer = new EffectComposer(renderer);
composer.setSize(W * RS, H * RS);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W * RS, H * RS), 0.5, 0.4, 0.84);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function gradientTex(stops) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); stops.forEach(([p, col]) => gr.addColorStop(p, col));
  g.fillStyle = gr; g.fillRect(0, 0, 2, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialTex(inner = 'rgba(0,0,0,0.75)', outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
const std = (c, r = 0.8, m = 0, e = null, ei = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e ?? 0x000000, emissiveIntensity: ei });
const phys = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.2, clearcoat: 0.6, ...o });
const glassMat = (c = 0xaad8ff, op = 0.25) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
const glowMat = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const lineMat = (c, op = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op });

function camSet(p, look, fov = 50) { camera.position.copy(p); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix(); }
// caméra en orbite autour d'une cible : angle (rad), hauteur, distance
function orbit(target, ang, height, dist, fov = 50) { camSet(V3(target.x + Math.sin(ang) * dist, target.y + height, target.z + Math.cos(ang) * dist), target, fov); }
function proj(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }

// ---------------- ambiances ----------------
// E.mood('night' | 'studio' | 'space' | 'day' | 'lab') règle fond, brouillard et lumières par défaut.
const lights = new THREE.Group(); scene.add(lights);
const hemi = new THREE.HemisphereLight(0x3a4a80, 0x0a0a10, 0.55); lights.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(-30, 60, -20); lights.add(key);
const rim = new THREE.DirectionalLight(0x66ccff, 0.0); rim.position.set(20, 15, -30); lights.add(rim);
const MOODS = {
  night:  { bg: [[0, '#02030a'], [0.55, '#0a1430'], [1, '#16203d']], fog: [0x0b1328, 40, 260], hemi: [0x3a4a80, 0x0a0a10, 0.55], key: [0x8fa8ff, 0.5], rim: 0, exp: 1.05 },
  studio: { bg: [[0, '#05070c'], [0.6, '#0d1220'], [1, '#121a2c']], fog: [0x0b101c, 18, 90], hemi: [0x8090c0, 0x101018, 0.7], key: [0xffffff, 1.4], rim: 1.2, exp: 1.0 },
  space:  { bg: [[0, '#000000'], [1, '#050814']], fog: null, hemi: [0x223355, 0x000000, 0.25], key: [0xfff4e0, 2.2], rim: 0.4, exp: 1.0 },
  day:    { bg: [[0, '#3b78c9'], [0.6, '#9cc6ef'], [1, '#dbe9f5']], fog: [0xbcd3ea, 60, 380], hemi: [0xcfe3ff, 0x4a5a3a, 1.1], key: [0xfff1dc, 2.0], rim: 0.3, exp: 1.0 },
  lab:    { bg: [[0, '#06110f'], [0.6, '#0b1f1c'], [1, '#12302b']], fog: [0x0b1f1c, 15, 80], hemi: [0x9fe0d0, 0x101515, 0.7], key: [0xffffff, 1.2], rim: 1.0, exp: 1.0 },
};
function mood(name) {
  const m = MOODS[name] || MOODS.studio;
  scene.background = gradientTex(m.bg);
  scene.fog = m.fog ? new THREE.Fog(...m.fog) : null;
  hemi.color.setHex(m.hemi[0]); hemi.groundColor.setHex(m.hemi[1]); hemi.intensity = m.hemi[2];
  key.color.setHex(m.key[0]); key.intensity = m.key[1]; rim.intensity = m.rim; renderer.toneMappingExposure = m.exp;
}
mood('studio');

// ---------------- pools d'effets réutilisables ----------------
const UP = V3(0, 1, 0);
const shellGeo = new THREE.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, 0.32);
const shellMat = () => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x3fe0ff) }, uOp: { value: 1 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOp; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float rim = 1.0 - smoothstep(0.0, 0.10, vUv.y); float fr = pow(1.0 - abs(dot(vN, vV)), 3.0);
      gl_FragColor = vec4(uColor * (1.0 + rim), uOp * (0.05 + 0.85 * rim + 0.35 * fr)); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
const shells = [];
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(shellGeo, shellMat()); m.visible = false; scene.add(m); shells.push(m); }
// front d'onde (calotte lumineuse) : centre, direction, rayon, couleur, opacité
function shell(i, center, dir, r, color = 0x3fe0ff, op = 0.8, aperture = 1) {
  const m = shells[i]; if (!m) return; m.visible = true; m.position.copy(center);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); m.scale.set(Math.max(r, 0.01) * aperture, Math.max(r, 0.01), Math.max(r, 0.01) * aperture);
  m.material.uniforms.uColor.value.set(color); m.material.uniforms.uOp.value = op;
}
const ringGeo = new THREE.RingGeometry(0.992, 1, 160);
const rings = [];
for (let i = 0; i < 40; i++) { const r = new THREE.Mesh(ringGeo, glowMat(0xffffff, 0.8)); r.visible = false; scene.add(r); rings.push(r); }
// anneau plat (onde sonore, ondulation) : centre, rayon, couleur, opacité, normale (défaut : vertical = posé au sol)
function ring(i, center, r, color = 0xffffff, op = 0.6, normal = UP) {
  const m = rings[i]; if (!m) return; m.visible = true; m.position.copy(center); m.scale.setScalar(Math.max(r, 0.01));
  m.quaternion.setFromUnitVectors(V3(0, 0, 1), normal.clone().normalize()); m.material.color.set(color); m.material.opacity = op;
}
const dotGeo = new THREE.SphereGeometry(1, 12, 8);
const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), 4000);   // lumineuses (additives) : couleur sombre = plus transparent
dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.count = 0; dots.frustumCulled = false; scene.add(dots);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _c = new THREE.Color();
// particule (molécule, photon, électron…) : à appeler chaque image, autant de fois que nécessaire
function dot(pos, size = 0.1, color = 0xffffff) {
  if (dots.count >= 4000) return; _m.compose(pos, _q, V3(size, size, size)); dots.setMatrixAt(dots.count, _m);
  dots.setColorAt(dots.count, _c.set(color)); dots.count++;
}
const lineObjs = [];
for (let i = 0; i < 40; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(600 * 3), 3)); const l = new THREE.Line(g, lineMat(0xffffff)); l.visible = false; l.frustumCulled = false; scene.add(l); lineObjs.push(l); }
// polyligne 3D (trajectoire, rayon lumineux, champ) : pts = [Vector3…] (≤ 600), prog = part dessinée 0..1
function line3(i, pts, color = 0xffffff, op = 1, prog = 1) {
  const l = lineObjs[i]; if (!l) return; const a = l.geometry.attributes.position.array; const n = Math.max(2, Math.min(600, Math.ceil(pts.length * clamp(prog))));
  for (let k = 0; k < n; k++) { const p = pts[Math.min(k, pts.length - 1)]; a[k*3] = p.x; a[k*3+1] = p.y; a[k*3+2] = p.z; }
  l.geometry.setDrawRange(0, n); l.geometry.attributes.position.needsUpdate = true; l.material.color.set(color); l.material.opacity = op; l.visible = true;
}
function resetFx() {
  for (const m of shells) m.visible = false; for (const r of rings) r.visible = false; for (const l of lineObjs) l.visible = false;
  dots.count = 0;
}

// ---------------- 2D ----------------
const COL = { acc: '#FFD23F', cyan: '#3FE0FF', orange: '#FF8A3D', red: '#FF3B3B', green: '#5BFF9E', violet: '#B58CFF', white: '#FFFFFF', grey: '#9AA4B2' };
function txt(s, x, y, size, col = '#fff', font = 'Inter', w = 700, align = 'center', base = 'middle') { o.font = `${w} ${size}px ${font}`; o.fillStyle = col; o.textAlign = align; o.textBaseline = base; o.fillText(s, x, y); }
function glass(x, y, w, h, r = 28, a = 0.58) { o.save(); o.fillStyle = `rgba(8,12,22,${a})`; o.beginPath(); o.roundRect(x, y, w, h, r); o.fill(); o.strokeStyle = 'rgba(255,255,255,0.14)'; o.lineWidth = 2; o.stroke(); o.restore(); }
function tag(label, x, y, col = '#fff', a = 1, size = 30) {
  if (a <= 0) return;
  o.save(); o.globalAlpha = a; o.font = `800 ${size}px Mono`; const w = o.measureText(label).width + size * 1.2; x = clamp(x, w / 2 + 30, W - w / 2 - 30);
  o.fillStyle = 'rgba(5,8,16,0.78)'; o.beginPath(); o.roundRect(x - w/2, y - size * 0.87, w, size * 1.74, size * 0.87); o.fill(); o.strokeStyle = col; o.lineWidth = 3; o.stroke();
  txt(label, x, y + 2, size, col, 'Mono', 800); o.restore();
}
// étiquette reliée à un point 3D : tag3(V3, 'TEXTE', dx, dy, couleur, opacité)
function tag3(v, label, dx = -120, dy = -160, col = '#fff', a = 1) { const [x, y, z] = proj(v); if (z > 1) return; leader(x, y, x + dx, y + dy, col, a); tag(label, x + dx, y + dy - 28, col, a); }
function leader(x1, y1, x2, y2, col, a = 1) { if (a <= 0) return; o.save(); o.globalAlpha = a; o.strokeStyle = col; o.lineWidth = 3; o.setLineDash([8, 8]); o.beginPath(); o.moveTo(x1, y1); o.lineTo(x2, y2); o.stroke(); o.setLineDash([]); o.fillStyle = col; o.beginPath(); o.arc(x1, y1, 7, 0, 7); o.fill(); o.restore(); }
function wave2(x, y, w, amp, lambda, phase, col, lw = 5) {
  o.save(); o.strokeStyle = col; o.lineWidth = lw; o.shadowColor = col; o.shadowBlur = 18; o.beginPath();
  for (let i = 0; i <= w; i += 3) { const yy = y + Math.sin((i / lambda) * Math.PI * 2 - phase) * amp; i ? o.lineTo(x + i, yy) : o.moveTo(x + i, yy); }
  o.stroke(); o.restore();
}
function reticle(x, y, s, col, a = 1, rot = 0) {
  o.save(); o.globalAlpha = a; o.translate(x, y); o.rotate(rot); o.strokeStyle = col; o.lineWidth = 5; o.shadowColor = col; o.shadowBlur = 14;
  for (let i = 0; i < 4; i++) { o.rotate(Math.PI / 2); o.beginPath(); o.moveTo(s, s - 40); o.lineTo(s, s); o.lineTo(s - 40, s); o.stroke(); }
  o.lineWidth = 2; o.beginPath(); o.arc(0, 0, 8, 0, 7); o.stroke(); o.restore();
}
function bigNumber(value, unit, x, y, a = 1, col = '#fff', size = 170) { o.save(); o.globalAlpha = a; txt(value, x, y, size, col, 'Mono', 800); if (unit) txt(unit, x, y + size * 0.72, size * 0.28, COL.grey, 'Mono', 800); o.restore(); }
function bar(x, y, w, h, frac, col = COL.acc, label = '', a = 1) {
  o.save(); o.globalAlpha = a; o.fillStyle = 'rgba(255,255,255,0.12)'; o.beginPath(); o.roundRect(x, y, w, h, h / 2); o.fill();
  o.fillStyle = col; o.beginPath(); o.roundRect(x, y, Math.max(h, w * clamp(frac)), h, h / 2); o.fill();
  if (label) txt(label, x, y - h - 4, 28, '#cfd6e0', 'Mono', 800, 'left'); o.restore();
}
function arrow2(x1, y1, x2, y2, col = COL.acc, a = 1, lw = 8) {
  o.save(); o.globalAlpha = a; o.strokeStyle = col; o.fillStyle = col; o.lineWidth = lw; o.lineCap = 'round'; o.shadowColor = col; o.shadowBlur = 14;
  o.beginPath(); o.moveTo(x1, y1); o.lineTo(x2, y2); o.stroke(); const an = Math.atan2(y2 - y1, x2 - x1);
  o.beginPath(); o.moveTo(x2 + Math.cos(an) * 6, y2 + Math.sin(an) * 6); o.lineTo(x2 - Math.cos(an - 0.5) * 34, y2 - Math.sin(an - 0.5) * 34); o.lineTo(x2 - Math.cos(an + 0.5) * 34, y2 - Math.sin(an + 0.5) * 34); o.fill(); o.restore();
}
function panel(title, lines, x = 90, y = 1250, w = 900, a = 1, col = COL.cyan) {
  // panneau d'explication : lines = [['texte', couleur?], ...] (déjà filtrées selon le temps)
  const h = 110 + lines.length * 74;
  o.save(); o.globalAlpha = a; glass(x, y, w, h, 32, 0.62);
  txt(title, x + 50, y + 60, 28, col, 'Mono', 800, 'left');
  lines.forEach(([s, c], i) => txt(s, x + 50, y + 130 + i * 74, 44, c || '#fff', 'Mono', 800, 'left'));
  o.restore();
}
// petits dessins 2D prêts à l'emploi
const P2 = {
  speedSign(x, y, r, label = '80', a = 1) { o.save(); o.globalAlpha = a; o.fillStyle = '#fff'; o.beginPath(); o.arc(x, y, r, 0, 7); o.fill();
    o.strokeStyle = '#d0101e'; o.lineWidth = r * 0.2; o.beginPath(); o.arc(x, y, r * 0.88, 0, 7); o.stroke(); txt(label, x, y + r * 0.06, r * 0.9, '#111', 'Inter', 900); o.restore(); },
  envelope(x, y, w, h, a = 1) { o.save(); o.globalAlpha = a; o.fillStyle = '#f3efe6'; o.beginPath(); o.roundRect(x, y, w, h, 10); o.fill();
    o.strokeStyle = '#c9c2b2'; o.lineWidth = 3; o.beginPath(); o.moveTo(x, y); o.lineTo(x + w/2, y + h*0.55); o.lineTo(x + w, y); o.stroke();
    o.fillStyle = '#1f3fa0'; o.fillRect(x + w - 120, y + 22, 90, 60); o.fillStyle = '#d0101e'; o.fillRect(x + 30, y + h - 60, 220, 14); o.fillStyle = '#888'; o.fillRect(x + 30, y + h - 36, 160, 10); o.restore(); },
  // jauge circulaire (pourcentage, température…)
  gauge(x, y, r, frac, col = COL.acc, label = '', a = 1) { o.save(); o.globalAlpha = a; o.lineCap = 'round';
    o.strokeStyle = 'rgba(255,255,255,0.12)'; o.lineWidth = r * 0.16; o.beginPath(); o.arc(x, y, r, Math.PI * 0.75, Math.PI * 2.25); o.stroke();
    o.strokeStyle = col; o.shadowColor = col; o.shadowBlur = 20; o.beginPath(); o.arc(x, y, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * clamp(frac))); o.stroke();
    o.shadowBlur = 0; if (label) txt(label, x, y, r * 0.42, '#fff', 'Mono', 800); o.restore(); },
  // compteur qui défile (valeur animée) : renvoie le texte formaté à la française
  count(from, to, k, dec = 0) { const v = lerp(from, to, ease(k)); return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); },
};
function flash(a, col = '255,255,255') { if (a > 0) { o.fillStyle = `rgba(${col},${a})`; o.fillRect(0, 0, W, H); } }
function scanlines(a = 0.06, col = '#9ff') { o.save(); o.globalAlpha = a; o.fillStyle = col; for (let y = 0; y < H; y += 6) o.fillRect(0, y, W, 2); o.restore(); }

// ---------------- sous-titres (style CapCut) ----------------
// 1 à 3 mots à la fois, Montserrat Black en majuscules, contour noir épais + ombre,
// le mot prononcé passe en jaune avec un petit « pop » ; les mots clés (*mot* / ^MOT^) s'affichent dans une pastille jaune.
let CHUNKS = [], TOTAL = 60, SHOTS = [], HANDLE = '@ton.compte';
const CAP = { size: 96, max: 940, gap: 34, box: COL.acc };
function buildChunks(words) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  words.forEach((w, i) => {
    const txtw = w.w.replace(/\.\.\.$/, '…');
    const key = w.style === 'bold' || w.style === 'italic';
    if (w.style === 'bold' && cur.length && cur[cur.length - 1].style !== 'bold') flush();
    cur.push({ ...w, t: txtw.toUpperCase(), key });
    const chars = cur.reduce((s, x) => s + x.t.length, 0) + cur.length;
    const next = words[i + 1];
    const pause = next ? next.s - w.e > 0.25 : true;
    if (/[.,:;!?…]$/.test(txtw) || pause || cur.length >= 3 || chars > 16 || (w.style === 'bold' && next?.style !== 'bold') || (next?.style === 'bold' && w.style !== 'bold')) flush();
  });
  flush();
  return out.map((ws, i, arr) => ({ words: ws, s: ws[0].s, e: Math.min(ws[ws.length - 1].e + 0.6, arr[i + 1] ? arr[i + 1][0].s : 1e9) }));
}
function captions(t, yc = 440) {
  const ch = CHUNKS.find(c => t >= c.s - 0.06 && t < c.e);
  if (!ch) return;
  const big = ch.words.every(w => w.style === 'bold');
  let size = big ? 150 : CAP.size;
  o.font = `900 ${size}px Caption`;
  const widths = () => ch.words.map(w => o.measureText(w.t).width + (w.key ? size * 0.32 : 0));   // place pour la pastille
  let ws = widths(), total = ws.reduce((a, b) => a + b, 0) + CAP.gap * (ws.length - 1);
  // retour à la ligne si trop large : une seule coupure, sinon réduction
  let lines = [ch.words.map((w, i) => i)];
  if (total > CAP.max && ch.words.length > 1) {
    const cut = Math.ceil(ch.words.length / 2); lines = [[...Array(cut).keys()], [...Array(ch.words.length - cut).keys()].map(i => i + cut)];
  }
  const lineW = l => l.reduce((s, i) => s + ws[i], 0) + CAP.gap * (l.length - 1);
  const maxW = Math.max(...lines.map(lineW));
  if (maxW > CAP.max) { size = Math.floor(size * CAP.max / maxW); o.font = `900 ${size}px Caption`; ws = widths(); }
  const lt = t - ch.s, pop = lt < 0.16 ? lerp(0.82, 1.06, lt / 0.16) : lt < 0.26 ? lerp(1.06, 1, (lt - 0.16) / 0.1) : 1;
  const lh = size * 1.18, y0 = yc - (lines.length - 1) * lh / 2;
  o.save(); o.translate(540, yc); o.scale(pop, pop); o.translate(-540, -yc);
  o.textBaseline = 'middle'; o.textAlign = 'left'; o.lineJoin = 'round'; o.miterLimit = 2;
  lines.forEach((l, li) => {
    let x = 540 - lineW(l) / 2; const y = y0 + li * lh;
    for (const i of l) {
      const w = ch.words[i], active = t >= w.s - 0.03 && t < (ch.words[i + 1]?.s ?? ch.e), said = t >= w.s - 0.03;
      const k = clamp((t - w.s + 0.03) / 0.1), sc = active ? lerp(1, 1.1, ease(k)) : 1;
      o.save(); o.translate(x + ws[i] / 2, y); o.scale(sc, sc); o.translate(-(x + ws[i] / 2), -y);
      const pad = w.key ? size * 0.16 : 0;
      if (w.key && said) {   // pastille jaune derrière le mot clé
        o.fillStyle = CAP.box; o.shadowColor = 'rgba(0,0,0,0.45)'; o.shadowBlur = 18; o.shadowOffsetY = 6;
        o.beginPath(); o.roundRect(x, y - size * 0.62, ws[i], size * 1.2, size * 0.22); o.fill();
        o.shadowColor = 'transparent'; o.fillStyle = '#111'; o.fillText(w.t, x + pad, y + size * 0.04);
      } else {
        o.shadowColor = 'rgba(0,0,0,0.6)'; o.shadowBlur = 14; o.shadowOffsetY = 6;
        o.strokeStyle = '#000'; o.lineWidth = size * 0.16; o.strokeText(w.t, x + pad, y + size * 0.04);
        o.shadowColor = 'transparent'; o.fillStyle = active ? COL.acc : '#fff'; o.fillText(w.t, x + pad, y + size * 0.04);
      }
      o.restore(); x += ws[i] + CAP.gap;
    }
  });
  o.restore();
}
const grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const id = g.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = rand(i) * 255; id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 255; } g.putImageData(id, 0, 0); return c; })();

// ---------------- image ----------------
let EP = null;
function frame(t) {
  resetFx();
  let si = SHOTS.length - 1; while (si > 0 && SHOTS[si].start > t) si--;
  const sh = SHOTS[si], lt = t - sh.start, dur = (SHOTS[si + 1]?.start ?? TOTAL) - sh.start;
  const k = clamp(lt / dur);
  if (sh.update) sh.update(t, lt, k);
  if (!sh.no3d) {
    dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    composer.render();
    o.save(); const f = typeof sh.filter === 'function' ? sh.filter(t, lt, k) : sh.filter; if (f) o.filter = f;
    o.drawImage(renderer.domElement, 0, 0, W, H); o.restore();
  } else { o.fillStyle = sh.bg || '#05070c'; o.fillRect(0, 0, W, H); }
  if (sh.hud) { o.save(); sh.hud(t, lt, k); o.restore(); }
  // transition : petit flash + léger zoom de coupe
  if (si > 0 && lt < 0.18 && !sh.noFlash) flash(0.3 * (1 - lt / 0.18));
  // vignette, haut assombri pour les sous-titres, grain
  const vg = o.createRadialGradient(540, 1000, 300, 540, 1000, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)'); o.fillStyle = vg; o.fillRect(0, 0, W, H);
  const tg = o.createLinearGradient(0, 0, 0, 760); tg.addColorStop(0, 'rgba(0,0,0,0.55)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = tg; o.fillRect(0, 0, W, 760);
  o.save(); o.globalAlpha = 0.07; o.globalCompositeOperation = 'overlay'; const gx = Math.floor(rand(t * 30) * 256), gy = Math.floor(rand(t * 30 + 5) * 256);
  o.translate(-gx, -gy); o.fillStyle = o.createPattern(grain, 'repeat'); o.fillRect(gx, gy, W, H); o.restore();
  captions(t, sh.captionY ?? 440);
  // barre de progression + signature
  o.fillStyle = 'rgba(255,255,255,0.15)'; o.fillRect(0, H - 8, W, 8); o.fillStyle = COL.acc; o.fillRect(0, H - 8, W * clamp(t / TOTAL), 8);
  o.save(); o.globalAlpha = 0.55; txt(HANDLE, 540, H - 110, 32, '#cfcfcf', 'Inter', 500); o.restore();
}

// ---------------- E : tout ce qu'un épisode peut utiliser ----------------
const E = {
  THREE, RoundedBoxGeometry, scene, camera, renderer, bloom, W, H, o, COL,
  clamp, ease, easeIO, easeBack, lerp, rand, V3,
  std, phys, glassMat, glowMat, lineMat, radialTex, gradientTex, envTex,
  camSet, orbit, proj, mood, lights: { hemi, key, rim },
  shell, ring, dot, line3,
  txt, glass, tag, tag3, leader, wave2, reticle, bigNumber, bar, arrow2, panel, flash, scanlines, P2,
  B: {}, words: [], P,
};
// capture de l'image 3D courante (avec bloom) dans un canvas 1080x1920, filtre CSS optionnel — pour « photos », vignettes, inserts
E.snapshot = (filter = null) => {
  dots.instanceMatrix.needsUpdate = true; composer.render();
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  if (filter) g.filter = filter; g.drawImage(renderer.domElement, 0, 0, W, H); return c;
};
// mot(…) : instant (s) du 1er mot normalisé « word » prononcé après « after »
E.at = (word, after = 0) => {
  const norm = s => s.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿœæ0-9]/g, '');
  const w = E.words.find(x => x.s >= after - 1e-6 && norm(x.w) === norm(word));
  if (!w) throw new Error('mot introuvable dans words.json : « ' + word + ' » après ' + after + ' s');
  return w.s;
};

window.setup = async (data, ep, handle) => {
  E.words = data.words; TOTAL = data.duration + 1.4; E.TOTAL = TOTAL; if (handle) HANDLE = handle;
  CHUNKS = buildChunks(data.words);
  EP = await import(`../${ep}/scene.js?v=${Date.now()}`);
  const r = await EP.build(E);
  SHOTS = r.shots.slice().sort((a, b) => a.start - b.start); SHOTS[0].start = 0;
  return { total: TOTAL, groups: CHUNKS.length, shots: SHOTS.map(s => ({ name: s.name, start: +s.start.toFixed(3), sfx: s.sfx || 'whoosh' })), sfx: r.sfx || [] };
};
window.frame = t => { frame(t); return out.toDataURL('image/jpeg', 0.92); };
window.ready = true;
