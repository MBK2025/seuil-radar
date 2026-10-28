// Épisode 003 – Pourquoi on a la chair de poule.
// Style holo. Zones : humain (origine), coupe de peau (x = 300), volaille (z = 300), chat (x = -300, z = 300),
// ancêtres (x = 300, z = 300), souris (z = -300).
export async function build(E) {
  const { THREE, V3, P, clamp, ease, easeIO, easeBack, lerp, COL, o, rand } = E;
  E.mood('studio');
  const ORANGE = 0xff8a3d, YEL = 0xffd23f, GREEN = 0x5bff9e;
  const col3 = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const grid = (pos, size = 40) => { const g = new THREE.GridHelper(size, size, 0x16336e, 0x0d2350); g.position.copy(pos); g.material.transparent = true; g.material.opacity = 0.35; g.userData.noHolo = true; E.scene.add(g); return g; };

  // ================= HUMAIN (origine) =================
  const S = 3;   // échelle de l'humain : 1 = 30 cm env., hauteur ≈ 5,6
  const HUM = V3(0, 0, 0);
  const human = P.human(); human.scale.setScalar(S); E.scene.add(human); grid(V3(0, 0, 0));
  // points de surface du corps (repère local de P.human), pour poils / fourrure
  const surf = [];
  const addCyl = (n, cx, cz, y0, y1, r) => { for (let i = 0; i < n; i++) { const a = rand(surf.length * 3.1) * 6.283, y = lerp(y0, y1, rand(surf.length * 1.7 + 4)); surf.push({ p: V3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r), n: V3(Math.cos(a), 0, Math.sin(a)) }); } };
  addCyl(260, 0, 0, 0.9, 1.42, 0.22); addCyl(90, -0.11, 0, 0.12, 0.82, 0.08); addCyl(90, 0.11, 0, 0.12, 0.82, 0.08);
  addCyl(70, -0.3, 0, 0.8, 1.38, 0.06); addCyl(70, 0.3, 0, 0.8, 1.38, 0.06);
  for (let i = 0; i < 80; i++) { const u = rand(i + 900) * 2 - 1, a = rand(i + 950) * 6.283, r = Math.sqrt(1 - u * u); const n = V3(r * Math.cos(a), u, r * Math.sin(a)); surf.push({ p: V3(0, 1.68, 0).add(n.clone().multiplyScalar(0.17)), n }); }
  const W_ = (p, base = HUM) => p.clone().multiplyScalar(S).add(base);
  // fourrure (segments) : réutilisable sur n'importe quel humain posé en « base »
  const furMat = new THREE.LineBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const makeFur = (base) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(surf.length * 6), 3));
    const l = new THREE.LineSegments(g, furMat.clone()); l.userData.noHolo = true; l.frustumCulled = false; E.scene.add(l);
    l.userData.set = (len, op, wob = 0, t = 0) => { const a = g.attributes.position.array; surf.forEach((s, i) => { const p = W_(s.p, base), q = p.clone().add(s.n.clone().multiplyScalar(len * (0.7 + 0.6 * rand(i + 77)))).add(V3(0, -len * 0.25 + Math.sin(t * 3 + i) * wob, 0));
      a.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6); }); g.attributes.position.needsUpdate = true; l.material.opacity = op; l.visible = op > 0; };
    l.visible = false; return l; };
  const furH = makeFur(HUM);
  // écran de film + enceinte
  const screen = new THREE.Mesh(new E.RoundedBoxGeometry(3.2, 2, 0.15, 2, 0.06), E.std(0x222)); screen.position.set(-4.2, 4.2, -1); screen.rotation.y = 0.45; E.scene.add(screen);
  const scrC = document.createElement('canvas'); scrC.width = 320; scrC.height = 200; { const g = scrC.getContext('2d'); g.fillStyle = '#05060c'; g.fillRect(0, 0, 320, 200);
    g.fillStyle = '#ff3b3b'; g.shadowColor = '#ff3b3b'; g.shadowBlur = 20; for (const x of [120, 200]) { g.beginPath(); g.ellipse(x, 85, 16, 9, 0, 0, 7); g.fill(); }
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(100 + i * 15, 140 + (i % 2) * 14); g.stroke(); }
  const scrT = new THREE.CanvasTexture(scrC); scrT.colorSpace = THREE.SRGBColorSpace;
  const scrFace = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.85), new THREE.MeshBasicMaterial({ map: scrT, toneMapped: false })); scrFace.position.z = 0.08; screen.add(scrFace);
  screen.position.set(-3.2, 4.0, -0.6);
  const speaker = new THREE.Group(); speaker.position.set(3.3, 0, -0.6); E.scene.add(speaker);
  const spBox = new THREE.Mesh(new E.RoundedBoxGeometry(1.4, 2.6, 1.2, 2, 0.1), E.std(0x333)); spBox.position.y = 1.3; speaker.add(spBox);
  for (const y of [0.8, 1.9]) { const c = new THREE.Mesh(new THREE.TorusGeometry(y > 1 ? 0.3 : 0.45, 0.06, 10, 32), E.std(0x444)); c.position.set(0, y, 0.62); speaker.add(c); }
  // cerveau, moelle, surrénales
  const brain = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), E.std(0xffffff)); brain.scale.set(1, 0.8, 1.15); brain.position.set(0, 1.7 * S + 0.08, 0); brain.userData.holoColor = YEL; E.scene.add(brain);
  const adrenals = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12), E.std(0xffffff)); m.position.set(s * 0.32, 1.05 * S, -0.25); m.userData.holoColor = ORANGE; E.scene.add(m); return m; });
  const nervePath = []; { const pts = [V3(0, 1.66, 0), V3(0, 1.45, -0.05), V3(0, 1.2, -0.12), V3(0.08, 1.38, -0.05), V3(0.28, 1.36, 0), V3(0.3, 1.0, 0.03), V3(0.3, 0.8, 0.07)].map(p => W_(p));
    const cv = new THREE.CatmullRomCurve3(pts); for (let i = 0; i <= 120; i++) nervePath.push(cv.getPoint(i / 120)); }
  const ARM = W_(V3(0.3, 0.95, 0.07));

  // ================= COUPE DE PEAU : grand bloc (x = 300) et bloc à un seul poil (x = 600) =================
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  const _v = new THREE.Vector3();
  const placeCyl = (m, a, b, r) => { _v.subVectors(b, a); const L = _v.length(); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), _v.normalize()); m.scale.set(r, L, r); };
  const makeSkin = (base, W, D, spots, big_ = false) => {
    const grp = new THREE.Group(); grp.position.copy(base); E.scene.add(grp);
    const epi = new THREE.Mesh(new THREE.BoxGeometry(W, 0.45, D), E.std(0xffffff)); epi.position.y = -0.22; epi.userData.holoColor = 0x6fb0ff; epi.userData.holoStrength = 0.35; grp.add(epi);
    const derm = new THREE.Mesh(new THREE.BoxGeometry(W, 2.9, D), E.std(0xffffff)); derm.position.y = -1.9; derm.userData.holoStrength = 0.22; grp.add(derm);
    const fols = spots.map(([x, z, ph]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); grp.add(g);
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.3, 8), E.std(0xffffff)); hair.position.y = 1.15; hair.userData.holoColor = YEL; hair.userData.holoStrength = big_ ? 0.28 : 0.45; g.add(hair);
      const fol = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 2.0, 16, 1, true), E.std(0xffffff)); fol.position.y = -1.0; g.add(fol);
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 8), E.std(0xffffff)); root.position.y = -1.0; root.userData.holoColor = YEL; root.userData.holoStrength = 0.4; g.add(root);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), E.std(0xffffff)); bulb.position.y = -2.05; g.add(bulb);
      const newHair = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 8), E.std(0xffffff)); newHair.userData.holoColor = GREEN; newHair.userData.holoStrength = 0.9; newHair.visible = false; g.add(newHair);
      const stem = []; for (let s = 0; s < 6; s++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), E.std(0xffffff)); const a = s / 6 * 6.283; c.position.set(Math.cos(a) * 0.24, -1.25 + (s % 2) * 0.12, Math.sin(a) * 0.24); c.userData.holoColor = GREEN; c.visible = false; g.add(c); stem.push(c); }
      const muscle = new THREE.Mesh(unitCyl, E.std(0xffffff)); muscle.userData.holoColor = ORANGE; muscle.userData.holoStrength = 1.1; grp.add(muscle);
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 10, 0, 6.283, 0, Math.PI / 2), E.std(0xffffff)); bump.position.set(x + 0.25, 0, z); bump.userData.holoColor = 0x8fd0ff; bump.userData.holoStrength = 0.55; grp.add(bump);
      return { g, x, z, hair, muscle, bump, stem, newHair, anchor: V3(x + 1.0, -0.5, z), ph };
    });
    const sk = { grp, base, fols };
    sk.pt = (f, ly) => f.g.localToWorld(V3(0, ly, 0));   // point du follicule (monde)
    // g = 0 (poil couché) → 1 (chair de poule)
    sk.goose = gFn => { grp.updateMatrixWorld(); fols.forEach((f, i) => { const g = clamp(typeof gFn === 'function' ? gFn(f, i) : gFn);
      f.g.rotation.z = -lerp(0.78, 0.08, ease(g)); f.g.updateMatrixWorld();
      placeCyl(f.muscle, sk.pt(f, -1.25).sub(base), f.anchor, lerp(0.1, 0.15, g));
      f.bump.scale.set(1, lerp(0.06, 0.6, ease(g)), 1); f.stem.forEach(c => c.visible = false); f.newHair.visible = false; }); };
    sk.goose(0);
    sk.nerves = fols.map(f => { const a = f.anchor.clone().add(base), m = sk.pt(f, -1.25).lerp(a, 0.5); const pts = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push(V3(lerp(base.x + f.x + 1.6, m.x, u), lerp(-3.6, m.y, Math.sqrt(u)), f.z + base.z + Math.sin(u * 3) * 0.2)); } return pts; });
    return sk;
  };
  const SK = V3(300, 0, 0), SF = V3(600, 0, 0);
  const HX = [-3.9, -2.6, -1.3, 0, 1.3, 2.6, 3.9];
  const big = makeSkin(SK, 10, 4.4, [...HX.map((x, i) => [x, 0.9, rand(i)]), ...HX.map((x, i) => [x + 0.65, -1.3, rand(i + 10)])], true);
  const one = makeSkin(SF, 4.2, 1.6, [[-0.6, 0, 0]]);
  const skinG = big.grp, follicles = big.fols, F = one.fols[0];
  const goose = big.goose;

  // ================= VOLAILLE (z = 300) =================
  const CH = V3(0, 0, 300);
  const chick = new THREE.Group(); chick.position.copy(CH); E.scene.add(chick); grid(CH);
  const cBody = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), E.std(0xffffff)); cBody.scale.set(1.7, 1.25, 1.15); cBody.position.y = 2.2; chick.add(cBody);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.1, 16), E.std(0xffffff)); neck.position.set(1.45, 3.2, 0); neck.rotation.z = -0.5; chick.add(neck);
  const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), E.std(0xffffff)); cHead.position.set(1.85, 3.85, 0); chick.add(cHead);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 12), E.std(0xffffff)); beak.rotation.z = -Math.PI / 2; beak.position.set(2.35, 3.8, 0); beak.userData.holoColor = YEL; chick.add(beak);
  const comb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), E.std(0xffffff)); comb.scale.set(1.2, 0.8, 0.4); comb.position.set(1.8, 4.3, 0); comb.userData.holoColor = 0xff4d4d; chick.add(comb);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), E.std(0xffffff)); leg.position.set(0, 0.6, s * 0.45); leg.userData.holoColor = YEL; chick.add(leg); }
  const chickPts = []; for (let i = 0; i < 260; i++) { const u = rand(i + 2000) * 2 - 1, a = rand(i + 2100) * 6.283, r = Math.sqrt(1 - u * u); chickPts.push(V3(r * Math.cos(a) * 1.72, 2.2 + u * 1.27, r * Math.sin(a) * 1.17).add(CH)); }

  // ================= CHAT (x = -300, z = 300) =================
  const CAT = V3(-300, 0, 300);
  const cat = new THREE.Group(); cat.position.copy(CAT); E.scene.add(cat); grid(CAT);
  const catBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 2.2, 8, 20), E.std(0xffffff)); catBody.rotation.z = Math.PI / 2; catBody.position.y = 1.9; cat.add(catBody);
  const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), E.std(0xffffff)); catHead.position.set(2.1, 2.55, 0); cat.add(catHead);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), E.std(0xffffff)); ear.position.set(2.15, 3.2, s * 0.33); cat.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), E.std(0xffffff)); eye.position.set(2.62, 2.65, s * 0.22); eye.userData.holoColor = GREEN; eye.userData.holoStrength = 1.5; cat.add(eye); }
  const catLegs = []; for (const [x, z] of [[-1.1, 0.4], [-1.1, -0.4], [1.0, 0.4], [1.0, -0.4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.3, 10), E.std(0xffffff)); l.position.set(x, 0.65, z); cat.add(l); catLegs.push(l); }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-1.8, 2.0, 0), V3(-2.5, 2.4, 0), V3(-2.7, 3.3, 0), V3(-2.4, 4.0, 0)]), 30, 0.11, 8), E.std(0xffffff)); cat.add(tail);
  const catSurf = []; for (let i = 0; i < 520; i++) { const a = rand(i + 3000) * 6.283, x = lerp(-1.7, 1.6, rand(i + 3100)); const n = V3(0, Math.cos(a), Math.sin(a)); if (n.y < -0.6) continue; catSurf.push({ p: V3(x, 1.9, 0).add(n.clone().multiplyScalar(0.75)), n }); }
  const catFurG = new THREE.BufferGeometry(); catFurG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(catSurf.length * 6), 3));
  const catFur = new THREE.LineSegments(catFurG, new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); catFur.userData.noHolo = true; catFur.frustumCulled = false; cat.add(catFur);
  // erect : 0 couché → 1 dressé ; puff : longueur (hérissement)
  const setCatFur = (erect, puff = 0) => { const a = catFurG.attributes.position.array; const len = lerp(0.35, 0.7, puff);
    catSurf.forEach((s, i) => { const dir = s.n.clone().multiplyScalar(lerp(0.25, 1, erect)).add(V3(-lerp(0.95, 0.1, erect), 0, 0)).normalize(); const q = s.p.clone().add(dir.multiplyScalar(len * (0.75 + 0.5 * rand(i))));
      a.set([s.p.x, s.p.y, s.p.z, q.x, q.y, q.z], i * 6); }); catFurG.attributes.position.needsUpdate = true; };

  // ================= ANCÊTRES (x = 300, z = 300) =================
  const AN = V3(300, 0, 300);
  const anc = P.human(); anc.scale.setScalar(S); anc.position.copy(AN).add(V3(-2.4, 0, 0)); E.scene.add(anc);
  const you = P.human(); you.scale.setScalar(S); you.position.copy(AN).add(V3(2.4, 0, 0)); E.scene.add(you); grid(AN);
  const furA = makeFur(AN.clone().add(V3(-2.4, 0, 0)));
  const speaker2 = speaker.clone(); speaker2.position.copy(AN).add(V3(6, 0, -1)); speaker2.rotation.y = -0.6; E.scene.add(speaker2);

  // ================= SOURIS (z = -300) =================
  const MS = V3(0, 0, -300);
  const mouse = new THREE.Group(); mouse.position.copy(MS); E.scene.add(mouse); grid(MS);
  const mBody = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), E.std(0xffffff)); mBody.scale.set(1.6, 1, 1); mBody.position.y = 1.1; mouse.add(mBody);
  const mHead = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.4, 20), E.std(0xffffff)); mHead.rotation.z = -Math.PI / 2; mHead.position.set(2.0, 1.25, 0); mouse.add(mHead);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 20), E.std(0xffffff)); ear.rotation.x = Math.PI / 2; ear.rotation.y = 0.3 * s; ear.position.set(1.55, 1.95, s * 0.5); mouse.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), E.std(0xffffff)); nose.position.set(2.72, 1.25, 0); nose.userData.holoColor = 0xff6fa0; mouse.add(nose);
  const mTail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-1.5, 0.9, 0), V3(-2.6, 0.5, 0.4), V3(-3.6, 0.6, -0.3), V3(-4.4, 1.0, 0.2)]), 40, 0.06, 6), E.std(0xffffff)); mouse.add(mTail);
  const snow = (base, t, n = 160, a = 1, w = 14, h = 10) => { for (let i = 0; i < n; i++) { const ph = (t * 0.12 + rand(i + 50)) % 1; E.dot(base.clone().add(V3((rand(i) - 0.5) * w + Math.sin(t + i) * 0.3, h * (1 - ph), (rand(i + 9) - 0.5) * 8)), 0.05, col3(0xcfe8ff, a * 0.8)); } };

  // ================= TEMPS CLÉS =================
  const B = {};
  B.film = E.at('film'); B.chanson = E.at('chanson'); B.courant = E.at('courant'); B.hop = E.at('hop'); B.bosses = E.at('bosses'); B.poule = E.at('poule');
  B.pourquoi = E.at('pourquoi'); B.voila = E.at('voilà'); B.cinq = E.at('5'); B.millions = E.at('millions'); B.base = E.at('base'); B.arrecteur = E.at('arrecteur'); B.redresser = E.at('redresser');
  B.etape1 = E.at('étape'); B.froid = E.at('froid'); B.cerveau = E.at('cerveau'); B.sympa = E.at('sympathique'); B.fuir = E.at('fuir'); B.pilote = E.at('pilote'); B.controles = E.at('contrôles'); B.libere = E.at('libère'); B.adre = E.at("l'adrénaline");
  B.etape2 = E.at('étape', B.adre); B.signal = E.at('signal'); B.contracte = E.at('contracte'); B.debout = E.at('debout'); B.souleve = E.at('soulève'); B.autour = E.at('autour'); B.multiplie = E.at('multiplie'); B.milliers = E.at('milliers');
  B.nom = E.at('nom'); B.volaille = E.at('volaille'); B.etape3 = E.at('étape', B.volaille); B.animal = E.at('animal'); B.emprisonnent = E.at('emprisonnent'); B.air = E.at("d'air", B.emprisonnent); B.doudoune = E.at('doudoune'); B.chaleur = E.at('chaleur', B.doudoune);
  B.chat = E.at('chat'); B.herisse = E.at('hérisse'); B.gros = E.at('gros'); B.mais = E.at('mais', B.gros); B.perdu = E.at('perdu'); B.rechauffe = E.at('réchauffe'); B.ancetres = E.at("d'ancêtres");
  B.emotion = E.at('émotion'); B.musique = E.at('musique', B.emotion); B.fou = E.at('fou'); B.y2020 = E.at('2020'); B.souris = E.at('souris'); B.meme = E.at('même', B.souris); B.reveillent = E.at('réveillent'); B.cellules = E.at('cellules', B.reveillent);
  B.capables = E.at('capables'); B.apres = E.at('après', B.capables); B.poussent = E.at('poussent'); B.semaines = E.at('semaines'); B.alors = E.at('alors', B.semaines); B.milliers2 = E.at('milliers', B.alors); B.fourrure = E.at('fourrure', B.alors); B.comme = E.at('comme', B.alors); B.toi = E.at('toi', B.fourrure);

  // visibilité par zone (évite de voir les autres décors au loin)
  const zones = { hum: [human, screen, speaker, brain, ...adrenals, furH], skin: [skinG], one: [one.grp], chick: [chick], cat: [cat], anc: [anc, you, speaker2, furA], mouse: [mouse] };
  const show = (...names) => { for (const [k, arr] of Object.entries(zones)) for (const ob of arr) ob.visible = names.includes(k) && (ob !== furH && ob !== furA ? true : ob.visible); if (!names.includes('hum')) furH.visible = false; if (!names.includes('anc')) furA.visible = false; };
  const resetSkin = () => {};
  const wind = (t, base, a = 1) => { for (let i = 0; i < 220; i++) { const ph = (t * 0.45 + rand(i + 400)) % 1; E.dot(base.clone().add(V3(lerp(9, -9, ph), 0.5 + rand(i + 1) * 6 + Math.sin(t * 2 + i) * 0.15, (rand(i + 2) - 0.5) * 6)), 0.035, col3(0xbfe4ff, a * Math.sin(ph * 3.14))); } };
  const bodyDots = (t, base, n, c, a = 1, size = 0.03) => { for (let i = 0; i < Math.min(n, surf.length); i++) E.dot(W_(surf[i].p, base).add(surf[i].n.clone().multiplyScalar(0.06)), size, col3(c, a)); };
  const shots = [];

  // 1. Accroche : film qui fait peur + chanson
  shots.push({ name: 'accroche', start: 0,
    update(t, lt, k) { show('hum'); brain.visible = false; adrenals.forEach(m => m.visible = false); human.userData.walk(0);
      screen.visible = true; speaker.visible = t > B.chanson - 0.2;
      if (t > B.chanson - 0.2) for (let i = 0; i < 5; i++) { const r = ((lt * 1.5 + i * 0.5) % 2.5); E.ring(i, speaker.position.clone().add(V3(-0.3, 1.6, 0.7)), 0.4 + r, 0x3fe0ff, 0.7 * (1 - r / 2.5), V3(0.3, 0, 1)); }
      E.fit(V3(0, 2.9, -0.5), 4.4, V3(lerp(0.15, -0.15, easeIO(k)), 0.1, 1), 1.3, 48); },
    hud(t) { E.tag3(screen.position, 'FILM QUI FAIT PEUR', 60, 330, COL.red, ease((t - B.film) * 3));
      if (t > B.chanson) E.tag3(speaker.position.clone().add(V3(0, 2.6, 0)), 'CHANSON', -40, -170, COL.cyan, ease((t - B.chanson) * 3)); } });
  // 2. Courant d'air glacé → bosses sur le bras
  shots.push({ name: 'air', start: B.courant,
    update(t, lt, k) { show('hum'); brain.visible = false; adrenals.forEach(m => m.visible = false); screen.visible = false; speaker.visible = false;
      wind(t, V3(0, 0, 0.5), 1);
      if (t > B.hop) { const g = ease((t - B.hop) / 0.8); for (let i = 0; i < surf.length; i++) { const s = surf[i]; if (rand(i + 7) > 0.55) continue; E.dot(W_(s.p).add(s.n.clone().multiplyScalar(0.08)), 0.035 * g, col3(0xffd23f, 0.9 * g)); } }
      E.fit(V3(0.4, 3.0, 0), 2.6, V3(lerp(0.6, 0.9, k), 0.15, 1), 1.6, 46); },
    hud(t) { E.tag3(V3(-3, 1.5, 0.5), 'AIR GLACÉ', -20, 260, COL.cyan, ease((t - B.courant) * 3));
      if (t > B.bosses) E.tag3(ARM, 'PETITES BOSSES', 40, 260, COL.acc, ease((t - B.bosses) * 3)); } });
  // 3. La chair de poule, vue de la peau (surface)
  shots.push({ name: 'surface', start: B.poule - 0.25,
    update(t, lt, k) { show('skin'); resetSkin(); goose((f) => (lt - 0.1 - f.ph * 0.5) * 1.5);
      E.fit(SK.clone().add(V3(0, 0.3, 0)), 5.6, V3(lerp(-0.25, 0.25, easeIO(k)), 0.85, 1), 1.35, 45); },
    hud(t, lt) { if (t > B.pourquoi) E.txt('?', 540, 1380, 260 * easeBack((t - B.pourquoi) * 2.5), COL.acc, 'Inter', 900); } });
  // 4. Sous la peau : coupe
  shots.push({ name: 'coupe', start: B.voila,
    update(t, lt, k) { show('skin'); resetSkin(); goose(0);
      E.fit(SK.clone().add(V3(0, -1, 0)), 5.8, V3(lerp(0.45, 0.2, easeIO(k)), lerp(0.6, 0.18, easeIO(k)), 1), 1.4, 45); },
    hud(t, lt) { const a = ease(lt * 2.5);
      E.tag3(SK.clone().add(V3(-4.6, -0.2, 2.2)), 'ÉPIDERME', 40, -180, COL.cyan, a);
      E.tag3(SK.clone().add(V3(-4.6, -2.4, 2.2)), 'DERME', 60, 220, '#9ab', ease(lt * 2.5 - 0.6)); } });
  // 5. 5 millions de poils
  shots.push({ name: 'millions', start: B.cinq - 0.3,
    update(t, lt, k) { show('hum'); screen.visible = false; speaker.visible = false; brain.visible = false; adrenals.forEach(m => m.visible = false);
      const n = Math.floor(ease((t - B.cinq + 0.3) / 2.2) * surf.length); bodyDots(t, HUM, n, 0xffd23f, 0.9, 0.035);
      E.orbit(V3(0, 2.8, 0), lerp(-0.35, 0.35, easeIO(k)), 0.6, 13.5, 46); },
    hud(t) { const a = ease((t - B.cinq) * 3); o.globalAlpha = a; E.glass(160, 1360, 760, 300, 40, 0.6);
      E.txt(E.P2.count(0, 5, clamp((t - B.cinq) / 1.2)) + ' 000 000', 540, 1470, 96, COL.acc, 'Mono', 800); E.txt('POILS SUR LE CORPS', 540, 1590, 36, '#cfd6e0', 'Mono', 800); o.globalAlpha = 1; } });
  // 6. Le muscle arrecteur (bloc à un seul poil)
  const oneNv = one.nerves[0], SFc = SF.clone().add(V3(-0.1, -0.6, 0));
  shots.push({ name: 'muscle', start: B.base,
    update(t, lt, k) { show('one'); one.goose(t > B.redresser ? (t - B.redresser - 0.2) * 1.2 : 0);
      E.fit(SFc, 2.6, V3(lerp(0.35, -0.1, easeIO(k)), lerp(0.25, 0.1, k), 1), 1.45, 44); },
    hud(t) { E.tag3(one.pt(F, 1.4), 'POIL', 170, 40, COL.acc, ease((t - B.base) * 3));
      E.tag3(F.muscle.position.clone().add(SF), 'MUSCLE ARRECTEUR', 90, 280, COL.orange, ease((t - B.arrecteur + 0.3) * 3));
      if (t > B.redresser) E.tag('↑ REDRESSE LE POIL', 540, 1680, COL.acc, ease((t - B.redresser) * 3)); } });
  // 7. L'alerte : cerveau → système nerveux sympathique (puis plan large : pilote automatique)
  const limbs = [[V3(0, 1.66, 0), V3(0, 1.2, -0.12), V3(0, 0.9, -0.1), V3(-0.11, 0.6, 0), V3(-0.11, 0.15, 0.03)], [V3(0, 1.2, -0.12), V3(0, 0.9, -0.1), V3(0.11, 0.6, 0), V3(0.11, 0.15, 0.03)],
    [V3(0, 1.45, -0.05), V3(-0.28, 1.36, 0), V3(-0.3, 1.0, 0.03), V3(-0.3, 0.8, 0.07)], [V3(0, 1.3, -0.1), V3(0, 1.0, 0.25), V3(-0.15, 1.1, 0.23)], [V3(0, 1.3, -0.1), V3(0, 1.0, 0.25), V3(0.15, 1.1, 0.23)]]
    .map(pts => { const cv = new THREE.CatmullRomCurve3(pts.map(p => W_(p))); return Array.from({ length: 81 }, (_, i) => cv.getPoint(i / 80)); });
  shots.push({ name: 'alerte', start: B.etape1,
    update(t, lt, k) { show('hum'); screen.visible = false; speaker.visible = false; adrenals.forEach(m => m.visible = false);
      brain.visible = true; brain.scale.setScalar(1 + (t > B.cerveau ? 0.08 * Math.sin(t * 12) : 0));
      if (t > B.froid - 0.3 && t < B.cerveau + 0.5) wind(t, V3(0, 0, 0.5), 0.6);
      if (t > B.sympa - 0.4) { E.line3(0, nervePath, 0xffd23f, 0.9, ease((t - B.sympa + 0.4) / 1.2));
        for (let i = 0; i < 6; i++) { const u = (((t - B.sympa) * 0.7 + i / 6) % 1 + 1) % 1; if (t - B.sympa > -0.2) E.dot(nervePath[Math.floor(u * 120)], 0.09, 0xffd23f); } }
      if (t > B.pilote - 0.2) { limbs.forEach((pl, j) => { E.line3(1 + j, pl, 0xffd23f, 0.75, ease((t - B.pilote - j * 0.15) / 1)); for (let i = 0; i < 3; i++) { const u = ((t * 0.8 + i / 3 + j * 0.1) % 1); E.dot(pl[Math.floor(u * 80)], 0.07, 0xffd23f); } });
        E.orbit(V3(0, 2.9, 0), lerp(0.5, -0.3, easeIO((t - B.pilote) / 7)), 0.8, 14.5, 46); }
      else E.fit(V3(0.3, 3.9, 0), 2.4, V3(lerp(0.9, 0.45, easeIO(lt / 6)), 0.12, 1), 1.6, 46); },
    hud(t) { if (t > B.cerveau && t < B.pilote) E.tag3(brain.position, 'CERVEAU', -120, -200, COL.acc, ease((t - B.cerveau) * 3));
      if (t > B.sympa && t < B.pilote) E.tag3(nervePath[70], 'SYSTÈME SYMPATHIQUE', 60, 260, COL.acc, ease((t - B.sympa) * 3));
      if (t > B.pilote) E.tag('PILOTE AUTOMATIQUE', 540, 760, COL.acc, ease((t - B.pilote) * 3));
      if (t > B.fuir) E.tag('MODE ALERTE : FUIR OU COMBATTRE', 540, 1580, COL.red, ease((t - B.fuir) * 3), 28);
      if (t > B.controles) E.tag('✕ PAS DE CONTRÔLE VOLONTAIRE', 540, 1690, '#fff', ease((t - B.controles) * 3), 28); } });
  // 8. Adrénaline
  shots.push({ name: 'adrenaline', start: B.libere - 0.2,
    update(t, lt, k) { show('hum'); screen.visible = false; speaker.visible = false; brain.visible = true;
      adrenals.forEach(m => { m.visible = true; m.scale.setScalar(1 + 0.15 * Math.sin(t * 10)); });
      for (let i = 0; i < 260; i++) { const ph = (lt * 0.35 + rand(i + 600)) % 1; const s = surf[i % surf.length]; const from = adrenals[i % 2].position;
        E.dot(from.clone().lerp(W_(s.p), ease(ph)), 0.045, col3(ORANGE, 1 - ph * 0.6)); }
      E.fit(V3(0, 3.0, 0), 3.0, V3(lerp(-0.5, -0.2, k), 0.15, 1), 1.55, 46); },
    hud(t) { E.tag3(adrenals[1].position, 'ADRÉNALINE', 120, -260, COL.orange, ease((t - B.adre + 0.2) * 3)); } });
  // 9. Étape deux : le signal arrive, le muscle se contracte (bloc à un seul poil), puis vue plongeante sur la bosse
  shots.push({ name: 'traction', start: B.etape2,
    update(t, lt, k) { show('one');
      one.goose(t < B.contracte ? 0 : (t - B.contracte) / 1.2);
      E.line3(0, oneNv, 0xffd23f, 0.9, ease((t - B.signal + 0.2) / 0.9));
      if (t > B.signal) for (let i = 0; i < 4; i++) { const u = clamp(((t - B.signal) * 1.2 + i * 0.25) % 1.2); E.dot(oneNv[Math.floor(u * 40)], 0.1, 0xffd23f); }
      F.muscle.scale.x = F.muscle.scale.z = t > B.contracte ? 0.17 + 0.03 * Math.sin(t * 20) : 0.1;
      if (t < B.autour) E.fit(SFc, 2.7, V3(lerp(0.4, 0.05, easeIO((t - B.etape2) / (B.autour - B.etape2))), 0.15, 1), 1.45, 44);
      else E.fit(SF.clone().add(V3(0, -0.3, 0)), 2.5, V3(lerp(-0.5, -0.2, easeIO((t - B.autour) / 3.5)), 0.8, 1), 1.5, 44); },
    hud(t) { const pre = t < B.autour;
      if (t > B.signal && pre) E.tag3(oneNv[12], 'SIGNAL NERVEUX', 140, 200, COL.acc, ease((t - B.signal) * 3));
      if (t > B.contracte && pre) E.tag3(F.muscle.position.clone().add(SF), 'CONTRACTION', 180, 280, COL.orange, ease((t - B.contracte) * 3));
      if (t > B.debout && pre) E.tag3(one.pt(F, 1.9), 'POIL DEBOUT', -150, -100, COL.acc, ease((t - B.debout) * 3));
      if (t > B.souleve) E.tag3(F.bump.position.clone().add(SF).add(V3(0.1, 0.35, 0)), 'LA PEAU SE SOULÈVE', 120, 260, COL.cyan, ease((t - B.souleve) * 3), 28); } });
  // 10. Multiplie ça par des milliers
  shots.push({ name: 'milliers', start: B.multiplie,
    update(t, lt, k) { show('skin'); resetSkin(); goose(f => f === F ? 1 : (t - B.multiplie - 0.15 - f.ph * 0.6) * 2);
      for (let i = 0; i < 26; i++) if (t > B.milliers - 0.2) { for (const f of follicles) { const nv = big.nerves[follicles.indexOf(f)]; const u = ((t * 1.3 + rand(i + f.x)) % 1); if (i === 0) E.dot(nv[Math.floor(u * 40)], 0.08, 0xffd23f); } }
      E.fit(SK.clone().add(V3(0, -0.6, 0)), 5.8, V3(lerp(-0.3, 0.3, easeIO(k)), lerp(0.3, 0.55, k), 1), 1.35, 46); },
    hud(t) { if (t > B.milliers) E.tag('× DES MILLIERS = CHAIR DE POULE', 540, 1660, COL.acc, ease((t - B.milliers) * 3), 28); } });
  // 11. La volaille plumée
  shots.push({ name: 'volaille', start: B.nom,
    update(t, lt, k) { show('chick');
      chickPts.forEach((p, i) => E.dot(p, 0.06 * ease((t - B.volaille + 0.3 - rand(i) * 0.4) * 3), col3(0xffd23f, 0.9)));
      E.fit(CH.clone().add(V3(0.3, 2.4, 0)), 2.9, V3(lerp(0.5, 0.15, easeIO(k)), 0.2, 1), 1.55, 46); },
    hud(t) { if (t > B.volaille) E.tag3(CH.clone().add(V3(0, 3.4, 1)), 'PEAU DE VOLAILLE PLUMÉE', -40, -200, COL.acc, ease((t - B.volaille) * 3), 28); } });
  // 12. À quoi ça sert : fourrure + couche d'air
  shots.push({ name: 'fourrure', start: B.etape3,
    update(t, lt, k) { show('cat'); cat.scale.setScalar(1); catBody.scale.set(1, 1, 1);
      const er = t < B.emprisonnent ? 0 : ease((t - B.emprisonnent) / 1.2); setCatFur(er, 0);
      if (t > B.air - 0.3) for (let i = 0; i < 420; i++) { const s = catSurf[i % catSurf.length]; const p = s.p.clone().add(s.n.clone().multiplyScalar(0.1 + rand(i + 5) * 0.3 * er)).add(CAT); E.dot(p, 0.03, col3(0x9fe8ff, 0.7 * ease((t - B.air + 0.3) * 2))); }
      if (t > B.chaleur - 0.3) for (let i = 0; i < 160; i++) { const ph = (t * 0.6 + rand(i + 70)) % 1; const s = catSurf[(i * 3) % catSurf.length];
        E.dot(s.p.clone().add(CAT).add(s.n.clone().multiplyScalar(-0.3 + ph * 0.55)), 0.05, col3(ORANGE, 0.9 * (1 - ph))); }
      if (t < B.doudoune) E.fit(CAT.clone().add(V3(0.3, 2.1, 0)), 3.0, V3(lerp(0.2, 0.5, easeIO(lt / 7)), 0.25, 1), 1.55, 46);
      else E.fit(CAT.clone().add(V3(0.2, 2.2, 0)), 3.0, V3(lerp(-0.9, -0.6, easeIO((t - B.doudoune) / 4)), 0.55, 1), 1.5, 46); },
    hud(t) { if (t > B.animal) E.tag3(CAT.clone().add(V3(-0.5, 2.7, 0.3)), 'FOURRURE', -100, -190, COL.cyan, ease((t - B.animal) * 3));
      if (t > B.air) E.tag3(CAT.clone().add(V3(0.6, 2.2, 0.8)), "COUCHE D'AIR", 120, 260, COL.cyan, ease((t - B.air) * 3));
      if (t > B.doudoune) E.tag('= UNE DOUDOUNE QUI GONFLE', 540, 1600, COL.acc, ease((t - B.doudoune) * 3), 28);
      if (t > B.chaleur) E.tag('LA CHALEUR RESTE DEDANS', 540, 1700, COL.orange, ease((t - B.chaleur) * 3), 28); } });
  // 13. Le chat qui a peur se hérisse
  shots.push({ name: 'herisse', start: B.chat,
    update(t, lt, k) { show('cat'); const h = t < B.herisse ? 0 : ease((t - B.herisse) / 0.7);
      setCatFur(lerp(0.3, 1, h), h); catBody.scale.set(1, 1, 1); catBody.position.y = 1.9 + h * 0.35; catBody.rotation.x = 0;
      catLegs.forEach(l => { l.scale.y = 1 + h * 0.25; l.position.y = 0.65 + h * 0.17; });
      E.fit(CAT.clone().add(V3(0.2, 2.2, 0)), 3.2, V3(lerp(-0.3, 0.1, easeIO(k)), 0.15, 1), 1.55, 46); },
    hud(t) { if (t > B.gros) { const a = ease((t - B.gros) * 3); E.tag('PARAÎT PLUS GROS', 540, 1660, COL.acc, a); E.bar(240, 1520, 600, 26, 0.55 + 0.35 * ease((t - B.gros) / 0.8), COL.orange, 'TAILLE APPARENTE', a); } } });
  // 14. Toi : presque plus de fourrure, ancêtres poilus
  shots.push({ name: 'ancetres', start: B.mais,
    update(t, lt, k) { show('anc'); anc.visible = t > B.ancetres - 0.4; furA.userData.set(0.32, t > B.ancetres - 0.4 ? 0.7 * ease((t - B.ancetres + 0.4) * 2) : 0, 0.02, t);
      for (let i = 0; i < 90; i++) { const ph = (t * 0.5 + rand(i + 33)) % 1; const s = surf[i * 7 % surf.length]; E.dot(W_(s.p, you.position).add(s.n.clone().multiplyScalar(ph * 1.6)), 0.05, col3(ORANGE, 0.9 * (1 - ph))); }
      const c = AN.clone().add(V3(t > B.ancetres - 0.4 ? 0 : 2.4, 2.8, 0)); E.fit(c, t > B.ancetres - 0.4 ? 6.0 : 3.2, V3(lerp(-0.2, 0.2, k), 0.12, 1), 1.45, 46); },
    hud(t) { E.tag3(you.position.clone().add(V3(0, 5.4, 0)), 'TOI', 170, 120, COL.cyan, ease((t - B.mais) * 3));
      if (t > B.rechauffe) E.tag('LA CHALEUR S\'ÉCHAPPE', 540, 1700, COL.orange, ease((t - B.rechauffe) * 3), 28);
      if (t > B.ancetres) E.tag3(anc.position.clone().add(V3(0, 5.4, 0)), 'ANCÊTRES POILUS', -60, 760, COL.acc, ease((t - B.ancetres) * 3)); } });
  // 15. Émotion forte : la musique
  shots.push({ name: 'musique', start: B.emotion - 0.2,
    update(t, lt, k) { show('anc'); anc.visible = false; furA.visible = false; speaker2.visible = true;
      for (let i = 0; i < 6; i++) { const r = ((lt * 1.6 + i * 0.45) % 2.8); E.ring(i, speaker2.position.clone().add(V3(-0.3, 1.6, 0.5)), 0.4 + r, 0x3fe0ff, 0.7 * (1 - r / 2.8), V3(-0.5, 0, 1)); }
      const g = ease((t - B.musique) / 0.8); for (let i = 0; i < surf.length; i++) { if (rand(i + 7) > 0.6) continue; const s = surf[i]; E.dot(W_(s.p, you.position).add(s.n.clone().multiplyScalar(0.08)), 0.035 * g, col3(YEL, 0.9 * g)); }
      E.fit(AN.clone().add(V3(4.2, 2.8, -0.5)), 4.3, V3(lerp(0.1, -0.15, easeIO(k)), 0.12, 1), 1.5, 46); },
    hud(t) { E.tag3(speaker2.position.clone().add(V3(0, 2.7, 0)), 'MUSIQUE', 40, -170, COL.cyan, ease((t - B.emotion) * 3));
      if (t > B.musique) E.tag3(W_(V3(0.3, 1.0, 0.07), you.position), 'CHAIR DE POULE', -200, 260, COL.acc, ease((t - B.musique) * 3)); } });
  // 16. 2020 : la souris de Harvard au froid
  shots.push({ name: '2020', start: B.fou - 0.1,
    update(t, lt, k) { show('mouse'); snow(MS, t, 200, t > B.y2020 ? 1 : 0.3);
      E.fit(MS.clone().add(V3(-0.6, 1.3, 0)), 3.6, V3(lerp(0.45, 0.15, easeIO(k)), 0.3, 1), 1.5, 46); },
    hud(t) { if (t > B.y2020) { o.globalAlpha = ease((t - B.y2020) * 3); E.txt('2020', 540, 1480, 150, '#fff', 'Mono', 800); E.txt('HARVARD · ÉTUDE SUR LA SOURIS', 540, 1590, 32, '#cfd6e0', 'Mono', 800); o.globalAlpha = 1; } } });
  // 17. Nerf + muscle réveillent les cellules souches (bloc à un seul poil)
  shots.push({ name: 'souches', start: B.meme,
    update(t, lt, k) { show('one'); one.goose(0.5);
      E.line3(0, oneNv, 0xffd23f, 0.9, 1);
      const P0 = one.pt(F, -1.25); const rib = []; for (let i = 0; i <= 80; i++) { const u = i / 80, a = u * 6.283 * 3; rib.push(P0.clone().add(V3(Math.cos(a) * 0.36, -0.35 + u * 0.7, Math.sin(a) * 0.36))); }
      E.line3(1, rib, 0xffd23f, 0.9, ease((t - B.meme) / 1.2));
      F.stem.forEach((c, i) => { c.visible = t > B.reveillent - 0.2; c.scale.setScalar(1 + (t > B.reveillent ? 0.3 * Math.sin(t * 9 + i) : 0)); });
      if (t > B.reveillent) for (let i = 0; i < 40; i++) { const ph = (t * 0.8 + rand(i)) % 1; E.dot(P0.clone().add(V3((rand(i + 1) - 0.5) * 1.2 * ph, (rand(i + 2) - 0.5) * 1.2 * ph, (rand(i + 3) - 0.5) * 1.2 * ph)), 0.04, col3(GREEN, 1 - ph)); }
      E.fit(SFc, 2.5, V3(lerp(-0.35, 0.2, easeIO(k)), 0.2, 1), 1.45, 44); },
    hud(t) { E.tag3(oneNv[14], 'NERF', 150, 200, COL.acc, ease((t - B.meme) * 3)); E.tag3(F.muscle.position.clone().add(SF), 'MUSCLE', 170, -60, COL.orange, ease((t - B.meme - 0.4) * 3));
      if (t > B.cellules) E.tag3(one.pt(F, -1.25), 'CELLULES SOUCHES', -150, -330, COL.green, ease((t - B.cellules) * 3));
      if (t > B.capables) E.tag('= FABRIQUENT DE NOUVEAUX POILS', 540, 1690, COL.green, ease((t - B.capables) * 3), 28); } });
  // 18. Après un froid prolongé : de nouveaux poils poussent
  shots.push({ name: 'repousse', start: B.apres,
    update(t, lt, k) { show('skin'); resetSkin(); goose(0.15); snow(SK.clone().add(V3(0, 0, 0)), t, 140, 0.8, 12, 6);
      const gr = ease((t - B.poussent + 0.3) / 2.2);
      follicles.forEach((f, i) => { f.newHair.visible = gr > 0; const L = 0.2 + gr * (1.6 + rand(i) * 0.6) ; f.newHair.scale.y = L; f.newHair.position.set(0.18, -2.0 + L / 2, 0); f.stem.forEach(c => c.visible = true); });
      E.fit(SK.clone().add(V3(0, -0.5, 0)), 5.6, V3(lerp(0.3, -0.2, easeIO(k)), 0.3, 1), 1.4, 46); },
    hud(t) { const a = ease((t - B.apres) * 3); o.globalAlpha = a; E.glass(170, 1380, 740, 300, 40, 0.6);
      const d = Math.min(13, Math.floor(clamp((t - B.apres) / Math.max(0.5, B.semaines - B.apres)) * 13));
      E.txt('JOUR ' + d, 540, 1490, 96, COL.green, 'Mono', 800); E.txt('MOINS DE 2 SEMAINES', 540, 1610, 36, '#cfd6e0', 'Mono', 800); o.globalAlpha = 1;
      if (t > B.poussent) E.tag('NOUVEAUX POILS', 540, 1300, COL.green, ease((t - B.poussent) * 3)); } });
  // 19. Fin : retour à l'humain, fourrure fantôme
  shots.push({ name: 'fin', start: B.alors,
    update(t, lt, k) { show('hum'); screen.visible = false; speaker.visible = false; brain.visible = false; adrenals.forEach(m => m.visible = false);
      const g = ease((t - B.milliers2 + 0.2) / 0.8); for (let i = 0; i < surf.length; i++) { if (rand(i + 7) > 0.6) continue; const s = surf[i]; E.dot(W_(s.p).add(s.n.clone().multiplyScalar(0.08)), 0.035 * g, col3(YEL, 0.9 * g)); }
      furH.userData.set(0.3, t > B.fourrure - 0.3 ? 0.55 * ease((t - B.fourrure + 0.3) * 1.5) : 0, 0.02, t);
      if (t < B.comme) E.orbit(V3(0, 3.3, 0), lerp(0.5, 0.1, easeIO((t - B.alors) / 7)), 0.5, lerp(15, 16, easeIO((t - B.alors) / 7)), 46);
      else E.orbit(V3(0, 3.3, 0), lerp(-0.7, -0.3, easeIO((t - B.comme) / 6)), lerp(1.5, 0.8, k), lerp(16, 18, easeIO((t - B.comme) / 6)), 46); },
    hud(t) { if (t > B.fourrure) E.tag('LA FOURRURE QU\'ON N\'A PLUS', 540, 1660, COL.orange, ease((t - B.fourrure) * 3), 28);
      if (t > B.toi) E.txt('?', 540, 1420, 220 * easeBack((t - B.toi) * 2.5), COL.acc, 'Inter', 900); } });

  return { shots, sfx: [
    { t: B.film, type: 'pop' }, { t: B.chanson, type: 'pop' }, { t: B.hop, type: 'click' }, { t: B.poule, type: 'boom' },
    { t: B.cinq, type: 'boom' }, { t: B.arrecteur, type: 'pop' }, { t: B.cerveau, type: 'pop' }, { t: B.sympa, type: 'rise' },
    { t: B.adre, type: 'pop' }, { t: B.contracte, type: 'click' }, { t: B.milliers, type: 'boom' }, { t: B.volaille, type: 'pop' },
    { t: B.air, type: 'pop' }, { t: B.herisse, type: 'boom' }, { t: B.ancetres, type: 'pop' }, { t: B.fou - 0.4, type: 'rise' },
    { t: B.y2020, type: 'boom' }, { t: B.cellules, type: 'pop' }, { t: B.semaines, type: 'ding' }, { t: B.toi + 1.0, type: 'ding' } ] };
}
