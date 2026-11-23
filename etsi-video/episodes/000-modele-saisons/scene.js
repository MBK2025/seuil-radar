// Épisode 004 – Pourquoi il y a des saisons.
// Style holo. Zones : système Soleil-Terre (origine, pas à l'échelle), lampe de poche (x = 300),
// sol + Soleil bas (z = 300), Uranus (x = -300) et son orbite (x = -300, z = -300).
// Repère : décembre = Terre en +x (a = 0), juin = Terre en -x (a = π). L'axe de la Terre penche toujours vers +x.
export async function build(E) {
  const { THREE, V3, P, clamp, ease, easeIO, easeBack, lerp, COL, o, rand } = E;
  E.mood('space');
  const YEL = 0xffd23f, ORANGE = 0xff8a3d, CYAN = 0x3fe0ff, GREEN = 0x5bff9e;
  const DEG = Math.PI / 180, TILT = 23.5 * DEG;
  const col3 = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const grid = (pos, size = 40) => { const g = new THREE.GridHelper(size, size, 0x16336e, 0x0d2350); g.position.copy(pos); g.material.transparent = true; g.material.opacity = 0.35; g.userData.noHolo = true; E.scene.add(g); return g; };

  // ================= PLANÈTE (shader : jour / nuit, grille de latitudes, bande de latitude) =================
  const planetMat = (col) => new THREE.ShaderMaterial({
    uniforms: { uSun: { value: V3(1, 0, 0) }, uCol: { value: new THREE.Color(col) }, uLat: { value: -99 }, uLatA: { value: 0 }, uBright: { value: 1 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0);
        vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uCol; uniform float uLat; uniform float uLatA; uniform float uBright;
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 p = normalize(vP); float lat = degrees(asin(clamp(p.y, -1.0, 1.0))); float lon = degrees(atan(p.z, p.x));
        float la = abs(fract(lat / 15.0 + 0.5) - 0.5) * 15.0;
        float lo = abs(fract(lon / 15.0 + 0.5) - 0.5) * 15.0 * cos(radians(lat));
        float gl = (1.0 - smoothstep(0.2, 0.65, la)) + (1.0 - smoothstep(0.2, 0.65, lo)) * step(abs(lat), 80.0);
        float eq = 1.0 - smoothstep(0.3, 0.9, abs(lat));
        float day = smoothstep(-0.06, 0.1, dot(normalize(vN), normalize(uSun)));
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        vec3 c = mix(vec3(0.006, 0.012, 0.04), uCol * 0.42, day);
        c += uCol * clamp(gl, 0.0, 1.0) * mix(0.07, 0.75, day) + uCol * eq * mix(0.12, 0.35, day);
        c += uCol * fres * mix(0.18, 0.7, day);
        float lb = 1.0 - smoothstep(0.5, 1.4, abs(lat - uLat));
        c += vec3(1.0, 0.8, 0.25) * lb * uLatA * mix(0.4, 1.0, day);
        gl_FragColor = vec4(c * uBright, 1.0); }` });
  const makePlanet = (col, r, tilt, axisCol = YEL) => {
    const g = new THREE.Group(); E.scene.add(g);
    const tiltG = new THREE.Group(); tiltG.rotation.z = -tilt; g.add(tiltG);
    const spin = new THREE.Group(); tiltG.add(spin);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), planetMat(col)); spin.add(mesh);
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.03, r * 3.2, 10), E.std(0xffffff)); axis.userData.holoColor = axisCol; axis.userData.holoStrength = 1.4; tiltG.add(axis);
    const npole = new THREE.Mesh(new THREE.ConeGeometry(r * 0.09, r * 0.25, 12), E.std(0xffffff)); npole.position.y = r * 1.7; npole.userData.holoColor = axisCol; npole.userData.holoStrength = 1.4; tiltG.add(npole);
    const P_ = { g, tiltG, spin, mesh, axis, npole, r, mat: mesh.material };
    P_.sun = (sunPos) => { const wp = g.getWorldPosition(new THREE.Vector3()); P_.mat.uniforms.uSun.value.copy(sunPos).sub(wp).normalize(); };
    // point de surface (latitude, longitude en degrés) → monde
    P_.pt = (lat, lon, h = 1.0) => { mesh.updateWorldMatrix(true, false); return mesh.localToWorld(V3(Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG)).multiplyScalar(r * h)); };
    P_.nrm = (lat, lon) => P_.pt(lat, lon, 1).sub(g.getWorldPosition(new THREE.Vector3())).normalize();
    P_.axisDir = () => { tiltG.updateWorldMatrix(true, false); return V3(0, 1, 0).applyQuaternion(tiltG.getWorldQuaternion(new THREE.Quaternion())); };
    return P_;
  };

  // ================= SYSTÈME SOLAIRE (origine) =================
  const R = 16;
  const orbitPos = a => V3(R * Math.cos(a), 0, -R * Math.sin(a));
  const SUN = V3(0, 0, 0);
  const sunG = new THREE.Group(); E.scene.add(sunG);
  const sunShell = new THREE.Mesh(new THREE.SphereGeometry(3, 48, 32), E.std(0xffffff)); sunShell.userData.holoColor = YEL; sunShell.userData.holoStrength = 1.1; sunG.add(sunShell);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(2.85, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6a4212 })); sunCore.userData.noHolo = true; sunG.add(sunCore);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.radialTex('rgba(255,190,80,0.55)', 'rgba(255,140,40,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  corona.scale.setScalar(13); corona.userData.noHolo = true; sunG.add(corona);
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 200 }, (_, i) => orbitPos(i / 200 * Math.PI * 2))),
    new THREE.LineBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  orbitLine.userData.noHolo = true; E.scene.add(orbitLine);
  const orbitPts = Array.from({ length: 241 }, (_, i) => orbitPos(i / 240 * Math.PI * 2));
  const earth = makePlanet(0x3d8bff, 1, TILT);
  const ghosts = [0, 1, 2, 3].map(i => { const gh = makePlanet(0x3d8bff, 1, TILT); gh.g.position.copy(orbitPos(i * Math.PI / 2)); gh.g.scale.setScalar(1.6); gh.mat.uniforms.uBright.value = 0.6; return gh; });
  const stars = P.stars(700, 500); stars.userData.noHolo = true; stars.material.size = 1.3; stars.material.color.setHex(0x6f8fc0); E.scene.add(stars);
  const placeEarth = (a, s = 1, spin = 0) => { earth.g.position.copy(orbitPos(a)); earth.g.scale.setScalar(s); earth.spin.rotation.y = spin; earth.sun(SUN); };

  // ================= LAMPE DE POCHE (x = 300) =================
  const LAMP = V3(300, 0, 0), LH = 5;
  const lampZone = new THREE.Group(); lampZone.position.copy(LAMP); E.scene.add(lampZone);
  const lg = grid(LAMP, 30); lampZone.userData.grid = lg;
  const piv = new THREE.Group(); piv.position.set(0, LH, 0); lampZone.add(piv);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.2, 24), E.std(0xffffff)); body.position.y = 1.55; piv.add(body);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.6, 28), E.std(0xffffff)); head.position.y = 0.3; head.rotation.x = Math.PI; piv.add(head);
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.12), E.std(0xffffff)); btn.position.set(0, 1.6, 0.34); btn.userData.holoColor = ORANGE; piv.add(btn);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x8a7a40, side: THREE.DoubleSide })); lens.rotation.x = Math.PI / 2; lens.position.y = 0.0; lens.userData.noHolo = true; piv.add(lens);
  const ALPHA = 13 * DEG;
  const beamGeo = new THREE.ConeGeometry(1, 1, 40, 1, true); beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.userData.noHolo = true; piv.add(beam);
  const spotU = { uPiv: { value: V3() }, uDir: { value: V3(0, -1, 0) }, uCosA: { value: Math.cos(ALPHA) }, uK: { value: 22 } };
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShaderMaterial({ uniforms: spotU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uPiv; uniform vec3 uDir; uniform float uCosA; uniform float uK; varying vec3 vW;
      void main(){ vec3 d = vW - uPiv; vec3 v = normalize(d); float inside = smoothstep(uCosA - 0.003, uCosA + 0.003, dot(v, uDir));
        float I = inside * max(-v.y, 0.0) / dot(d, d) * uK; I = min(I, 0.95);
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.3) * I, 1.0); }` }));
  spot.rotation.x = -Math.PI / 2; spot.position.y = 0.01; lampZone.add(spot);
  // inclinaison de la lampe (beta, autour de z) → centre de la tache, demi-axes
  const setLamp = (beta) => { piv.rotation.z = beta; piv.updateWorldMatrix(true, true);
    const dir = V3(Math.sin(beta), -Math.cos(beta), 0); const L = LH / Math.cos(beta) + 0.4;
    beam.scale.set(L * Math.tan(ALPHA), L, L * Math.tan(ALPHA));
    spotU.uPiv.value.copy(LAMP).add(V3(0, LH, 0)); spotU.uDir.value.copy(dir);
    const xa = LH * Math.tan(beta - ALPHA), xb = LH * Math.tan(beta + ALPHA);
    return { cx: (xa + xb) / 2, a: (xb - xa) / 2, b: LH / Math.cos(beta) * Math.tan(ALPHA), dir }; };
  const square = (c, s = 1) => [V3(-s / 2, 0.03, -s / 2), V3(s / 2, 0.03, -s / 2), V3(s / 2, 0.03, s / 2), V3(-s / 2, 0.03, s / 2), V3(-s / 2, 0.03, -s / 2)].map(p => p.add(c));

  // ================= SOL + SOLEIL BAS (z = 300) =================
  const GR = V3(0, 0, 300);
  const groundZone = new THREE.Group(); groundZone.position.copy(GR); E.scene.add(groundZone);
  const gg = grid(GR, 40);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 6), E.std(0xffffff)); slab.position.y = -0.2; slab.userData.holoStrength = 0.25; groundZone.add(slab);
  const house = new THREE.Group(); house.position.set(-4.5, 0, -1.2); groundZone.add(house);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), E.std(0xffffff)); hb.position.y = 0.6; house.add(hb);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), E.std(0xffffff)); roof.position.y = 1.65; roof.rotation.y = Math.PI / 4; roof.userData.holoColor = ORANGE; house.add(roof);
  const tree = new THREE.Group(); tree.position.set(4.6, 0, -1.4); groundZone.add(tree);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 10), E.std(0xffffff)); trunk.position.y = 0.6; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), E.std(0xffffff)); crown.position.y = 1.7; crown.userData.holoColor = GREEN; tree.add(crown);
  const sun2 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 20), E.std(0xffffff)); sun2.userData.holoColor = YEL; sun2.userData.holoStrength = 1.3; groundZone.add(sun2);
  const sun2glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.radialTex('rgba(255,200,90,0.6)', 'rgba(255,150,40,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sun2glow.scale.setScalar(4.5); sun2glow.userData.noHolo = true; groundZone.add(sun2glow);

  // ================= URANUS (x = -300) =================
  const UR = V3(-300, 0, 0), URS = V3(-300, 0, -300), RU = 15;
  const uranus = makePlanet(0x4fe3d0, 2.4, 98 * DEG, 0xffd23f);
  const uRing = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 96), new THREE.MeshBasicMaterial({ color: 0x4fe3d0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  uRing.rotation.x = Math.PI / 2; uRing.userData.noHolo = true; uranus.tiltG.add(uRing);
  const uSunG = new THREE.Group(); uSunG.position.copy(URS); E.scene.add(uSunG);
  const uSunS = sunShell.clone(); uSunS.scale.setScalar(0.6); uSunG.add(uSunS); const uSunC = sunCore.clone(); uSunC.scale.setScalar(0.6); uSunG.add(uSunC);
  const uCor = corona.clone(); uCor.scale.setScalar(8); uSunG.add(uCor);
  const uOrbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 200 }, (_, i) => V3(RU * Math.cos(i / 200 * 6.283), 0, -RU * Math.sin(i / 200 * 6.283)).add(URS))), orbitLine.material.clone());
  uOrbit.userData.noHolo = true; E.scene.add(uOrbit);
  grid(UR.clone().add(V3(0, -5, 0)), 30);

  // ================= TEMPS CLÉS =================
  const B = {};
  B.janvier = E.at('janvier'); B.pres = E.at('près'); B.hiver = E.at('hiver'); B.alors = E.at('alors'); B.saisons = E.at('saisons');
  B.oublie = E.at('oublie'); B.voila = E.at('voilà'); B.dabord = E.at("d'abord"); B.orbite = E.at('orbite'); B.pres2 = E.at('près', B.orbite); B.n147 = E.at('147');
  B.loin = E.at('loin'); B.n152 = E.at('152'); B.ca = E.at('ça', B.n152); B.n3 = E.at('3', B.ca); B.beaucoup = E.at('beaucoup');
  B.preuve = E.at('preuve'); B.france = E.at('france'); B.australie = E.at('australie'); B.si = E.at('si', B.australie); B.toute = E.at('toute', B.si);
  B.vrai = E.at('vrai'); B.inclin = E.at("l'inclinaison"); B.axe = E.at("l'axe"); B.tourne = E.at('tourne', B.axe); B.n235 = E.at('23,5');
  B.surtout = E.at('surtout'); B.pointe = E.at('pointe'); B.resultat = E.at('résultat'); B.juin = E.at('juin'); B.nord = E.at('nord'); B.penche = E.at('penche', B.nord);
  B.decembre = E.at('décembre'); B.inverse = E.at("l'inverse"); B.autre = E.at("l'autre", B.inverse); B.deux = E.at('deux'); B.un = E.at('un', B.deux); B.angle = E.at("l'angle");
  B.prends = E.at('prends'); B.eclaire = E.at('éclaire'); B.cercle = E.at('cercle'); B.penchela = E.at('penche-la'); B.tache = E.at('tache'); B.pale = E.at('pâle');
  B.enhiver = E.at('en', B.pale); B.bas = E.at('bas', B.enhiver); B.biais = E.at('biais'); B.metre = E.at('mètre'); B.energie = E.at("d'énergie");
  B.deux2 = E.at('deux', B.energie); B.paris = E.at('paris'); B.n16 = E.at('16'); B.findec = E.at('fin', B.n16); B.n8 = E.at('8', B.findec);
  B.moins = E.at('moins', B.n8); B.refroidir = E.at('refroidir'); B.rayons2 = E.at('rayons', B.refroidir); B.voila2 = E.at('voilà', B.rayons2);
  B.fou = E.at('fou'); B.uranus = E.at('uranus'); B.n98 = E.at('98'); B.couchee = E.at('couchée'); B.labas = E.at('là-bas'); B.n84 = E.at('84');
  B.saison = E.at('saison', B.n84); B.vingtaine = E.at('vingtaine'); B.imagine = E.at('imagine'); B.alors2 = E.at('alors', B.imagine);
  B.souviens = E.at('souviens-toi'); B.cest = E.at("c'est", B.souviens); B.penchee = E.at('penchée'); B.toi = E.at('toi', B.penchee);

  // ================= VISIBILITÉ PAR ZONE =================
  const zones = { sys: [sunG, orbitLine, earth.g, stars], ghosts: ghosts.map(g => g.g), lamp: [lampZone, lg], ground: [groundZone, gg], ur: [uranus.g], urs: [uSunG, uOrbit] };
  const show = (...names) => { for (const [k, arr] of Object.entries(zones)) for (const ob of arr) ob.visible = names.includes(k); stars.visible = true; };
  const earthReset = () => { earth.mat.uniforms.uLatA.value = 0; earth.mat.uniforms.uBright.value = 1; earth.axis.visible = true; earth.npole.visible = true; earth.axis.scale.y = 1; };
  // flux de photons venant du Soleil vers la Terre (plans rapprochés)
  const photons = (t, target, from, n = 90, spread = 1.4, len = 9, c = YEL, a = 0.8) => { const d = from.clone().sub(target).normalize();
    const u = Math.abs(d.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0); const s1 = u.clone().cross(d).normalize(), s2 = d.clone().cross(s1).normalize();
    for (let i = 0; i < n; i++) { const ph = (t * 0.7 + rand(i + 11)) % 1; const ox = (rand(i + 3) - 0.5) * 2 * spread, oy = (rand(i + 7) - 0.5) * 2 * spread * 1.2;
      E.dot(target.clone().add(d.clone().multiplyScalar(lerp(len, 1.1, ph))).add(s1.clone().multiplyScalar(ox)).add(s2.clone().multiplyScalar(oy)), 0.05, col3(c, a * Math.sin(ph * 3.14))); } };
  const snow = (t, P_, a = 1, n = 140) => { for (let i = 0; i < n; i++) { const lat = 35 + rand(i + 5) * 45, lon = rand(i + 9) * 360, ph = (t * 0.25 + rand(i)) % 1;
    E.dot(P_.pt(lat, lon, 1.04 + ph * 0.25), 0.028 * P_.g.scale.x, col3(0xcfe8ff, a * Math.sin(ph * 3.14))); } };
  const latDots = (P_, lat, n = 120) => { let lit = 0; const sd = P_.mat.uniforms.uSun.value; for (let i = 0; i < n; i++) { const lon = i / n * 360; const isLit = P_.nrm(lat, lon).dot(sd) > 0; if (isLit) lit++;
    E.dot(P_.pt(lat, lon, 1.025), 0.026 * P_.g.scale.x, isLit ? 0xc89a20 : 0x5a3cd0); } return lit / n; };
  const clock = (x, y, r, frac, label, a, col = COL.acc) => { o.save(); o.globalAlpha = a; E.glass(x - r - 50, y - r - 50, 2 * r + 100, 2 * r + 170, 40, 0.6);
    o.lineWidth = r * 0.18; o.strokeStyle = 'rgba(106,76,255,0.55)'; o.beginPath(); o.arc(x, y, r, 0, 7); o.stroke();
    o.strokeStyle = col; o.shadowColor = col; o.shadowBlur = 18; o.beginPath(); o.arc(x, y, r, -Math.PI / 2 - Math.PI * frac, -Math.PI / 2 + Math.PI * frac); o.stroke(); o.shadowBlur = 0;
    E.txt(label, x, y, r * 0.52, '#fff', 'Mono', 800); E.txt('DE JOUR SUR 24 H', x, y + r + 80, 30, '#cfd6e0', 'Mono', 800); o.restore(); };
  const frontLat = (P_, lat) => { const cd = E.camera.position.clone().sub(P_.g.position).normalize(); let best = null, bv = -9;
    for (let lon = 0; lon < 360; lon += 5) { const v = P_.nrm(lat, lon).dot(cd) + 0.3 * P_.nrm(lat, lon).x * Math.sign(-cd.x || 1); if (v > bv) { bv = v; best = P_.pt(lat, lon, 1.02); } } return best; };
  const A_PERI = 0.22, A_JUIN = Math.PI, A_DEC = 0;
  const shots = [];

  // 1. Accroche : début janvier, la Terre au plus près du Soleil… et c'est l'hiver
  shots.push({ name: 'accroche', start: 0,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_PERI, 1.8, t * 0.5);
      if (t > B.pres - 0.2) E.line3(0, [SUN.clone().add(orbitPos(A_PERI).normalize().multiplyScalar(3.2)), orbitPos(A_PERI).multiplyScalar(1 - 2.0 / R)], YEL, 0.85, ease((t - B.pres + 0.2) / 0.8));
      if (t > B.hiver - 0.3) snow(t, earth, ease((t - B.hiver + 0.3) * 2));
      const c = orbitPos(A_PERI).multiplyScalar(0.5);
      if (t < B.alors) E.fit(c.clone().add(V3(0, 0, 0)), 10.5, V3(lerp(-0.1, 0.15, easeIO(lt / B.alors)), 0.45, 1), 1.45, 46);
      else E.orbit(c, lerp(0.15, 0.9, easeIO((t - B.alors) / 2.5)), lerp(8, 13, easeIO((t - B.alors) / 2.5)), 64, 46); },
    hud(t) { E.tag3(earth.g.position.clone().add(V3(0, 1.9, 0)), 'DÉBUT JANVIER', 40, -230, '#fff', ease((t - B.janvier) * 3));
      if (t > B.pres && t < B.alors) E.tag3(orbitPos(A_PERI).multiplyScalar(0.55), 'AU PLUS PRÈS DU SOLEIL', -60, 330, COL.acc, ease((t - B.pres) * 3), 28);
      if (t > B.hiver && t < B.alors) E.tag('ET POURTANT : HIVER CHEZ NOUS', 540, 1560, COL.cyan, ease((t - B.hiver) * 3), 30);
      if (t > B.saisons - 0.4) E.txt('?', 540, 1380, 280 * easeBack((t - B.saisons + 0.4) * 2.5), COL.acc, 'Inter', 900); } });
  // 2. Idée reçue : « plus près = plus chaud »
  shots.push({ name: 'idee-recue', start: B.oublie,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_PERI + lt * 0.5, 1.9, t * 0.5);
      E.fit(V3(0, 0, 0), 18.5, V3(lerp(0.15, -0.1, easeIO(k)), 1, 0.38), 1.45, 46); },
    hud(t, lt) { const a = ease(lt * 3); o.globalAlpha = a; E.glass(110, 1380, 860, 260, 40, 0.65);
      E.txt('IDÉE REÇUE', 540, 1440, 34, COL.red, 'Mono', 800); E.txt('PLUS PRÈS = PLUS CHAUD ?', 540, 1530, 50, '#fff', 'Inter', 900);
      if (t > B.voila) { o.globalAlpha = ease((t - B.voila) * 3); E.txt('✕', 540, 1080, 260 * easeBack((t - B.voila) * 2.5), COL.red, 'Inter', 900); } o.globalAlpha = 1; } });
  // 3. La distance : l'orbite presque ronde, un tour en un an
  shots.push({ name: 'orbite', start: B.dabord,
    update(t, lt, k) { show('sys'); earthReset(); const a = lerp(A_JUIN + 0.9, Math.PI * 2 + A_PERI, easeIO(clamp((t - B.dabord) / (B.pres2 - B.dabord))));
      placeEarth(a, 1.9, t * 0.5);
      orbitLine.visible = t > B.orbite + 1.2; if (t > B.orbite - 0.2) E.line3(1, orbitPts, 0x7fd0ff, 0.9, ease((t - B.orbite + 0.2) / 1.4));
      E.fit(V3(0, 0, 0), 18.5, V3(lerp(-0.25, 0.1, easeIO(k)), 1, lerp(0.6, 0.45, k)), 1.45, 46); },
    hud(t) { if (t > B.orbite) E.tag('ORBITE PRESQUE RONDE · 1 TOUR = 1 AN', 540, 1640, COL.cyan, ease((t - B.orbite) * 3), 28); } });
  // 4. Au plus près 147 millions de km, au plus loin 152 millions
  const distLine = (a) => [orbitPos(a).normalize().multiplyScalar(3.2), orbitPos(a).multiplyScalar(1 - 2.0 / R)];
  shots.push({ name: 'distances', start: B.pres2,
    update(t, lt, k) { show('sys'); earthReset();
      const a = t < B.loin ? A_PERI : lerp(A_PERI, A_PERI + Math.PI, easeIO((t - B.loin) / (B.n152 - B.loin + 0.2)));
      placeEarth(a, 1.9, t * 0.5);
      if (t > B.n147 - 0.3 && t < B.loin) E.line3(0, distLine(A_PERI), YEL, 0.9, ease((t - B.n147 + 0.3) / 0.6));
      if (t > B.n152 - 0.3) E.line3(0, distLine(A_PERI + Math.PI), ORANGE, 0.9, ease((t - B.n152 + 0.3) / 0.6));
      E.fit(V3(0, 0, 0), 18.5, V3(lerp(0.3, 0.05, easeIO(k)), 1, 0.5), 1.45, 46); },
    hud(t) { if (t > B.n147 - 0.2 && t < B.loin + 0.3) { o.globalAlpha = ease((t - B.n147 + 0.2) * 3); E.glass(170, 1430, 740, 240, 40, 0.6);
        E.txt(E.P2.count(0, 147, clamp((t - B.n147 + 0.2) / 0.9)) + ' MILLIONS', 540, 1520, 66, COL.acc, 'Mono', 800); E.txt('DE KM · DÉBUT JANVIER', 540, 1610, 32, '#cfd6e0', 'Mono', 800); o.globalAlpha = 1; }
      if (t > B.n152 - 0.2) { o.globalAlpha = ease((t - B.n152 + 0.2) * 3); E.glass(170, 1430, 740, 240, 40, 0.6);
        E.txt(E.P2.count(147, 152, clamp((t - B.n152 + 0.2) / 0.7)) + ' MILLIONS', 540, 1520, 66, COL.orange, 'Mono', 800); E.txt('DE KM · DÉBUT JUILLET', 540, 1610, 32, '#cfd6e0', 'Mono', 800); o.globalAlpha = 1; } } });
  // 5. Seulement 3 % d'écart (fond flou)
  shots.push({ name: '3-pourcent', start: B.ca, filter: 'blur(9px) brightness(0.5)',
    update(t) { shots[3].update(t, t - B.pres2, 1); },
    hud(t, lt) { const a = ease(lt * 3); o.globalAlpha = a; E.glass(70, 760, 940, 900, 40, 0.6);
      E.txt('DISTANCE TERRE – SOLEIL', 540, 840, 32, COL.cyan, 'Mono', 800);
      const g = ease(lt * 1.5);
      E.bar(150, 960, 780, 46, 147 / 152 * g, COL.acc, 'JANVIER : 147 MILLIONS DE KM', a); E.bar(150, 1100, 780, 46, g, COL.orange, 'JUILLET : 152 MILLIONS DE KM', a);
      if (t > B.n3 - 0.2) { o.globalAlpha = ease((t - B.n3 + 0.2) * 3); E.txt('≈ 3 %', 540, 1320, 170 * easeBack((t - B.n3 + 0.2) * 2.5), '#fff', 'Mono', 800); E.txt("D'ÉCART SEULEMENT", 540, 1440, 36, '#cfd6e0', 'Mono', 800); }
      if (t > B.beaucoup) { o.globalAlpha = ease((t - B.beaucoup) * 3); E.tag('✕  TROP PEU POUR FAIRE UN HIVER', 540, 1580, COL.red, 1, 28); } o.globalAlpha = 1; } });
  // 6. La preuve : hiver en France, été en Australie
  const FR = [46, 2], AU = [-25, 134];
  shots.push({ name: 'preuve', start: B.preuve,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_DEC, 1, -20 * DEG + 0.04 * lt);
      photons(t, earth.g.position, SUN, 110, 1.3, 10);
      if (t < B.si) E.fit(earth.g.position.clone(), 1.6, V3(lerp(-0.55, -0.35, easeIO(lt / 4.5)), 0.12, 1), 1.6, 44);
      else { E.fit(earth.g.position.clone().add(V3(-3, 0, 0)), 5.5, V3(lerp(0.05, -0.15, easeIO((t - B.si) / 4)), 0.3, 1), 1.45, 46); } },
    hud(t) { const pre = t < B.si;
      if (t > B.france && pre) E.tag3(earth.pt(...FR), 'FRANCE : HIVER', 170, -180, COL.cyan, ease((t - B.france) * 3));
      if (t > B.australie && pre) E.tag3(earth.pt(...AU), 'AUSTRALIE : ÉTÉ', -120, 240, COL.orange, ease((t - B.australie) * 3));
      if (!pre) { const a = ease((t - B.si) * 3); o.globalAlpha = a; E.glass(110, 1400, 860, 300, 40, 0.65);
        E.txt('SI C\'ÉTAIT LA DISTANCE…', 540, 1470, 40, '#fff', 'Inter', 900); E.txt('MÊME SAISON PARTOUT', 540, 1560, 44, COL.acc, 'Mono', 800);
        if (t > B.toute + 0.8) E.txt('✕ CE N\'EST PAS LE CAS', 540, 1645, 34, COL.red, 'Mono', 800); o.globalAlpha = 1; } } });
  // 7. Le vrai coupable : l'inclinaison de l'axe (23,5°)
  const arcPts = (c, r, a0, a1) => Array.from({ length: 41 }, (_, i) => { const a = lerp(a0, a1, i / 40); return c.clone().add(V3(Math.sin(a) * r, Math.cos(a) * r, 0)); });
  shots.push({ name: 'inclinaison', start: B.vrai,
    update(t, lt, k) { show('sys'); earthReset(); const spin = t < B.tourne ? t * 0.3 : B.tourne * 0.3 + (t - B.tourne) * 1.6;
      placeEarth(A_JUIN, 1, spin); earth.mat.uniforms.uSun.value.set(0.25, 0.1, 1).normalize();
      earth.axis.scale.y = t > B.axe - 0.2 ? ease((t - B.axe + 0.2) / 0.8) : 0.01; earth.npole.visible = t > B.axe + 0.3;
      const c = earth.g.position.clone();
      if (t > B.n235 - 0.5) { E.line3(2, [c.clone().add(V3(0, -2.3, 0)), c.clone().add(V3(0, 2.3, 0))], 0xffffff, 0.6, ease((t - B.n235 + 0.5) / 0.5));
        E.line3(3, arcPts(c, 2.05, 0, TILT), YEL, 1, ease((t - B.n235) / 0.5)); }
      if (t > B.tourne - 0.2 && t < B.n235) for (let i = 0; i < 3; i++) E.ring(i, c.clone().add(earth.axisDir().multiplyScalar(1.25 + i * 0.12)), 0.5 - i * 0.08, YEL, 0.6, earth.axisDir());
      E.fit(c.clone().add(V3(0, 0.1, 0)), 2.0, V3(lerp(-0.25, 0.2, easeIO(k)), 0.1, 1), 1.55, 44); },
    hud(t) { if (t > B.inclin && t < B.n235) E.tag('L\'INCLINAISON', 540, 1640, COL.acc, ease((t - B.inclin) * 3), 34);
      if (t > B.axe + 0.3) E.tag3(earth.g.position.clone().add(earth.axisDir().multiplyScalar(1.75)), 'AXE DE ROTATION', 120, 160, COL.acc, ease((t - B.axe - 0.3) * 3));
      if (t > B.n235) { o.globalAlpha = ease((t - B.n235) * 3); E.txt('23,5°', 540, 1560, 120 * easeBack((t - B.n235) * 2.5), COL.acc, 'Mono', 800); o.globalAlpha = 1; } } });
  // 8. L'axe pointe toujours dans la même direction
  shots.push({ name: 'meme-direction', start: B.surtout,
    update(t, lt, k) { show('sys', 'ghosts'); earthReset(); earth.g.visible = false;
      ghosts.forEach((gh, i) => { gh.g.visible = t > B.pointe - 0.3 + i * 0.25 || i === 0; gh.spin.rotation.y = t * 0.5; gh.sun(SUN); });
      for (let i = 0; i < 4; i++) { if (!ghosts[i].g.visible) continue; const p = ghosts[i].g.position, d = ghosts[i].axisDir(); E.line3(4 + i, [p.clone().add(d.clone().multiplyScalar(-4)), p.clone().add(d.clone().multiplyScalar(4))], YEL, 0.7, 1); }
      E.fit(V3(0, 0, 0), 19, V3(lerp(-0.1, 0.25, easeIO(k)), 0.65, 1), 1.4, 46); },
    hud(t) { if (t > B.pointe) E.tag('L\'AXE GARDE TOUJOURS SA DIRECTION', 540, 1660, COL.acc, ease((t - B.pointe) * 3), 28); } });
  // 9. Juin : l'hémisphère nord penche vers le Soleil
  const sideCam = (P_, sunSide, lt, k) => E.fit(P_.g.position.clone().add(V3(sunSide * 0.9, 0, 0)), 2.6, V3(lerp(-0.2 * sunSide, 0.05 * sunSide, easeIO(k)), 0.15, 1), 1.5, 44);
  shots.push({ name: 'juin', start: B.resultat,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_JUIN, 1, t * 0.4);
      earth.mat.uniforms.uLatA.value = t > B.nord - 0.2 ? 0.0 : 0; photons(t, earth.g.position, SUN, 110, 1.3, 10);
      sideCam(earth, 1, lt, k); },
    hud(t) { E.tag('JUIN', 540, 760, '#fff', ease((t - B.juin) * 3), 40);
      if (t > B.nord) E.tag3(earth.g.position.clone().add(V3(0.15, 0.75, 0.62)), 'HÉMISPHÈRE NORD', -200, 380, COL.acc, ease((t - B.nord) * 3));
      E.tag3(earth.g.position.clone().add(V3(2.6, -0.5, 0)), 'SOLEIL →', 60, 260, COL.orange, ease((t - B.resultat - 0.3) * 3));
      if (t > B.penche) E.tag('PENCHÉ VERS LE SOLEIL = ÉTÉ', 540, 1680, COL.acc, ease((t - B.penche) * 3), 30); } });
  // 10. Décembre : c'est l'inverse
  shots.push({ name: 'decembre', start: B.decembre,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_DEC, 1, t * 0.4); photons(t, earth.g.position, SUN, 110, 1.3, 10);
      if (t > B.autre) snow(t, earth, ease((t - B.autre) * 2), 120);
      sideCam(earth, -1, lt, k); },
    hud(t) { E.tag('DÉCEMBRE', 540, 760, '#fff', ease((t - B.decembre) * 3), 40);
      E.tag3(earth.g.position.clone().add(V3(-2.6, -0.5, 0)), '← SOLEIL', -60, 260, COL.orange, ease((t - B.decembre - 0.3) * 3));
      if (t > B.inverse) E.tag3(earth.g.position.clone().add(V3(-0.15, 0.75, 0.62)), 'LE NORD S\'ÉLOIGNE', 160, 380, COL.cyan, ease((t - B.inverse) * 3));
      if (t > B.autre) E.tag('PENCHÉ À L\'OPPOSÉ = HIVER', 540, 1680, COL.cyan, ease((t - B.autre) * 3), 30); } });
  // 11. Ça change deux choses
  shots.push({ name: 'deux-choses', start: B.deux, filter: 'blur(8px) brightness(0.5)',
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_JUIN + lt * 0.25, 1.9, t * 0.5); E.fit(V3(0, 0, 0), 18.5, V3(0.1, 0.7, 1), 1.4, 46); },
    hud(t, lt) { o.globalAlpha = ease(lt * 3); E.glass(90, 900, 900, 560, 40, 0.6);
      E.txt('L\'INCLINAISON CHANGE…', 540, 990, 38, COL.cyan, 'Mono', 800);
      E.txt('1 · L\'ANGLE DES RAYONS', 540, 1150, 48, t > B.un - 0.1 ? COL.acc : '#fff', 'Inter', 900);
      E.txt('2 · LA DURÉE DU JOUR', 540, 1300, 48, '#fff', 'Inter', 900); o.globalAlpha = 1; } });
  // 12. La lampe de poche bien droite : petit cercle très lumineux
  const lampRays = (t, beta, n = 70) => { const s = setLamp(beta); const P0 = LAMP.clone().add(V3(0, LH, 0));
    for (let i = 0; i < n; i++) { const ph = (t * 1.1 + rand(i + 21)) % 1, r = Math.sqrt(rand(i + 5)), th = rand(i + 9) * 6.283;
      const tgt = LAMP.clone().add(V3(s.cx + Math.cos(th) * r * s.a * 0.95, 0.05, Math.sin(th) * r * s.b * 0.95)); E.dot(P0.clone().lerp(tgt, ph), 0.05, col3(YEL, 0.85)); } return s; };
  shots.push({ name: 'lampe-droite', start: B.prends,
    update(t, lt, k) { show('lamp'); const on = t > B.eclaire - 0.1; beam.visible = on; spot.visible = on; lens.material.color.setHex(on ? 0x8a7a40 : 0x222222);
      if (on) lampRays(t, 0); else setLamp(0);
      if (t > B.cercle) E.line3(0, square(LAMP, 1), CYAN, 0.9, ease((t - B.cercle) * 2));
      E.fit(LAMP.clone().add(V3(0, 3.4, 0)), 3.9, V3(lerp(0.35, 0.15, easeIO(k)), 0.45, 1), 1.35, 46); },
    hud(t) { E.tag3(LAMP.clone().add(V3(0, LH + 2.6, 0)), 'LAMPE DE POCHE', 230, 60, '#fff', ease((t - B.prends) * 3));
      if (t > B.cercle) E.tag3(LAMP.clone().add(V3(0.6, 0, 0.6)), 'PETIT CERCLE TRÈS LUMINEUX', 0, 280, COL.acc, ease((t - B.cercle) * 3), 28);
      if (t > B.cercle) { const a = ease((t - B.cercle - 0.3) * 3); E.bar(240, 1580, 600, 26, 0.92, COL.acc, 'LUMIÈRE SUR 1 m²', a); } } });
  // 13. On la penche : la même lumière s'étale, plus pâle
  shots.push({ name: 'lampe-penchee', start: B.penchela,
    update(t, lt, k) { show('lamp'); beam.visible = spot.visible = true; const beta = lerp(0, 58 * DEG, easeIO(lt / 1.4)); const s = lampRays(t, beta);
      E.line3(0, square(LAMP.clone().add(V3(s.cx, 0, 0)), 1), CYAN, 0.9, 1);
      E.fit(LAMP.clone().add(V3(3.2, 2.6, 0)), 6.4, V3(lerp(-0.15, -0.3, easeIO(k)), 0.65, 1), 1.4, 46); },
    hud(t, lt) { const beta = lerp(0, 58 * DEG, easeIO(lt / 1.4)); const s = setLamp(beta);
      const rel = (0.1 * 0.1 / Math.cos(0)) ; const I = Math.pow(Math.cos(beta), 3);   // éclairement au centre ∝ cos³
      E.bar(240, 1580, 600, 26, 0.92 * I, COL.acc, 'LUMIÈRE SUR 1 m²', 1);
      if (t > B.tache) E.tag3(LAMP.clone().add(V3(s.cx + s.a * 0.7, 0, 0)), 'GRANDE TACHE, PLUS PÂLE', -60, 270, COL.acc, ease((t - B.tache) * 3), 28);
      if (t > B.pale) E.tag('MÊME LUMIÈRE, PLUS ÉTALÉE', 540, 1690, '#fff', ease((t - B.pale) * 3), 28); } });
  // 14. En hiver, le Soleil reste bas : rayons en biais, moins d'énergie par m²
  const ELEV_S = 62 * DEG, ELEV_W = 17 * DEG;
  shots.push({ name: 'soleil-bas', start: B.enhiver,
    update(t, lt, k) { show('ground'); const e = lerp(ELEV_S, ELEV_W, easeIO(lt / 1.6));
      const sd = V3(-Math.cos(e), Math.sin(e), 0); sun2.position.copy(sd.clone().multiplyScalar(7.5)).add(V3(0, 0.3, 0)); sun2glow.position.copy(sun2.position);
      const perp = V3(Math.sin(e), Math.cos(e), 0); let hits = 0;
      for (let i = -12; i <= 12; i++) { const off = i * 0.38; const hitX = off / Math.sin(e); if (Math.abs(hitX) > 7.6) continue; const hit = GR.clone().add(V3(hitX, 0.02, 0.6));
        const inSq = Math.abs(hitX) <= 0.5; if (inSq) hits++;
        const ph = (t * 0.9 + rand(i + 40)) % 1; E.line3(i + 12, [hit.clone().add(sd.clone().multiplyScalar(9)), hit], inSq ? YEL : 0xb08a30, inSq ? 0.95 : 0.45, 1);
        E.dot(hit.clone().add(sd.clone().multiplyScalar(9 * (1 - ph))), 0.06, col3(YEL, 0.9)); }
      E.line3(30, square(GR.clone().add(V3(0, 0, 0.6)), 1), CYAN, 1, 1); this.hits = hits;
      E.fit(GR.clone().add(V3(0, 1.8, 0)), 7.4, V3(lerp(0.12, -0.08, easeIO(k)), 0.32, 1), 1.38, 46); },
    hud(t, lt) { E.tag3(GR.clone().add(V3(0, 0, 1.1)), '1 m²', 160, 230, COL.cyan, ease(lt * 3));
      E.tag('HIVER : SOLEIL BAS', 540, 760, COL.cyan, ease((lt - 0.8) * 3), 34);
      if (t > B.biais) E.tag3(GR.clone().add(sun2.position), 'RAYONS EN BIAIS', 120, 240, COL.acc, ease((t - B.biais) * 3));
      const e = lerp(ELEV_S, ELEV_W, easeIO(lt / 1.6)); E.bar(240, 1600, 600, 26, Math.sin(e), COL.orange, 'ÉNERGIE REÇUE PAR m²', ease((t - B.metre + 1.5) * 2)); } });
  // 15. Durée du jour : Paris, fin juin → plus de 16 h
  shots.push({ name: 'jour-juin', start: B.deux2,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_JUIN, 1, t * 0.6); earth.mat.uniforms.uLatA.value = t > B.paris - 0.2 ? 0.1 : 0; earth.mat.uniforms.uLat.value = 48.85;
      this.frac = latDots(earth, 48.85);
      E.fit(earth.g.position.clone(), 1.75, V3(lerp(0.55, 0.3, easeIO(k)), lerp(1.1, 0.9, k), 1), 1.5, 44); },
    hud(t, lt) { E.tag('2 · LA DURÉE DU JOUR', 540, 1730, '#fff', ease(lt * 3), 34);
      if (t > B.paris) E.tag3(frontLat(earth, 48.85), 'LATITUDE DE PARIS', -250, 170, COL.acc, ease((t - B.paris) * 3), 28);
      if (t > B.n16 - 0.3) clock(540, 1430, 120, 16.2 / 24, '16 H', ease((t - B.n16 + 0.3) * 3)); } });
  // 16. Fin décembre → à peine 8 h ; moins de temps pour chauffer
  shots.push({ name: 'jour-decembre', start: B.findec,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_DEC, 1, t * 0.6); earth.mat.uniforms.uLatA.value = 0.1; earth.mat.uniforms.uLat.value = 48.85;
      latDots(earth, 48.85); if (t > B.moins) snow(t, earth, ease((t - B.moins) * 2), 100);
      if (t < B.moins) E.fit(earth.g.position.clone(), 1.75, V3(lerp(-0.55, -0.35, easeIO(lt / 2.5)), 1.0, 1), 1.5, 44);
      else E.fit(earth.g.position.clone(), 1.75, V3(lerp(-0.2, 0.15, easeIO((t - B.moins) / 3.2)), 0.35, 1), 1.55, 44); },
    hud(t, lt) { if (t < B.moins) { if (t > B.n8 - 0.3) clock(540, 1430, 120, 8.2 / 24, '8 H', ease((t - B.n8 + 0.3) * 3), COL.cyan);
        E.tag('FIN DÉCEMBRE', 540, 760, '#fff', ease(lt * 3), 34); }
      else { const a = ease((t - B.moins) * 3); o.globalAlpha = a; E.glass(130, 1360, 820, 330, 40, 0.6);
        E.bar(200, 1440, 680, 30, 8 / 24, COL.orange, 'TEMPS POUR CHAUFFER', a);
        E.bar(200, 1580, 680, 30, t > B.refroidir - 0.4 ? 16 / 24 : 0, COL.cyan, 'TEMPS POUR REFROIDIR', a); o.globalAlpha = 1; } } });
  // 17. Bilan : rayons rasants + nuits longues = hiver
  shots.push({ name: 'bilan', start: B.rayons2,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_DEC, 1.9, t * 0.5); photons(t, earth.g.position, SUN, 140, 2.4, 14);
      snow(t, earth, 1, 160);
      E.fit(orbitPos(A_DEC).multiplyScalar(0.6), 9.5, V3(lerp(0.15, -0.1, easeIO(k)), 0.4, 1), 1.45, 46); },
    hud(t, lt) { const a = ease(lt * 3); o.globalAlpha = a; E.glass(110, 1380, 860, 320, 40, 0.65);
      E.txt('RAYONS RASANTS', 540, 1450, 44, COL.acc, 'Inter', 900); E.txt('+ NUITS LONGUES', 540, 1530, 44, COL.violet, 'Inter', 900);
      if (t > B.voila2) E.txt('= HIVER', 540, 1625, 58 * easeBack((t - B.voila2) * 2.5), COL.cyan, 'Mono', 800); o.globalAlpha = 1; } });
  // 18. Uranus : penchée à 98°, presque couchée
  shots.push({ name: 'uranus', start: B.fou - 0.1,
    update(t, lt, k) { show('ur'); uranus.g.position.copy(UR); uranus.g.scale.setScalar(1); uranus.spin.rotation.y = t * 0.8; uranus.mat.uniforms.uSun.value.set(0.6, 0.25, 1).normalize();
      uranus.axis.scale.y = 1;
      if (t > B.n98 - 0.4) { E.line3(2, [UR.clone().add(V3(0, -5.5, 0)), UR.clone().add(V3(0, 5.5, 0))], 0xffffff, 0.6, ease((t - B.n98 + 0.4) / 0.5));
        E.line3(3, arcPts(UR, 4.7, 0, 98 * DEG), YEL, 1, ease((t - B.n98) / 0.6)); }
      E.fit(UR.clone().add(V3(0.4, 0, 0)), 5.0, V3(lerp(-0.3, 0.2, easeIO(k)), 0.18, 1), 1.5, 46); },
    hud(t) { if (t > B.uranus) E.tag3(UR.clone().add(V3(-1.2, 2.0, 0)), 'URANUS', -120, -260, COL.cyan, ease((t - B.uranus) * 3));
      if (t > B.n98) { o.globalAlpha = ease((t - B.n98) * 3); E.txt('98°', 540, 1560, 130 * easeBack((t - B.n98) * 2.5), COL.acc, 'Mono', 800); o.globalAlpha = 1; }
      if (t > B.couchee) E.tag('COUCHÉE SUR LE CÔTÉ', 540, 1690, '#fff', ease((t - B.couchee) * 3), 30); } });
  // 19. Une année de 84 ans, des saisons d'une vingtaine d'années
  shots.push({ name: 'uranus-orbite', start: B.labas,
    update(t, lt, k) { show('urs', 'ur');
      const T0 = B.labas, T1 = B.imagine; const a = lerp(Math.PI * 0.35, Math.PI * 1.0, easeIO(clamp((t - T0) / (T1 - T0)))) ;
      uranus.g.position.copy(URS.clone().add(V3(RU * Math.cos(a), 0, -RU * Math.sin(a)))); uranus.g.scale.setScalar(0.85); uranus.spin.rotation.y = t * 1.2; uranus.sun(URS);
      if (t > B.imagine - 0.2) photons(t, uranus.g.position, URS, 120, 2.2, 12);
      E.fit(URS.clone(), 17.5, V3(lerp(0.2, -0.05, easeIO(k)), 0.85, 1), 1.4, 46); },
    hud(t, lt) { const a = ease(lt * 3); o.globalAlpha = a; E.glass(170, 1390, 740, 300, 40, 0.6);
      E.txt('1 ANNÉE = ' + (t > B.n84 - 0.3 ? E.P2.count(0, 84, clamp((t - B.n84 + 0.3) / 1)) : '…') + ' ANS', 540, 1480, 58, COL.acc, 'Mono', 800);
      if (t > B.vingtaine - 0.2) E.txt('1 SAISON ≈ 20 ANS', 540, 1590, 46, COL.cyan, 'Mono', 800); o.globalAlpha = 1;
      if (t > B.imagine) E.tag3(uranus.g.position.clone().add(V3(0, 2.6, 0)), 'PÔLE FACE AU SOLEIL : ÉTÉ DE 20 ANS', -150, -230, COL.orange, ease((t - B.imagine) * 3), 26); } });
  // 20. Fin : janvier, la Terre au plus près… mais penchée
  shots.push({ name: 'fin', start: B.alors2,
    update(t, lt, k) { show('sys'); earthReset(); placeEarth(A_PERI, t < B.cest ? 1.8 : 1, t * 0.5);
      if (t < B.cest) { snow(t, earth, 0.8, 120); E.line3(0, distLine(A_PERI), YEL, 0.8, 1);
        const c = orbitPos(A_PERI).multiplyScalar(0.5); E.fit(c, 10.5, V3(lerp(0.3, 0.05, easeIO((t - B.alors2) / 6)), 0.45, 1), 1.45, 46); }
      else { const c = earth.g.position.clone(); E.line3(2, [c.clone().add(V3(0, -2.3, 0)), c.clone().add(V3(0, 2.3, 0))], 0xffffff, 0.6, 1); E.line3(3, arcPts(c, 2.05, 0, TILT), YEL, 1, ease((t - B.penchee + 0.3) / 0.5));
        photons(t, c, SUN, 110, 1.3, 10);
        E.fit(c.clone().add(V3(-0.6, 0.1, 0)), 2.3, V3(lerp(0.0, 0.25, easeIO((t - B.cest) / 5)), 0.12, 1), 1.55, 44); } },
    hud(t) { if (t < B.cest) { if (t > B.souviens) E.tag3(earth.g.position.clone().add(V3(0, 1.9, 0)), 'JANVIER : AU PLUS PRÈS', -40, 330, COL.acc, ease((t - B.souviens) * 3)); }
      else { if (t > B.penchee) E.tag('MAIS PENCHÉE DE 23,5°', 540, 1560, COL.acc, ease((t - B.penchee) * 3), 34);
        if (t > B.toi) E.txt('?', 540, 1330, 230 * easeBack((t - B.toi) * 2.5), COL.acc, 'Inter', 900); } } });

  E.holo({ strength: 0.7 });
  E.bloom.strength = 0.7; E.bloom.threshold = 0.8;

  return { shots, sfx: [
    { t: B.janvier, type: 'pop' }, { t: B.hiver, type: 'boom' }, { t: B.oublie - 0.2, type: 'rise' }, { t: B.voila + 0.3, type: 'click' },
    { t: B.n147, type: 'pop' }, { t: B.n152, type: 'pop' }, { t: B.n3, type: 'boom' }, { t: B.australie, type: 'ding' },
    { t: B.inclin, type: 'boom' }, { t: B.n235, type: 'ding' }, { t: B.pointe, type: 'pop' }, { t: B.penche, type: 'click' },
    { t: B.cercle, type: 'pop' }, { t: B.penchela, type: 'click' }, { t: B.metre, type: 'pop' }, { t: B.n16, type: 'ding' },
    { t: B.n8, type: 'boom' }, { t: B.voila2, type: 'ding' }, { t: B.fou - 0.5, type: 'rise' }, { t: B.n98, type: 'boom' },
    { t: B.vingtaine, type: 'pop' }, { t: B.penchee, type: 'boom' }, { t: B.toi + 1.2, type: 'ding' } ] };
}
