// Épisode 001 – Comment un radar te flashe.
// Modèle de référence : un épisode exporte build(E) et renvoie { shots, sfx }.
// Chaque plan : { name, start (s), update(t, lt, k) → place la 3D, hud(t, lt, k) → dessine en 2D,
//                 filter (CSS filter sur l'image 3D), no3d (plan 100 % 2D), sfx ('whoosh' par défaut | 'none' | …) }
// t = temps global, lt = temps depuis le début du plan, k = avancement du plan 0..1.
export async function build(E) {
  const { THREE, V3, P, clamp, ease, easeIO, lerp, COL, o, W, H } = E;
  E.mood('night');

  // ---------- décor ----------
  const world = P.nightRoad(); E.scene.add(world);
  const RADAR = V3(5.4, 0, 30);
  const tower = P.radarTower(); tower.position.copy(RADAR); world.add(tower);
  const LENS = RADAR.clone().add(tower.userData.lens);
  const car = P.car(); world.add(car);
  const CARX = 1.9, front = z => V3(CARX, 0.75, z + 2.25);
  const drive = z => car.userData.drive(CARX, z);
  const beams = on => { for (const b of car.userData.beams) b.visible = on; car.userData.hl.emissiveIntensity = on ? 2.6 : 1.0; };

  // zone ambulance, loin de la route (x = 600)
  const AMB = new THREE.Group(); AMB.position.set(600, 0, 0); E.scene.add(AMB);
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 60), E.std(0x15171c, 0.95)); g.rotation.x = -Math.PI / 2; AMB.add(g);
    for (let i = 0; i < 60; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.15), E.std(0xeeeeee, 0.6, 0, 0x777777, 0.4)); d.rotation.x = -Math.PI / 2; d.position.set(-180 + i * 6, 0.012, 0); AMB.add(d); }
    for (const s of [-1, 1]) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(400, 40), E.std(0x0b1510, 1)); gr.rotation.x = -Math.PI / 2; gr.position.set(0, -0.01, s * 25); AMB.add(gr); } }
  const amb = P.ambulance(); AMB.add(amb);

  // ---------- temps clés (mots du script) ----------
  const B = {};
  B.trop = E.at('trop'); B.voila = E.at('voilà'); B.leradar = E.at('le', 5); B.envoie = E.at('envoie'); B.frappe = E.at('frappe'); B.rebondit = E.at('rebondit');
  B.mais = E.at('mais'); B.plustu = E.at('plus', B.mais); B.cest = E.at("c'est", B.plustu); B.lememe = E.at('le', B.cest);
  B.enquelques = E.at('en', B.lememe + 3); B.ladeduit = E.at('en', B.enquelques + 1); B.v97 = E.at('97'); B.marge = E.at('il', B.v97);
  B.reste = E.at('reste'); B.surune = E.at('sur', B.reste); B.clic = E.at('clic'); B.tourelles = E.at('et', B.clic);
  B.infrarouge = E.at('infrarouge'); B.tunele = E.at('tu', B.infrarouge); B.limage = E.at("l'image"); B.rennes = E.at('rennes');
  B.taplaque = E.at('ta', B.rennes); B.etlavis = E.at('et', B.taplaque); B.maintenant = E.at('maintenant');

  // ---------- physique simplifiée des ondes ----------
  const VW = 17, PER = 0.34, carZ2 = t => -30 + 6.2 * (t - B.leradar);
  const hitTime = te => { let th = te + 1; for (let i = 0; i < 30; i++) th = te + LENS.distanceTo(front(carZ2(th))) / VW; return th; };

  // ---------- photo du radar (capturée une fois) ----------
  const carZ5 = t => -42 + 4.4 * (t - B.enquelques);
  let PHOTO = null;
  const getPhoto = () => {
    if (PHOTO) return PHOTO;
    beams(false); car.userData.hl.emissiveIntensity = 0.9; drive(carZ5(B.clic));
    const f = front(carZ5(B.clic)); E.camSet(V3(LENS.x - 0.1, LENS.y + 0.05, LENS.z - 0.6), V3(f.x, f.y + 0.2, f.z), 11);
    const c = E.snapshot('grayscale(1) contrast(1.3) brightness(1.05)');
    const zc = carZ5(B.clic) + 2.27, pc = E.proj(V3(CARX, 0.42, zc)), pl = E.proj(V3(CARX - 0.26, 0.42, zc)), pr = E.proj(V3(CARX + 0.26, 0.42, zc));
    PHOTO = { c, px: pc[0], py: pc[1], pw: Math.abs(pr[0] - pl[0]) }; return PHOTO;
  };

  // ---------- carte de France (contour simplifié) ----------
  const FR = [[2.37,51.03],[4.2,50.0],[5.8,49.5],[8.2,48.95],[7.6,47.6],[6.8,47.4],[6.1,46.4],[7.0,45.9],[6.6,45.1],[7.0,44.2],[7.5,43.8],[6.2,43.1],[4.8,43.4],[3.2,43.0],[3.1,42.45],[1.7,42.5],[0.0,42.7],[-1.8,43.4],[-1.25,44.6],[-1.2,46.0],[-2.1,46.8],[-2.5,47.3],[-4.4,47.8],[-4.8,48.4],[-3.5,48.85],[-1.6,48.65],[-1.9,49.7],[-1.2,49.35],[0.2,49.45],[1.6,50.2],[1.6,50.9]];
  const frXY = (lo, la, cx, cy, s) => [cx + (lo - 2.4) * 0.69 * s, cy - (la - 46.6) * s];
  const franceMap = (cx, cy, s, a) => { o.save(); o.globalAlpha = a; o.beginPath(); FR.forEach(([lo, la], i) => { const [X, Y] = frXY(lo, la, cx, cy, s); i ? o.lineTo(X, Y) : o.moveTo(X, Y); }); o.closePath();
    o.fillStyle = 'rgba(63,224,255,0.08)'; o.fill(); o.strokeStyle = 'rgba(63,224,255,0.75)'; o.lineWidth = 4; o.shadowColor = COL.cyan; o.shadowBlur = 16; o.stroke(); o.restore(); };
  const photoCard = (x, y, w, a, rot = 0) => {
    const Pp = getPhoto(), h = w * 1.2;
    o.save(); o.globalAlpha = a; o.translate(x, y); o.rotate(rot);
    o.shadowColor = 'rgba(0,0,0,0.6)'; o.shadowBlur = 40; o.fillStyle = '#f5f5f5'; o.fillRect(-w/2 - 14, -h/2 - 14, w + 28, h + 90); o.shadowBlur = 0;
    o.drawImage(Pp.c, Pp.px - 330, Pp.py - 520, 660, 792, -w/2, -h/2, w, h); o.restore();
  };

  const shots = [];
  // 1. Accroche : la voiture arrive, ralenti, retour arrière
  const carZ1 = t => t < B.trop ? lerp(-95, 25.5, t / B.trop) : t < B.voila ? 25.5 + (t - B.trop) * 1.4
    : lerp(25.5 + (B.voila - B.trop) * 1.4, -30, easeIO((t - B.voila) / (B.leradar - B.voila - 0.15)));
  shots.push({ name: 'accroche', start: 0,
    update(t) { beams(true); tower.userData.blink(t); drive(carZ1(t));
      const k = easeIO(clamp((t - B.trop) / (B.leradar - B.trop)));
      const look = V3(lerp(1.6, 3.2, k), lerp(1.3, 1.2, k), lerp(-20, 18, k)); if (t < B.trop) look.z = lerp(-30, 10, ease(t / B.trop));
      E.camSet(V3(lerp(-1.3, 11, k), lerp(0.9, 6.5, k), lerp(41, 44, k)), look, lerp(42, 40, k)); },
    hud(t) {
      if (t < B.trop) E.tag3(LENS, 'RADAR', -150, -160, '#fff', clamp((t - 0.5) * 3) * clamp((B.trop - t) * 4));
      if (t >= B.trop && t < B.voila) E.txt('◉ SLOW MOTION', 540, 1700, 34, COL.acc, 'Mono', 800);
      if (t >= B.voila) { E.txt('◀◀  RETOUR ARRIÈRE', 540, 1700, 36, '#fff', 'Mono', 800); o.globalAlpha = 0.1; o.fillStyle = '#fff'; for (let i = 0; i < 12; i++) o.fillRect(0, ((t - B.voila) * 900 + i * 170) % H, W, 6); }
    } });
  // 2. Onde émise / réfléchie
  shots.push({ name: 'ondes', start: B.leradar,
    update(t, lt, k) { beams(true); drive(carZ2(t));
      E.camSet(V3(lerp(22, 18, k), lerp(13, 10, k), lerp(46, 43, k)), V3(2.5, 0.8, lerp(10, 14, k)), 50);
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const te = B.envoie + i * PER; if (te > t) break;
        const th = hitTime(te), r = (t - te) * VW;
        if (t < th) E.shell(n++, LENS, front(carZ2(te)).sub(LENS), r, 0x3fe0ff, 0.75);
        else if (t > B.frappe - 0.3) { const c = front(carZ2(th)), rr = (t - th) * VW; if (rr < c.distanceTo(LENS)) E.shell(n++, c, LENS.clone().sub(c), rr, 0xff8a3d, 0.85); }
      } },
    hud(t) {
      E.tag3(LENS, 'ONDE ÉMISE', -60, -230, COL.cyan, clamp((t - B.envoie - 0.3) * 3));
      if (t > B.rebondit - 0.2) E.tag3(front(carZ2(t)), 'ONDE RÉFLÉCHIE', 40, 260, COL.orange, clamp((t - B.rebondit + 0.2) * 3));
    } });
  // 3. Panneau Doppler (fond flou)
  shots.push({ name: 'doppler', start: B.mais, filter: 'blur(10px) brightness(0.55)',
    update() { shots[1].update(B.mais - 0.01, 0, 1); },
    hud(t, lt) {
      const a = ease(lt / 0.4), x = 80, y = 820, w = 920; o.globalAlpha = a; o.translate(0, (1 - a) * 80);
      E.glass(x, y, w, 760, 36, 0.62);
      E.txt('ÉMISE', x + 50, y + 70, 30, COL.cyan, 'Mono', 800, 'left'); E.wave2(x + 50, y + 200, w - 100, 70, 180, t * 9, COL.cyan);
      const sp = ease((t - B.plustu) / 1.6) * 97, comp = 1 + sp / 97 * 1.4;
      E.txt('REÇUE', x + 50, y + 360, 30, COL.orange, 'Mono', 800, 'left'); E.wave2(x + 50, y + 490, w - 100, 70, 180 / comp, t * 9 * comp, COL.orange);
      E.bar(x + 50, y + 620, w - 100, 22, sp / 97, COL.acc);
      E.txt('VITESSE', x + 50, y + 690, 28, '#aaa', 'Mono', 800, 'left'); E.txt(`${Math.round(sp)} km/h`, x + w - 50, y + 690, 34, '#fff', 'Mono', 800, 'right');
      if (t > B.cest) E.txt('λ ↓   fréquence ↑', 540, y - 60, 40, '#fff', 'Mono', 800);
    } });
  // 4. Ambulance vue du dessus : les cercles sonores se resserrent devant
  const AV = 7.5, SV = 15, AP = 0.28;
  shots.push({ name: 'ambulance', start: B.lememe,
    update(t) { const tt = t - B.lememe + 0.2, ax = -20 + AV * tt; amb.position.set(ax, 0, 0); amb.userData.setBlink(Math.floor(t * 8) % 2);
      let n = 0;
      for (let i = 0; i < 60 && n < 26; i++) { const te = -1.6 + i * AP; if (te > tt) break; const r = (tt - te) * SV; if (r > 70) continue;
        E.ring(n++, V3(600 - 20 + AV * te + 2.6, 0.3, 0), r, 0xffffff, 0.55 * clamp(1 - r / 70)); }
      const k = easeIO(clamp(tt / 4)); E.camSet(V3(600 + lerp(-12, 6, k), lerp(34, 40, k), lerp(13, 17, k)), V3(600 + lerp(-12, 6, k), 0, 0), 50); },
    hud(t) { const tt = t - B.lememe + 0.2, ax = 600 - 20 + AV * tt, a = clamp((tt - 1.0) * 2);
      const [fx, fy] = E.proj(V3(ax + 13, 0, 0)), [bx, by] = E.proj(V3(ax - 13, 0, 0));
      E.tag('SON AIGU  ▲', fx, fy + 160, '#fff', a); E.tag('SON GRAVE  ▼', bx, by + 160, '#fff', a); } });
  // 5. Vue du radar : mesure et calcul
  shots.push({ name: 'mesure', start: B.enquelques,
    update(t) { beams(false); tower.userData.blink(t); const z = carZ5(t); drive(z); const f = front(z);
      E.camSet(V3(LENS.x - 0.1, LENS.y + 0.05, LENS.z - 0.6), V3(f.x + Math.sin(t * 0.7) * 0.03, f.y + 0.2, f.z), lerp(18, 13, ease((t - B.enquelques) / 8))); },
    hud(t) {
      const [cx, cy] = E.proj(front(carZ5(t)).add(V3(0, 0.25, 0))), red = t > B.surune;
      E.reticle(cx, cy, 130 + Math.sin(t * 6) * 6, red ? COL.red : COL.cyan, 1, red ? 0 : t * 0.4); E.scanlines();
      E.txt('● REC', 90, 720, 30, COL.red, 'Mono', 800, 'left');
      E.txt(`t = ${Math.min(0.032, Math.max(0, (t - B.enquelques) * 0.012)).toFixed(3)} s`, 990, 720, 30, '#cfe', 'Mono', 800, 'right');
      const y0 = 1270;
      if (t > B.ladeduit - 0.2) {
        o.save(); o.globalAlpha = ease((t - B.ladeduit + 0.2) * 3); E.glass(90, y0, 900, 470, 32, 0.6);
        E.txt('VITESSE MESURÉE', 140, y0 + 60, 28, '#9ab', 'Mono', 800, 'left');
        E.txt(t > B.v97 ? String(Math.round(ease((t - B.v97) / 1.0) * 97)) : '--', 140, y0 + 170, 150, '#fff', 'Mono', 800, 'left');
        E.txt('km/h', 380, y0 + 200, 44, '#9ab', 'Mono', 800, 'left');
        if (t > B.marge) E.txt('− 5   marge technique', 140, y0 + 290, 40, COL.acc, 'Mono', 800, 'left');
        if (t > B.reste) { o.fillStyle = 'rgba(255,255,255,0.25)'; o.fillRect(140, y0 + 335, 800, 3); E.txt('= 92 km/h retenus', 140, y0 + 400, 52, '#fff', 'Mono', 800, 'left'); }
        o.restore();
        if (t > B.surune) { const b = ease((t - B.surune) * 2.5); E.P2.speedSign(860, y0 + 160, 95 * (0.6 + 0.4 * b), '80', b); E.tag('+12 km/h', 860, y0 + 300, COL.red, b); }
      } } });
  // 6. La photo (plan 2D) avec obturateur
  shots.push({ name: 'photo', start: B.clic, no3d: true,
    update() { getPhoto(); },
    hud(t, lt) { const Pp = getPhoto(); o.save(); const s = lerp(1.0, 1.08, lt / 2); o.translate(540, 1050); o.scale(s, s); o.translate(-540, -1050);
      o.drawImage(Pp.c, Pp.px - 540, Pp.py - 1000, W, H, 0, 0, W, H); o.restore();
      o.fillStyle = 'rgba(0,0,0,0.75)'; o.fillRect(0, 1560, W, 120); E.txt('VITESSE RETENUE 92 KM/H  ·  VMA 80', 540, 1620, 34, '#fff', 'Mono', 800);
      if (lt < 0.35) { const k = lt < 0.12 ? lt / 0.12 : 1 - (lt - 0.12) / 0.23; o.fillStyle = '#000'; o.fillRect(0, 0, W, H * 0.5 * k); o.fillRect(0, H - H * 0.5 * k, W, H * 0.5 * k); }
      if (lt > 0.12 && lt < 0.4) E.flash(1 - (lt - 0.12) / 0.28);
      E.reticle(540, 1000, 120, COL.acc, clamp((lt - 0.5) * 3)); } });
  // 7. Tourelle : vision normale puis infrarouge
  const carZ6 = t => -60 + 30 * (t - B.tourelles), ir = t => t >= B.infrarouge && t < B.tunele;
  shots.push({ name: 'tourelle', start: B.tourelles,
    filter: t => ir(t) ? 'grayscale(1) sepia(1) hue-rotate(-35deg) saturate(3.2) contrast(1.45) brightness(1.2)' : null,
    update(t, lt, k) { beams(true); drive(carZ6(t)); tower.userData.blink(t); E.camSet(V3(-3.2, 1.6, lerp(50, 47, k)), V3(lerp(4.2, 4.6, k), 2.6, 27), 44); },
    hud(t) {
      const L = LENS.clone().add(V3(0.1, 0, 0.3)), [x, y] = E.proj(L);
      if (t < B.infrarouge) E.tag3(L, 'RADAR TOURELLE', -220, -170, '#fff', ease((t - B.tourelles - 0.2) * 3));
      if (ir(t)) { E.txt('◉ VISION INFRAROUGE', 540, 1700, 36, '#fff', 'Mono', 800);
        const d = t - B.infrarouge - 0.55; if (d > 0) { const a = Math.exp(-d * 2.2), gr = o.createRadialGradient(x, y, 0, x, y, 900 * (0.4 + 0.6 * a)); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.25, `rgba(255,255,255,${0.5 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); o.fillStyle = gr; o.fillRect(0, 0, W, H); } }
      if (t >= B.tunele) { const a = ease((t - B.tunele) * 3); o.globalAlpha = a; E.txt('◉ VISION HUMAINE', 540, 1700, 36, '#fff', 'Mono', 800); E.tag('AUCUN FLASH VISIBLE', 540, 1600, COL.acc); }
    } });
  // 8–10. Données : Rennes, lecture de plaque, boîte aux lettres (fond 3D flouté)
  const bgDrift = t => { drive(-200); E.camSet(V3(-10 + t * 0.3, 14, 70), V3(3, 0, 20), 45); };
  shots.push({ name: 'rennes', start: B.limage, filter: 'blur(10px) brightness(0.55)', update: bgDrift,
    hud(t, lt) { const q = easeIO(lt / 1.6); franceMap(560, 1150, 78, ease(lt * 2)); const [rx, ry] = frXY(-1.68, 48.11, 560, 1150, 78);
      const pulse = (t * 1.5) % 1; o.save(); o.strokeStyle = COL.acc; o.globalAlpha = 1 - pulse; o.lineWidth = 4; o.beginPath(); o.arc(rx, ry, 20 + pulse * 70, 0, 7); o.stroke(); o.restore();
      o.fillStyle = COL.acc; o.beginPath(); o.arc(rx, ry, 14, 0, 7); o.fill();
      if (t > B.rennes - 0.3) E.tag('RENNES · CENTRE DE TRAITEMENT', 540, ry - 110, COL.acc, ease((t - B.rennes + 0.3) * 3));
      const sx = 820, sy = 1650, cx = 900, cy = 900;
      o.save(); o.strokeStyle = 'rgba(63,224,255,0.7)'; o.lineWidth = 4; o.setLineDash([10, 12]); o.lineDashOffset = -t * 60; o.beginPath(); o.moveTo(sx, sy); o.quadraticCurveTo(cx, cy, rx, ry); o.stroke(); o.restore();
      const bx = (1-q)*(1-q)*sx + 2*(1-q)*q*cx + q*q*rx, by = (1-q)*(1-q)*sy + 2*(1-q)*q*cy + q*q*ry;
      photoCard(bx, by, lerp(300, 90, q), 1 - clamp((q - 0.92) * 12), lerp(-0.12, 0, q));
      if (q < 0.9) E.txt('🔒', bx + lerp(150, 45, q), by - lerp(190, 60, q), lerp(60, 26, q), '#fff'); } });
  shots.push({ name: 'plaque', start: B.taplaque, filter: 'blur(10px) brightness(0.55)', update: bgDrift,
    hud(t, lt) { const Pp = getPhoto(); E.glass(70, 820, 940, 820, 36, 0.7);
      const zw = 840, zh = 420, sw = Pp.pw * 1.15, sh = sw / 2;
      o.save(); o.beginPath(); o.roundRect(120, 870, zw, zh, 20); o.clip(); o.drawImage(Pp.c, Pp.px - sw/2, Pp.py - sh/2, sw, sh, 120, 870, zw, zh); o.restore();
      o.fillStyle = 'rgba(63,224,255,0.8)'; o.fillRect(120 + ((lt * 0.9) % 1) * zw, 870, 5, zh);
      const chars = 'AB-123-CD', n = Math.min(chars.length, Math.floor(lt / 0.16)), cw = zw / 1.15 * 0.78 / 9, x0 = 120 + zw / 2 - zw / 1.15 * 0.39;
      for (let i = 0; i < n; i++) { o.strokeStyle = COL.cyan; o.lineWidth = 3; o.strokeRect(x0 + i * cw + 3, 870 + zh / 2 - 60, cw - 6, 120); }
      E.txt(chars.slice(0, n) + (n < chars.length && Math.floor(lt * 6) % 2 ? '▌' : ''), 540, 1420, 96, '#fff', 'Mono', 800);
      if (n === chars.length) E.tag('✓  PLAQUE IDENTIFIÉE', 540, 1550, COL.green, ease((lt - 1.5) * 3)); } });
  shots.push({ name: 'courrier', start: B.etlavis, filter: 'blur(10px) brightness(0.55)', update: bgDrift,
    hud(t, lt) { o.save(); o.translate(540, 1240);
      o.fillStyle = '#2a3442'; o.beginPath(); o.roundRect(-260, -230, 520, 520, 34); o.fill(); o.fillStyle = '#3a4658'; o.beginPath(); o.roundRect(-230, -200, 460, 460, 26); o.fill();
      o.fillStyle = '#0a0d12'; o.beginPath(); o.roundRect(-170, -140, 340, 26, 13); o.fill(); o.restore();
      const ey = lerp(560, 1080, easeIO(clamp(lt / 1.1)));
      o.save(); o.beginPath(); o.rect(0, 0, W, 1113); o.clip(); E.P2.envelope(380, ey, 320, 210); o.restore();
      if (lt > 1.1) E.tag('AVIS DE CONTRAVENTION', 540, 820, COL.red, ease((lt - 1.1) * 3)); } });
  // 11. Grue finale
  shots.push({ name: 'fin', start: B.maintenant,
    update(t, lt, k) { beams(true); tower.userData.blink(t); drive(lerp(33, 120, clamp(lt / 4.5))); const e = easeIO(k);
      E.camSet(V3(lerp(-1.5, 9, e), lerp(1.6, 24, e), lerp(18, -6, e)), V3(lerp(4, 2, e), lerp(2.4, 0, e), lerp(32, 60, e)), 48); },
    hud(t, lt) { o.globalAlpha = ease((lt - 2.0) * 1.2); E.txt('LÈVE LE PIED.', 540, 1560, 74, COL.acc, 'Inter', 900); } });

  shots.find(s => s.name === 'photo').sfx = 'none';   // le « clic » remplace le whoosh
  // bruitages calés sur les mots (la musique de fond est ajoutée automatiquement par tools/mix.py)
  return { shots, sfx: [
    { t: B.trop, type: 'boom' }, { t: B.voila + 0.05, type: 'rise' }, { t: B.frappe + 0.3, type: 'pop' },
    { t: E.at('doppler'), type: 'boom' }, { t: B.v97, type: 'ding' }, { t: B.reste, type: 'pop' }, { t: E.at('80'), type: 'pop' },
    { t: B.clic, type: 'click' }, { t: B.infrarouge + 0.55, type: 'pop' }, { t: B.rennes, type: 'ding' },
    { t: B.taplaque + 1.5, type: 'ding' }, { t: E.at('lettres'), type: 'pop' } ] };
}
