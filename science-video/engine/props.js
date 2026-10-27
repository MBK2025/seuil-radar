// Accessoires 3D réutilisables. Chaque fonction renvoie un THREE.Group (ou un objet avec .group).
// Unités : 1 = 1 mètre. Les objets sont centrés au sol (y = 0) sauf mention contraire.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const std = (c, r = 0.8, m = 0, e = null, ei = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e ?? 0x000000, emissiveIntensity: ei });
const glowMat = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
export function radialTex(inner = 'rgba(0,0,0,0.75)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
export function textTexture(lines, { w = 512, h = 256, bg = '#f4f4f4', fg = '#111', font = '800 80px Inter' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  [].concat(lines).forEach((s, i, a) => g.fillText(s, w / 2, h / 2 + (i - (a.length - 1) / 2) * h / (a.length + 0.5)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// ombre douce de contact sous un objet
export function contactShadow(w = 2, d = 2, a = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: radialTex(`rgba(0,0,0,${a})`), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.005; return m;
}

// ---------- décor « studio » : sol sombre infini avec halo, idéal pour présenter un objet ----------
export function studio({ floor = 0x0f1420, halo = 'rgba(120,160,255,0.22)', size = 60 } = {}) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.CircleGeometry(size, 64), std(floor, 0.55, 0.1)); f.rotation.x = -Math.PI / 2; g.add(f);
  const h = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: radialTex(halo), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  h.rotation.x = -Math.PI / 2; h.position.y = 0.01; g.add(h);
  const grid = new THREE.GridHelper(size, size, 0x1f2a40, 0x141c2c); grid.position.y = 0.006; grid.material.transparent = true; grid.material.opacity = 0.35; g.add(grid);
  const spot = new THREE.SpotLight(0xffffff, 120, 30, 0.6, 0.6, 1.5); spot.position.set(3, 9, 5); spot.target.position.set(0, 0, 0); g.add(spot, spot.target);
  const fill = new THREE.PointLight(0x66aaff, 20, 20); fill.position.set(-5, 3, -3); g.add(fill);
  return g;
}

// ---------- route de nuit (axe z, voies x ∈ [-4.6, 4.6]) avec glissière, balises, arbres, lampadaires ----------
export function nightRoad() {
  const world = new THREE.Group(), m = new THREE.Matrix4();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 700), std(0x17191e, 0.92)); road.rotation.x = -Math.PI / 2; world.add(road);
  for (const s of [-1, 1]) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 700), std(0x0b1510, 1)); grass.rotation.x = -Math.PI / 2; grass.position.set(s * 105, -0.02, 0); world.add(grass);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 700), std(0xbbbbbb, 0.6, 0, 0x444444, 0.12)); edge.rotation.x = -Math.PI / 2; edge.position.set(s * 4.6, 0.01, 0); world.add(edge);
  }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 3), std(0xcccccc, 0.6, 0, 0x444444, 0.15), 120);
  for (let i = 0; i < 120; i++) { m.compose(V3(0, 0.012, -340 + i * 6), q, V3(1, 1, 1)); dashes.setMatrixAt(i, m); }
  world.add(dashes);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 700), std(0x9aa3ad, 0.35, 0.8)); rail.position.set(-6.2, 0.75, 0); world.add(rail);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), std(0x6b737c, 0.5, 0.6), 175);
  for (let i = 0; i < 175; i++) { m.compose(V3(-6.3, 0.4, -340 + i * 4), new THREE.Quaternion(), V3(1, 1, 1)); posts.setMatrixAt(i, m); }
  world.add(posts);
  const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), std(0xeeeeee, 0.5), 60);
  const balR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), std(0xff7a00, 0.4, 0, 0xff5500, 2.2), 60);
  for (let i = 0; i < 60; i++) {
    m.compose(V3(5.6, 0.5, -330 + i * 11), new THREE.Quaternion(), V3(1, 1, 1)); bal.setMatrixAt(i, m);
    m.compose(V3(5.6, 0.85, -330 + i * 11), new THREE.Quaternion(), V3(1, 1, 1)); balR.setMatrixAt(i, m);
  }
  world.add(bal, balR);
  world.add(trees(260, 11, 40, 330));
  for (const z of [-60, -10, 40, 90]) world.add(streetLamp(-7.2, z));
  for (const z of [40, -10]) { const sl = new THREE.PointLight(0xffb060, 30, 26, 1.6); sl.position.set(-5, 7.6, z); world.add(sl); }
  world.add(stars());
  return world;
}
export function trees(n = 200, minX = 11, spreadX = 40, spanZ = 330, color = 0x07110c) {
  const tree = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 7, 7), std(color, 1), n), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = side * (minX + rand(i) * spreadX), z = -spanZ + rand(i + 7) * 2 * spanZ, s = 0.7 + rand(i + 3) * 1.1;
    m.compose(V3(x, 3.5 * s, z), new THREE.Quaternion(), V3(s, s, s)); tree.setMatrixAt(i, m);
  }
  return tree;
}
export function streetLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 8, 8), std(0x3b4048, 0.5, 0.6)); pole.position.set(x, 4, z); g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.12), std(0x3b4048, 0.5, 0.6)); arm.position.set(x + 1.1, 8, z); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.35), std(0xffc070, 0.4, 0, 0xffb060, 4)); head.position.set(x + 2.2, 7.92, z); g.add(head);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,170,80,0.22)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(x + 3.7, 0.03, z); g.add(pool);
  return g;
}
export function stars(n = 500, R = 600) {
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < n; i++) { const a = rand(i) * Math.PI * 2, e = 0.15 + rand(i + 9) * 1.2; sp.push(Math.cos(a) * R * Math.cos(e), R * Math.sin(e), Math.sin(a) * R * Math.cos(e)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  return new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
}

// ---------- voiture (avant = +z) ----------
export function plateTexture(text = 'AB-123-CD') {
  const c = document.createElement('canvas'); c.width = 520; c.height = 112; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 520, 112);
  g.fillStyle = '#1f3fa0'; g.fillRect(0, 0, 58, 112); g.fillRect(462, 0, 58, 112);
  g.fillStyle = '#fff'; g.font = '800 34px Inter'; g.textAlign = 'center'; g.fillText('F', 29, 92);
  g.fillStyle = '#111'; g.font = '800 78px Mono'; g.fillText(text, 260, 84);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, 514, 106);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function car({ color = 0xb3121f, plate = 'AB-123-CD', beams = true } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.72, 4.5, 4, 0.26), paint); body.position.y = 0.72; g.add(body);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 });
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.74, 0.62, 2.3, 4, 0.24), glass); cabin.position.set(0, 1.32, -0.25); g.add(cabin);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.08, 1.7, 2, 0.04), paint); roof.position.set(0, 1.64, -0.35); g.add(roof);
  const tire = std(0x0c0c0c, 0.9), rim = std(0xb8bec6, 0.25, 0.9);
  g.userData.wheels = [];
  for (const [x, z] of [[-0.98, 1.45], [0.98, 1.45], [-0.98, -1.45], [0.98, -1.45]]) {
    const w = new THREE.Group(); w.position.set(x, 0.4, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24), tire); t.rotation.z = Math.PI / 2; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.32, 10), rim); r.rotation.z = Math.PI / 2; w.add(r);
    g.add(w); g.userData.wheels.push(w);
  }
  const hl = std(0xffffff, 0.2, 0, 0xfff4dd, 2.6); g.userData.hl = hl; g.userData.beams = [];
  for (const x of [-0.68, 0.68]) {
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.13, 0.08, 2, 0.04), hl); h.position.set(x, 0.86, 2.25); g.add(h);
    const tl = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.06, 2, 0.03), std(0xff1a1a, 0.3, 0, 0xff0000, 5)); tl.position.set(x, 0.9, -2.26); g.add(tl);
    if (beams) { const b = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 32, 1, true), glowMat(0xfff1d6, 0.03)); b.rotation.x = -Math.PI / 2 - 0.07; b.position.set(x, 0.75, 10.25); g.add(b); g.userData.beams.push(b); }
  }
  const grille = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 0.05, 2, 0.03), std(0x111111, 0.4, 0.5)); grille.position.set(0, 0.6, 2.25); g.add(grille);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.112), new THREE.MeshBasicMaterial({ map: plateTexture(plate), color: 0xa8a8a8 })); pl.position.set(0, 0.42, 2.27); g.add(pl);
  g.add(contactShadow(3.4, 6.2, 0.85));
  if (beams) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 16), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,240,210,0.30)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.025, 10); g.add(pool); g.userData.beams.push(pool);
    const spot = new THREE.SpotLight(0xfff0d8, 60, 45, 0.45, 0.6, 1.4); spot.position.set(0, 0.9, 2.3); spot.target.position.set(0, 0, 16); g.add(spot, spot.target);
  }
  // roule : place la voiture à z et fait tourner les roues
  g.userData.drive = (x, z) => { g.position.set(x, 0, z); for (const w of g.userData.wheels) w.rotation.x = z / 0.4; };
  return g;
}

// ---------- ambulance (avant = +x), gyrophares : setBlink(on) ----------
export function ambulance() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.2, clearcoat: 1 });
  const b = new THREE.Mesh(new RoundedBoxGeometry(5.2, 1.9, 2.2, 4, 0.2), white); b.position.set(-0.4, 1.35, 0); g.add(b);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.3, 2.1, 4, 0.2), white); cab.position.set(2.6, 1.05, 0); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 1.8), std(0x0a1018, 0.05, 0.9)); ws.position.set(3.4, 1.4, 0); g.add(ws);
  for (const z of [-1.12, 1.12]) { const st = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 0.02), std(0xd0101e, 0.4)); st.position.set(0.4, 1.0, z); g.add(st); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.6), std(0xf2f2f2, 0.4)); top.position.set(-0.6, 2.33, 0); g.add(top);
  for (const [w, d] of [[1.0, 0.3], [0.3, 1.0]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), std(0x1f4fa8, 0.4)); c.position.set(-0.6, 2.37, 0); g.add(c); }
  const lr = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.6, 2, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2030 })); lr.position.set(3.0, 1.82, -0.5);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.6, 2, 0.08), new THREE.MeshBasicMaterial({ color: 0x2050ff })); lb.position.set(3.0, 1.82, 0.5);
  g.add(lr, lb);
  const pr = new THREE.PointLight(0xff2030, 25, 14); pr.position.set(3, 2.4, -0.6); const pb = new THREE.PointLight(0x2050ff, 25, 14); pb.position.set(3, 2.4, 0.6); g.add(pr, pb);
  for (const [x, z] of [[-2.2, -1.05], [-2.2, 1.05], [2.4, -1.05], [2.4, 1.05]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 20), std(0x0c0c0c, 0.9)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w); }
  g.userData.setBlink = on => { lr.material.color.setHex(on ? 0xff2030 : 0x300005); lb.material.color.setHex(on ? 0x0a1030 : 0x2050ff); pr.intensity = on ? 40 : 0; pb.intensity = on ? 0 : 40; };
  return g;
}

// ---------- radar tourelle (objectif vers -z) ; .userData.lens = position locale de l'objectif ----------
export function radarTower() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 24), std(0x555b63, 0.7)); base.position.y = 0.15; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 3.6, 32), std(0xc9ced4, 0.35, 0.4)); body.position.y = 2.1; g.add(body);
  for (const [y, c] of [[1.1, 0x1f4fa8], [1.35, 0xf2f2f2], [1.6, 0xc8102e]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.36, 0.22, 32), std(c, 0.5)); b.position.y = y; g.add(b); }
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.75, 32), std(0x05070c, 0.08, 0.9)); win.position.y = 3.35; g.add(win);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc9ced4, 0.35, 0.4)); cap.position.y = 3.9; g.add(cap);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 })); led.position.set(-0.12, 3.62, -0.33); g.add(led);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), new THREE.MeshBasicMaterial({ color: 0x66ccff })); lens.position.set(-0.05, 3.35, -0.35); lens.rotation.y = Math.PI; g.add(lens);
  g.userData.lens = V3(-0.08, 3.35, -0.4);
  g.userData.blink = t => led.material.color.setHex(Math.sin(t * 9) > 0 ? 0xff2020 : 0x330000);
  return g;
}

// ---------- personnage stylisé (mannequin), hauteur ~1.8 ; .userData.walk(phase) ----------
export function human({ color = 0xFFD23F, emissive = 0x332600 } = {}) {
  const g = new THREE.Group(), mat = std(color, 0.5, 0, emissive, 0.6);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 6, 12), mat); torso.position.y = 1.15; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mat); head.position.y = 1.68; g.add(head);
  const limb = (len, r) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat); m.position.y = -len / 2 - r; p.add(m); return p; };
  const legL = limb(0.7, 0.08), legR = limb(0.7, 0.08), armL = limb(0.55, 0.06), armR = limb(0.55, 0.06);
  legL.position.set(-0.11, 0.86, 0); legR.position.set(0.11, 0.86, 0); armL.position.set(-0.3, 1.42, 0); armR.position.set(0.3, 1.42, 0);
  g.add(legL, legR, armL, armR); g.add(contactShadow(0.9, 0.9, 0.6));
  g.userData.walk = ph => { const s = Math.sin(ph) * 0.5; legL.rotation.x = s; legR.rotation.x = -s; armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8; };
  g.userData.parts = { torso, head, legL, legR, armL, armR };
  return g;
}

// ---------- flèche 3D (le long de +y, longueur 1) ----------
export function arrow3D(color = 0xFFD23F, len = 1, r = 0.05) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.8, 12), m); s.position.y = len * 0.4; g.add(s);
  const h = new THREE.Mesh(new THREE.ConeGeometry(r * 3, len * 0.2, 16), m); h.position.y = len * 0.9; g.add(h);
  // pointe la flèche de a vers b
  g.userData.point = (a, b) => { const d = b.clone().sub(a), L = d.length(); g.position.copy(a); g.scale.setScalar(L / len); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); };
  return g;
}

// ---------- planète / sphère texturée procéduralement ----------
export function planet({ r = 1, c1 = '#2a6fdb', c2 = '#3fae5a', clouds = true, seed = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) { g.fillStyle = c2; g.beginPath(); g.ellipse(rand(i * seed) * 512, 40 + rand(i * seed + 3) * 176, 10 + rand(i + 5) * 50, 6 + rand(i + 8) * 30, rand(i) * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })));
  if (clouds) grp.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 48, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 1 })));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(r * 1.08, 48, 24), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  grp.add(atm); return grp;
}
