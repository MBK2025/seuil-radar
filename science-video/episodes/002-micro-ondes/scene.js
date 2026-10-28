// Épisode 002 – Comment le micro-ondes chauffe ta nourriture.
// Unités : 1 = 10 cm. Le four est centré en x = 0, posé sur un plan de travail (y = 0), porte vers +z.
export async function build(E) {
  const { THREE, V3, P, clamp, ease, easeIO, easeBack, lerp, COL, o, W, H, rand } = E;
  E.mood('studio');
  E.bloom.strength = 0.35; E.bloom.threshold = 0.95;

  // ================= DÉCOR CUISINE =================
  const kitchen = new THREE.Group(); E.scene.add(kitchen);
  const st = P.studio({ halo: 'rgba(255,190,120,0.14)' }); st.traverse(o2 => { if (o2.isLight) o2.intensity *= 0.3; }); kitchen.add(st);
  E.lights.key.intensity = 0.8;
  const counter = new THREE.Mesh(new E.RoundedBoxGeometry(12, 0.5, 6, 3, 0.08), E.std(0x2b2320, 0.55, 0.05)); counter.position.set(0, -0.25, 0); kitchen.add(counter);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), E.std(0x1a2230, 0.9)); wall.position.set(0, 8, -4); kitchen.add(wall);
  const tiles = new THREE.GridHelper(40, 40, 0x2a3446, 0x2a3446); tiles.rotation.x = Math.PI / 2; tiles.position.set(0, 8, -3.98); tiles.material.transparent = true; tiles.material.opacity = 0.35; kitchen.add(tiles);

  // ================= LE FOUR =================
  const oven = new THREE.Group(); kitchen.add(oven);
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xb9bfc6, roughness: 0.4, metalness: 0.35, clearcoat: 0.6, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const inMat = E.std(0x6f7882, 0.5, 0.6);
  const panel = (w, h, d, x, y, z, m = shellMat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); oven.add(b); return b; };
  const shellParts = [
    panel(5, 0.1, 3.6, 0, 2.95, 0), panel(5, 0.1, 3.6, 0, 0.05, 0), panel(0.1, 3, 3.6, -2.45, 1.5, 0), panel(0.1, 3, 3.6, 2.45, 1.5, 0), panel(5, 3, 0.1, 0, 1.5, -1.75),
  ];
  const partition = panel(0.06, 2.8, 3.4, 1.1, 1.5, 0, inMat);
  const ctrl = panel(1.35, 2.9, 0.08, 1.78, 1.5, 1.78, E.std(0x14171c, 0.4, 0.3));
  // afficheur LED (texture mise à jour)
  const dispC = document.createElement('canvas'); dispC.width = 256; dispC.height = 96; const dispG = dispC.getContext('2d');
  const dispT = new THREE.CanvasTexture(dispC); dispT.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.38), new THREE.MeshBasicMaterial({ map: dispT, toneMapped: false })); disp.position.set(1.78, 2.45, 1.83); oven.add(disp);
  const setDisplay = s => { dispG.fillStyle = '#05080a'; dispG.fillRect(0, 0, 256, 96); dispG.fillStyle = '#5BFF9E'; dispG.font = '800 70px Mono'; dispG.textAlign = 'center'; dispG.textBaseline = 'middle'; dispG.fillText(s, 128, 52); dispT.needsUpdate = true; };
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 20), E.std(0x3a4049, 0.4, 0.6)); b.rotation.x = Math.PI / 2; b.position.set(1.55 + (i % 2) * 0.46, 1.85 - Math.floor(i / 2) * 0.38, 1.83); oven.add(b); }
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 32), E.std(0xb8bec6, 0.3, 0.9)); knob.rotation.x = Math.PI / 2; knob.position.set(1.78, 0.55, 1.85); oven.add(knob);
  // porte : cadre + vitre grillagée
  const door = new THREE.Group(); door.position.set(-2.45, 0, 1.8); oven.add(door);
  const frameMat = E.std(0x1b1f25, 0.35, 0.4);
  for (const [w, h, x, y] of [[3.5, 0.35, 1.75, 2.78], [3.5, 0.35, 1.75, 0.22], [0.35, 3, 0.17, 1.5], [0.35, 3, 3.38, 1.5]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat); f.position.set(x, y, 0); door.add(f); }
  const meshTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'destination-out'; for (const [x, y] of [[16, 16], [48, 16], [32, 48], [0, 48], [64, 48]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const winTex = meshTex.clone(); winTex.repeat.set(70, 66); winTex.needsUpdate = true;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.25), new THREE.MeshStandardMaterial({ color: 0x0e1116, alphaMap: winTex, transparent: true, opacity: 0.92, roughness: 0.3, metalness: 0.5, depthWrite: false }));
  win.position.set(1.75, 1.5, 0.02); door.add(win);
  const handle = new THREE.Mesh(new E.RoundedBoxGeometry(0.12, 2.0, 0.18, 2, 0.05), E.std(0xb8bec6, 0.25, 0.9)); handle.position.set(3.2, 1.5, 0.15); door.add(handle);
  // intérieur : lumière, plateau, bol
  const bulb = new THREE.PointLight(0xffd59a, 3.5, 7, 1.4); bulb.position.set(-0.7, 2.6, 0.4); oven.add(bulb);
  const plateG = new THREE.Group(); plateG.position.set(-0.65, 0.12, 0); oven.add(plateG);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 64), E.glassMat(0xcfe8ff, 0.18)); plateG.add(plate);
  const darkPlate = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 64), E.std(0x1c2027, 0.6, 0.2)); darkPlate.visible = false; plateG.add(darkPlate);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([0, 0.55, 0.75, 0.86, 0.9].map((r, i) => new THREE.Vector2(r, i * 0.17)).concat([new THREE.Vector2(0.86, 0.7)]), 48), E.phys(0xf3efe8, { roughness: 0.25, side: THREE.DoubleSide }));
  bowl.position.y = 0.05; plateG.add(bowl);
  const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.7, 0.08, 48), E.std(0xd2691e, 0.45, 0, 0x4a1a00, 0.6)); soup.position.y = 0.6; plateG.add(soup);
  // magnétron + guide d'onde (dans le compartiment de droite)
  const MAG = V3(1.78, 2.15, -0.3);
  const mag = new THREE.Group(); mag.position.copy(MAG); oven.add(mag);
  const copper = E.std(0xc8733a, 0.3, 0.9, 0x331100, 0.2);
  const magBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 32), copper); mag.add(magBody);
  for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.025, 32), E.std(0xb0b6bd, 0.3, 0.9)); f.position.y = -0.22 + i * 0.09; mag.add(f); }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12), E.std(0xe0e0e0, 0.2, 0.9)); ant.rotation.z = Math.PI / 2; ant.position.set(-0.4, 0.15, 0); mag.add(ant);
  const magGlow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), E.glowMat(0xff8a3d, 0)); mag.add(magGlow);
  const guide = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.6), E.std(0x8a929c, 0.4, 0.8)); guide.position.set(1.42, 2.3, -0.3); oven.add(guide);
  const OUTLET = V3(1.05, 2.3, -0.3);
  const setXray = a => { shellMat.opacity = 1 - a * 0.88; shellMat.depthWrite = a < 0.5; win.material.opacity = 0.92 - a * 0.75; ctrl.material.transparent = a > 0; ctrl.material.opacity = 1 - a * 0.85; partition.material.transparent = a > 0; partition.material.opacity = 1 - a * 0.8; };

  // vapeur
  const steam = (t, a = 1) => { for (let i = 0; i < 70; i++) { const ph = (t * 0.35 + rand(i)) % 1; const ang = rand(i + 3) * 6.28, r = 0.15 + rand(i + 5) * 0.5;
    E.dot(V3(-0.65 + Math.cos(ang) * r + Math.sin(t * 2 + i) * 0.08 * ph, 0.8 + ph * 2.4, Math.sin(ang) * r), 0.05 + ph * 0.09, new THREE.Color(0xffffff).multiplyScalar(0.35 * a * (1 - ph))); } };

  // ================= MOLÉCULES D'EAU (zone x = 300) =================
  const MOL = V3(300, 4, 0);
  const molWorld = new THREE.Group(); molWorld.position.copy(MOL); E.scene.add(molWorld);
  const oMat = E.std(0xff4d4d, 0.35, 0.1, 0x400000, 0.5), hMat = E.std(0xf5f5f5, 0.35, 0.1);
  const mols = [];
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Group(); const Om = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), oMat.clone()); m.add(Om);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), hMat); h.position.set(Math.sin(s * 0.91) * 0.42, Math.cos(0.91) * 0.42, 0); m.add(h); }
    const r = 1.5 + rand(i) * 5.5, a = rand(i + 1) * 6.28, b = (rand(i + 2) - 0.5) * 2.2;
    m.position.set(Math.cos(a) * r, b * 2.2, Math.sin(a) * r * 0.8); m.userData = { base: m.position.clone(), ph: rand(i + 4) * 6.28, rot0: rand(i + 6) * 6.28, O: Om };
    molWorld.add(m); mols.push(m);
  }
  const fieldArrow = P.arrow3D(0x3fe0ff, 1, 0.07); molWorld.add(fieldArrow);
  const molLight = new THREE.PointLight(0xffffff, 60, 30); molLight.position.set(4, 6, 8); molWorld.add(molLight);
  const heatMol = new THREE.Color();
  const molUpdate = (t, agit, heat, freq = 1.2) => {
    const field = Math.sign(Math.sin(t * Math.PI * 2 * freq)) || 1;
    fieldArrow.userData.point(V3(-7.5, -2.5 * field, 2), V3(-7.5, 2.5 * field, 2)); fieldArrow.visible = agit > 0;
    heatMol.setRGB(1, lerp(0.3, 0.75, heat), lerp(0.3, 0.1, heat));
    for (const m of mols) { const u = m.userData;
      const target = field > 0 ? 0 : Math.PI, wob = Math.sin(t * 9 + u.ph) * 0.5 * agit;
      m.rotation.z = lerp(u.rot0 + Math.sin(t * 0.6 + u.ph) * 0.3, target + wob, clamp(agit * 1.5));
      m.rotation.y = Math.sin(t * 0.8 + u.ph) * 0.5;
      const j = 0.04 + agit * 0.22; m.position.set(u.base.x + Math.sin(t * 11 + u.ph) * j, u.base.y + Math.cos(t * 13 + u.ph) * j, u.base.z + Math.sin(t * 7 + u.ph * 2) * j);
      u.O.material.emissive.copy(heatMol).multiplyScalar(0.15 + heat * 0.9); }
  };

  // ================= MAINS (zone x = -300) =================
  const HANDS = V3(-300, 3, 0);
  const handsG = new THREE.Group(); handsG.position.copy(HANDS); E.scene.add(handsG);
  const skin = E.std(0xc98b62, 0.6, 0, 0xff3b00, 0);
  const palmL = new THREE.Mesh(new E.RoundedBoxGeometry(0.45, 2.4, 1.5, 4, 0.2), skin), palmR = palmL.clone();
  handsG.add(palmL, palmR);
  const fingers = p => { for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.9, 4, 10), skin); f.position.set(0, 1.55, -0.52 + i * 0.35); p.add(f); } };
  fingers(palmL); fingers(palmR);
  const handLight = new THREE.PointLight(0xffe6d0, 25, 20); handLight.position.set(3, 4, 6); handsG.add(handLight);

  // ================= COUPE THERMIQUE (zone z = -300) =================
  const SLAB = V3(0, 3, -300);
  const slabG = new THREE.Group(); slabG.position.copy(SLAB); E.scene.add(slabG);
  const heatU = { uPen: { value: 0.0 }, uDiff: { value: 0.0 } };
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 3), new THREE.ShaderMaterial({ uniforms: heatU,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uPen; uniform float uDiff; varying vec3 vP;
      vec3 ramp(float x){ vec3 c1 = vec3(0.13,0.35,1.0), c2 = vec3(1.0,0.82,0.25), c3 = vec3(1.0,0.22,0.08);
        return x < 0.5 ? mix(c1, c2, x * 2.0) : mix(c2, c3, (x - 0.5) * 2.0); }
      void main(){ float d = min(3.0 - abs(vP.x), 1.7 - abs(vP.y));
        float T = uPen * exp(-d / 0.55) + uDiff * exp(-d / 1.6) * 0.75; T = clamp(T, 0.0, 1.0);
        float lines = 0.06 * step(0.92, fract(d * 4.0));
        gl_FragColor = vec4(ramp(T) * (0.85 + lines), 1.0); }` }));
  slabG.add(slab);
  const plateLow = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.12, 64), E.std(0x5a6068, 0.4, 0.3)); plateLow.position.y = -1.8; slabG.add(plateLow);
  const slabLight = new THREE.PointLight(0xffffff, 15, 25); slabLight.position.set(3, 6, 8); slabG.add(slabLight);

  // ================= CAVITÉ VUE DU DESSUS : rebonds et zones chaudes =================
  const CAV = { x0: -2.35, x1: 1.05, z0: -1.65, z1: 1.65 };
  const spotU = { uA: { value: 0 }, uRot: { value: 0 } };
  const spots = new THREE.Mesh(new THREE.PlaneGeometry(CAV.x1 - CAV.x0, CAV.z1 - CAV.z0), new THREE.ShaderMaterial({ uniforms: spotU, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vP;
      void main(){ float I = pow(cos(vP.x * 4.1 + 0.6) * cos(vP.y * 3.7 + 0.3), 2.0);
        vec3 c = mix(vec3(0.13,0.35,1.0), vec3(1.0,0.3,0.08), I);
        gl_FragColor = vec4(c, uA * (0.55 + 0.45 * I)); }` }));
  spots.rotation.x = -Math.PI / 2; spots.position.set((CAV.x0 + CAV.x1) / 2, 0.16, 0); oven.add(spots);
  const I = (x, z) => { const lx = x - (CAV.x0 + CAV.x1) / 2, lz = -z; return Math.pow(Math.cos(lx * 4.1 + 0.6) * Math.cos(lz * 3.7 + 0.3), 2); };
  const rays = [];
  for (let r = 0; r < 7; r++) {   // rayons qui rebondissent dans la cavité (vue de dessus, y = 1.6)
    let x = OUTLET.x - 0.05, z = OUTLET.z, a = Math.PI + (r - 3) * 0.32, pts = [V3(x, 2.25, z)];
    for (let s = 0; s < 160; s++) { x += Math.cos(a) * 0.08; z += Math.sin(a) * 0.08;
      if (x < CAV.x0 || x > CAV.x1) { a = Math.PI - a; x = clamp(x, CAV.x0, CAV.x1); }
      if (z < CAV.z0 || z > CAV.z1) { a = -a; z = clamp(z, CAV.z0, CAV.z1); }
      pts.push(V3(x, lerp(2.25, 1.0, s / 160), z)); }
    rays.push(pts);
  }
  const pieces = [];   // morceaux de nourriture sur le plateau
  for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new E.RoundedBoxGeometry(0.28, 0.2, 0.28, 2, 0.05), E.std(0x3a6cff, 0.5, 0, 0x000000, 0)); const a = i / 14 * 6.28, r = i % 2 ? 0.95 : 0.55;
    p.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r); p.userData = { a, r, h: 0 }; plateG.add(p); pieces.push(p); }
  const pieceCol = new THREE.Color();

  // ================= GRILLE EN MACRO (zone z = +300) =================
  const MESH = V3(0, 3, 300);
  const meshG = new THREE.Group(); meshG.position.copy(MESH); E.scene.add(meshG);
  const macroTex = meshTex.clone(); macroTex.repeat.set(6, 6); macroTex.needsUpdate = true;
  const macro = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x3c424a, alphaMap: macroTex, transparent: true, alphaTest: 0.5, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
  meshG.add(macro);
  const behind = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0xffc070 })); behind.position.z = -6; meshG.add(behind);
  const meshLight = new THREE.PointLight(0xffffff, 50, 30); meshLight.position.set(3, 4, 8); meshG.add(meshLight);
  const holes = []; for (let ix = -2; ix <= 2; ix++) for (let iy = -2; iy <= 2; iy++) for (const [hx, hy] of [[0.25, 0.25], [0.75, 0.25], [0.5, 0.75]]) holes.push(V3((ix + hx - 0.5) * 2, (iy + hy - 0.5) * 2, 0));

  // ================= 1945 : CHOCOLAT (zone x = -300, z = -300) =================
  const CHOC = V3(-300, 0, -300);
  const chocG = new THREE.Group(); chocG.position.copy(CHOC); E.scene.add(chocG);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 8), E.std(0x3b2a1e, 0.7)); desk.position.y = -0.2; chocG.add(desk);
  const mag2 = mag.clone(); mag2.position.set(2.2, 1.2, -1); mag2.scale.setScalar(2.4); chocG.add(mag2);
  const glow2 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), E.glowMat(0xff8a3d, 0.25)); glow2.position.copy(mag2.position); chocG.add(glow2);
  const bar = new THREE.Group(); bar.position.set(-1.2, 0.18, 1); chocG.add(bar);
  const chocMat = E.std(0x4a2513, 0.35, 0.05);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const sq = new THREE.Mesh(new E.RoundedBoxGeometry(0.62, 0.3, 0.62, 2, 0.08), chocMat); sq.position.set(-0.99 + i * 0.66, 0, -0.33 + j * 0.66); bar.add(sq); }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), E.std(0x3a1c0e, 0.2, 0.1)); puddle.rotation.x = -Math.PI / 2; puddle.position.set(-1.2, 0.01, 1); chocG.add(puddle);
  const chocLight = new THREE.PointLight(0xffd0a0, 40, 20); chocLight.position.set(-2, 5, 5); chocG.add(chocLight);

  // ================= TEMPS CLÉS =================
  const B = {};
  B.brulant = E.at('brûlant'); B.pourtant = E.at('pourtant'); B.flamme = E.at('flamme'); B.resist = E.at('résistance'); B.alors = E.at('alors');
  B.tout = E.at('tout', B.alors); B.magnetron = E.at('magnétron'); B.transforme = E.at('transforme'); B.mo = E.at('micro-ondes', B.transforme);
  B.oscillent = E.at('oscillent'); B.veut = E.at('veut'); B.seconde = E.at('seconde', B.veut);
  B.nourriture = E.at('nourriture'); B.eau = E.at("l'eau"); B.molecule = E.at('molécule'); B.plus = E.at('plus', B.molecule); B.moins = E.at('moins', B.plus);
  B.chaque = E.at('chaque'); B.tournent = E.at('tournent'); B.agitation = E.at('agitation'); B.chaleur = E.at('chaleur', B.agitation); B.frottes = E.at('frottes');
  B.attention = E.at('attention'); B.interieur = E.at("l'intérieur"); B.penetrent = E.at('pénètrent'); B.loin = E.at('loin'); B.voila = E.at('voilà'); B.glace = E.at('glacé');
  B.autre = E.at('autre'); B.rebondissent = E.at('rebondissent'); B.croisent = E.at('croisent'); B.resultat = E.at('résultat'); B.tourne = E.at('tourne', B.resultat);
  B.porte = E.at('porte', B.tourne); B.grille = E.at('grille'); B.trous = E.at('trous'); B.douze = E.at('12'); B.trop = E.at('trop', B.douze); B.lumiere = E.at('lumière');
  B.traverse = E.at('traverse'); B.vois = E.at('vois'); B.fou = E.at('fou'); B.hasard = E.at('hasard'); B.y1945 = E.at('1945'); B.chocolat = E.at('chocolat'); B.fond = E.at('fond', B.chocolat);
  B.alors2 = E.at('alors', B.fond); B.dansent = E.at('dansent'); B.connais = E.at('connaissais');

  const lightsOn = (...on) => { for (const l of [bulb, molLight, handLight, slabLight, meshLight, chocLight]) l.visible = on.includes(l); };
  const resetOven = () => { oven.visible = true; shellParts[0].visible = true; setXray(0); spotU.uA.value = 0; magGlow.material.opacity = 0; door.rotation.y = 0; for (const p of pieces) p.visible = false; soup.visible = true; bowl.visible = true; plate.visible = true; darkPlate.visible = false; bulb.intensity = 3.5; shellMat.color.setHex(0xb9bfc6); };
  const countdown = t => { const s = Math.max(0, 120 - Math.floor(t * 9)); setDisplay(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); };
  const shots = [];

  // 1. Accroche : le plat tourne, le compte à rebours défile, ça fume
  shots.push({ name: 'accroche', start: 0,
    update(t, lt, k) { resetOven(); lightsOn(bulb); countdown(t); plateG.rotation.y = t * 0.8;
      if (t > B.brulant - 0.3) steam(t, ease((t - B.brulant + 0.3) * 1.5));
      E.camSet(V3(lerp(3.5, 1.2, easeIO(k)), lerp(2.2, 1.9, k), lerp(10.5, 7.2, easeIO(k))), V3(-0.2, 1.5, 0), 42); },
    hud(t) { if (t > B.brulant) { const a = ease((t - B.brulant) * 3); E.tag3(V3(-0.65, 0.9, 1.8), 'BRÛLANT', -140, -200, COL.orange, a); } } });
  // 2. Rayons X : l'air n'a presque pas chauffé
  shots.push({ name: 'rayons-x', start: B.pourtant,
    update(t, lt, k) { resetOven(); lightsOn(bulb); countdown(t); setXray(ease(lt * 1.5)); plateG.rotation.y = t * 0.8; steam(t, 0.6);
      for (let i = 0; i < 160; i++) { const x = lerp(CAV.x0, CAV.x1, rand(i)), y = 0.4 + rand(i + 1) * 2.3, z = lerp(CAV.z0, CAV.z1, rand(i + 2));
        E.dot(V3(x + Math.sin(t * 0.7 + i) * 0.1, y + Math.cos(t * 0.5 + i) * 0.1, z), 0.025, 0x6fb6ff); }
      soup.material.emissiveIntensity = 1.4;
      E.orbit(V3(-0.4, 1.5, 0), lerp(0.25, -0.55, easeIO(k)), lerp(1.2, 3.2, k), lerp(7.5, 8.5, k), 44); },
    hud(t) {
      E.tag3(V3(-1.8, 2.3, 0), 'AIR : À PEINE TIÈDE', -60, -260, COL.cyan, ease((t - B.pourtant - 0.6) * 3));
      E.tag3(V3(-0.65, 0.75, 0), 'PLAT : BRÛLANT', 120, 300, COL.orange, ease((t - B.pourtant - 1.0) * 3));
      if (t > B.flamme) E.tag('✕  PAS DE FLAMME', 540, 1420, COL.red, ease((t - B.flamme) * 4));
      if (t > B.resist) E.tag('✕  PAS DE RÉSISTANCE', 540, 1520, COL.red, ease((t - B.resist) * 4)); } });
  // 3. Question : tour rapide autour du four
  shots.push({ name: 'question', start: B.alors,
    update(t, lt, k) { resetOven(); lightsOn(bulb); countdown(t); setXray(0.5); plateG.rotation.y = t * 0.8;
      E.orbit(V3(0, 1.5, 0), lerp(-0.55, -2.4, easeIO(k)), lerp(3, 4.5, k), lerp(8.5, 9.5, k), 46); },
    hud(t, lt) { E.txt('?', 540, 1300, 300 * easeBack(lt * 2.5), COL.acc, 'Inter', 900); } });
  // 4. Le magnétron
  shots.push({ name: 'magnetron', start: B.tout,
    update(t, lt, k) { resetOven(); lightsOn(bulb); setXray(0.85); countdown(t);
      magGlow.material.opacity = t > B.magnetron ? 0.25 + 0.15 * Math.sin(t * 20) : 0;
      if (t > B.transforme) { const cable = []; for (let i = 0; i <= 40; i++) { const u = i / 40; cable.push(V3(lerp(2.3, MAG.x, u), lerp(0.3, MAG.y - 0.3, u) + Math.sin(u * 3.14) * 0.3, lerp(-2.6, MAG.z, u))); }
        E.line3(0, cable, 0xffd23f, 0.9, ease((t - B.transforme) * 2)); for (let i = 0; i < 4; i++) { const u = ((t * 1.2 + i / 4) % 1); const p = cable[Math.floor(u * 40)]; E.dot(p, 0.06, 0xffd23f); } }
      E.camSet(V3(lerp(5.5, 4.2, easeIO(k)), lerp(3.6, 2.8, k), lerp(4.5, 3.4, easeIO(k))), V3(1.6, 2.1, -0.3), 40); },
    hud(t) { E.tag3(MAG.clone().add(V3(0, 0.3, 0)), 'MAGNÉTRON', -200, -220, COL.orange, ease((t - B.magnetron) * 3));
      if (t > B.transforme) E.tag3(V3(2.3, 0.35, -2.6), 'ÉLECTRICITÉ', 60, 220, COL.acc, ease((t - B.transforme) * 3)); } });
  // 5. Les micro-ondes partent dans la cavité
  shots.push({ name: 'ondes', start: B.mo,
    update(t, lt, k) { resetOven(); lightsOn(bulb); setXray(0.85); countdown(t); plateG.rotation.y = t * 0.8; magGlow.material.opacity = 0.3 + 0.15 * Math.sin(t * 20);
      for (let i = 0; i < 18; i++) { const r = ((lt * 3 + i * 0.4) % 7); if (lt * 3 < i * 0.4) continue; E.shell(i, OUTLET, V3(-1, -0.35, 0), r, 0x3fe0ff, 0.8 * (1 - r / 7)); }
      E.camSet(V3(lerp(2.6, 1.0, k), lerp(4.2, 3.6, k), lerp(8, 7, k)), V3(-0.4, 1.4, 0), 42); },
    hud(t, lt) { E.tag3(OUTLET, 'MICRO-ONDES', -200, -230, COL.cyan, ease(lt * 3)); } });
  // 6. 2,45 GHz : compteur (fond flou)
  shots.push({ name: 'frequence', start: B.oscillent, filter: 'blur(9px) brightness(0.5)',
    update(t) { shots[4].update(t, t - B.mo, 1); },
    hud(t, lt) { const a = ease(lt * 3); o.globalAlpha = a; E.glass(70, 760, 940, 860, 40, 0.6);
      E.txt('FRÉQUENCE', 120, 830, 30, COL.cyan, 'Mono', 800, 'left');
      E.txt('2,45 GHz', 540, 960, 150, '#fff', 'Mono', 800);
      E.wave2(120, 1140, 840, 60, 70, t * 40, COL.cyan, 6);
      if (t > B.veut) { const kk = clamp((t - B.veut) / (B.seconde - B.veut + 0.3));
        E.txt('CHANGEMENTS DE SENS', 120, 1290, 28, '#9ab', 'Mono', 800, 'left');
        E.txt(E.P2.count(0, 2450000000, kk), 540, 1400, 92, COL.acc, 'Mono', 800);
        E.txt('par seconde', 540, 1500, 40, '#cfd6e0', 'Mono', 800); } } });
  // 7. Zoom dans la soupe → molécules d'eau
  shots.push({ name: 'eau', start: B.nourriture,
    update(t, lt, k) {
      if (t < B.eau) { resetOven(); lightsOn(bulb); setXray(0.4); plateG.rotation.y = t * 0.8; const e = easeIO(clamp(lt / (B.eau - B.nourriture)));
        E.camSet(V3(lerp(0.6, -0.55, e), lerp(3.5, 1.35, e), lerp(6, 0.55, e)), V3(-0.65, 0.66, 0), lerp(42, 30, e)); }
      else { oven.visible = false; lightsOn(molLight); molUpdate(t, 0, 0.05); const e = easeIO(clamp((t - B.eau) / 3));
        E.camSet(MOL.clone().add(V3(lerp(0, 3, e), lerp(1, 2.5, e), lerp(5, 16, e))), MOL.clone().add(V3(-1, 0, 0)), 50); } },
    hud(t) { if (Math.abs(t - B.eau) < 0.25) E.flash(1 - Math.abs(t - B.eau) / 0.25);
      if (t > B.plus - 0.2) { const m = mols[5], wp = m.getWorldPosition(new THREE.Vector3());
        E.tag3(wp.clone().add(V3(0, 0.45, 0)), '+', -60, -150, COL.cyan, ease((t - B.plus + 0.2) * 4));
        E.tag3(wp.clone().add(V3(0, -0.3, 0)), '−', 80, 150, COL.red, ease((t - B.moins + 0.2) * 4)); }
      if (t > B.molecule && t < B.plus) E.tag3(mols[5].getWorldPosition(new THREE.Vector3()), 'H₂O', 120, -200, '#fff', ease((t - B.molecule) * 3)); } });
  // 8. Le champ s'inverse, les molécules tournent → chaleur
  shots.push({ name: 'agitation', start: B.chaque,
    update(t, lt, k) { oven.visible = false; lightsOn(molLight);
      const agit = t < B.tournent ? 0.35 : t < B.agitation ? 0.8 : 1, heat = clamp((t - B.tournent) / (B.chaleur - B.tournent + 0.5));
      molUpdate(t, agit, heat, t < B.tournent ? 0.8 : 2.2);
      if (t > B.chaleur - 0.2) for (let i = 0; i < 120; i++) { const ph = (t * 0.5 + rand(i)) % 1; E.dot(MOL.clone().add(V3((rand(i + 1) - 0.5) * 14, -4 + ph * 9, (rand(i + 2) - 0.5) * 8)), 0.06, new THREE.Color(1, 0.45, 0.1).multiplyScalar(1 - ph)); }
      E.camSet(MOL.clone().add(V3(lerp(-3, 4, easeIO(k)), lerp(2, 1, k), lerp(15, 12, k))), MOL.clone().add(V3(-1.5, 0, 0)), 52); },
    hud(t) { E.tag3(MOL.clone().add(V3(-7.5, 2.8, 2)), 'CHAMP ÉLECTRIQUE', 40, -160, COL.cyan, ease((t - B.chaque) * 3));
      if (t > B.chaleur) { const a = ease((t - B.chaleur) * 3); E.P2.gauge(540, 1430, 150, ease((t - B.chaleur) / 1.2), COL.orange, '', a); E.txt('CHALEUR', 540, 1440, 42, '#fff', 'Mono', 800); } } });
  // 9. Les mains qu'on frotte
  shots.push({ name: 'mains', start: B.frottes,
    update(t, lt, k) { oven.visible = false; lightsOn(handLight); const s = Math.sin(lt * 26) * 0.55;
      palmL.position.set(-0.27, s, 0); palmR.position.set(0.27, -s, 0); palmL.rotation.z = 0.05; palmR.rotation.z = -0.05;
      skin.emissiveIntensity = clamp(lt / 1.5) * 0.5;
      for (let i = 0; i < 40; i++) { const ph = (lt * 1.2 + rand(i)) % 1; E.dot(HANDS.clone().add(V3((rand(i + 3) - 0.5) * 1.2 + (rand(i) - 0.5) * ph * 3, (rand(i + 5) - 0.5) * 2.6, 0.9 + ph)), 0.04, new THREE.Color(1, 0.6, 0.2).multiplyScalar(1 - ph)); }
      E.camSet(HANDS.clone().add(V3(lerp(5.5, 4.5, k), lerp(2.5, 2, k), lerp(4.5, 3.8, k))), HANDS.clone().add(V3(0, 0.3, 0)), 45); },
    hud(t, lt) { E.tag3(HANDS.clone().add(V3(0, 0, 0.9)), 'FROTTEMENT = CHALEUR', -60, 300, COL.orange, ease((lt - 0.4) * 3)); } });
  // 10. Idée reçue : coupe thermique
  shots.push({ name: 'coupe', start: B.attention,
    update(t, lt, k) { oven.visible = false; lightsOn(slabLight);
      heatU.uPen.value = t < B.penetrent ? 0.15 : ease((t - B.penetrent) / 1.5);
      heatU.uDiff.value = t < B.loin ? 0 : ease((t - B.loin) / 4) * 0.55;
      for (let i = 0; i < 10; i++) if (t > B.penetrent && t < B.loin + 1) { const r = ((lt * 2.5 + i * 0.5) % 3); E.shell(i, SLAB.clone().add(V3(lerp(-3, 3, (i % 5) / 4), 5.5, 0)), V3(0, -1, 0), r, 0x3fe0ff, 0.7 * (1 - r / 3), 0.6); }
      E.camSet(SLAB.clone().add(V3(lerp(-4, 3, easeIO(k)), lerp(4.5, 2, k), lerp(19, 16, k))), SLAB.clone().add(V3(0, -0.6, 0)), 45); },
    hud(t) {
      if (t < B.penetrent) E.tag('IDÉE REÇUE', 540, 760, COL.red, ease((t - B.attention) * 3));
      if (t > B.penetrent) { const [x1, y1] = E.proj(SLAB.clone().add(V3(-3, 1.7, 1.5))), [x2, y2] = E.proj(SLAB.clone().add(V3(-2.45, 1.7, 1.5)));
        E.tag3(SLAB.clone().add(V3(-2.7, 0, 1.5)), 'QUELQUES CM', -40, -330, COL.cyan, ease((t - B.penetrent) * 3)); }
      if (t > B.loin + 0.3 && t < B.voila) E.tag3(SLAB.clone().add(V3(-1.8, 0, 1.5)), 'LA CHALEUR AVANCE →', 120, 260, COL.acc, ease((t - B.loin - 0.3) * 3));
      if (t > B.voila) E.tag3(SLAB.clone().add(V3(2.7, 1.3, 1.5)), 'BRÛLANT', 0, -280, COL.orange, ease((t - B.voila) * 3));
      if (t > B.glace) E.tag3(SLAB.clone().add(V3(0, 0, 1.5)), 'GLACÉ', 0, 300, COL.cyan, ease((t - B.glace) * 3)); } });
  // 11. Les ondes rebondissent (vue de dessus) → zones chaudes → le plateau tourne
  shots.push({ name: 'rebonds', start: B.autre,
    update(t, lt, k) { resetOven(); lightsOn(bulb); setXray(1); soup.visible = false; bowl.visible = t < B.rebondissent;
      for (const p of pieces) p.visible = t > B.resultat;
      plate.visible = false; darkPlate.visible = true; bulb.intensity = 0.8; shellMat.color.setHex(0x23272d); shellMat.opacity = 1; shellParts[0].visible = false;
      if (t > B.rebondissent) rays.forEach((pts, i) => { const n = Math.floor(pts.length * ease((t - B.rebondissent - i * 0.08) / 1.8));
        E.line3(i, pts.slice(0, Math.max(2, n)), 0x3fe0ff, 0.9, 1);
        for (let q = 0; q < 3; q++) { const j = Math.floor(((t * 40 + q * 53 + i * 17) % Math.max(1, n))); E.dot(pts[j], 0.07, 0x7fe9ff); } });
      spotU.uA.value = t > B.croisent ? ease((t - B.croisent) / 1.2) : 0;
      plateG.rotation.y = t > B.tourne ? (t - B.tourne) * 1.6 : 0;
      for (const p of pieces) { const u = p.userData, ang = u.a + plateG.rotation.y, wx = plateG.position.x + Math.cos(ang) * u.r, wz = -Math.sin(ang) * u.r;
        const inten = t > B.tourne ? 0.55 + 0.45 * I(wx, wz) : I(plateG.position.x + Math.cos(u.a) * u.r, -Math.sin(u.a) * u.r);
        const h = t < B.resultat ? 0 : clamp((t - B.resultat) / 3) * inten;
        pieceCol.setRGB(lerp(0.23, 1, h), lerp(0.42, 0.35, h), lerp(1, 0.08, h)); p.material.color.copy(pieceCol); p.material.emissive.copy(pieceCol); p.material.emissiveIntensity = 0.22; }
      const e = easeIO(clamp(lt / 2.2)); E.camSet(V3(lerp(1.5, -0.65, e), lerp(7, 9.5, e), lerp(7.5, 0.01, e)), V3(-0.65, 0.2, 0), lerp(44, 34, e)); },
    hud(t) {
      if (t > B.resultat) { E.tag('■ ZONE CHAUDE', 300, 1660, COL.orange, ease((t - B.resultat) * 3)); E.tag('■ ZONE FROIDE', 780, 1660, COL.cyan, ease((t - B.resultat - 0.3) * 3)); }
      if (t > B.tourne) E.tag('↻  LE PLATEAU TOURNE', 540, 760, COL.acc, ease((t - B.tourne) * 3)); } });
  // 12. La porte
  shots.push({ name: 'porte', start: B.porte,
    update(t, lt, k) { resetOven(); lightsOn(bulb); countdown(t); plateG.rotation.y = t * 0.8;
      const e = easeIO(k); E.camSet(V3(lerp(-0.2, -0.7, e), lerp(1.6, 1.5, e), lerp(6.5, 2.4, e)), V3(-0.7, 1.5, 1.8), 40); },
    hud(t) { if (t > B.grille) E.tag3(V3(-0.2, 2.2, 1.85), 'GRILLE MÉTALLIQUE', 80, -250, COL.acc, ease((t - B.grille) * 3)); } });
  // 13. Macro sur la grille : onde réfléchie, lumière qui passe
  shots.push({ name: 'macro', start: B.trous,
    update(t, lt, k) { oven.visible = false; lightsOn(meshLight);
      if (t > B.douze - 0.3) for (let i = 0; i < 5; i++) { const ph = ((t - B.douze + 0.3) * 0.9 + i * 0.2) % 2; const inc = ph < 1;
        const r = inc ? lerp(1, 7, ph) : lerp(7, 1, ph - 1);
        E.shell(i, MESH.clone().add(V3(0, 0, inc ? -7 - 0 : -7)), V3(0, 0, 1), r, 0xff8a3d, inc ? 0.8 : 0.35, 1.6); }
      if (t > B.lumiere) holes.forEach((h, i) => { if (i % 2) return; const a = MESH.clone().add(h).add(V3(0, 0, -5)), b = MESH.clone().add(h).add(V3(h.x * 0.15, h.y * 0.15, 12));
        E.line3(10 + (i >> 1), [a, b], 0xfff2b0, 0.85, ease((t - B.lumiere - i * 0.01) * 1.5)); });
      E.camSet(MESH.clone().add(V3(lerp(3.5, 1.5, easeIO(k)), lerp(2.5, 1.2, k), lerp(7, 9.5, easeIO(k)))), MESH.clone(), 48); },
    hud(t) {
      E.tag3(MESH.clone().add(V3(1, 1, 0)), 'TROU ≈ 1 MM', 80, -240, '#fff', ease((t - B.trous) * 3));
      if (t > B.douze) E.tag('ONDE ≈ 12 CM  →  BLOQUÉE', 540, 1540, COL.orange, ease((t - B.douze) * 3));
      if (t > B.traverse) E.tag('LUMIÈRE  →  PASSE ✓', 540, 1640, COL.acc, ease((t - B.traverse) * 3)); } });
  // 14. Tu vois ton plat
  shots.push({ name: 'vois', start: B.vois,
    update(t, lt, k) { resetOven(); lightsOn(bulb); countdown(t); plateG.rotation.y = t * 0.8; steam(t, 0.7);
      for (let i = 0; i < 6; i++) { const r = ((lt * 2 + i * 0.6) % 3.6); E.shell(i, OUTLET, V3(-1, -0.3, 0), r, 0x3fe0ff, 0.5 * (1 - r / 3.6)); }
      setXray(0.15); E.camSet(V3(lerp(0.8, 2.2, k), 2, lerp(7, 8.5, k)), V3(-0.5, 1.4, 0), 42); } });
  // 15. 1945
  shots.push({ name: '1945', start: B.fou, filter: 'sepia(0.55) contrast(1.1)',
    update(t, lt, k) { oven.visible = false; lightsOn(chocLight);
      glow2.material.opacity = 0.2 + 0.1 * Math.sin(t * 15); mag2.rotation.y = t * 0.2;
      const m = t > B.fond - 0.2 ? ease((t - B.fond + 0.2) / 1.6) : 0;
      bar.scale.set(1 + m * 0.25, 1 - m * 0.75, 1 + m * 0.25); bar.position.y = 0.18 - m * 0.1; puddle.scale.setScalar(0.01 + m * 1.7);
      E.camSet(CHOC.clone().add(V3(lerp(-5, -2, easeIO(k)), lerp(5.5, 3.6, k), lerp(10, 7.5, easeIO(k)))), CHOC.clone().add(V3(0, 0.3, 0)), 44); },
    hud(t) { if (t > B.y1945) { o.globalAlpha = ease((t - B.y1945) * 3); E.txt('1945', 540, 1560, 150, '#f3e2c0', 'Mono', 800); E.txt('PERCY SPENCER · INGÉNIEUR', 540, 1660, 34, '#d8c6a4', 'Mono', 800); o.globalAlpha = 1; }
      if (t > B.chocolat) E.tag3(CHOC.clone().add(V3(-1.2, 0.4, 1)), 'CHOCOLAT', -140, 250, COL.orange, ease((t - B.chocolat) * 3));
      if (t > B.magnetron && t > B.y1945) E.tag3(CHOC.clone().add(mag2.position).add(V3(0, 1.2, 0)), 'MAGNÉTRON', 60, -230, COL.acc, ease((t - B.y1945 - 0.8) * 3)); } });
  // 16. Fin : retour au four, les molécules dansent, « ding »
  shots.push({ name: 'fin', start: B.alors2,
    update(t, lt, k) { resetOven(); lightsOn(bulb); setXray(t > B.dansent - 0.3 ? 0.5 : 0); plateG.rotation.y = t * 0.8; steam(t, 1);
      setDisplay(t > B.connais ? 'END' : '0:0' + Math.max(0, 9 - Math.floor(lt * 2)));
      if (t > B.dansent - 0.3) for (let i = 0; i < 300; i++) { const a = rand(i) * 6.28, r = rand(i + 1) * 0.75; E.dot(V3(-0.65 + Math.cos(a + t * 3) * r, 0.62 + Math.sin(t * 9 + i) * 0.05, Math.sin(a + t * 3) * r), 0.03, i % 3 ? 0xff4d4d : 0xffffff); }
      const e = easeIO(k); E.camSet(V3(lerp(1.5, 4.5, e), lerp(1.8, 4.5, e), lerp(5.5, 11.5, e)), V3(-0.3, 1.3, 0), 42); } });

  return { shots, sfx: [
    { t: B.brulant, type: 'boom' }, { t: B.flamme, type: 'pop' }, { t: B.resist, type: 'pop' }, { t: B.alors - 0.1, type: 'rise' },
    { t: B.magnetron, type: 'boom' }, { t: B.transforme + 0.4, type: 'pop' }, { t: E.at('gigahertz'), type: 'pop' }, { t: B.seconde, type: 'ding' },
    { t: B.eau, type: 'pop' }, { t: B.plus, type: 'pop' }, { t: B.chaleur, type: 'boom' }, { t: B.penetrent, type: 'pop' }, { t: B.glace, type: 'pop' },
    { t: B.resultat, type: 'pop' }, { t: B.grille, type: 'click' }, { t: B.douze, type: 'boom' }, { t: B.traverse, type: 'ding' },
    { t: B.fou - 0.1, type: 'rise' }, { t: B.y1945, type: 'boom' }, { t: B.connais + 1.2, type: 'ding' } ] };
}
