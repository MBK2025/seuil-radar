// Épisode 003 – Et si toute la glace de la Terre fondait ?
// Style classic photoréaliste. Zones (show) :
//  EARTH (Terre vue de l'espace, glaces et niveau de la mer pilotables), ICE (falaise de banquise + océan + icebergs, 1 u = 1 m),
//  BLOCK (calotte antarctique en coupe, montagnes sous la glace, 1 u ≈ 250 m), MTN (vallée glaciaire, 1 u = 10 m),
//  CITY (ville côtière qui se noie, 1 u = 1 m), GLASS (verre d'eau et glaçon sur une table).
export async function build(E) {
  const { THREE, V3, clamp, ease, easeIO, lerp, rand } = E;
  const scene = E.scene, cam = E.camera;
  E.mood('space');
  scene.background = new THREE.Color(0x000000);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const NOISE = `
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
    float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.07 + vec3(4.7, 1.2, 8.1); a *= 0.5; } return s / 0.875; }
    vec3 bumpN(vec3 pos, vec3 n, float h, float k){ vec3 sx = dFdx(pos), sy = dFdy(pos); vec3 r1 = cross(sy, n), r2 = cross(n, sx);
      float det = dot(sx, r1); vec3 g = sign(det) * (dFdx(h) * k * r1 + dFdy(h) * k * r2); return normalize(abs(det) * n - g); }`;
  const VS = `varying vec3 vP; varying vec3 vN; varying vec3 vW;
    void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  // éclairage extérieur partagé par tous les shaders « terrain »
  const ENV = { uL: { value: V3(0.6, 0.25, 0.75).normalize() }, uLC: { value: new THREE.Color(1.3, 1.1, 0.9) }, uAmb: { value: new THREE.Color(0.3, 0.36, 0.45) },
    uFog: { value: new THREE.Color(0.6, 0.66, 0.75) }, uFogD: { value: new THREE.Vector2(200, 1100) }, uT: { value: 0 } };
  const ENVG = `uniform vec3 uL; uniform vec3 uLC; uniform vec3 uAmb; uniform vec3 uFog; uniform vec2 uFogD; uniform float uT;
    varying vec3 vP; varying vec3 vN; varying vec3 vW;
    vec3 fogit(vec3 c){ float d = length(cameraPosition - vW); return mix(c, uFog, smoothstep(uFogD.x, uFogD.y, d)); }`;
  const L = E.lights;
  const lightsOff = () => { L.key.intensity = 0; L.hemi.intensity = 0; L.rim.intensity = 0; };
  const setEnv = (o) => { if (o.L) ENV.uL.value.copy(o.L).normalize(); if (o.LC) ENV.uLC.value.setRGB(...o.LC); if (o.amb) ENV.uAmb.value.setRGB(...o.amb); if (o.fog) ENV.uFog.value.setRGB(...o.fog); if (o.fogD) ENV.uFogD.value.set(...o.fogD);
    lightsOff(); L.key.position.copy(ENV.uL.value).multiplyScalar(200); L.key.color.setRGB(ENV.uLC.value.r, ENV.uLC.value.g, ENV.uLC.value.b); L.key.intensity = o.key ?? 1.6;
    L.hemi.color.setRGB(ENV.uAmb.value.r * 2, ENV.uAmb.value.g * 2, ENV.uAmb.value.b * 2); L.hemi.groundColor.setRGB(0.12, 0.12, 0.13); L.hemi.intensity = o.hemi ?? 0.8; };

  // ======================= ciel (dôme + étoiles) =======================
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: 0 }, uSpace: { value: 1 }, uSun: { value: V3(0.6, 0.25, 0.75).normalize() }, uMilky: { value: 0.6 }, uWarm: { value: 0 }, uHaze: { value: new THREE.Color(0.75, 0.8, 0.86) }, uAur: { value: 0 }, uAT: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uDay; uniform float uSpace; uniform vec3 uSun; uniform float uMilky; uniform float uWarm; uniform vec3 uHaze; uniform float uAur; uniform float uAT; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 night = mix(vec3(0.010, 0.016, 0.034), vec3(0.0015, 0.003, 0.009), smoothstep(-0.05, 0.6, y));
        vec3 day = mix(uHaze, vec3(0.07, 0.20, 0.50), smoothstep(-0.02, 0.45, y));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        day += vec3(1.0, 0.75, 0.45) * pow(sd, 10.0) * 0.3 + vec3(1.0, 0.9, 0.7) * pow(sd, 600.0) * 1.2;
        vec3 warm = vec3(0.95, 0.45, 0.16) * pow(1.0 - clamp(y, 0.0, 1.0), 5.0) * uWarm * (0.5 + 0.5 * pow(sd, 2.0));
        vec3 c = mix(night, day, uDay) + warm;
        float cl = smoothstep(0.55, 0.8, fbm(vec3(d.xz / max(y, 0.06) * 0.8, 1.0))) * smoothstep(0.0, 0.15, y) * uDay;
        c = mix(c, mix(vec3(0.8, 0.82, 0.86), vec3(1.0, 0.8, 0.6), uWarm) * (0.6 + 0.5 * sd), cl * 0.5);
        vec3 bn = normalize(vec3(0.3, 0.55, -0.78)); float band = exp(-pow(dot(d, bn), 2.0) * 22.0);
        float mw = band * (0.35 + fbm(d * 6.0)) * smoothstep(0.35, 0.75, fbm(d * 3.0 + 5.0) + 0.25);
        c += vec3(0.10, 0.095, 0.115) * mw * uMilky * (1.0 - uDay);
        if (uAur > 0.001) { float az = atan(d.z, d.x); float cx = az * 3.0 + fbm(vec3(az * 2.0, uAT * 0.15, 1.0)) * 3.0;
          float ray = pow(fbm3(vec3(cx * 5.0, 0.0, uAT * 0.4)), 2.2); float base = 0.10 + 0.07 * sin(az * 2.0 + uAT * 0.25) + 0.04 * fbm(vec3(az * 6.0, uAT * 0.3, 2.0)); float hh = y - base;
          float cur = smoothstep(0.0, 0.025, hh) * exp(-max(hh, 0.0) * 6.0) * ray * smoothstep(0.35, 0.65, fbm(vec3(az * 1.3, 3.0, uAT * 0.08)));
          c += mix(vec3(0.08, 0.95, 0.42), vec3(0.55, 0.2, 0.85), smoothstep(0.04, 0.3, hh)) * cur * uAur * 0.55; }
        c = mix(c, vec3(0.11, 0.10, 0.13) * mw * uMilky + vec3(0.008, 0.005, 0.016) * fbm(d * 2.5), uSpace);
        gl_FragColor = vec4(max(c, 0.0), 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), skyMat); sky.renderOrder = -10; scene.add(sky);
  const starGrp = new THREE.Group(); scene.add(starGrp);
  const mkStars = (n, size, seed, R) => {
    const g = new THREE.BufferGeometry(), pos = [], col = [];
    for (let i = 0; i < n; i++) {
      const u = rand(i * 3.1 + seed) * 2 - 1, a = rand(i * 7.3 + seed + 1) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.push(Math.cos(a) * s * R, u * R, Math.sin(a) * s * R);
      const k = 0.35 + 0.65 * Math.pow(rand(i + seed * 3), 3), tint = rand(i * 1.7 + seed);
      const c = new THREE.Color().setRGB(tint < 0.3 ? 1 : 0.8, 0.85, tint > 0.75 ? 1 : 0.85).multiplyScalar(k); col.push(c.r, c.g, c.b);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
    const pts = new THREE.Points(g, m); pts.renderOrder = -9; starGrp.add(pts); return pts;
  };
  const starsS = mkStars(5000, 1.3, 1, 950), starsB = mkStars(500, 2.4, 9, 950);
  const setStars = k => { starsS.material.opacity = clamp(k); starsB.material.opacity = clamp(k); starGrp.visible = k > 0.01; };
  const followSky = () => { sky.position.copy(cam.position); starGrp.position.copy(cam.position); };
  const setSky = (o) => { const u = skyMat.uniforms; u.uAur.value = o.aur ?? 0; u.uDay.value = o.day ?? 0; u.uSpace.value = o.space ?? 0; u.uMilky.value = o.milky ?? 0.5; u.uWarm.value = o.warm ?? 0;
    u.uSun.value.copy(o.sun ?? ENV.uL.value); if (o.haze) u.uHaze.value.setRGB(...o.haze); };

  // ======================= textures canvas =======================
  const canvasTex = (w, h, draw, rep = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t; };
  const woodTex = canvasTex(1024, 1024, (g, w, h) => { for (let i = 0; i < 8; i++) { const y = i * h / 8; g.fillStyle = ['#4a3020', '#55372a', '#43291b', '#5a3b26'][i % 4]; g.fillRect(0, y, w, h / 8);
      for (let k = 0; k < 160; k++) { g.globalAlpha = 0.12; g.fillStyle = rand(i * 100 + k) > 0.5 ? '#2a170c' : '#7a5236'; g.fillRect(0, y + rand(i * 50 + k * 3) * h / 8, w, 1 + rand(k) * 2); }
      g.globalAlpha = 1; g.fillStyle = '#1a0f08'; g.fillRect(0, y, w, 3); g.fillRect(rand(i * 7) * w, y, 3, h / 8); } }, 3);

  // ======================= bruit JS =======================
  const n2 = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const h = (a, b) => rand(a * 57.3 + b * 131.7 + 7.1); return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v); };
  const f2 = (x, z) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * n2(x, z); x = x * 2.02 + 3.1; z = z * 2.02 + 1.7; a *= 0.5; } return s / 0.97; };
  const ridge = (x, z) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * (1 - Math.abs(2 * n2(x, z) - 1)); x = x * 2.03 + 5.1; z = z * 2.03 + 2.7; a *= 0.5; } return s / 0.97; };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler();
  const heightGeo = (w, d, nx, nz, cx, cz, fn) => { const g = new THREE.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, fn(p.getX(i), p.getZ(i))); g.computeVertexNormals(); return g; };

  // ======================= matériaux « glace », « neige », « roche », « eau » =======================
  // glace massive (falaise, icebergs, blocs) : strates bleues, neige sur le dessus, diffusion sous-surface, partie mouillée
  const iceMat = (sc = 1, bump = 0.6) => new THREE.ShaderMaterial({ uniforms: { ...ENV, uSc: { value: sc }, uBump: { value: bump }, uWL: { value: 0 }, uTop: { value: 1e9 } }, vertexShader: VS, side: THREE.DoubleSide,
    fragmentShader: NOISE + ENVG + `uniform float uSc; uniform float uBump; uniform float uWL; uniform float uTop;
      void main(){ vec3 N = normalize(vN); vec3 w = vW * uSc; vec3 V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
        float strata = fbm(vec3(w.x * 0.03, w.y * 0.5, w.z * 0.03)); float det = fbm(w * 0.35); float fine = noise(w * 2.5);
        float streak = fbm(vec3(w.x * 0.6, w.y * 0.05, w.z * 0.6));
        vec3 snow = vec3(0.80, 0.85, 0.91) * (0.92 + 0.1 * det);
        vec3 blue = mix(vec3(0.24, 0.38, 0.47), vec3(0.62, 0.71, 0.78), smoothstep(0.15, 0.85, strata)) * (0.75 + 0.35 * det) * (0.78 + 0.4 * streak);
        blue = mix(blue, vec3(0.70, 0.74, 0.78), smoothstep(0.6, 0.75, strata) * 0.35);
        float top = smoothstep(0.55, 0.85, N.y) + smoothstep(uTop - 1.5, uTop, vW.y) * 0.7;
        vec3 col = mix(blue, snow, clamp(top, 0.0, 1.0));
        vec3 Nb = bumpN(vW, N, det * 0.7 + streak * 1.4 + fine * 0.08, uBump);
        float ndl = max(dot(Nb, uL), 0.0); float wrap = clamp((dot(Nb, uL) + 0.5) / 1.5, 0.0, 1.0);
        vec3 c = col * (uAmb * 1.1 + uLC * ndl * 0.85) + vec3(0.03, 0.12, 0.18) * wrap * 0.35 * (1.0 - clamp(top, 0.0, 1.0));
        vec3 H = normalize(uL + V); float wet = 1.0 - smoothstep(0.0, 2.5, vW.y - uWL);
        c += uLC * pow(max(dot(Nb, H), 0.0), mix(40.0, 160.0, wet)) * mix(0.12, 0.6, wet);
        c *= mix(1.0, 0.55, wet);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  // surface de neige (plateau) : sastrugi, ombres bleutées, mares de fonte ; découpe (falaise ou bloc en coupe)
  const snowMat = (sc = 1) => new THREE.ShaderMaterial({ uniforms: { ...ENV, uSc: { value: sc }, uMelt: { value: 0 }, uCut: { value: 0 }, uCX: { value: 30 }, uCZ: { value: 30 }, uH: { value: 0 } },
    vertexShader: `uniform float uH; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); w.y += uH; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG + `uniform float uSc; uniform float uMelt; uniform float uCut; uniform float uCX; uniform float uCZ;
      float edgeZ(float x){ return 4.0 * sin(x * 0.031) + 2.5 * sin(x * 0.087 + 1.3) + 1.2 * sin(x * 0.21 + 0.4); }
      void main(){ if (uCut > 0.5 && uCut < 1.5 && vW.z > edgeZ(vW.x)) discard; if (uCut > 1.5 && (vW.x > uCX || vW.z > uCZ)) discard;
        vec3 w = vW * uSc; vec3 N = normalize(vN);
        float big = fbm(vec3(w.xz * 0.004, 1.0)); float det = fbm(vec3(w.xz * 0.06, 2.0)); float fine = noise(vec3(w.xz * 0.9, 3.0));
        vec2 wd = normalize(vec2(0.8, 0.35)); float sas = sin(dot(w.xz, wd) * 0.35 + fbm(vec3(w.xz * 0.02, 5.0)) * 9.0); sas = smoothstep(-0.2, 1.0, sas);
        float hgt = sas * 0.12 * smoothstep(0.35, 0.7, fbm(vec3(w.xz * 0.008, 9.0))) + det * 0.9 + fine * 0.06 + big * 2.0;
        vec3 Nb = bumpN(vW, N, hgt, 0.4);
        vec3 col = vec3(0.84, 0.88, 0.93) * (0.9 + 0.12 * det);
        float ndl = dot(Nb, uL); float lit = clamp(ndl, 0.0, 1.0);
        vec3 c = col * (uAmb * 1.15 + uLC * lit * 0.85);
        c = mix(c, c * vec3(0.84, 0.9, 1.0), (1.0 - lit) * 0.35);
        vec3 V = normalize(cameraPosition - vW); vec3 H = normalize(uL + V);
        c += uLC * pow(max(dot(Nb, H), 0.0), 220.0) * step(0.985, fine) * 1.5;
        float pond = smoothstep(0.66 - uMelt * 0.22, 0.68 - uMelt * 0.22, fbm(vec3(w.xz * 0.012, 7.0)) + det * 0.05) * step(0.001, uMelt);
        vec3 pc = mix(vec3(0.02, 0.22, 0.34), vec3(0.08, 0.42, 0.55), det); float fr = 0.03 + 0.97 * pow(1.0 - max(V.y, 0.0), 5.0);
        pc = mix(pc, uFog * 1.1, fr * 0.7) + uLC * pow(max(dot(reflect(-V, vec3(0, 1, 0)), uL), 0.0), 300.0) * 2.0;
        c = mix(c, pc, pond);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  // roche : strates, éboulis, neige au-dessus d'une altitude ; glacier de vallée (MTN)
  const rockMat = (sc = 1) => new THREE.ShaderMaterial({ uniforms: { ...ENV, uSc: { value: sc }, uSnowH: { value: 1e9 }, uWet: { value: 0 }, uDark: { value: 1 } }, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform float uSc; uniform float uSnowH; uniform float uWet; uniform float uDark;
      void main(){ vec3 w = vW * uSc; vec3 N = normalize(vN);
        float big = fbm(w * 0.01); float det = fbm(w * 0.12); float fine = noise(w * 0.9); float str = fbm(vec3(w.x * 0.02, w.y * 0.35, w.z * 0.02));
        vec3 rock = mix(vec3(0.075, 0.075, 0.075), vec3(0.25, 0.235, 0.215), big) * (0.62 + 0.6 * det);
        rock = mix(rock, rock * vec3(1.15, 0.98, 0.82), smoothstep(0.45, 0.7, str) * 0.6);
        float slope = 1.0 - N.y;
        vec3 scree = vec3(0.19, 0.19, 0.2) * (0.7 + 0.5 * fine);
        vec3 col = mix(scree, rock, smoothstep(0.15, 0.35, slope));
        float snow = smoothstep(uSnowH - 4.0, uSnowH + 4.0, vW.y + (det - 0.5) * 18.0) * smoothstep(0.62, 0.32, slope + (fine - 0.5) * 0.2);
        col = mix(col, vec3(0.82, 0.86, 0.92) * (0.9 + 0.1 * det), snow);
        col = mix(col, col * 0.55, uWet);
        vec3 Nb = bumpN(vW, N, det * 1.5 + fine * 0.25 + str * 0.6, 0.7);
        float ndl = max(dot(Nb, uL), 0.0);
        vec3 c = col * (uAmb * 0.9 + uLC * ndl);
        vec3 V = normalize(cameraPosition - vW); c += uLC * pow(max(dot(Nb, normalize(uL + V)), 0.0), 60.0) * 0.15 * (uWet + snow * 0.3);
        c *= uDark;
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  // océan : vagues multi-échelles, Fresnel, reflet du soleil, turbidité
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { ...ENV, uTop: { value: new THREE.Color(0.10, 0.22, 0.42) }, uHor: { value: new THREE.Color(0.55, 0.62, 0.70) }, uDeep: { value: new THREE.Color(0.004, 0.022, 0.032) },
      uSharp: { value: 300 }, uGlit: { value: 1 }, uMurk: { value: 0 }, uScale: { value: 1 } },
    vertexShader: VS, transparent: true, depthWrite: true,
    fragmentShader: NOISE + ENVG + `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uDeep; uniform float uSharp; uniform float uGlit; uniform float uMurk; uniform float uScale;
      void main(){ vec2 p = vW.xz * uScale; float t = uT; float dd = length(cameraPosition - vW); float att = 1.0 / (1.0 + dd * 0.006 * uScale);
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.22 + t * 1.1) * 0.10;
        g += vec2(-0.3, 0.95) * cos(dot(p, vec2(-0.3, 0.95)) * 0.41 + t * 1.5) * 0.07;
        g += vec2(0.95, -0.2) * cos(dot(p, vec2(0.95, -0.2)) * 0.9 + t * 2.2) * 0.05;
        g += vec2(0.2, 0.98) * cos(dot(p, vec2(0.2, 0.98)) * 1.9 + t * 3.0) * 0.035;
        float n1 = noise(vec3(p * 1.3, t * 0.5)), n2 = noise(vec3(p * 1.3 + 3.3, t * 0.5));
        g += (vec2(n1, n2) - 0.5) * 0.16; g *= att * 1.5;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW); vec3 R = reflect(-V, N); R.y = abs(R.y);
        float fr = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 skyc = mix(uHor, uTop, smoothstep(0.0, 0.45, R.y));
        float sp = pow(max(dot(R, uL), 0.0), uSharp);
        vec3 deep = mix(uDeep, vec3(0.03, 0.07, 0.06), uMurk);
        vec3 c = mix(deep + uLC * 0.015 * max(uL.y, 0.0), skyc, fr) + uLC * sp * 3.5 * uGlit;
        float foam = smoothstep(0.78, 0.92, noise(vec3(p * 0.35, t * 0.3)) * fbm3(vec3(p * 2.0, t))) * 0.12;
        c += vec3(0.8) * foam * (0.4 + 0.6 * max(uL.y, 0.1));
        gl_FragColor = vec4(fogit(c), mix(0.97, 0.9, uMurk)); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2), waterMat); scene.add(water);

  // ======================= TERRE (vue de l'espace) =======================
  const R = 10;
  const SUN_DIR = V3(1, 0.15, 0.55).normalize();
  const GDIR = V3(-0.42, 0.82, 0.4).normalize();
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uSea: { value: 0 }, uIceN: { value: 1 }, uIceS: { value: 1 }, uG: { value: GDIR.clone() }, uCity: { value: 1 } },
    vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uSea; uniform float uIceN; uniform float uIceS; uniform vec3 uG; uniform float uCity; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP);
        float h = fbm(p * 2.1 + vec3(3.1, 1.7, 0.4) + (fbm(p * 4.0 + 2.0) - 0.5) * 0.9); float det = fbm(p * 11.0); float lat = abs(p.y);
        float ant = smoothstep(-0.70, -0.80, p.y + (det - 0.5) * 0.12); h = mix(h, max(h, 0.6), ant);
        float gd = dot(p, normalize(uG)) + (det - 0.5) * 0.06; float gre = smoothstep(0.905, 0.925, gd + (fbm(p * 6.0) - 0.5) * 0.05); h = mix(h, max(h, 0.6), gre);
        h = mix(h, min(h, 0.45), smoothstep(0.80, 0.86, p.y) * (1.0 - gre));
        float land = smoothstep(0.525 + uSea, 0.545 + uSea, h + det * 0.03);
        float shallow = smoothstep(0.38, 0.53 + uSea, h);
        vec3 ocean = mix(vec3(0.003, 0.014, 0.045), vec3(0.008, 0.05, 0.10), shallow);
        ocean = mix(ocean, vec3(0.02, 0.11, 0.15), smoothstep(0.50, 0.53 + uSea, h) * (1.0 - land) * step(0.001, uSea) * 0.8);
        vec3 green = mix(vec3(0.03, 0.08, 0.02), vec3(0.07, 0.11, 0.035), det);
        vec3 desert = mix(vec3(0.36, 0.25, 0.13), vec3(0.50, 0.38, 0.22), det);
        float dry = smoothstep(0.48, 0.66, fbm(p * 2.6 + 7.0)) * (1.0 - smoothstep(0.35, 0.6, lat));
        vec3 lc = mix(green, desert, dry); lc = mix(lc, vec3(0.16, 0.14, 0.11), smoothstep(0.62, 0.74, h + det * 0.1));
        vec3 bare = mix(vec3(0.10, 0.09, 0.08), vec3(0.22, 0.19, 0.16), det);
        lc = mix(lc, bare, max(ant, gre));
        float iceA = ant * smoothstep(mix(1.2, 0.76, uIceS), mix(1.2, 0.76, uIceS) + 0.03, -p.y + (det - 0.5) * 0.1);
        float iceG = gre * smoothstep(mix(1.05, 0.915, uIceN), mix(1.05, 0.915, uIceN) + 0.01, gd);
        float seaIce = (1.0 - land) * smoothstep(mix(1.2, 0.93, uIceN), mix(1.2, 0.93, uIceN) + 0.02, p.y + (det - 0.5) * 0.08 + (fbm(p * 5.0) - 0.5) * 0.06);
        float ice = max(max(iceA, iceG), seaIce);
        vec3 col = mix(ocean, lc, land); col = mix(col, vec3(0.80, 0.84, 0.90) * (0.92 + 0.1 * det), ice);
        vec3 N = normalize(vN); vec3 Nb = bumpN(vW, N, land * (h + det * 0.4) * (1.0 - ice * 0.7), 0.35);
        vec3 L = normalize(uSun); vec3 V = normalize(cameraPosition - vW);
        float ndl = dot(Nb, L), ndl0 = dot(N, L);
        float diff = clamp(ndl, 0.0, 1.0) * smoothstep(-0.08, 0.12, ndl0);
        vec3 c = col * diff * 2.2;
        float spec = pow(max(dot(N, normalize(L + V)), 0.0), 260.0) * (1.0 - land) * (1.0 - ice) + pow(max(dot(N, normalize(L + V)), 0.0), 30.0) * (1.0 - land) * 0.04;
        c += vec3(1.0, 0.92, 0.8) * spec * 0.45 * smoothstep(0.0, 0.2, ndl0);
        float term = smoothstep(-0.1, 0.05, ndl0) * (1.0 - smoothstep(0.05, 0.3, ndl0)); c += vec3(0.20, 0.07, 0.02) * term * 0.08;
        float night = 1.0 - smoothstep(-0.12, 0.04, ndl0);
        float city = step(0.7, noise(p * 90.0)) * smoothstep(0.45, 0.7, fbm(p * 8.0 + 2.0)) * land * (1.0 - ice) * (1.0 - dry * 0.7) * (1.0 - max(ant, gre));
        c += vec3(1.0, 0.62, 0.25) * city * night * 0.9 * uCity;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0); c += vec3(0.25, 0.5, 1.0) * fr * smoothstep(-0.2, 0.4, ndl0) * 0.9;
        gl_FragColor = vec4(c, 1.0); }` });
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uT: { value: 0 } }, vertexShader: VS, transparent: true, depthWrite: false,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP); vec3 q = p * 3.2 + vec3(uT * 0.01, 0.0, 0.0);
        float w = fbm(q + fbm(q * 1.5) * 1.4); float a = smoothstep(0.52, 0.76, w) * (0.75 + 0.25 * fbm(p * 20.0));
        a *= 1.0 - smoothstep(0.7, 0.9, abs(p.y)) * 0.85;
        float ndl = dot(normalize(vN), normalize(uSun)); float diff = smoothstep(-0.1, 0.5, ndl);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (0.02 + 2.0 * diff * clamp(ndl + 0.15, 0.0, 1.0)), a * 0.85); }` });
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() } }, vertexShader: VS, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 uSun; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = -normalize(vN);
        float rim = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 1.6); float lit = smoothstep(-0.35, 0.5, dot(-N, normalize(uSun)));
        float a = smoothstep(0.0, 0.35, abs(dot(N, V)));
        gl_FragColor = vec4(mix(vec3(0.5, 0.35, 0.3), vec3(0.25, 0.5, 1.0), smoothstep(-0.25, 0.2, dot(-N, normalize(uSun)))) * a * lit * 1.1 * (1.0 - rim * 0.3), 1.0); }` });
  const EARTH = new THREE.Group(); scene.add(EARTH);
  const spin = new THREE.Group(); EARTH.add(spin);
  const earthS = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), earthMat); spin.add(earthS);
  const cloudS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 128, 64), cloudMat); spin.add(cloudS);
  const atmoS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 96, 48), atmoMat); EARTH.add(atmoS);
  const earthLook = (o = {}) => { lightsOff(); scene.fog = null; setSky({ space: 1, milky: 0.7 }); setStars(1); followSky(); E.renderer.toneMappingExposure = 0.95;
    const s = (o.sun ?? SUN_DIR); [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(s));
    earthMat.uniforms.uSea.value = o.sea ?? 0; earthMat.uniforms.uIceN.value = o.iceN ?? 1; earthMat.uniforms.uIceS.value = o.iceS ?? 1; cloudS.visible = o.clouds ?? true; };
  // la caméra regarde la Terre depuis une direction (latitude, longitude en degrés, dans le repère de la Terre qui tourne)
  const DEG = Math.PI / 180;
  const fitD = (r, fov, frac = 0.62) => 0.8 * r / frac / Math.tan(Math.atan(Math.tan(fov * DEG / 2) * 1080 / 1920));
  const latlon = (la, lo) => V3(Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG), Math.cos(la * DEG) * Math.cos(lo * DEG));
  const camDir = (dir, dist, look = V3(0, 0, 0), fov = 42, roll = 0) => { cam.position.copy(look).add(dir.clone().normalize().multiplyScalar(dist)); cam.fov = fov; cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(look); cam.rotation.z += roll; };
  // lon de Groenland dans le repère de la sphère
  const G_LON = Math.atan2(GDIR.x, GDIR.z) / DEG, G_LAT = Math.asin(GDIR.y) / DEG;

  // ======================= ICE : falaise de banquise, océan, icebergs (1 u = 1 m) =======================
  const ICE = new THREE.Group(); scene.add(ICE);
  const edgeZ = x => 4 * Math.sin(x * 0.031) + 2.5 * Math.sin(x * 0.087 + 1.3) + 1.2 * Math.sin(x * 0.21 + 0.4);
  const shelfTop = (x, z) => 34 + 3 * (f2(x / 90 + 2, z / 90) - 0.5) + 0.8 * (f2(x / 20, z / 20) - 0.5);
  const shelfSnow = snowMat(1); shelfSnow.uniforms.uCut.value = 1;
  const shelf = new THREE.Mesh(heightGeo(1800, 1400, 180, 140, 0, -692, shelfTop), shelfSnow); ICE.add(shelf);
  const cliffGeo = (() => { const NX = 1400, NY = 30, pos = [], idx = [];
    for (let i = 0; i <= NX; i++) { const x = -700 + i; const z0 = edgeZ(x); const top = shelfTop(x, z0);
      for (let j = 0; j <= NY; j++) { const v = j / NY; const y = lerp(-10, top, v);
        const d = 1.6 * (f2(x / 7, y / 11) - 0.5) + 0.9 * (f2(x / 1.8 + 9, y / 4) - 0.5) + 2.2 * (f2(x / 40, 3) - 0.5) - (v > 0.97 ? 0.6 : 0);
        pos.push(x, y, z0 + d); } }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { const a = i * (NY + 1) + j, b = a + NY + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const cliffMat = iceMat(1, 0.8); cliffMat.uniforms.uTop.value = 33.5;
  const cliff = new THREE.Mesh(cliffGeo, cliffMat); ICE.add(cliff);
  // icebergs tabulaires
  const bergMat = iceMat(1, 0.7);
  const mkBerg = (w, h, d, seed) => { const g = new THREE.BoxGeometry(w, h, d, 24, 10, 24); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const side = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
      const k = 1 + 0.18 * (f2(x / 9 + seed, z / 9 + y / 7) - 0.5) - 0.12 * (y < 0 ? -y / h : 0);
      x *= k; z *= k; if (y > h * 0.45) y += 1.2 * (f2(x / 12 + seed, z / 12) - 0.5) - (side > 0.95 ? 0.8 : 0); p.setXYZ(i, x, y, z); }
    g.computeVertexNormals(); return new THREE.Mesh(g, bergMat); };
  const BERGS = [[-360, 380, 70, 26, 50, 0.3], [140, 330, 110, 30, 70, 1.2], [-330, 520, 140, 34, 90, 2.1], [380, 640, 90, 24, 60, 0.7], [20, 820, 180, 30, 110, 2.6], [-230, 170, 18, 9, 14, 0.9], [190, 210, 10, 6, 9, 1.7], [-520, 300, 60, 22, 40, 0.2]];
  BERGS.forEach(([x, z, w, h, d, a], i) => { const m = mkBerg(w, h * 1.6, d, i * 3.1); m.position.set(x, h * 0.3, z); m.rotation.y = a; ICE.add(m); });
  // bloc qui se détache (vêlage)
  const chunk = (() => { const g = new THREE.BoxGeometry(46, 44, 4, 30, 26, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + 0.6 * (f2(y / 6, z / 6) - 0.5), y + (y > 21 ? 1.0 * (f2(x / 10, z / 10) - 0.5) : 0), z + 1.4 * (f2(x / 6, y / 9) - 0.5)); }
    g.translate(0, 12, -2); g.computeVertexNormals(); const m = new THREE.Mesh(g, cliffMat); m.visible = false; ICE.add(m); return m; })();
  const fallMat = new THREE.ShaderMaterial({ uniforms: { ...ENV }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vU; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vU = uv; vec3 p = position; p.x *= mix(1.9, 0.75, uv.y); p.z += (1.0 - uv.y) * (1.0 - uv.y) * 3.5; vP = p; vN = vec3(0.0, 0.0, 1.0); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG + `varying vec2 vU;
      void main(){ float x = vU.x * 2.0 - 1.0; float st = fbm(vec3(vU.x * 7.0, vU.y * 1.5 + uT * 1.4, 1.0)); float st2 = noise(vec3(vU.x * 28.0, vU.y * 5.0 + uT * 3.2, 2.0));
        float a = smoothstep(1.0, 0.25, abs(x)) * (0.25 + 0.75 * smoothstep(0.35, 0.72, st)) * (0.55 + 0.45 * st2);
        a *= smoothstep(0.0, 0.1, vU.y) * (1.0 - smoothstep(0.96, 1.0, vU.y));
        vec3 col = vec3(0.80, 0.86, 0.9) * (uAmb * 1.3 + uLC * 0.55) * (0.85 + 0.3 * st2);
        gl_FragColor = vec4(fogit(col), min(1.0, a * 1.3)); }` });
  const FALLS = new THREE.Group(); ICE.add(FALLS);
  for (let f = 0; f < 7; f++) { const x = -48 + f * 14 + rand(f * 3.3) * 6; const z0 = edgeZ(x); const top = shelfTop(x, z0);
    const g = new THREE.PlaneGeometry(4 + rand(f) * 4, top + 1, 1, 40); g.translate(0, (top + 1) / 2 - 0.5, 0); const m = new THREE.Mesh(g, fallMat); m.position.set(x, 0, z0 + 1.2); m.userData.x = x; m.userData.z = z0; FALLS.add(m); }
  const iceLook = (mode) => { FALLS.visible = false; // 'gold' (lumière dorée de face), 'back' (contre-jour couchant), 'day', 'grey'
    E.renderer.toneMappingExposure = 0.9; setStars(0); water.position.y = 0; waterMat.uniforms.uScale.value = 1; waterMat.uniforms.uMurk.value = 0;
    cliffMat.uniforms.uWL.value = 0; bergMat.uniforms.uWL.value = 0; waterMat.uniforms.uGlit.value = 1; waterMat.uniforms.uSharp.value = 300;
    if (mode === 'gold') { setEnv({ L: V3(0.55, 0.2, 0.8), LC: [1.45, 1.05, 0.72], amb: [0.24, 0.31, 0.42], fog: [0.62, 0.62, 0.66], fogD: [250, 1400] }); setSky({ day: 1, warm: 0.6, haze: [0.78, 0.72, 0.70] });
      waterMat.uniforms.uTop.value.setRGB(0.10, 0.2, 0.38); waterMat.uniforms.uHor.value.setRGB(0.55, 0.55, 0.6); }
    else if (mode === 'back') { setEnv({ L: V3(-0.55, 0.1, -0.83), LC: [1.6, 0.9, 0.5], amb: [0.22, 0.26, 0.38], fog: [0.62, 0.5, 0.46], fogD: [250, 1300] }); setSky({ day: 0.9, warm: 1.1, haze: [0.82, 0.62, 0.5] });
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.16, 0.3); waterMat.uniforms.uHor.value.setRGB(0.72, 0.5, 0.4); waterMat.uniforms.uSharp.value = 120; }
    else { setEnv({ L: V3(0.4, 0.55, 0.6), LC: [1.25, 1.18, 1.08], amb: [0.32, 0.38, 0.48], fog: [0.7, 0.75, 0.82], fogD: [300, 1500] }); setSky({ day: 1, warm: 0.05, haze: [0.75, 0.8, 0.86] });
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.26, 0.48); waterMat.uniforms.uHor.value.setRGB(0.62, 0.7, 0.78); }
    shelfSnow.uniforms.uMelt.value = 0; chunk.visible = false; followSky(); };

  // ======================= BLOCK : calotte antarctique en coupe (1 u ≈ 250 m) =======================
  const BLOCK = new THREE.Group(); scene.add(BLOCK);
  const CX = 30, CZ = 30, ICE_H = 20, BASE = -70;
  const bedH = (x, z) => { const r = Math.pow(ridge(x / 26 + 5, z / 26 + 3), 1.9); return 0.5 + 15.5 * r + 2.2 * (f2(x / 6, z / 6) - 0.5) + 2 * (f2(x / 60, z / 60) - 0.5); };
  const bedMat = rockMat(14); bedMat.uniforms.uSnowH.value = 14;
  const bed = new THREE.Mesh(heightGeo(240, 240, 360, 360, CX - 120, CZ - 120, bedH), bedMat); BLOCK.add(bed);
  const iceTopMat = snowMat(9); iceTopMat.uniforms.uCut.value = 2; iceTopMat.uniforms.uCX.value = CX; iceTopMat.uniforms.uCZ.value = CZ;
  const iceTop = new THREE.Mesh(heightGeo(2400, 2400, 240, 240, 0, 0, (x, z) => 0.5 * (f2(x / 40, z / 40) - 0.5) + 0.25 * (f2(x / 9, z / 9) - 0.5)), iceTopMat); BLOCK.add(iceTop);
  // faces de la coupe (roche + glace), la hauteur de la glace suit uIce
  const faceUni = { ...ENV, uIce: { value: ICE_H } };
  const mkFace = (axis) => { const N = 900, pos = [], top = [], bedA = [], idx = [];
    for (let i = 0; i <= N; i++) { const s = (CX - 240) + i * 240 / N; const x = axis === 'x' ? CX : s, z = axis === 'x' ? s : CZ; const b = bedH(x, z);
      for (let j = 0; j < 4; j++) { pos.push(x, b, z); top.push(j); bedA.push(b); } }
    for (let i = 0; i < N; i++) { const a = i * 4, c = a + 4; idx.push(a, c, a + 1, a + 1, c, c + 1, a + 2, c + 2, a + 3, a + 3, c + 2, c + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); g.setAttribute('aBed', new THREE.Float32BufferAttribute(bedA, 1)); g.setIndex(idx);
    const nrm = axis === 'x' ? V3(1, 0, 0) : V3(0, 0, 1);
    return new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...faceUni, uNrm: { value: nrm } }, side: THREE.DoubleSide,
      vertexShader: `attribute float aTop; attribute float aBed; uniform float uIce; uniform vec3 uNrm; varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vKind;
        void main(){ vec3 p = position; float y;
          if (aTop < 0.5) { y = ${BASE.toFixed(1)}; vKind = 0.0; } else if (aTop < 1.5) { y = aBed; vKind = 0.0; } else if (aTop < 2.5) { y = aBed; vKind = 1.0; } else { y = max(aBed, uIce); vKind = 1.0; }
          p.y = y; vP = p; vN = uNrm; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: NOISE + ENVG + `uniform float uIce; varying float vKind;
        void main(){ vec3 N = normalize(vN); vec3 w = vW * 9.0; float det = fbm(w * 0.08); float fine = noise(w * 0.6);
          vec3 c;
          if (vKind > 0.5) { float depth = uIce - vW.y; float str = fbm(vec3(w.x * 0.02 + w.z * 0.02, vW.y * 2.2, 1.0));
            vec3 ice = mix(vec3(0.66, 0.72, 0.78), vec3(0.13, 0.25, 0.36), smoothstep(0.0, 18.0, depth)) * (0.8 + 0.35 * str) * (0.92 + 0.12 * det);
            ice = mix(ice, ice * vec3(0.8, 0.88, 1.0), smoothstep(0.55, 0.65, str) * 0.5);
            vec3 Nb = bumpN(vW, N, det * 0.6 + str * 0.4, 0.4); float ndl = max(dot(Nb, uL), 0.0);
            c = ice * (uAmb * 1.1 + uLC * ndl * 0.6) + vec3(0.02, 0.08, 0.13) * 0.4;
            c += uLC * pow(max(dot(Nb, normalize(uL + normalize(cameraPosition - vW))), 0.0), 90.0) * 0.12; }
          else { float str = fbm(vec3(w.x * 0.01, vW.y * 0.9, w.z * 0.01));
            vec3 rock = mix(vec3(0.07, 0.065, 0.06), vec3(0.26, 0.23, 0.2), str) * (0.65 + 0.5 * det) * (0.9 + 0.2 * fine);
            vec3 Nb = bumpN(vW, N, det * 0.8 + str, 0.5); float ndl = max(dot(Nb, uL), 0.0);
            c = rock * (uAmb + uLC * ndl * 0.8); c *= 0.15 + 0.85 * smoothstep(-30.0, 2.0, vW.y); }
          gl_FragColor = vec4(fogit(c), 1.0); }` })); };
  const faceX = mkFace('x'), faceZ = mkFace('z'); BLOCK.add(faceX, faceZ);
  // « mont Blanc » de comparaison, posé à côté de la coupe (même hauteur que la glace la plus épaisse)
  const MB = new THREE.Group(); BLOCK.add(MB); MB.position.set(CX + 13, 0, CZ - 44);
  const mbH = (x, z) => { const r = Math.hypot(x, z); const k = Math.exp(-r * r / (2 * 6.5 * 6.5)); return r > 11 ? -4 * smooth(11, 14, r) : ICE_H * k * (0.82 + 0.3 * ridge(x / 5 + 2, z / 5)) + 0.4 * (f2(x / 2, z / 2) - 0.5); };
  const mbMat = rockMat(14); mbMat.uniforms.uSnowH.value = 14;
  const mb = new THREE.Mesh(heightGeo(30, 30, 200, 200, 0, 0, mbH), mbMat); MB.add(mb);
  // avion radar
  const PLANE = new THREE.Group(); BLOCK.add(PLANE);
  { const body = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }); const red = new THREE.MeshStandardMaterial({ color: 0xb8361f, roughness: 0.5 });
    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.9, 6, 16).rotateZ(Math.PI / 2), body); PLANE.add(fus);
    const wing = new THREE.Mesh(new E.RoundedBoxGeometry(0.28, 0.025, 1.5, 2, 0.01), body); wing.position.set(0.05, 0.02, 0); PLANE.add(wing);
    const tail = new THREE.Mesh(new E.RoundedBoxGeometry(0.16, 0.02, 0.5, 2, 0.008), body); tail.position.set(-0.52, 0.03, 0); PLANE.add(tail);
    const fin = new THREE.Mesh(new E.RoundedBoxGeometry(0.16, 0.24, 0.02, 2, 0.008), red); fin.position.set(-0.53, 0.14, 0); PLANE.add(fin);
    [-0.4, 0.4].forEach(z => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12).rotateZ(Math.PI / 2), red); e.position.set(0.14, -0.02, z); PLANE.add(e); }); }
  const blockLook = (mode, ice = ICE_H, cut = true) => { // 'day' | 'gold' | 'night'
    E.renderer.toneMappingExposure = 0.92; setStars(0);
    if (mode === 'gold') { setEnv({ L: V3(0.75, 0.32, 0.45), LC: [1.5, 1.08, 0.75], amb: [0.22, 0.28, 0.4], fog: [0.68, 0.66, 0.68], fogD: [80, 900] }); setSky({ day: 1, warm: 0.55, haze: [0.8, 0.74, 0.72] }); }
    else if (mode === 'night') { setEnv({ L: V3(0.2, 0.5, 0.3), LC: [0.10, 0.12, 0.18], amb: [0.05, 0.07, 0.12], fog: [0.02, 0.03, 0.06], fogD: [200, 1000] }); setSky({ day: 0, milky: 1 }); setStars(1); }
    else { setEnv({ L: V3(0.6, 0.45, 0.5), LC: [1.3, 1.2, 1.08], amb: [0.3, 0.37, 0.48], fog: [0.72, 0.77, 0.84], fogD: [100, 1000] }); setSky({ day: 1, warm: 0.08, haze: [0.76, 0.81, 0.87] }); }
    iceTopMat.uniforms.uH.value = ice; faceUni.uIce.value = ice; iceTopMat.uniforms.uCut.value = cut ? 2 : 0; faceX.visible = faceZ.visible = cut; MB.visible = false; PLANE.visible = false;
    bedMat.uniforms.uWet.value = 0; iceTopMat.uniforms.uMelt.value = 0; followSky(); };

  // ======================= MTN : vallée glaciaire (1 u = 10 m) =======================
  const MTN = new THREE.Group(); scene.add(MTN);
  const vz = x => 25 * Math.sin(x * 0.012);
  const mtnH = (x, z) => { const dz = z - vz(x); const val = 1 - Math.exp(-dz * dz / (2 * 42 * 42)); return 12 - x * 0.12 + val * (40 + 85 * Math.pow(ridge(x / 70 + 1, z / 70 + 4), 1.4)) + 6 * (f2(x / 18, z / 18) - 0.5); };
  const mtnMat = rockMat(10); mtnMat.uniforms.uSnowH.value = 80;
  MTN.add(new THREE.Mesh(heightGeo(1400, 1100, 340, 280, 50, 0, mtnH), mtnMat));
  const glacUni = { uThin: { value: 0 }, uFront: { value: 260 } };
  const glacMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...glacUni }, side: THREE.DoubleSide,
    vertexShader: `attribute float aThick; attribute float aAlong; uniform float uThin; varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vAl;
      void main(){ vec3 p = position; p.y -= aThick * uThin; vP = p; vAl = aAlong; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG + `uniform float uFront; varying float vAl;
      void main(){ if (vW.x > uFront + (noise(vec3(vW.z * 0.15, 0.0, 1.0)) - 0.5) * 14.0) discard;
        vec3 N = normalize(vN); vec3 w = vW * 10.0; float det = fbm(w * 0.01); float crev = smoothstep(0.9, 0.98, abs(sin(vW.x * 0.35 + fbm(w * 0.004) * 9.0 + vW.z * 0.05))) * smoothstep(0.4, 0.6, fbm(w * 0.02));
        float deb = smoothstep(0.55, 0.7, fbm(vec3(vW.z * 0.08, vW.x * 0.01, 3.0))) * 0.6 + smoothstep(uFront - 30.0, uFront, vW.x) * 0.5;
        vec3 col = mix(vec3(0.78, 0.84, 0.9), vec3(0.42, 0.6, 0.72), crev * 0.8) * (0.85 + 0.2 * det);
        col = mix(col, vec3(0.28, 0.26, 0.24) * (0.7 + 0.6 * det), clamp(deb, 0.0, 1.0));
        vec3 Nb = bumpN(vW, N, det * 2.0 + crev * 0.6, 0.6); float ndl = max(dot(Nb, uL), 0.0);
        vec3 c = col * (uAmb * 1.1 + uLC * ndl * 0.85);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  { const NX = 300, NZ = 24, pos = [], th = [], al = [], idx = [];
    for (let i = 0; i <= NX; i++) { const x = -450 + i * 2.4; const zc = vz(x); const wv = 20 + 6 * Math.sin(x * 0.02);
      for (let j = 0; j <= NZ; j++) { const u = j / NZ * 2 - 1; const z = zc + u * wv * 1.25; const thick = 8 * (1 - u * u); pos.push(x, mtnH(x, z) + thick - 1.2, z); th.push(thick); al.push(x); } }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j, b = a + NZ + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aThick', new THREE.Float32BufferAttribute(th, 1)); g.setAttribute('aAlong', new THREE.Float32BufferAttribute(al, 1)); g.setIndex(idx); g.computeVertexNormals();
    MTN.add(new THREE.Mesh(g, glacMat)); }
  const mtnLook = () => { E.renderer.toneMappingExposure = 0.92; setStars(0);
    setEnv({ L: V3(0.35, 0.6, 0.7), LC: [1.35, 1.25, 1.1], amb: [0.28, 0.34, 0.45], fog: [0.68, 0.74, 0.82], fogD: [200, 1300] }); setSky({ day: 1, warm: 0.05, haze: [0.72, 0.78, 0.86] }); followSky(); };

  // ======================= CITY : ville côtière (1 u = 1 m) =======================
  const CITY = new THREE.Group(); scene.add(CITY);
  const COAST_Z = 110;
  const cityH = (x, z) => z < COAST_Z ? 2 + Math.max(0, -z - 150) * 0.055 + 1.5 * (f2(x / 200, z / 200) - 0.5) : 2 - (z - COAST_Z) * 0.09;
  const seaUni = { uSea: { value: 0 }, uNight: { value: 0 } };
  const groundMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...seaUni }, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform float uSea; uniform float uNight;
      void main(){ vec3 N = normalize(vN); vec2 q = vW.xz; vec2 cell = floor((q + vec2(6.0)) / 42.0); vec2 f = mod(q + vec2(6.0), 42.0);
        float street = 1.0 - step(12.0, f.x) * step(12.0, f.y); float walk = (1.0 - step(14.5, f.x) * step(14.5, f.y)) * (1.0 - street) + step(39.5, f.x) + step(39.5, f.y);
        float det = fbm(vec3(q * 0.3, 1.0)); float id = hash(vec3(cell, 4.0));
        vec3 asph = vec3(0.07, 0.072, 0.075) * (0.8 + 0.4 * det); float lane = step(abs(f.x - 6.0), 0.12) * step(0.5, fract(q.y * 0.1)) + step(abs(f.y - 6.0), 0.12) * step(0.5, fract(q.x * 0.1));
        asph += vec3(0.45, 0.42, 0.33) * lane * street;
        vec3 side = vec3(0.32, 0.31, 0.29) * (0.85 + 0.3 * det);
        vec3 lot = id < 0.18 ? mix(vec3(0.06, 0.11, 0.04), vec3(0.12, 0.15, 0.06), det) : vec3(0.2, 0.2, 0.2) * (0.8 + 0.4 * det);
        vec3 col = street > 0.5 ? asph : (walk > 0.5 ? side : lot);
        vec3 sand = vec3(0.62, 0.53, 0.38) * (0.85 + 0.25 * det); float beach = smoothstep(${(COAST_Z - 22).toFixed(1)}, ${(COAST_Z - 18).toFixed(1)}, vW.z);
        col = mix(col, sand, beach); col = mix(col, sand * 0.5, smoothstep(${(COAST_Z + 2).toFixed(1)}, ${(COAST_Z + 6).toFixed(1)}, vW.z));
        float ndl = max(dot(N, uL), 0.0); vec3 c = col * (uAmb + uLC * ndl * 0.9);
        float lamp = (1.0 - street) * walk * step(0.97, hash(vec3(floor(q / 6.0), 2.0))); c += vec3(1.0, 0.7, 0.4) * lamp * uNight * 0.6;
        float d = uSea - vW.y; c = mix(c, vec3(0.015, 0.04, 0.045), smoothstep(0.0, 6.0, d) * 0.92);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  CITY.add(new THREE.Mesh(heightGeo(2600, 2600, 260, 260, 0, -500, cityH), groundMat));
  const bldMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...seaUni, uHero: { value: V3(1e5, 0, 0) } }, side: THREE.FrontSide,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec3 vI; varying vec3 vS;
      void main(){ vP = position; mat4 m = modelMatrix * instanceMatrix; vN = normalize(mat3(m) * normal); vec4 w = m * vec4(position, 1.0); vW = w.xyz; vI = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vS = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz)); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG.replace('varying vec3 vP; varying vec3 vN; varying vec3 vW;', 'varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec3 vI; varying vec3 vS;') + `uniform float uSea; uniform float uNight; uniform vec3 uHero;
      void main(){ vec3 N = normalize(vN); float id = hash(vec3(floor(vI.xz), 1.0)); float id2 = hash(vec3(floor(vI.xz), 7.0));
        vec3 V = normalize(cameraPosition - vW); vec3 c;
        float yb = vW.y - vI.y;
        if (N.y > 0.5) { float det = fbm(vec3(vW.xz * 0.5, 3.0)); vec3 roof = vec3(0.22, 0.215, 0.2) * (0.7 + 0.5 * det);
          vec2 rq = vW.xz - vI.xz; float edge = step(vS.x * 0.5 - 0.6, abs(rq.x)) + step(vS.z * 0.5 - 0.6, abs(rq.y)); roof = mix(roof, vec3(0.3), clamp(edge, 0.0, 1.0));
          float unit = step(0.6, hash(vec3(floor(rq / 3.0), id))) * step(abs(rq.x), vS.x * 0.3) * step(abs(rq.y), vS.z * 0.3); roof = mix(roof, vec3(0.38, 0.38, 0.37), unit * 0.6);
          c = roof * (uAmb + uLC * max(dot(N, uL), 0.0) * 0.9); }
        else { float u = abs(N.x) > 0.5 ? vW.z : vW.x; float fh = 3.2; float style = id; float fw = style > 0.7 ? 1.5 : (style > 0.4 ? 2.4 : 3.6);
          vec2 f = vec2(fract(u / fw), fract(yb / fh)); float floorI = floor(yb / fh); float colI = floor(u / fw);
          float win;
          if (style > 0.7) win = step(0.04, f.x) * step(0.10, f.y);                       // mur-rideau vitré
          else if (style > 0.4) win = step(0.12, f.x) * step(f.x, 0.88) * step(0.28, f.y) * step(f.y, 0.9);   // bandeaux
          else win = step(0.25, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.85);  // immeuble ancien
          win *= step(1.0, floorI) + step(floorI, 0.5) * step(0.12, f.x) * step(f.x, 0.88) * step(f.y, 0.8);   // rez-de-chaussée : vitrines
          vec3 wall = style < 0.2 ? vec3(0.50, 0.45, 0.38) : (style < 0.4 ? vec3(0.40, 0.38, 0.35) : (style < 0.7 ? vec3(0.34, 0.35, 0.36) : vec3(0.18, 0.2, 0.22)));
          wall *= (0.75 + 0.3 * id2) * (0.8 + 0.3 * fbm(vec3(u * 0.15, yb * 0.15, id * 10.0))); wall *= mix(0.7, 1.0, smoothstep(0.0, 4.0, yb));
          wall *= 1.0 - 0.18 * smoothstep(0.85, 1.0, f.y) * step(style, 0.7);
          float fr = 0.06 + 0.9 * pow(1.0 - max(dot(N, V), 0.0), 4.0); vec3 R = reflect(-V, N);
          vec3 skyr = mix(uFog * 0.75, vec3(0.16, 0.25, 0.4), smoothstep(0.0, 0.5, R.y));
          float pane = hash(vec3(colI, floorI, id * 31.0));
          vec3 inside = mix(vec3(0.035, 0.035, 0.04), vec3(0.09, 0.08, 0.07), pane) * (style > 0.7 ? 0.6 : 1.0);
          vec3 glass = mix(inside, skyr * (0.75 + 0.35 * pane), fr * (style > 0.7 ? 1.0 : 0.75) + (style > 0.7 ? 0.25 : 0.0)) + uLC * pow(max(dot(R, uL), 0.0), 300.0) * 1.2;
          glass *= 0.85 + 0.25 * step(0.5, fract(pane * 7.0));
          glass += vec3(1.0, 0.72, 0.42) * step(0.7, pane) * uNight * 0.7;
          float ndl = max(dot(N, uL), 0.0);
          vec3 wc = wall * (uAmb + uLC * ndl * 0.85);
          c = mix(wc, glass, win);
          float hero = step(distance(vI.xz, uHero.xz), 1.0); c = mix(c, c * vec3(1.15, 1.08, 0.95), hero * 0.0); }
        float d = uSea - vW.y; c = mix(c, vec3(0.012, 0.035, 0.04), smoothstep(0.0, 5.0, d) * 0.93);
        float ao = mix(0.55, 1.0, smoothstep(0.0, 8.0, vW.y - vI.y + 0.0)); c *= N.y > 0.5 ? 1.0 : ao;
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  const blds = [];
  for (let bx = -14; bx <= 14; bx++) for (let bz = -22; bz <= 2; bz++) {
    const x0 = bx * 42 + 6, z0 = bz * 42 + 6; if (z0 + 36 > COAST_Z - 20) continue;
    const dC = Math.hypot(bx * 42, bz * 42 + 200); const park = rand(bx * 13.1 + bz * 7.7) < 0.12; if (park) continue;
    const n = 1 + Math.floor(rand(bx * 3.7 + bz * 1.3) * 3.99);
    for (let k = 0; k < n; k++) { const w = n === 1 ? 26 : 12 + rand(k + bx * 5 + bz) * 3, d = n === 1 ? 26 : (n > 2 ? 12 : 26);
      const cx = x0 + 8 + (n === 1 ? 13 : (k % 2) * 14 + 6), cz = z0 + 8 + (n === 1 ? 13 : (n > 2 ? Math.floor(k / 2) * 14 + 6 : 13));
      const tall = Math.exp(-dC * dC / (2 * 380 * 380)); const floors = Math.max(3, Math.round(3 + 34 * tall * Math.pow(rand(bx * 9.1 + bz * 4.3 + k), 1.5) + 4 * rand(k * 7 + bx)));
      blds.push({ x: cx, z: cz, w, d, h: floors * 3.2 + 0.8, y: cityH(cx, cz) }); } }
  const HERO = { x: 6 * 42 + 6 + 21, z: -1 * 42 + 6 + 21 }; // immeuble de 20 étages
  { const b = blds.find(b => Math.hypot(b.x - HERO.x, b.z - HERO.z) < 15); if (b) { b.h = 20 * 3.2 + 0.8; b.w = 22; b.d = 22; b.x = HERO.x; b.z = HERO.z; b.y = cityH(b.x, b.z); } else blds.push({ x: HERO.x, z: HERO.z, w: 22, d: 22, h: 64.8, y: cityH(HERO.x, HERO.z) }); }
  bldMat.uniforms.uHero.value.set(HERO.x, 0, HERO.z);
  const bldI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bldMat, blds.length);
  blds.forEach((b, i) => { M.compose(V3(b.x, b.y - 0.5, b.z), Q.identity(), V3(b.w, b.h, b.d)); bldI.setMatrixAt(i, M); }); CITY.add(bldI);
  // plage : parasols, transats ; ponton et bateaux (flottent avec la mer)
  const UMB = new THREE.Group(); CITY.add(UMB);
  { const cols = [0xc2452d, 0x2f6f9a, 0xe0c060, 0xf0ece0, 0x3c8a5a]; const pole = new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.6 });
    for (let i = 0; i < 46; i++) { const x = -300 + rand(i * 3.3) * 600, z = COAST_Z - 14 + rand(i * 5.1) * 12; const y = cityH(x, z);
      const m = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.55, 12, 1, true), new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.8, side: THREE.DoubleSide })); m.position.set(x, y + 2.3, z); UMB.add(m);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), pole); p.position.set(x, y + 1.15, z); UMB.add(p);
      const towel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 1.8), new THREE.MeshStandardMaterial({ color: cols[(i + 2) % 5], roughness: 0.9 })); towel.position.set(x + 1.2, y + 0.02, z + 0.3); towel.rotation.y = rand(i) * 0.6; UMB.add(towel); } }
  const PIER = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 120), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85, map: woodTex })); PIER.position.set(160, 2.2, COAST_Z + 50); CITY.add(PIER);
  const BOATS = [];
  { const hullGeo = new THREE.LatheGeometry([[0, -0.9], [0.9, -0.7], [1.35, -0.1], [1.45, 0.6], [1.4, 0.75]].map(([x, y]) => new THREE.Vector2(x, y)), 24); hullGeo.scale(1, 1, 3.2);
    const hullCols = [0xe8e6e0, 0x1f3550, 0xb0402a, 0xe8e6e0, 0x2d4a3a];
    for (let i = 0; i < 9; i++) { const b = new THREE.Group(); const hull = new THREE.Mesh(hullGeo, new THREE.MeshPhysicalMaterial({ color: hullCols[i % 5], roughness: 0.35, clearcoat: 0.8 })); b.add(hull);
      const cab = new THREE.Mesh(new E.RoundedBoxGeometry(1.6, 1.0, 2.2, 2, 0.15), new THREE.MeshPhysicalMaterial({ color: 0xf0f0ee, roughness: 0.4, clearcoat: 0.5 })); cab.position.set(0, 1.2, -0.6); b.add(cab);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 })); mast.position.set(0, 4.5, 0.5); if (i % 2) b.add(mast);
      b.position.set(152 + (i % 2) * 16, 0, COAST_Z + 20 + Math.floor(i / 2) * 22); b.rotation.y = (rand(i) - 0.5) * 0.3; CITY.add(b); BOATS.push(b); } }
  const cityLook = (sea, mode = 'day') => { E.renderer.toneMappingExposure = 0.92; setStars(0);
    if (mode === 'dusk') { setEnv({ L: V3(-0.6, 0.14, -0.78), LC: [1.5, 0.9, 0.55], amb: [0.2, 0.24, 0.36], fog: [0.6, 0.5, 0.48], fogD: [300, 1600] }); setSky({ day: 0.85, warm: 1.0, haze: [0.8, 0.6, 0.5] }); seaUni.uNight.value = 0.7;
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.16, 0.3); waterMat.uniforms.uHor.value.setRGB(0.7, 0.52, 0.44); waterMat.uniforms.uSharp.value = 140; }
    else { setEnv({ L: V3(0.5, 0.5, 0.7), LC: [1.35, 1.25, 1.1], amb: [0.3, 0.36, 0.46], fog: [0.7, 0.74, 0.8], fogD: [300, 1700] }); setSky({ day: 1, warm: 0.1, haze: [0.74, 0.79, 0.85] }); seaUni.uNight.value = 0;
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.26, 0.48); waterMat.uniforms.uHor.value.setRGB(0.62, 0.7, 0.78); waterMat.uniforms.uSharp.value = 300; }
    seaUni.uSea.value = sea; water.position.y = sea; waterMat.uniforms.uMurk.value = clamp(sea / 6); waterMat.uniforms.uScale.value = 1; waterMat.uniforms.uGlit.value = 1;
    BOATS.forEach((b, i) => { b.position.y = Math.max(sea, 0) + 0.25 + Math.sin(ENV.uT.value * 1.3 + i) * 0.12; b.rotation.z = Math.sin(ENV.uT.value * 0.9 + i * 2) * 0.04; });
    followSky(); };

  // ======================= GLASS : verre d'eau et glaçon =======================
  const GLASS = new THREE.Group(); scene.add(GLASS); GLASS.position.set(0, 0, 3000);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(14, 10).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.35 })); GLASS.add(table);
  const backW = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 })); backW.position.set(0, 4, -6); GLASS.add(backW);
  const glassGeo = new THREE.LatheGeometry([[0, 0], [0.33, 0], [0.355, 0.02], [0.4, 1.05], [0.405, 1.07], [0.385, 1.07], [0.38, 1.04], [0.335, 0.07], [0, 0.07]].map(([x, y]) => new THREE.Vector2(x, y)), 96);
  const glassMatP = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.06, ior: 1.5, clearcoat: 1, envMapIntensity: 1.3, specularIntensity: 1, depthWrite: false });
  const glassM = new THREE.Mesh(glassGeo, glassMatP); GLASS.add(glassM);
  const waterGeo = new THREE.LatheGeometry([[0, 0.07], [0.334, 0.07], [0.372, 0.7], [0, 0.7]].map(([x, y]) => new THREE.Vector2(x, y)), 96);
  const waterM = new THREE.Mesh(waterGeo, new THREE.MeshPhysicalMaterial({ color: 0x5f7f8a, roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1, envMapIntensity: 0.5, depthWrite: false })); GLASS.add(waterM);
  const cubeGeo = (s, seed) => { const g = new E.RoundedBoxGeometry(s, s, s, 5, s * 0.16); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + 0.04 * (f2(v.x * 20 + seed, v.y * 20 + v.z * 13) - 0.5)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0x9fc2d2, roughness: 0.1, transparent: true, opacity: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.7, depthWrite: false });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.12, depthWrite: false });
  const cube1 = new THREE.Mesh(cubeGeo(0.26, 1), cubeMat); GLASS.add(cube1); cube1.position.set(-0.08, 0.66, 0.05); cube1.rotation.set(0.3, 0.5, 0.15);
  const cube2 = new THREE.Mesh(cubeGeo(0.25, 7), cubeMat); GLASS.add(cube2);
  [cube1, cube2].forEach(c => { const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), coreMat); core.scale.set(1, 0.7, 1.2); c.add(core); }); waterM.renderOrder = 2; cube1.renderOrder = 3; cube2.renderOrder = 3;
  const shadowG = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: E.radialTex('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false })); shadowG.position.y = 0.003; GLASS.add(shadowG);
  const caust = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: E.radialTex('rgba(255,236,200,0.35)', 'rgba(255,220,170,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); caust.position.set(0.45, 0.004, 0.25); GLASS.add(caust);
  const bokeh = []; for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.radialTex('rgba(255,190,120,0.55)', 'rgba(255,160,80,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(-5 + rand(i * 3.1) * 10, 1.4 + rand(i * 5.3) * 3, -5.5); s.scale.setScalar(0.6 + rand(i) * 0.9); GLASS.add(s); bokeh.push(s); }
  const gKey = new THREE.SpotLight(0xffd9b0, 0, 30, 0.45, 0.7, 1.2); gKey.position.set(-3, 5, 3); gKey.target = glassM; GLASS.add(gKey);
  const gRim = new THREE.PointLight(0x9fc4ff, 0, 12, 1.5); gRim.position.set(2.5, 2, -2.5); GLASS.add(gRim);
  const glassLook = () => { lightsOff(); scene.fog = null; sky.visible = false; setStars(0); gKey.intensity = 90; gRim.intensity = 14; L.hemi.color.setRGB(0.5, 0.42, 0.36); L.hemi.groundColor.setRGB(0.12, 0.08, 0.06); L.hemi.intensity = 0.35; E.renderer.toneMappingExposure = 1.0; };

  // ======================= helpers =======================
  const GROUPS = { EARTH, ICE, BLOCK, MTN, CITY, GLASS };
  const show = (...names) => { for (const k in GROUPS) GROUPS[k].visible = names.includes(k); water.visible = names.includes('ICE') || names.includes('CITY'); sky.visible = !names.includes('GLASS'); gKey.visible = gRim.visible = names.includes('GLASS'); };
  const label = (x, y, s, a = 1, size = 30, col = '#ffffff') => { if (a <= 0) return; const o = E.o; o.save(); o.font = `600 ${size}px Inter`; o.textAlign = 'center'; o.textBaseline = 'middle';
    { const w0 = o.measureText(s).width; const g = o.createRadialGradient(x, y, 0, x, y, w0 * 0.75 + 40); g.addColorStop(0, `rgba(0,0,0,${0.22 * clamp(a)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = g; o.save(); o.translate(x, y); o.scale(1, (size * 2.6) / (w0 * 1.5 + 80)); o.translate(-x, -y); o.fillRect(x - w0, y - w0, w0 * 2, w0 * 2); o.restore(); }
    o.globalAlpha = clamp(a);
    o.shadowColor = 'rgba(0,0,0,0.75)'; o.shadowBlur = 12; o.fillStyle = col; o.fillText(s, x, y); const w = o.measureText(s).width; o.globalAlpha = clamp(a) * 0.55; o.fillRect(x - w / 2, y + size * 0.72, w, 2); o.restore(); };
  const fadeBlack = (a) => { if (a > 0) { E.o.fillStyle = `rgba(0,0,0,${clamp(a)})`; E.o.fillRect(0, 0, 1080, 1920); } };
  const fr = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
  const at = (w, after = 0) => E.at(w, after);
  const zoomIn = (d = 0.35, px = 14) => (t, lt) => lt < d ? `blur(${((d - lt) / d * px).toFixed(1)}px)` : null;
  const dipIn = (d = 0.35) => (t, lt) => lt < d ? `brightness(${(0.25 + 0.75 * lt / d).toFixed(2)})` : null;
  const look = (p, tg, fov = 42, roll = 0) => { cam.position.copy(p); cam.fov = fov; cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(tg); cam.rotation.z += roll; };
  // ligne de mesure verticale (2D) entre deux points 3D
  const measure = (a, b, prog, txtS, alpha, col = '#ffe1a0') => { if (alpha <= 0) return; const o = E.o; const [x1, y1] = E.proj(a), [x2, y2] = E.proj(b); const yb = lerp(y1, y2, prog);
    o.save(); o.globalAlpha = clamp(alpha); o.strokeStyle = col; o.lineWidth = 3; o.shadowColor = 'rgba(0,0,0,0.6)'; o.shadowBlur = 8;
    o.beginPath(); o.moveTo(x1, y1); o.lineTo(lerp(x1, x2, prog), yb); o.stroke(); [[x1, y1], [lerp(x1, x2, prog), yb]].forEach(([x, y]) => { o.beginPath(); o.moveTo(x - 14, y); o.lineTo(x + 14, y); o.stroke(); });
    o.restore(); if (txtS) label(Math.min(lerp(x1, x2, 0.5) + 150, 960), lerp(y1, yb, 0.5), txtS, alpha, 38, col); };
  const sprayAt = (c, t0, t, n = 300, spread = 30, height = 25, col = 0x9aa6ad) => { const tt = t - t0; if (tt < 0 || tt > 4) return;
    for (let i = 0; i < n; i++) { const a = rand(i * 1.7) * 6.283, r = rand(i * 3.1) * spread, v = 0.4 + rand(i * 5.3); const up = height * v * tt - 9.8 * 0.5 * tt * tt * 1.2;
      if (up < -1) continue; E.dot(V3(c.x + Math.cos(a) * r * (0.5 + tt * 0.4), c.y + Math.max(0, up), c.z + Math.sin(a) * r * 0.6 * (0.5 + tt * 0.4)), (0.12 + rand(i) * 0.22) * (1 - tt / 4), col); } };

  // ======================= temps (calés sur la voix) =======================
  const T = {
    fondait: at('fondait'), auj: at("Aujourd'hui"), poles: at('pôles'), tiers: at('tiers'), le2: at('Le', 6.8), ant: at("l'Antarctique", 6.8), une: at('Une', 7.9), n2: at('2'), moyenne: at('moyenne'),
    et4: at('Et', 11.9), endroits: at('endroits'), n5: at('5'), apeu: at('À', 14.2), blanc: at('Blanc'), alors: at('Alors', 15.5), tout: at('Tout', 17), fond: at('fond', 17),
    les6: at('Les', 17.9), glaciers: at('glaciers'), le7: at('le', 19.1), groen: at('Groenland'), puis: at('puis', 20), ant2: at("l'Antarctique", 20), toute: at('Toute', 21), ocean: at("l'océan"),
    et9: at('Et', 23), niveau: at('niveau'), n65: at('65'), la10: at('La', 25.9), immeuble: at('immeuble'), etages: at("d'étages"), les11: at('Les', 27.6), plages: at('plages'), ports: at('ports'), villes: at('villes'), eau: at("l'eau", 30),
    vue: at('Vue'), carte: at('carte'), continents: at('continents'), retrec: at('rétrécissent'), et14: at('Et', 36), surprise: at('surprise'), sous: at('Sous', 37.5), montagnes: at('montagnes', 39), alpes: at('Alpes'),
    elle: at('Elle', 42), enfouie: at('enfouie'), personne: at('Personne'), radars: at('radars'), mais: at('Mais', 47.6), toute2: at('Toute', 48.4), equateur: at("l'équateur"), alors2: at('Alors', 51.4), vite: at('vite'), journees: at('journées', 53.5),
    dailleurs: at("D'ailleurs"), commence: at('commencé'), avec: at('Avec', 56.4), milli: at('milliseconde'), rassure: at('Rassure-toi'), n5000: at('5000'), ans: at('ans', 64.5),
    alors3: at('Alors', 65), glacon: at('glaçon', 66), verre: at('verre'), pense: at('pense'), grand: at('grand', 68.7), sec: at('sec'), et20: at('Et', 72), toi: at('toi', 72), dis: at('Dis-le'), abonne: at('abonne-toi'),
  };

  const shots = [
    // 1 — ACCROCHE : falaise de la banquise antarctique dorée au-dessus de l'océan ; au mot « fondait », un pan de glace se détache
    { name: 'banquise', start: 0, noFlash: true,
      update(t, lt, k) { show('ICE'); iceLook('gold'); ENV.uT.value = t; const s = easeIO(clamp(t / 2.8));
        look(V3(lerp(-100, -85, s), lerp(7, 6, s), lerp(135, 118, s)), V3(lerp(-14, -8, s), 21, 0), 44); followSky();
        const tc = t - (T.fondait + 0.1); chunk.visible = true; chunk.position.set(-6, 0, edgeZ(-6) + 0.6); chunk.visible = tc > 0; const r = tc > 0 ? Math.min(1.3, 0.9 * tc * tc + 0.1 * tc) : 0; chunk.rotation.set(r, 0, 0); chunk.position.y = -Math.max(0, tc - 0.5) * 7;
        sprayAt(V3(-6, 0, 30), T.fondait + 1.0, t, 1400, 26, 22, 0x6f787c); },
      hud(t) { fadeBlack(1 - t / 0.5); } },
    // 2 — LA TERRE DEPUIS L'ESPACE : calotte du pôle Nord et Groenland ; la glace retient l'eau douce
    { name: 'terre-glace', start: T.auj, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('EARTH'); earthLook(); cloudMat.uniforms.uT.value = t; spin.rotation.set(0, -G_LON * DEG + 0.5 - lt * 0.04, 0);
        camDir(V3(0.15, lerp(0.75, 0.9, easeIO(k)), 1), lerp(fitD(R, 40, 0.6), fitD(R, 40, 0.66), easeIO(k)), V3(0, 0.6, 0), 40); },
      hud(t) { label(540, 470, 'plus des 2/3 de l\'eau douce', ease((t - T.tiers + 0.2) / 0.4) * 0.92, 34, '#e6f3ff'); label(540, 520, 'est gelée dans les calottes', ease((t - T.tiers - 0.2) / 0.4) * 0.75, 26, '#cfd9e6'); } },
    // 3 — L'ANTARCTIQUE vu du dessous de la planète
    { name: 'antarctique', start: T.le2, filter: dipIn(),
      update(t, lt, k) { show('EARTH'); earthLook({ sun: V3(0.6, -0.35, 0.7).normalize() }); cloudMat.uniforms.uT.value = t; spin.rotation.set(0, 0.8 + lt * 0.05, 0);
        camDir(V3(0.25, -1, lerp(0.85, 0.6, easeIO(k))), lerp(fitD(R, 40, 0.6), fitD(R, 40, 0.68), easeIO(k)), V3(0, -1.2, 0), 40); },
      hud(t) { label(540, 470, 'Antarctique', ease((t - T.ant) / 0.4) * 0.9, 34, '#ffffff'); } },
    // 4 — LE PLATEAU : survol d'un désert de glace infini, épaisseur moyenne
    { name: 'plateau', start: T.une, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('BLOCK'); blockLook('gold', ICE_H, false); const s = easeIO(k); look(V3(-120 + lt * 3.2, ICE_H + 2.2, -60 + lt * 1.2), V3(-60 + lt * 3.2, ICE_H - 0.5, -95 + lt * 1.2), 44, -0.02); followSky(); },
      hud(t) { label(540, 470, 'plus de 2 km de glace', ease((t - T.n2 + 0.1) / 0.4) * 0.92, 38, '#ffe1a0'); label(540, 525, 'en moyenne', ease((t - T.moyenne) / 0.4) * 0.8, 26, '#e6eaf0'); } },
    // 5 — EN COUPE : la calotte tranchée ; mesure jusqu'à près de 5 km, puis le mont Blanc à côté pour comparer
    { name: 'coupe', start: T.et4, filter: dipIn(0.4),
      update(t, lt, k) { show('BLOCK'); blockLook('day'); MB.visible = true; const p = smooth(T.apeu - 0.2, T.blanc + 0.4, t);
        const tg = V3(lerp(CX - 4, CX + 4, p), lerp(4, 6, p), lerp(CZ - 6, CZ - 32, p)); look(V3(CX + lerp(46, 66, p) + lt * 0.8, lerp(26, 24, p), CZ + lerp(46, 40, p)), tg, 44); followSky(); },
      hud(t, lt) { const bx = CX, bz = 12.5; const b = bedH(bx, bz); const g = ease(clamp((t - T.n5 + 0.5) / 1.0)); const a = ease((t - T.endroits) / 0.4) * (1 - 0.6 * ease((t - T.blanc) / 0.5));
        measure(V3(bx, ICE_H, bz), V3(bx, b, bz), g, g > 0.05 ? 'près de ' + fr(5 * g, 0) + ' km' : '', a);
        const ma = ease((t - T.blanc + 0.1) / 0.4); const [mx, my] = E.proj(V3(CX + 13, ICE_H, CZ - 44)); label(mx, Math.max(my - 50, 420), 'mont Blanc · 4 806 m', ma * 0.95, 30, '#ffffff'); } },
    // 6 — TOUT FOND : accéléré, le soleil file, la glace ruisselle, des mares turquoise apparaissent
    { name: 'timelapse', start: T.alors, filter: dipIn(0.5),
      update(t, lt, k) { show('ICE'); iceLook('day'); ENV.uT.value = t * 8; const ph = lt * 2.4; const sd = V3(Math.cos(ph) * 0.8, 0.15 + 0.35 * Math.sin(ph * 0.5 + 0.6), 0.6).normalize();
        setEnv({ L: sd, LC: [1.3, lerp(1.0, 1.2, sd.y), lerp(0.7, 1.05, sd.y)], amb: [0.28, 0.34, 0.45], fog: [0.68, 0.72, 0.8], fogD: [300, 1500] }); setSky({ day: 1, warm: 0.4 * (1 - sd.y), sun: sd });
        shelfSnow.uniforms.uMelt.value = smooth(T.tout - 0.3, T.fond + 0.8, t); look(V3(lerp(120, 90, k), lerp(70, 60, k), lerp(160, 140, k)), V3(20, 26, -40), 46); followSky();
        if (t > T.tout) for (let i = 0; i < 1400; i++) { const x = -200 + (i % 70) * 6 + rand(i) * 3; const z0 = edgeZ(x); const ph2 = (lt * 1.6 + rand(i * 7.7)) % 1; const y = shelfTop(x, z0) - ph2 * ph2 * 36;
          if (rand(i * 3.3) < 0.65 || y < 0) continue; E.dot(V3(x + (rand(i * 2) - 0.5) * 0.8, y, z0 + 1.2 + ph2 * 2.5), 0.22, 0x5d6a72); } },
      hud(t, lt) { label(540, 470, 'accéléré', 0.7 * ease(lt / 0.4), 24, '#dfe6ee'); } },
    // 7 — LES GLACIERS DES MONTAGNES : la langue de glace recule et s'amincit
    { name: 'glacier', start: T.les6, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('MTN'); mtnLook(); const m = smooth(T.les6, T.le7 + 0.2, t); glacUni.uFront.value = lerp(250, -40, m); glacUni.uThin.value = lerp(0, 0.7, m); mtnMat.uniforms.uSnowH.value = lerp(80, 115, m);
        look(V3(420 - lt * 12, 125, 70), V3(-150, 55, -10), 46); followSky(); } },
    // 8 — LE GROENLAND PUIS L'ANTARCTIQUE : depuis l'espace, les calottes fondent (la caméra bascule du nord au sud)
    { name: 'calottes', start: T.le7, filter: dipIn(),
      update(t, lt, k) { show('EARTH'); const mN = smooth(T.le7, T.puis + 0.2, t), mS = smooth(T.puis, T.toute, t); earthLook({ iceN: 1 - mN, iceS: 1 - mS, sun: V3(0.7, 0, 0.7).normalize() }); cloudMat.uniforms.uT.value = t;
        spin.rotation.set(0, -G_LON * DEG + 0.4, 0); const sw = easeIO(smooth(T.puis - 0.3, T.puis + 0.6, t)); camDir(V3(0.15, lerp(0.85, -0.9, sw), 1), fitD(R, 40, 0.64), V3(0, lerp(0.5, -0.5, sw), 0), 40); },
      hud(t) { label(540, 470, 'Groenland', ease((t - T.groen) / 0.3) * 0.9 * (1 - ease((t - T.puis) / 0.3)), 32); label(540, 470, 'Antarctique', ease((t - T.ant2) / 0.3) * 0.9, 32); } },
    // 9 — TOUTE CETTE EAU FILE VERS L'OCÉAN : cascades de fonte qui tombent de la falaise
    { name: 'cascades', start: T.toute, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('ICE'); iceLook('gold'); ENV.uT.value = t; shelfSnow.uniforms.uMelt.value = 1; cliffMat.uniforms.uWL.value = 0;
        look(V3(lerp(55, 45, k), 8, lerp(70, 62, k)), V3(-5, 20, 0), 44); followSky();
        FALLS.visible = true; FALLS.children.forEach((m, f) => { for (let i = 0; i < 50; i++) { const ph = (t * 0.8 + rand(i * 9.1 + f)) % 1; E.dot(V3(m.userData.x + (rand(i) - 0.5) * 7 * ph, ph * 3.5, m.userData.z + 4.5 + (rand(i * 3) - 0.5) * 5 * ph), 0.5 * (1 - ph), 0x4a5458); } }); } },
    // 10 — LA MER MONTE DE 65 M : la ville côtière, l'eau envahit les rues et monte jusqu'au toit de l'immeuble de 20 étages
    { name: 'montee', start: T.et9, filter: dipIn(0.4),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; const sea = 65 * easeIO(smooth(T.niveau - 0.2, T.etages + 0.4, t)); cityLook(sea);
        const s = easeIO(k); look(V3(HERO.x + lerp(150, 120, s), lerp(95, 110, s), HERO.z + lerp(330, 290, s)), V3(HERO.x - 60, lerp(10, 40, s), HERO.z - 90), 44); followSky(); },
      hud(t) { const sea = 65 * easeIO(smooth(T.niveau - 0.2, T.etages + 0.4, t)); label(540, 470, '+ ' + fr(sea) + ' m', ease((t - T.niveau) / 0.4) * 0.95, 46, '#ffe1a0');
        const a = ease((t - T.immeuble) / 0.4) * 0.95; const [x, y] = E.proj(V3(HERO.x, cityH(HERO.x, HERO.z) + 66, HERO.z)); if (a > 0) { label(x, Math.max(y - 60, 560), '20 étages', a, 30, '#ffffff'); } } },
    // 11 — LES PLAGES, LES PORTS : à hauteur d'eau, la mer recouvre la plage, les bateaux montent avec elle
    { name: 'plage', start: T.plages - 0.25, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; const sea = lerp(0.2, 4.5, smooth(T.plages - 0.2, T.villes, t)); cityLook(sea); look(V3(lerp(60, 75, k), 7.5, COAST_Z + 45), V3(-30, 2.5, COAST_Z - 12), 46); followSky(); } },
    // 12 — DES VILLES ENTIÈRES SOUS L'EAU : survol au couchant, il ne reste que les toits des tours
    { name: 'villes', start: T.villes, filter: dipIn(0.35),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; cityLook(lerp(48, 62, k), 'dusk'); const s = easeIO(k); look(V3(lerp(-260, -200, s), 130, lerp(300, 240, s)), V3(-40, 30, -260), 46); followSky(); } },
    // 13 — VUE DE L'ESPACE : les côtes reculent, les continents rétrécissent
    { name: 'carte', start: T.vue, filter: zoomIn(0.35, 14),
      update(t, lt, k) { show('EARTH'); const m = smooth(T.carte, T.retrec + 0.9, t); earthLook({ sea: 0.045 * m, iceN: 0, iceS: 0, sun: V3(0.4, 0.3, 1).normalize(), clouds: true }); cloudMat.uniforms.uT.value = t;
        spin.rotation.set(0, 2.2 + lt * 0.06, 0); camDir(V3(0.3, 0.32, 1), lerp(fitD(R, 40, 0.6), fitD(R, 40, 0.75), easeIO(k)), V3(0, 0.2, 0), 40); },
      hud(t) { label(540, 470, 'les côtes reculent', ease((t - T.carte - 0.4) / 0.4) * 0.85, 30, '#e6f3ff'); } },
    // 14 — SURPRISE : la glace de l'Antarctique disparaît et révèle une chaîne de montagnes cachée
    { name: 'montagnes', start: T.et14, filter: dipIn(0.4),
      update(t, lt, k) { show('BLOCK'); const m = easeIO(smooth(T.sous, T.alpes - 0.2, t)); blockLook('gold', lerp(ICE_H, 2.5, m)); bedMat.uniforms.uWet.value = 0.5 * m; bedMat.uniforms.uSnowH.value = lerp(30, 13, m);
        const s = easeIO(k); look(V3(CX + lerp(40, 22, s), lerp(30, 24, s), CZ + lerp(44, 30, s)), V3(CX - 26, lerp(10, 6, s), CZ - 30), 46); followSky(); },
      hud(t) { label(540, 470, 'Monts Gamburtsev', ease((t - T.montagnes) / 0.4) * 0.9, 34, '#ffffff'); label(540, 525, '≈ la taille des Alpes', ease((t - T.alpes) / 0.4) * 0.85, 28, '#ffe1a0'); } },
    // 15 — ENFOUIE, INVISIBLE : la glace est revenue ; un avion survole la coupe et sonde au radar le relief caché
    { name: 'radar', start: T.elle, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('BLOCK'); blockLook('day'); PLANE.visible = true; const px = lerp(-30, CX + 2, clamp((t - T.elle) / (T.radars + 1.2 - T.elle))); PLANE.position.set(px, ICE_H + 2.6, CZ - 1.5); PLANE.scale.setScalar(2.2); PLANE.rotation.set(0, 0, 0.02 * Math.sin(t));
        const s = easeIO(k); look(V3(CX + lerp(26, 20, s), lerp(18, 15, s), CZ + lerp(40, 30, s)), V3(lerp(-2, 10, s), 8, CZ - 4), 46); followSky();
        if (t > T.personne) { for (let i = 0; i < 4; i++) { const ph = ((t - T.personne) * 1.4 + i / 4) % 1; E.shell(i, PLANE.position.clone().add(V3(0, -0.2, 0)), V3(0, -1, 0), 0.5 + ph * 24, 0x9fe0ff, 0.7 * (1 - ph), 1.3); }
          const pts = []; for (let x = -30; x <= px; x += 0.4) pts.push(V3(x, bedH(x, CZ - 0.05) + 0.15, CZ + 0.05)); if (pts.length > 1) E.line3(0, pts, 0x9fe4ff, 0.9, 1); } },
      hud(t) { if (t > T.personne) { const px = lerp(-30, CX + 2, clamp((t - T.elle) / (T.radars + 1.2 - T.elle))); const o = E.o; o.save(); o.strokeStyle = 'rgba(150,230,255,0.95)'; o.lineWidth = 4; o.shadowColor = '#7fdcff'; o.shadowBlur = 14; o.beginPath();
          let first = true; for (let x = -30; x <= px; x += 0.4) { const [sx, sy] = E.proj(V3(x, bedH(x, CZ) + 0.1, CZ + 0.05)); first ? o.moveTo(sx, sy) : o.lineTo(sx, sy); first = false; } o.stroke(); o.restore(); }
        label(540, 470, 'invisible sous la glace', ease((t - T.personne) / 0.4) * 0.85 * (1 - ease((t - T.radars + 0.2) / 0.3)), 30, '#ffffff'); label(540, 470, 'révélée par radar', ease((t - T.radars + 0.1) / 0.3) * 0.9, 32, '#bfe8ff'); } },
    // 16 — L'EAU QUITTE LES PÔLES ET S'ÉTALE VERS L'ÉQUATEUR : flux d'eau lumineux sur le globe
    { name: 'equateur', start: T.mais, filter: dipIn(),
      update(t, lt, k) { show('EARTH'); earthLook({ iceN: 0.3, iceS: 0.3, sun: V3(0.9, 0.25, 0.6).normalize(), clouds: false }); spin.rotation.set(0, 1.0 + lt * 0.05, 0);
        camDir(V3(0.2, 0.15, 1), fitD(R, 40, 0.62), V3(0, 0, 0), 40);
        const fa = smooth(T.toute2 - 0.2, T.toute2 + 0.8, t);
        if (fa > 0) for (let i = 0; i < 1600; i++) { const north = i % 2 === 0; const lo = rand(i * 3.7) * 360; const ph = ((t - T.toute2) * 0.35 + rand(i * 1.9)) % 1; const la = (north ? 1 : -1) * lerp(78, 4, ph);
          const p = latlon(la, lo).multiplyScalar(R * 1.012).applyEuler(spin.rotation); if (p.clone().normalize().dot(cam.position.clone().normalize()) < 0.15) continue; E.dot(p, 0.028 + 0.015 * rand(i), new THREE.Color(0x3a8cff).multiplyScalar(fa * (0.55 + 0.45 * Math.sin(ph * Math.PI)))); } },
      hud(t) { label(540, 470, "vers l'équateur", ease((t - T.equateur) / 0.4) * 0.9, 32, '#cfe8ff'); } },
    // 17 — LA TERRE TOURNE MOINS VITE : le jour se lève sur le limbe, la rotation ralentit
    { name: 'rotation', start: T.alors2, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('EARTH'); earthLook({ iceN: 0.3, iceS: 0.3, sun: V3(-1, 0.1, -0.15).normalize() }); cloudMat.uniforms.uT.value = t;
        const w = lerp(0.6, 0.18, smooth(T.vite - 0.6, T.vite + 0.6, t)); spin.rotation.set(0, 2.0 + (lt < 1 ? lt * 0.6 : 0.6 + (lt - 1) * w), 0); camDir(V3(-0.55, 0.2, 1), fitD(R, 40, 0.62), V3(0, 0, 0), 40); },
      hud(t) { label(540, 470, 'rotation ralentie (effet exagéré)', ease((t - T.vite) / 0.4) * 0.75, 26, '#dfe6ee'); label(540, 520, 'les journées s\'allongent', ease((t - T.journees) / 0.4) * 0.9, 32, '#ffe1a0'); } },
    // 18 — ÇA A DÉJÀ COMMENCÉ : vêlage en temps réel, un pan de falaise s'effondre dans la mer
    { name: 'velage', start: T.dailleurs, filter: dipIn(0.4),
      update(t, lt, k) { show('ICE'); iceLook('grey'); ENV.uT.value = t; const tc = t - (T.commence - 0.3); chunk.visible = tc > 0; chunk.position.set(-6, 0, edgeZ(-6) + 0.6);
        const r = tc > 0 ? Math.min(1.35, 0.5 * tc * tc + 0.06 * tc) : 0; chunk.rotation.set(r, 0, 0); chunk.position.y = -Math.max(0, tc - 0.9) * 6; chunk.position.z = edgeZ(-6) + 0.6 + Math.max(0, tc - 1) * 3;
        look(V3(lerp(-160, -145, k), 12, lerp(200, 185, k)), V3(-2, 16, 0), 42); followSky(); sprayAt(V3(-6, 0, 28), T.commence + 1.2, t, 2200, 30, 28, 0xa6b0b5);
        if (tc > 1.5 && tc < 4.5) { const rr = (tc - 1.5) * 18; for (let i = 0; i < 3; i++) E.ring(i, V3(-6, 0.1, 30), rr * (1 - i * 0.2), 0x9fb0b8, 0.25 * (1 - (tc - 1.5) / 3)); } },
      hud(t) { label(540, 470, '+ 1,3 ms par siècle', ease((t - T.milli + 0.1) / 0.4) * 0.95, 40, '#ffe1a0'); label(540, 525, 'durée du jour, depuis 2000', ease((t - T.milli + 0.1) / 0.4) * 0.72, 24, '#e6eaf0'); } },
    // 19 — PLUS DE 5000 ANS : nuit polaire, les étoiles tournent au-dessus du plateau, les siècles défilent
    { name: '5000-ans', start: T.rassure, filter: dipIn(0.5),
      update(t, lt, k) { show('BLOCK'); blockLook('night', ICE_H, false); E.renderer.toneMappingExposure = 1.05; const day = Math.max(0, Math.sin(lt * 3.2)) * 0.25; skyMat.uniforms.uWarm.value = day * 1.2;
        setEnv({ L: V3(0.4, 0.15, -0.9), LC: [0.25 + day * 2, 0.22 + day * 1.4, 0.3 + day], amb: [0.07, 0.09, 0.13], fog: [0.012 + day * 0.3, 0.02 + day * 0.25, 0.04 + day * 0.2], fogD: [150, 900] }); skyMat.uniforms.uSun.value.copy(ENV.uL.value);
        skyMat.uniforms.uAur.value = 1; skyMat.uniforms.uAT.value = lt * 4; look(V3(-40, ICE_H + 1.6, 40), V3(-60, ICE_H + 16, -20), 48); followSky(); starGrp.rotation.set(-1.1, 0, lt * 0.9); },
      hud(t) { const y = 5000 * ease(clamp((t - T.selon0) / (T.ans + 0.3 - T.selon0))); label(540, 470, '+ ' + fr(Math.round(y / 10) * 10) + ' ans', ease((t - T.rassure - 0.4) / 0.4) * 0.92, 44, '#ffe1a0'); } },
    // 20 — UN GLAÇON DANS TON VERRE : gros plan, le glaçon tombe dans l'eau
    { name: 'glacon', start: T.alors3, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('GLASS'); glassLook(); const tf = t - (T.glacon - 0.45); const y = tf < 0 ? 1.9 : (tf < 0.42 ? 1.9 - 0.5 * 9.8 * tf * tf * 1.15 : 0.6 + 0.07 * Math.exp(-(tf - 0.42) * 3) * Math.cos((tf - 0.42) * 12));
        cube2.position.set(0.1, Math.max(0.6, y), -0.04); cube2.rotation.set(0.6 + lt * 0.3, 0.2 + lt * 0.4, 0.1); cube1.position.y = 0.64 + 0.02 * Math.exp(-Math.max(0, tf - 0.42) * 2) * Math.sin(Math.max(0, tf - 0.42) * 10);
        look(V3(lerp(1.5, 1.3, k), lerp(1.35, 1.2, k), lerp(3.0, 2.7, k)).add(GLASS.position), V3(0, 0.6, 0).add(GLASS.position), 36);
        if (tf > 0.4 && tf < 1.6) { for (let i = 0; i < 90; i++) { const a = rand(i) * 6.283, v = 0.6 + rand(i * 3) * 0.8, tt = tf - 0.4; const up = v * 1.6 * tt - 4.9 * tt * tt; if (up < -0.05) continue;
          E.dot(V3(0.1 + Math.cos(a) * (0.05 + tt * 0.35 * v), 0.7 + up, -0.04 + Math.sin(a) * (0.05 + tt * 0.35 * v)).add(GLASS.position), 0.004 + 0.003 * rand(i), 0x6a767a); } }
        if (tf > 0.4) for (let i = 0; i < 60; i++) { const ph = ((tf - 0.4) * 0.6 + rand(i * 2.2)) % 1; E.dot(V3(-0.2 + rand(i * 5) * 0.4, 0.1 + ph * 0.55, -0.15 + rand(i * 7) * 0.3).add(GLASS.position), 0.006, 0x4a5458); } } },
    // 21 — LE PLUS GRAND GLAÇON DU MONDE : la banquise au couchant, en contre-jour ; recul lent
    { name: 'plus-grand', start: T.pense, filter: dipIn(0.4),
      update(t, lt, k) { show('ICE'); iceLook('back'); ENV.uT.value = t; const s = easeIO(k); look(V3(lerp(70, 90, s), lerp(110, 150, s), lerp(170, 220, s)), V3(-300, 10, -150), 46); followSky(); },
      hud(t) { label(540, 470, 'le plus grand glaçon du monde', ease((t - T.grand) / 0.4) * 0.9 * (1 - ease((t - T.sec - 0.3) / 0.4)), 32, '#ffffff'); label(540, 470, 'il garde nos côtes au sec', ease((t - T.sec - 0.4) / 0.4) * 0.9, 32, '#ffe1a0'); } },
    // 22 — QUESTION FINALE : la Terre bleue, calottes intactes
    { name: 'final', start: T.et20, filter: zoomIn(0.35, 12),
      update(t, lt, k) { show('EARTH'); earthLook({ sun: V3(0.9, 0.3, 0.5).normalize() }); cloudMat.uniforms.uT.value = t; spin.rotation.set(0, 0.3 + lt * 0.05, 0);
        camDir(V3(-0.2, lerp(-0.35, -0.1, easeIO(k)), 1), lerp(fitD(R, 40, 0.55), fitD(R, 40, 0.62), easeIO(k)), V3(0, -0.4, 0), 40); },
      hud(t) { label(540, 470, 'Tu irais vivre où ?', ease((t - T.toi) / 0.5) * 0.95, 46, '#ffffff'); fadeBlack(smooth(E.TOTAL - 0.9, E.TOTAL, t)); } },
  ];
  T.selon0 = at('selon');

  shots.forEach(sh => { const u = sh.update; sh.update = (t, lt, k) => { E.bloom.threshold = 0.88; E.bloom.strength = 0.32; E.bloom.radius = 0.5; chunk.visible = false; u(t, lt, k); }; });
  const sfx = [
    { t: T.fondait + 0.1, type: 'rise' }, { t: T.fondait + 1.0, type: 'boom' }, { t: T.tiers, type: 'pop' }, { t: T.n2, type: 'pop' }, { t: T.n5, type: 'boom' }, { t: T.blanc, type: 'ding' },
    { t: T.tout, type: 'rise' }, { t: T.n65, type: 'boom' }, { t: T.etages, type: 'pop' }, { t: T.retrec, type: 'ding' }, { t: T.surprise, type: 'rise' }, { t: T.alpes, type: 'boom' },
    { t: T.radars, type: 'click' }, { t: T.vite, type: 'pop' }, { t: T.commence + 1.2, type: 'boom' }, { t: T.n5000, type: 'ding' }, { t: T.glacon, type: 'click' }, { t: T.sec, type: 'pop' },
  ];
  return { shots, sfx };
}
