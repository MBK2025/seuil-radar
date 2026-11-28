// Épisode 004 – Et si le Soleil s'éteignait ? Style classic photoréaliste (base : zones de l'épisode 003 + zones nouvelles).
export async function build(E) {
  const { THREE, V3, clamp, ease, easeIO, lerp, rand } = E;
  const scene = E.scene, cam = E.camera;
  E.mood('space'); E.camera.far = 3000; E.camera.updateProjectionMatrix();
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
      uSharp: { value: 300 }, uGlit: { value: 1 }, uMurk: { value: 0 }, uScale: { value: 1 }, uFreeze: { value: 0 } },
    vertexShader: VS, transparent: true, depthWrite: true,
    fragmentShader: NOISE + ENVG + `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uDeep; uniform float uSharp; uniform float uGlit; uniform float uMurk; uniform float uScale; uniform float uFreeze;
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
        float fzm = fbm(vec3(vW.xz * 0.012, 3.0)); float fz = smoothstep(0.0, 0.06, uFreeze * 1.25 - fzm * 0.9 - 0.08 + fbm3(vec3(vW.xz * 0.2, 1.0)) * 0.04);
        if (fz > 0.001) { float d1 = fbm(vec3(vW.xz * 0.08, 5.0)), d2 = noise(vec3(vW.xz * 1.5, 2.0));
          float crack = smoothstep(0.035, 0.0, abs(fbm3(vec3(vW.xz * 0.03, 7.0)) - 0.5)) * 0.8; float snw = smoothstep(0.45, 0.75, fbm(vec3(vW.xz * 0.04, 9.0)));
          vec3 ic = mix(vec3(0.10, 0.17, 0.22), vec3(0.32, 0.40, 0.46), d1) * (0.85 + 0.25 * d2); ic = mix(ic, vec3(0.72, 0.76, 0.82) * (0.9 + 0.1 * d2), snw * fz);
          ic = mix(ic, vec3(0.05, 0.09, 0.12), crack * (1.0 - snw)); vec3 Nf = bumpN(vW, vec3(0.0, 1.0, 0.0), d1 * 0.6 + snw * 0.5 + d2 * 0.04, 0.5);
          vec3 icl = ic * (uAmb * 1.2 + uLC * max(dot(Nf, uL), 0.0) * 0.9) + uLC * pow(max(dot(reflect(-V, Nf), uL), 0.0), 60.0) * 0.25 * (1.0 - snw);
          c = mix(c, icl, fz); }
        gl_FragColor = vec4(fogit(c), mix(mix(0.97, 0.9, uMurk), 1.0, fz)); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2), waterMat); scene.add(water);

  // ======================= TERRE (vue de l'espace) =======================
  const R = 10;
  const SUN_DIR = V3(1, 0.15, 0.55).normalize();
  const GDIR = V3(-0.42, 0.82, 0.4).normalize();
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uSea: { value: 0 }, uIceN: { value: 1 }, uIceS: { value: 1 }, uG: { value: GDIR.clone() }, uCity: { value: 1 }, uDim: { value: 1 }, uAmbE: { value: 0 }, uFreeze: { value: 0 } },
    vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uSea; uniform float uIceN; uniform float uIceS; uniform vec3 uG; uniform float uCity; uniform float uDim; uniform float uAmbE; uniform float uFreeze; varying vec3 vP; varying vec3 vN; varying vec3 vW;
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
        float fz = uFreeze * smoothstep(0.0, 0.15, uFreeze * 1.3 - fbm(p * 3.0 + 4.0) * 0.6 - 0.1 + abs(p.y) * 0.4); col = mix(col, mix(vec3(0.62, 0.68, 0.76), vec3(0.85, 0.88, 0.93), det) * (1.0 - land * 0.15), clamp(fz, 0.0, 1.0)); ice = max(ice, fz);
        vec3 N = normalize(vN); vec3 Nb = bumpN(vW, N, land * (h + det * 0.4) * (1.0 - ice * 0.7), 0.35);
        vec3 L = normalize(uSun); vec3 V = normalize(cameraPosition - vW);
        float ndl = dot(Nb, L), ndl0 = dot(N, L);
        float diff = clamp(ndl, 0.0, 1.0) * smoothstep(-0.08, 0.12, ndl0);
        vec3 c = col * diff * 2.2 * uDim + col * uAmbE;
        float spec = pow(max(dot(N, normalize(L + V)), 0.0), 260.0) * (1.0 - land) * (1.0 - ice) + pow(max(dot(N, normalize(L + V)), 0.0), 30.0) * (1.0 - land) * 0.04;
        c += vec3(1.0, 0.92, 0.8) * spec * 0.45 * smoothstep(0.0, 0.2, ndl0) * uDim;
        float term = smoothstep(-0.1, 0.05, ndl0) * (1.0 - smoothstep(0.05, 0.3, ndl0)); c += vec3(0.20, 0.07, 0.02) * term * 0.08 * uDim;
        float night = mix(1.0, 1.0 - smoothstep(-0.12, 0.04, ndl0), uDim);
        float city = step(0.7, noise(p * 90.0)) * smoothstep(0.45, 0.7, fbm(p * 8.0 + 2.0)) * land * (1.0 - ice) * (1.0 - dry * 0.7) * (1.0 - max(ant, gre));
        c += vec3(1.0, 0.62, 0.25) * city * night * 0.9 * uCity * (1.0 - clamp(fz, 0.0, 1.0));
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0); c += vec3(0.25, 0.5, 1.0) * fr * smoothstep(-0.2, 0.4, ndl0) * 0.9 * uDim + vec3(0.25, 0.4, 0.7) * fr * uAmbE * 1.5;
        gl_FragColor = vec4(c, 1.0); }` });
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uT: { value: 0 }, uDim: { value: 1 } }, vertexShader: VS, transparent: true, depthWrite: false,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uT; uniform float uDim; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP); vec3 q = p * 3.2 + vec3(uT * 0.01, 0.0, 0.0);
        float w = fbm(q + fbm(q * 1.5) * 1.4); float a = smoothstep(0.52, 0.76, w) * (0.75 + 0.25 * fbm(p * 20.0));
        a *= 1.0 - smoothstep(0.7, 0.9, abs(p.y)) * 0.85;
        float ndl = dot(normalize(vN), normalize(uSun)); float diff = smoothstep(-0.1, 0.5, ndl);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (0.02 + 2.0 * diff * clamp(ndl + 0.15, 0.0, 1.0)) * uDim, a * 0.85 * mix(0.25, 1.0, uDim)); }` });
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uDim: { value: 1 } }, vertexShader: VS, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 uSun; uniform float uDim; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = -normalize(vN);
        float rim = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 1.6); float lit = smoothstep(-0.35, 0.5, dot(-N, normalize(uSun)));
        float a = smoothstep(0.0, 0.35, abs(dot(N, V)));
        gl_FragColor = vec4(mix(vec3(0.5, 0.35, 0.3), vec3(0.25, 0.5, 1.0), smoothstep(-0.25, 0.2, dot(-N, normalize(uSun)))) * a * lit * 1.1 * (1.0 - rim * 0.3) * uDim, 1.0); }` });
  const EARTH = new THREE.Group(); scene.add(EARTH);
  const spin = new THREE.Group(); EARTH.add(spin);
  const earthS = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), earthMat); spin.add(earthS);
  const cloudS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 128, 64), cloudMat); spin.add(cloudS);
  const atmoS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 96, 48), atmoMat); EARTH.add(atmoS);
  const earthLook = (o = {}) => { lightsOff(); scene.fog = null; setSky({ space: 1, milky: 0.7 }); setStars(1); followSky(); E.renderer.toneMappingExposure = 0.95;
    const s = (o.sun ?? SUN_DIR); [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(s));
    earthMat.uniforms.uSea.value = o.sea ?? 0; const dm = o.dim ?? 1; earthMat.uniforms.uDim.value = dm; cloudMat.uniforms.uDim.value = dm; atmoMat.uniforms.uDim.value = dm; earthMat.uniforms.uAmbE.value = o.amb ?? 0; earthMat.uniforms.uFreeze.value = o.freeze ?? 0; earthMat.uniforms.uCity.value = o.city ?? 1; earthMat.uniforms.uIceN.value = o.iceN ?? 1; earthMat.uniforms.uIceS.value = o.iceS ?? 1; cloudS.visible = o.clouds ?? true; };
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
  const seaUni = { uSea: { value: 0 }, uNight: { value: 0 }, uSnow: { value: 0 } };
  const groundMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...seaUni }, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform float uSea; uniform float uNight; uniform float uSnow;
      void main(){ vec3 N = normalize(vN); vec2 q = vW.xz; vec2 cell = floor((q + vec2(6.0)) / 42.0); vec2 f = mod(q + vec2(6.0), 42.0);
        float street = 1.0 - step(12.0, f.x) * step(12.0, f.y); float walk = (1.0 - step(14.5, f.x) * step(14.5, f.y)) * (1.0 - street) + step(39.5, f.x) + step(39.5, f.y);
        float det = fbm(vec3(q * 0.3, 1.0)); float id = hash(vec3(cell, 4.0));
        vec3 asph = vec3(0.07, 0.072, 0.075) * (0.8 + 0.4 * det); float lane = step(abs(f.x - 6.0), 0.12) * step(0.5, fract(q.y * 0.1)) + step(abs(f.y - 6.0), 0.12) * step(0.5, fract(q.x * 0.1));
        asph += vec3(0.45, 0.42, 0.33) * lane * street;
        vec3 side = vec3(0.32, 0.31, 0.29) * (0.85 + 0.3 * det);
        vec3 lot = id < 0.18 ? mix(vec3(0.06, 0.11, 0.04), vec3(0.12, 0.15, 0.06), det) : vec3(0.2, 0.2, 0.2) * (0.8 + 0.4 * det);
        vec3 col = street > 0.5 ? asph : (walk > 0.5 ? side : lot);
        vec3 sand = vec3(0.62, 0.53, 0.38) * (0.85 + 0.25 * det); float beach = smoothstep(${(COAST_Z - 22).toFixed(1)}, ${(COAST_Z - 18).toFixed(1)}, vW.z);
        col = mix(col, sand, beach); col = mix(col, vec3(0.74, 0.77, 0.83) * (0.85 + 0.2 * det), uSnow * smoothstep(0.3, 0.7, det + (street > 0.5 ? 0.15 : 0.45))); col = mix(col, sand * 0.5, smoothstep(${(COAST_Z + 2).toFixed(1)}, ${(COAST_Z + 6).toFixed(1)}, vW.z));
        float ndl = max(dot(N, uL), 0.0); vec3 c = col * (uAmb + uLC * ndl * 0.9);
        float lamp = (1.0 - street) * walk * step(0.97, hash(vec3(floor(q / 6.0), 2.0))); c += vec3(1.0, 0.7, 0.4) * lamp * uNight * 0.6;
        float d = uSea - vW.y; c = mix(c, vec3(0.015, 0.04, 0.045), smoothstep(0.0, 6.0, d) * 0.92);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  CITY.add(new THREE.Mesh(heightGeo(2600, 2600, 260, 260, 0, -500, cityH), groundMat));
  const bldMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...seaUni, uHero: { value: V3(1e5, 0, 0) } }, side: THREE.FrontSide,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec3 vI; varying vec3 vS;
      void main(){ vP = position; mat4 m = modelMatrix * instanceMatrix; vN = normalize(mat3(m) * normal); vec4 w = m * vec4(position, 1.0); vW = w.xyz; vI = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vS = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz)); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG.replace('varying vec3 vP; varying vec3 vN; varying vec3 vW;', 'varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec3 vI; varying vec3 vS;') + `uniform float uSea; uniform float uNight; uniform vec3 uHero; uniform float uSnow;
      void main(){ vec3 N = normalize(vN); float id = hash(vec3(floor(vI.xz), 1.0)); float id2 = hash(vec3(floor(vI.xz), 7.0));
        vec3 V = normalize(cameraPosition - vW); vec3 c;
        float yb = vW.y - vI.y;
        if (N.y > 0.5) { float det = fbm(vec3(vW.xz * 0.5, 3.0)); vec3 roof = vec3(0.22, 0.215, 0.2) * (0.7 + 0.5 * det);
          vec2 rq = vW.xz - vI.xz; float edge = step(vS.x * 0.5 - 0.6, abs(rq.x)) + step(vS.z * 0.5 - 0.6, abs(rq.y)); roof = mix(roof, vec3(0.3), clamp(edge, 0.0, 1.0));
          float unit = step(0.6, hash(vec3(floor(rq / 3.0), id))) * step(abs(rq.x), vS.x * 0.3) * step(abs(rq.y), vS.z * 0.3); roof = mix(roof, vec3(0.38, 0.38, 0.37), unit * 0.6); roof = mix(roof, vec3(0.76, 0.79, 0.85) * (0.85 + 0.2 * det), uSnow * 0.92);
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
    if (mode === 'night') { setEnv({ L: V3(-0.3, 0.6, 0.6), LC: [0.07, 0.08, 0.12], amb: [0.035, 0.042, 0.065], fog: [0.02, 0.025, 0.04], fogD: [250, 1400] }); setSky({ day: 0, milky: 0.8 }); setStars(1); seaUni.uNight.value = 1;
      waterMat.uniforms.uTop.value.setRGB(0.02, 0.03, 0.05); waterMat.uniforms.uHor.value.setRGB(0.05, 0.05, 0.07); waterMat.uniforms.uSharp.value = 300; }
    else if (mode === 'rise') { setEnv({ L: V3(0.15, 0.09, -0.99), LC: [1.6, 0.95, 0.55], amb: [0.2, 0.23, 0.33], fog: [0.62, 0.52, 0.5], fogD: [300, 1600] }); setSky({ day: 0.85, warm: 1.2, haze: [0.85, 0.62, 0.48] }); seaUni.uNight.value = 0.35;
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.16, 0.3); waterMat.uniforms.uHor.value.setRGB(0.75, 0.52, 0.42); waterMat.uniforms.uSharp.value = 140; }
    else if (mode === 'dusk') { setEnv({ L: V3(-0.6, 0.14, -0.78), LC: [1.5, 0.9, 0.55], amb: [0.2, 0.24, 0.36], fog: [0.6, 0.5, 0.48], fogD: [300, 1600] }); setSky({ day: 0.85, warm: 1.0, haze: [0.8, 0.6, 0.5] }); seaUni.uNight.value = 0.7;
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.16, 0.3); waterMat.uniforms.uHor.value.setRGB(0.7, 0.52, 0.44); waterMat.uniforms.uSharp.value = 140; }
    else { setEnv({ L: V3(0.5, 0.5, 0.7), LC: [1.4, 1.3, 1.15], amb: [0.28, 0.36, 0.5], fog: [0.6, 0.7, 0.84], fogD: [350, 2000] }); setSky({ day: 1, warm: 0.05, haze: [0.58, 0.72, 0.9] }); seaUni.uNight.value = 0;
      waterMat.uniforms.uTop.value.setRGB(0.12, 0.26, 0.48); waterMat.uniforms.uHor.value.setRGB(0.62, 0.7, 0.78); waterMat.uniforms.uSharp.value = 300; }
    seaUni.uSea.value = sea; water.position.y = sea; waterMat.uniforms.uMurk.value = clamp(sea / 6); waterMat.uniforms.uScale.value = 1; waterMat.uniforms.uGlit.value = 1;
    BOATS.forEach((b, i) => { b.position.y = Math.max(sea, 0) + 0.25 + Math.sin(ENV.uT.value * 1.3 + i) * 0.12; b.rotation.z = Math.sin(ENV.uT.value * 0.9 + i * 2) * 0.04; });
    followSky(); };
  // =====================================================================================
  // ÉPISODE 004 – Et si le Soleil s'éteignait ? Zones ajoutées :
  //  SUN (le Soleil en gros plan), SOLAR (Soleil + Terre + Lune, distances non à l'échelle), MOON (la Lune),
  //  FOREST (forêt de conifères et prairie), UNDER (sous la banquise), VENT (sources hydrothermales),
  //  HAB (coupe du sous-sol avec un abri), VOLC (volcan islandais la nuit)
  // =====================================================================================

  // ----------- particules opaques (fumée, vapeur) : Points à mélange normal -----------
  const mkSmoke = (n, col, op = 0.5) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(new Float32Array(n), 1)); g.setAttribute('aA', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(col) }, uOp: { value: op }, uLit: { value: new THREE.Color(0, 0, 0) } }, transparent: true, depthWrite: false,
      vertexShader: `attribute float aS; attribute float aA; varying float vA; varying float vH; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * 900.0 / -mv.z; vH = position.y; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: NOISE + `uniform vec3 uC; uniform float uOp; uniform vec3 uLit; varying float vA; varying float vH; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
        float n = fbm(vec3(gl_PointCoord * 3.0, vA * 7.0)); float a = smoothstep(0.5, 0.1, d) * (0.45 + 0.55 * n) * vA * uOp; gl_FragColor = vec4(uC * (0.75 + 0.5 * n) + uLit * (1.0 - gl_PointCoord.y), a); }` });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.n = n; p.userData.set = (i, v, s, a) => { const P = g.attributes.position.array; P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; g.attributes.aS.array[i] = s; g.attributes.aA.array[i] = a; };
    p.userData.done = () => { g.attributes.position.needsUpdate = true; g.attributes.aS.needsUpdate = true; g.attributes.aA.needsUpdate = true; }; return p; };
  // neige qui tombe autour de la caméra (particules lumineuses discrètes)
  const snowFall = (t, n = 1500, spd = 1.2, size = 0.05, box = 30, col = 0x9aa3b0, wind = 0.4) => { const c = cam.position; const B = box * 2; const md = (v) => ((v % B) + B) % B;
    for (let i = 0; i < n; i++) { const v = 0.7 + 0.6 * rand(i * 5.1);
      const x = c.x - box + md(rand(i * 1.31) * B + t * wind + Math.sin(t * 0.7 + i) * 0.3), y = c.y - box + md(rand(i * 2.17) * B - t * spd * v), z = c.z - box + md(rand(i * 3.71) * B);
      E.dot(V3(x, y, z), size * (0.6 + 0.8 * rand(i * 5.3)), col); } };

  // ======================= SUN : le Soleil (rayon 10) =======================
  const SUNG = new THREE.Group(); scene.add(SUNG);
  const sunUni = { uT: { value: 0 }, uOn: { value: 1 } };
  const sunMat = new THREE.ShaderMaterial({ uniforms: sunUni, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uT; uniform float uOn; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP); vec3 V = normalize(cameraPosition - vW); float mu = max(dot(normalize(vN), V), 0.0);
        vec3 q = p * 22.0 + vec3(0.0, uT * 0.06, uT * 0.04); float g = fbm(q + fbm(q * 0.5) * 1.5); float cell = noise(p * 90.0 + uT * 0.3);
        float gran = smoothstep(0.25, 0.85, g) * 0.7 + cell * 0.3;
        float spots = smoothstep(0.70, 0.74, fbm(p * 2.6 + vec3(5.0, 1.0, 2.0))) * smoothstep(0.55, 0.2, abs(p.y));
        float pen = smoothstep(0.64, 0.70, fbm(p * 2.6 + vec3(5.0, 1.0, 2.0))) * smoothstep(0.55, 0.2, abs(p.y));
        float fac = smoothstep(0.58, 0.72, fbm(p * 6.0 + 2.0));
        float limb = pow(mu, 0.5);
        vec3 hot = vec3(2.3, 1.45, 0.62), cool = vec3(1.25, 0.5, 0.12);
        vec3 c = mix(cool, hot, gran) * (0.35 + 0.65 * limb);
        c *= 1.0 - pen * 0.45; c = mix(c, vec3(0.12, 0.04, 0.01), spots * 0.92);
        c += vec3(0.9, 0.55, 0.2) * fac * pow(1.0 - mu, 2.0) * 0.7;
        c = mix(c, c * vec3(1.0, 0.55, 0.25), pow(1.0 - mu, 3.0));
        vec3 dead = vec3(0.022, 0.010, 0.005) * (0.4 + gran) * smoothstep(0.0, 0.4, uOn + 0.25) + vec3(0.004, 0.005, 0.008) * pow(1.0 - mu, 4.0);
        float alive = smoothstep(0.0, 1.0, uOn * 1.45 - pow(1.0 - limb, 1.5) * 0.45 + (g - 0.5) * 0.25);
        c = mix(dead, c * (0.6 + 0.4 * uOn), alive);
        gl_FragColor = vec4(c, 1.0); }` });
  const sunS = new THREE.Mesh(new THREE.SphereGeometry(10, 160, 80), sunMat); SUNG.add(sunS);
  // couronne : plan face caméra, jets radiaux
  const coronaMat = new THREE.ShaderMaterial({ uniforms: { uT: sunUni.uT, uOn: sunUni.uOn, uR: { value: 0.5 / 3.2 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uT; uniform float uOn; uniform float uR; varying vec2 vU;
      void main(){ vec2 q = vU - 0.5; float d = length(q) / uR; float a = atan(q.y, q.x); if (d < 0.985) discard;
        float jets = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, d * 0.6 - uT * 0.04)); float st = pow(fbm(vec3(cos(a) * 9.0, sin(a) * 9.0, 1.0)), 2.0);
        float glow = exp(-(d - 1.0) * 5.0) * 0.9 + exp(-(d - 1.0) * 1.4) * (0.10 + 0.35 * st) * (0.6 + 0.6 * jets);
        float flame = exp(-(d - 1.0) * 26.0) * (0.5 + jets);
        vec3 c = vec3(1.4, 0.75, 0.3) * glow + vec3(1.6, 0.5, 0.12) * flame;
        gl_FragColor = vec4(c * uOn * smoothstep(1.0, 0.6, length(q) * 2.0), 1.0); }` });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), coronaMat); SUNG.add(corona);
  // protubérances : arcs de plasma
  const promMat = new THREE.ShaderMaterial({ uniforms: { uT: sunUni.uT, uOn: sunUni.uOn }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uT; uniform float uOn; varying vec2 vU; varying vec3 vP;
      void main(){ float n = fbm(vP * 1.6 + vec3(0.0, uT * 0.3, 0.0)); float a = smoothstep(0.35, 0.8, n) * sin(vU.x * 3.1416);
        gl_FragColor = vec4(vec3(1.7, 0.55, 0.15) * a * 0.9 * uOn, 1.0); }` });
  [[0.3, 0.2, 3.2, 0.25], [2.2, -0.3, 2.4, 0.2], [4.2, 0.1, 4.0, 0.3], [5.4, 0.5, 1.8, 0.16], [1.2, -0.6, 2.8, 0.22]].forEach(([ang, tilt, h, w]) => {
    const d0 = V3(Math.cos(ang), tilt, Math.sin(ang)).normalize(); const tg = new THREE.Vector3().crossVectors(d0, V3(0.2, 1, 0.1)).normalize();
    const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; const d = d0.clone().add(tg.clone().multiplyScalar((u - 0.5) * w * 2)).normalize(); pts.push(d.multiplyScalar(9.8 + Math.sin(u * Math.PI) * h)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.32, 10), promMat); SUNG.add(m); });
  const sunLook = (on) => { lightsOff(); scene.fog = null; setSky({ space: 1, milky: 0.5 }); setStars(1); followSky(); E.renderer.toneMappingExposure = 0.82; sunUni.uOn.value = on; corona.lookAt(cam.position); };

  // ======================= SOLAR : Soleil, Terre, Lune (distances non à l'échelle) =======================
  const SOLAR = new THREE.Group(); scene.add(SOLAR);
  const SP = V3(0, 0, 0), ORB = 40;  // Soleil au centre, Terre sur un cercle de rayon 70
  const sunSmall = new THREE.Mesh(new THREE.SphereGeometry(6, 96, 48), sunMat); SOLAR.add(sunSmall);
  const coronaS = new THREE.Mesh(new THREE.PlaneGeometry(38.4, 38.4), coronaMat); SOLAR.add(coronaS);
  const earthSm = new THREE.Group(); SOLAR.add(earthSm); earthSm.scale.setScalar(2.5);
  earthSm.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 96, 48), earthMat), new THREE.Mesh(new THREE.SphereGeometry(1.21, 64, 32), cloudMat), new THREE.Mesh(new THREE.SphereGeometry(1.254, 64, 32), atmoMat));
  const moonUni = { uSun: { value: V3(1, 0, 0) }, uOn: { value: 1 }, uAmb: { value: 0 } };
  const moonMat = new THREE.ShaderMaterial({ uniforms: moonUni, vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uOn; uniform float uAmb; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      float crater(vec3 p, float s, float seed){ vec3 q = p * s + seed; vec3 i = floor(q); vec3 f = fract(q); float h = 0.0;
        vec3 cc = vec3(0.4) + 0.2 * vec3(hash(i + 1.3), hash(i + 7.1), hash(i + 3.7)); float r = 0.12 + 0.2 * hash(i + 9.9); float d = length(f - cc);
        if (hash(i + 4.4) < 0.55) { h = -smoothstep(r, 0.0, d) * 0.9 + smoothstep(r * 0.75, r, d) * smoothstep(r * 1.45, r, d) * 0.55; } return h * r; }
      void main(){ vec3 p = normalize(vP);
        float h = crater(p, 3.0, 1.0) * 1.6 + crater(p, 7.0, 3.0) + crater(p, 15.0, 5.0) * 0.7 + crater(p, 33.0, 8.0) * 0.5 + crater(p, 70.0, 2.0) * 0.4 + fbm(p * 30.0) * 0.06;
        float mare = smoothstep(0.5, 0.62, fbm(p * 1.7 + vec3(2.0, 0.0, 1.0)));
        float det = fbm(p * 12.0);
        vec3 col = mix(vec3(0.46, 0.45, 0.43), vec3(0.17, 0.17, 0.18), mare) * (0.8 + 0.35 * det);
        col = mix(col, vec3(0.62, 0.61, 0.59), smoothstep(0.02, 0.06, h) * 0.5);
        vec3 N = normalize(vN); vec3 Nb = bumpN(vW, N, h * 3.0 * (1.0 - mare * 0.6), 1.0);
        float ndl = max(dot(Nb, normalize(uSun)), 0.0); float ndl0 = dot(N, normalize(uSun));
        vec3 c = col * ndl * smoothstep(-0.05, 0.1, ndl0) * 2.1 * uOn + col * uAmb;
        gl_FragColor = vec4(c, 1.0); }` });
  const moonSm = new THREE.Mesh(new THREE.SphereGeometry(0.8, 64, 32), moonMat); SOLAR.add(moonSm);
  const earthAt = (ang) => V3(Math.cos(ang) * ORB, 0, Math.sin(ang) * ORB);
  const solarLook = (on) => { lightsOff(); scene.fog = null; setSky({ space: 1, milky: 0.6 }); setStars(1); followSky(); E.renderer.toneMappingExposure = 0.95; sunUni.uOn.value = on; coronaS.lookAt(cam.position); sunSmall.visible = coronaS.visible = true; };
  const orbitPts = (() => { const a = []; for (let i = 0; i <= 360; i++) a.push(earthAt(i / 360 * Math.PI * 2)); return a; })();

  // ======================= MOON : la Lune en gros plan (rayon 6) =======================
  const MOON = new THREE.Group(); scene.add(MOON);
  const moonBig = new THREE.Mesh(new THREE.SphereGeometry(6, 200, 100), moonMat); MOON.add(moonBig);
  const moonLook = (on) => { lightsOff(); scene.fog = null; setSky({ space: 1, milky: 0.8 }); setStars(1); followSky(); E.renderer.toneMappingExposure = 0.95; moonUni.uOn.value = on; };

  // ======================= FOREST : forêt de conifères et prairie (1 u = 1 m) =======================
  const FOREST = new THREE.Group(); scene.add(FOREST); FOREST.position.set(0, 0, -6000);
  const FO = FOREST.position;
  const fH = (x, z) => 8 * (f2(x / 160 + 3, z / 160) - 0.5) + 30 * Math.max(0, f2(x / 400 + 9, z / 400) - 0.45) * (z < -150 ? 1 : 0.2) + Math.max(0, -z - 200) * 0.12;
  const fUni = { uDead: { value: 0 }, uSnow: { value: 0 }, uOff: { value: FO.clone() } };
  const fGroundMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...fUni }, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform float uDead; uniform float uSnow;
      void main(){ vec3 N = normalize(vN); vec2 q = vW.xz; float det = fbm(vec3(q * 0.15, 1.0)); float fine = noise(vec3(q * 3.0, 2.0)); float big = fbm(vec3(q * 0.01, 4.0));
        vec3 grass = mix(vec3(0.05, 0.09, 0.025), vec3(0.11, 0.14, 0.04), det) * (0.75 + 0.4 * fine);
        vec3 dry = mix(vec3(0.17, 0.12, 0.06), vec3(0.24, 0.19, 0.11), det) * (0.75 + 0.4 * fine);
        vec3 col = mix(grass, dry, clamp(uDead * (0.75 + 0.5 * big), 0.0, 1.0)); col = mix(col, vec3(0.08, 0.065, 0.05), smoothstep(0.6, 0.75, big) * 0.6);
        float sn = uSnow * smoothstep(0.35, 0.65, det + uSnow * 0.5 - 0.25); col = mix(col, vec3(0.7, 0.74, 0.8) * (0.9 + 0.15 * fine), clamp(sn, 0.0, 1.0));
        vec3 Nb = bumpN(vW, N, det * 0.6 + fine * 0.15, 0.6); float ndl = max(dot(Nb, uL), 0.0);
        vec3 c = col * (uAmb * 1.2 + uLC * ndl); c += uLC * pow(max(dot(reflect(-normalize(cameraPosition - vW), Nb), uL), 0.0), 40.0) * 0.08 * sn;
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  { const g = heightGeo(2400, 2400, 300, 300, 0, -400, fH); FOREST.add(new THREE.Mesh(g, fGroundMat)); }
  // conifère : tronc + étages de branches irréguliers
  const coniferGeo = (() => { const prof = []; const tiers = 15; prof.push([0, 0]);
    for (let i = 0; i < tiers; i++) { const y0 = 0.1 + i / tiers * 0.86; const w = (0.36 * (1 - i / tiers) + 0.035) * (0.85 + 0.3 * rand(i * 3.3)); prof.push([w * 0.45, y0 + 0.03], [w, y0 - 0.015], [w * 0.4, y0 + 0.055]); }
    prof.push([0.01, 1.0]); const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 14); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.6 * (f2(a * 2.5 + y * 9, y * 7) - 0.5); p.setXYZ(i, x * k, y + 0.02 * (f2(a * 3, y * 11) - 0.5), z * k); }
    g.computeVertexNormals(); return g; })();
  const treeMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...fUni },
    vertexShader: `attribute float aId; varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vId; varying float vH;
      void main(){ vP = position; vId = aId; vH = position.y; mat4 m = modelMatrix * instanceMatrix; vN = normalize(mat3(m) * normal); vec4 w = m * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG.replace('varying vec3 vP; varying vec3 vN; varying vec3 vW;', 'varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vId; varying float vH;') + `uniform float uDead; uniform float uSnow;
      void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N; vec3 w = vW * 3.0; float nd = fbm(w); float fine = noise(w * 4.0);
        vec3 green = mix(vec3(0.018, 0.04, 0.02), vec3(0.05, 0.085, 0.035), nd) * (0.6 + 0.7 * fine) * (0.85 + 0.3 * vId);
        vec3 brown = mix(vec3(0.12, 0.07, 0.03), vec3(0.2, 0.13, 0.06), nd) * (0.6 + 0.7 * fine);
        float die = step(0.5, vId) * uDead; vec3 col = mix(green, brown, die * 0.8);
        float sn = uSnow * smoothstep(0.1, 0.6, N.y + (nd - 0.5) * 0.8); col = mix(col, vec3(0.72, 0.76, 0.82) * (0.85 + 0.2 * fine), clamp(sn, 0.0, 1.0));
        float ao = 0.35 + 0.65 * smoothstep(0.0, 0.45, vH) * (0.6 + 0.4 * smoothstep(-0.2, 0.6, N.y));
        vec3 Nb = bumpN(vW, N, nd * 0.5 + fine * 0.3, 0.4); float ndl = max(dot(Nb, uL), 0.0); float wrap = clamp(dot(Nb, uL) * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = col * (uAmb * 1.1 + uLC * (ndl * 0.8 + wrap * 0.25)) * ao;
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  const TREES = []; for (let i = 0; i < 4200; i++) { const x = (rand(i * 1.7) - 0.5) * 1400, z = -40 - rand(i * 2.9) * 900; if (Math.abs(x) < 40 && z > -120) continue; if (f2(x / 120, z / 120) < 0.42) continue;
    const big = rand(i * 4.1); TREES.push({ x, z, h: 10 + big * big * 22, id: rand(i * 6.3) }); }
  // grands arbres au premier plan (plan « les grands arbres »)
  [[-14, -60, 34], [10, -75, 38], [-30, -95, 31], [26, -110, 36], [-4, -125, 40], [-48, -70, 28], [40, -82, 30]].forEach(([x, z, h], i) => TREES.push({ x, z, h, id: 0.2 + 0.05 * i }));
  const treeI = new THREE.InstancedMesh(coniferGeo, treeMat, TREES.length); { const ids = new Float32Array(TREES.length);
    TREES.forEach((tr, i) => { EU.set(0, rand(i) * 6.28, 0); Q.setFromEuler(EU); M.compose(V3(tr.x, fH(tr.x, tr.z) - 0.3, tr.z), Q, V3(tr.h * 0.62, tr.h, tr.h * 0.62)); treeI.setMatrixAt(i, M); ids[i] = tr.id; });
    coniferGeo.setAttribute('aId', new THREE.InstancedBufferAttribute(ids, 1)); } FOREST.add(treeI);
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.9, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.95 }), TREES.length);
  TREES.forEach((tr, i) => { M.compose(V3(tr.x, fH(tr.x, tr.z) - 0.3, tr.z), Q.identity(), V3(tr.h * 0.022, tr.h * 0.22, tr.h * 0.022)); trunkI.setMatrixAt(i, M); }); FOREST.add(trunkI);
  // prairie : brins d'herbe instanciés autour de la caméra du plan « plantes »
  const bladeGeo = (() => { const g = new THREE.PlaneGeometry(0.035, 0.45, 1, 4); g.translate(0, 0.225, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y / 0.47)); p.setZ(i, y * y * 0.5); } g.computeVertexNormals(); return g; })();
  const grassMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, ...fUni }, side: THREE.DoubleSide,
    vertexShader: `attribute float aId; uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vId; varying float vH;
      void main(){ vP = position; vId = aId; vH = position.y / 0.45; vec3 p = position; p.x += sin(uT * 1.3 + aId * 20.0) * 0.03 * vH * vH; mat4 m = modelMatrix * instanceMatrix; vN = normalize(mat3(m) * normal); vec4 w = m * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + ENVG.replace('varying vec3 vP; varying vec3 vN; varying vec3 vW;', 'varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vId; varying float vH;') + `uniform float uDead; uniform float uSnow;
      void main(){ vec3 green = mix(vec3(0.05, 0.12, 0.025), vec3(0.14, 0.2, 0.05), vId); vec3 dry = mix(vec3(0.22, 0.16, 0.07), vec3(0.32, 0.25, 0.13), vId);
        float d = clamp(uDead * 1.3 - vId * 0.3 + (1.0 - vH) * 0.0, 0.0, 1.0); vec3 col = mix(green, dry, d) * (0.35 + 0.65 * vH);
        col = mix(col, vec3(0.78, 0.82, 0.88), uSnow * smoothstep(0.3, 1.0, vH) * 0.8);
        vec3 N = normalize(vN); float ndl = abs(dot(N, uL)); vec3 c = col * (uAmb * 1.3 + uLC * (0.35 + 0.65 * ndl));
        c += uLC * 0.12 * pow(clamp(dot(normalize(cameraPosition - vW), -uL), 0.0, 1.0), 4.0) * vH * (1.0 - uSnow);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  grassMat.uniforms.uT = ENV.uT;
  const GR = { x: 0, z: 0 }; const NB = 26000;
  const grassI = new THREE.InstancedMesh(bladeGeo, grassMat, NB); { const ids = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { const r = Math.sqrt(rand(i * 1.1)) * 9, a = rand(i * 2.3) * 6.283; const x = GR.x + Math.cos(a) * r * 1.4, z = GR.z - 3 + Math.sin(a) * r;
      EU.set((rand(i * 3.3) - 0.5) * 0.5, rand(i * 4.4) * 6.28, (rand(i * 5.5) - 0.5) * 0.5); Q.setFromEuler(EU); const s = 0.6 + rand(i * 6.6) * 0.9; M.compose(V3(x, fH(x, z) - 0.02, z), Q, V3(s, s * (0.7 + rand(i * 7.7) * 0.8), s)); grassI.setMatrixAt(i, M); ids[i] = rand(i * 8.8); }
    bladeGeo.setAttribute('aId', new THREE.InstancedBufferAttribute(ids, 1)); } FOREST.add(grassI);
  const forestLook = (dead, snow, mode = 'night') => { E.renderer.toneMappingExposure = 1.0; fUni.uDead.value = dead; fUni.uSnow.value = snow;
    if (mode === 'last') { setEnv({ L: V3(-0.5, 0.18, -0.85), LC: [1.5, 0.95, 0.6], amb: [0.22, 0.26, 0.34], fog: [0.55, 0.5, 0.5], fogD: [80, 900] }); setSky({ day: 0.8, warm: 1.0, haze: [0.8, 0.62, 0.52] }); setStars(0); }
    else { setEnv({ L: V3(0.35, 0.55, -0.75), LC: [0.30, 0.36, 0.52], amb: [0.055, 0.068, 0.1], fog: [0.025, 0.032, 0.055], fogD: [60, 700] }); setSky({ day: 0, milky: 1.0 }); setStars(1); }
    followSky(); };

  // ======================= UNDER : sous la banquise (eau liquide sous la glace) =======================
  const UNDER = new THREE.Group(); scene.add(UNDER); UNDER.position.set(6000, 0, 0);
  const UO = UNDER.position;
  const ceilGeo = (() => { const g = new THREE.PlaneGeometry(600, 600, 300, 300); g.rotateX(Math.PI / 2); g.translate(UO.x, 0, UO.z); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const keel = Math.pow(Math.max(0, f2(x / 40, z / 40) - 0.5), 1.5) * 26; p.setY(i, -keel - 1.5 * f2(x / 6, z / 6)); } g.computeVertexNormals(); return g; })();
  const ceilMat = new THREE.ShaderMaterial({ uniforms: { ...ENV }, side: THREE.DoubleSide, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N; vec3 w = vW;
        float det = fbm(w * 0.3); float fine = noise(w * 3.0); float thin = fbm(vec3(w.xz * 0.02, 1.0));
        vec3 col = mix(vec3(0.03, 0.09, 0.12), vec3(0.11, 0.24, 0.29), smoothstep(0.35, 0.75, thin)) * (0.75 + 0.45 * det);
        float bub = step(0.93, noise(w * 9.0)) * 0.6; col += vec3(0.25, 0.35, 0.4) * bub * (0.4 + det);
        float crack = smoothstep(0.03, 0.0, abs(fbm3(vec3(w.xz * 0.05, 3.0)) - 0.5)); col += vec3(0.1, 0.22, 0.26) * crack;
        vec3 Nb = bumpN(vW, N, det * 1.2 + fine * 0.1, 0.8); float ndl = max(dot(Nb, uL), 0.0);
        vec3 c = col * (uAmb * 2.0 + uLC * ndl * 0.9) + uLC * pow(max(dot(reflect(-V, Nb), uL), 0.0), 50.0) * 0.2;
        float d = length(cameraPosition - vW); c = mix(c, uFog, 1.0 - exp(-d * 0.018));
        gl_FragColor = vec4(c, 1.0); }` });
  UNDER.add(new THREE.Mesh(ceilGeo, ceilMat)); UNDER.children[0].position.set(-UO.x, 0, -UO.z);
  // surface de glace vue en coupe (bord de la banquise) : un bloc avec neige dessus, pour le plan « couverture »
  const underLook = () => { lightsOff(); scene.background.setRGB(0.006, 0.022, 0.034); setEnv({ L: V3(0.2, -0.3, 0.9), LC: [0.25, 0.42, 0.5], amb: [0.03, 0.07, 0.09], fog: [0.006, 0.022, 0.034], fogD: [5, 160] }); sky.visible = true; setSky({ space: 1, milky: 0 }); skyMat.uniforms.uSpace.value = 1; setStars(0);
    skyMat.uniforms.uMilky.value = 0; E.renderer.toneMappingExposure = 1.05; followSky(); };
  const marineSnow = (t, n = 1800, box = 18, sz = 1) => { const c = cam.position; for (let i = 0; i < n; i++) { const r1 = rand(i * 1.9), r2 = rand(i * 2.7), r3 = rand(i * 3.3);
      const x = c.x + ((r1 * box * 2 + t * 0.15) % (box * 2)) - box, y = c.y + ((r2 * box * 2 - t * 0.12 * (0.5 + r3)) % (box * 2) + box * 2) % (box * 2) - box, z = c.z + (r3 - 0.5) * box * 2;
      const d = Math.hypot(x - c.x, y - c.y, z - c.z); E.dot(V3(x, y, z), (0.018 + 0.03 * rand(i * 4.1)) * sz, new THREE.Color(0x6f8f99).multiplyScalar(Math.max(0, 1 - d / box) * 0.55)); } };

  // ======================= VENT : sources hydrothermales (1 u = 1 m) =======================
  const VENT = new THREE.Group(); scene.add(VENT); VENT.position.set(-6000, -2000, 0);
  const VO = VENT.position;
  const vfH = (x, z) => 3 * (f2(x / 30, z / 30) - 0.5) + 1.2 * (f2(x / 5, z / 5) - 0.5) + 6 * Math.max(0, f2(x / 80 + 4, z / 80) - 0.55) * 4;
  const ventMatU = { ...ENV, uHeat: { value: 1 } };
  const ventMat = new THREE.ShaderMaterial({ uniforms: ventMatU, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform float uHeat;
      void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 w = vW - vec3(${VO.x.toFixed(1)}, ${VO.y.toFixed(1)}, ${VO.z.toFixed(1)});
        float det = fbm(w * 0.8); float fine = noise(w * 6.0); float big = fbm(w * 0.12); float str = fbm(vec3(w.x * 0.5, w.y * 2.5, w.z * 0.5));
        vec3 rock = mix(vec3(0.035, 0.03, 0.028), vec3(0.13, 0.1, 0.075), big) * (0.6 + 0.7 * det);
        rock = mix(rock, vec3(0.36, 0.2, 0.07) * (0.6 + 0.6 * det), smoothstep(0.55, 0.7, str) * 0.7);   // oxydes de fer, ocre
        rock = mix(rock, vec3(0.4, 0.36, 0.18) * (0.7 + 0.5 * fine), smoothstep(0.62, 0.72, fbm(w * 2.0 + 3.0)) * 0.5);   // soufre
        float mat = smoothstep(0.5, 0.62, fbm(w * 1.3 + 7.0) + smoothstep(4.0, 0.0, w.y) * 0.2) * smoothstep(0.1, 0.7, N.y + 0.3);   // tapis bactériens
        vec3 col = mix(rock, vec3(0.62, 0.6, 0.5) * (0.75 + 0.4 * fine), mat * 0.85);
        vec3 Nb = bumpN(vW, N, det * 0.9 + fine * 0.15 + mat * 0.2, 0.8); float ndl = max(dot(Nb, uL), 0.0);
        float dd = length(cameraPosition - vW); float lamp = 1.0 / (1.0 + dd * dd * 0.0022);
        vec3 c = col * (uAmb + uLC * ndl * lamp * 1.6) + uLC * pow(max(dot(reflect(-V, Nb), uL), 0.0), 30.0) * 0.12 * lamp * (1.0 - mat);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  { const g = heightGeo(500, 500, 250, 250, 0, 0, vfH); g.translate(VO.x, VO.y, VO.z); VENT.add(new THREE.Mesh(g, ventMat)); VENT.children[0].position.set(-VO.x, -VO.y, -VO.z); }
  const CHIM = [[0, 0, 16, 2.4], [-9, -6, 11, 1.8], [7, -10, 13, 2.0], [-4, -16, 8, 1.4], [14, -3, 7, 1.3], [-16, 4, 6, 1.2], [3, 7, 5, 1.0]];
  const chimTops = [];
  CHIM.forEach(([x, z, h, w], ci) => { const prof = []; for (let i = 0; i <= 24; i++) { const u = i / 24; const r = w * (1.25 - 0.75 * u) * (1 + 0.25 * Math.sin(u * 17 + ci) * (1 - u)) + 0.25 * (u > 0.92 ? 1 : 0); prof.push(new THREE.Vector2(Math.max(0.2, r), u * h)); }
    const g = new THREE.LatheGeometry(prof, 28); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i); const k = 1 + 0.4 * (f2(X * 1.3 + ci * 5 + Y * 0.8, Z * 1.3 + Y * 0.6) - 0.5); p.setXYZ(i, X * k + Math.sin(Y * 0.25 + ci) * 0.5, Y, Z * k); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, ventMat); m.position.set(x, vfH(x, z) - 0.5, z); VENT.add(m); chimTops.push(V3(x + Math.sin(h * 0.25 + ci) * 0.5, vfH(x, z) - 0.5 + h, z).add(VO)); });
  // vers tubicoles (tubes blancs, panaches rouges) au pied des cheminées
  const WORMS = new THREE.Group(); VENT.add(WORMS);
  if (false) { const tubeM = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.55 }); const plumeM = new THREE.MeshStandardMaterial({ color: 0xa01810, roughness: 0.6, emissive: 0x200000 });
    for (let i = 0; i < 160; i++) { const a = rand(i * 2.1) * 6.283, r = 2.6 + rand(i * 3.3) * 3.2; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = 0.6 + rand(i * 5.5) * 1.3;
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 7), tubeM); tb.position.set(x, vfH(x, z) + h / 2 - 0.1, z); tb.rotation.set((rand(i) - 0.5) * 0.4, 0, (rand(i * 7) - 0.5) * 0.4); WORMS.add(tb);
      const pl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), plumeM); pl.scale.set(1, 1.8, 1); pl.position.set(x + tb.rotation.z * -h / 2, vfH(x, z) + h - 0.05, z + tb.rotation.x * h / 2); WORMS.add(pl); } }
  const smokeV = mkSmoke(2400, 0x2b2824, 0.7); VENT.add(smokeV); smokeV.position.set(-VO.x, -VO.y, -VO.z);
  const updVentSmoke = (t) => { const n = smokeV.userData.n, per = Math.floor(n / chimTops.length);
    chimTops.forEach((tp, ci) => { for (let j = 0; j < per; j++) { const i = ci * per + j; const ph = (t * 0.22 + rand(i * 1.7)) % 1; const up = ph * (14 + CHIM[ci][2]) ;
      const sw = 0.3 + ph * 3.2; const v = V3(tp.x + Math.sin(i * 1.3 + t * 0.6) * sw * rand(i * 3.1) + ph * ph * 3, tp.y + up, tp.z + Math.cos(i * 2.1 + t * 0.5) * sw * rand(i * 4.7));
      smokeV.userData.set(i, v, (0.25 + ph * 2.2) * CHIM[ci][3] * 0.5, (1 - ph) * Math.min(1, ph * 12)); } }); smokeV.userData.done(); };
  const ventLook = () => { lightsOff(); scene.background.setRGB(0.008, 0.03, 0.045); setEnv({ L: V3(0.25, 0.6, 0.76), LC: [1.5, 1.55, 1.6], amb: [0.015, 0.025, 0.035], fog: [0.008, 0.03, 0.045], fogD: [6, 80] }); setSky({ space: 1, milky: 0 }); skyMat.uniforms.uMilky.value = 0; setStars(0);
    E.renderer.toneMappingExposure = 1.05; L.hemi.color.setRGB(0.1, 0.12, 0.14); L.hemi.intensity = 0.6; L.key.position.set(cam.position.x, cam.position.y + 6, cam.position.z + 4); L.key.color.setRGB(1, 1, 1); L.key.intensity = 1.2; followSky(); };

  // ======================= CAVE : abri souterrain (galerie creusée dans la roche, éclairée par des lampes) =======================
  const CAVE = new THREE.Group(); scene.add(CAVE); CAVE.position.set(0, -4000, 0);
  const CO = CAVE.position;
  const LAMPS = []; for (let i = 0; i < 10; i++) LAMPS.push(V3(i % 2 ? 2.2 : -2.2, 3.6, -6 - i * 11).add(CO));
  const caveMat = new THREE.ShaderMaterial({ uniforms: { ...ENV, uLamps: { value: LAMPS }, uEnd: { value: V3(0, 1.5, -122).add(CO) } }, side: THREE.BackSide, vertexShader: VS,
    fragmentShader: NOISE + ENVG + `uniform vec3 uLamps[10]; uniform vec3 uEnd;
      void main(){ vec3 N = -normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 w = vW - vec3(${CO.x.toFixed(1)}, ${CO.y.toFixed(1)}, ${CO.z.toFixed(1)});
        float det = fbm(w * 0.9); float fine = noise(w * 7.0); float big = fbm(w * 0.15); float str = fbm(vec3(w.x * 0.3, w.y * 1.8, w.z * 0.3));
        vec3 rock = mix(vec3(0.07, 0.065, 0.06), vec3(0.2, 0.18, 0.16), big) * (0.6 + 0.7 * det); rock = mix(rock, rock * vec3(1.25, 1.0, 0.8), smoothstep(0.5, 0.7, str) * 0.6);
        float floorK = smoothstep(0.6, 0.9, N.y); vec3 col = mix(rock, vec3(0.13, 0.125, 0.12) * (0.7 + 0.5 * fine), floorK);
        float drill = smoothstep(0.92, 1.0, abs(sin(w.z * 2.6 + det * 3.0))) * (1.0 - floorK) * 0.25; col *= 1.0 - drill;
        vec3 Nb = bumpN(vW, N, det * 0.9 + fine * 0.12 + drill, 0.7); vec3 c = col * uAmb;
        for (int i = 0; i < 10; i++) { vec3 Lv = uLamps[i] - vW; float d = length(Lv); vec3 Ld = Lv / d; float att = 1.0 / (1.0 + d * d * 0.09);
          c += col * vec3(1.0, 0.72, 0.45) * max(dot(Nb, Ld), 0.0) * att * 3.2 + vec3(1.0, 0.72, 0.45) * pow(max(dot(reflect(-V, Nb), Ld), 0.0), 40.0) * att * 0.25 * (1.0 - floorK * 0.5); }
        vec3 Le = uEnd - vW; float de = length(Le); c += col * vec3(0.9, 0.75, 1.0) * max(dot(Nb, Le / de), 0.0) * 30.0 / (de * de + 30.0);
        gl_FragColor = vec4(fogit(c), 1.0); }` });
  { const g = new THREE.CylinderGeometry(6, 6, 150, 72, 220, true); g.rotateX(Math.PI / 2); g.translate(0, 2, -70); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i) - 2, z = p.getZ(i); const a = Math.atan2(y, x); const k = 1 + 0.12 * (f2(a * 3 + z * 0.08, z * 0.15) - 0.5) + 0.05 * (f2(a * 9, z * 0.6) - 0.5);
      x *= k * 1.15; y *= k * 0.85; if (y < -3.2) y = -3.2 + (y + 3.2) * 0.05; p.setXYZ(i, x, y + 2, z); } g.computeVertexNormals(); CAVE.add(new THREE.Mesh(g, caveMat)); }
  { const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 1.0) }); const metal = new THREE.MeshStandardMaterial({ color: 0x4a4c50, metalness: 0.7, roughness: 0.4 });
    LAMPS.forEach((l) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.18), lampM); m.position.copy(l).sub(CO); CAVE.add(m); const h = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.26), metal); h.position.copy(m.position).add(V3(0, 0.07, 0)); CAVE.add(h); });
    [-2.6, 2.6].forEach(x => { const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 140, 6).rotateX(Math.PI / 2), metal); cab.position.set(x, 3.9, -70); CAVE.add(cab); }); }
  // l'abri au fond de la galerie : modules éclairés + serre
  const HABM = new THREE.Group(); CAVE.add(HABM); HABM.position.set(0, -1.2, -112);
  { const shell = new THREE.MeshPhysicalMaterial({ color: 0xd8d4cc, roughness: 0.45, metalness: 0.2, clearcoat: 0.4 }); const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.7) });
    const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 1.6) }); const leafM = new THREE.MeshStandardMaterial({ color: 0x3b7a2a, roughness: 0.75 });
    const mod1 = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 5, 8, 24).rotateZ(Math.PI / 2), shell); mod1.position.set(-1.6, 1.4, 0); HABM.add(mod1);
    for (let k = 0; k < 4; k++) { const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), winM); wdw.position.set(-3.6 + k * 1.3, 1.6, 1.62); HABM.add(wdw); }
    const gh = new THREE.Mesh(new E.RoundedBoxGeometry(4.2, 2.6, 3.2, 3, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false })); gh.position.set(2.8, 1.3, -1); HABM.add(gh);
    for (let r = 0; r < 3; r++) for (let s2 = 0; s2 < 2; s2++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 2.6, 8, 2, 16), leafM); pl.position.set(1.6 + r * 1.2, 0.4 + s2 * 1.0, -1); const pp = pl.geometry.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) + 0.12 * f2(pp.getX(i) * 9 + r, pp.getZ(i) * 9 + s2)); pl.geometry.computeVertexNormals(); HABM.add(pl);
      const led = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 2.6), ledM); led.position.set(1.6 + r * 1.2, 0.95 + s2 * 1.0, -1); HABM.add(led); }
    const pt = new THREE.PointLight(0xffc89a, 30, 25, 1.6); pt.position.set(0, 3.5, 3); HABM.add(pt); const pt2 = new THREE.PointLight(0xd8a0ff, 14, 12, 1.6); pt2.position.set(2.8, 2, 1); HABM.add(pt2); }
  const caveLook = () => { lightsOff(); setEnv({ L: V3(0, 1, 0), LC: [0, 0, 0], amb: [0.012, 0.011, 0.01], fog: [0.02, 0.016, 0.012], fogD: [10, 130] }); setStars(0); E.renderer.toneMappingExposure = 1.0;
    L.hemi.color.setRGB(0.5, 0.4, 0.3); L.hemi.intensity = 0.25; followSky(); };

  // ======================= VOLC : volcan la nuit, géothermie (1 u = 10 m) =======================
  const VOLC = new THREE.Group(); scene.add(VOLC); VOLC.position.set(0, 0, 6000);
  const VCO = VOLC.position;
  const vH = (x, z) => { const r = Math.hypot(x, z); const cone = 85 * Math.exp(-Math.pow(r / 120, 1.6)); const crater = -22 * Math.exp(-r * r / (2 * 14 * 14)); return cone + crater + 12 * (ridge(x / 60 + 2, z / 60) - 0.5) * (0.4 + Math.min(1, r / 150)) + 4 * (f2(x / 12, z / 12) - 0.5); };
  const volcMat = rockMat(10); volcMat.uniforms.uSnowH.value = 72;
  volcMat.uniforms.uGP = { value: V3(0, 70, 0).add(VCO) }; volcMat.uniforms.uGC = { value: new THREE.Color(0, 0, 0) };
  volcMat.fragmentShader = volcMat.fragmentShader.replace('uniform float uDark;', 'uniform float uDark; uniform vec3 uGP; uniform vec3 uGC;').replace('c *= uDark;', 'c *= uDark; float gd = length(vW - uGP); c += col * uGC * 60.0 / (gd * gd + 60.0) * (0.4 + 0.6 * max(dot(N, normalize(uGP - vW)), 0.0));');
  { const g = heightGeo(1800, 1800, 300, 300, 0, 0, vH); g.translate(VCO.x, 0, VCO.z); const m = new THREE.Mesh(g, volcMat); m.position.set(-VCO.x, 0, -VCO.z); VOLC.add(m); }
  const lavaMat = new THREE.ShaderMaterial({ uniforms: { uT: ENV.uT }, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vec2 q = vP.xy; float n = fbm(vec3(q * 0.25, uT * 0.15)); float cr = smoothstep(0.35, 0.65, fbm(vec3(q * 0.6 + n * 2.0, uT * 0.05)));
      vec3 c = mix(vec3(0.08, 0.015, 0.005), vec3(2.2, 0.62, 0.12), cr) + vec3(1.6, 1.0, 0.4) * smoothstep(0.8, 0.95, cr) * 0.6; gl_FragColor = vec4(c, 1.0); }` });
  const lava = new THREE.Mesh(new THREE.CircleGeometry(16, 48), lavaMat); lava.rotation.x = -Math.PI / 2; lava.position.set(0, vH(0, 0) + 2.5, 0); VOLC.add(lava);
  const steamV = mkSmoke(1800, 0x8a8f96, 0.35); VOLC.add(steamV); steamV.position.set(-VCO.x, 0, -VCO.z);
  // centrale géothermique au pied du volcan : bâtiments éclairés + colonnes de vapeur
  const PLANT = new THREE.Group(); VOLC.add(PLANT); PLANT.position.set(210, 0, 170);
  { const bm = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.6, metalness: 0.3 }); const wm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.0, 0.6) });
    [[0, 0, 8, 3, 5], [10, 3, 6, 2.2, 4], [-8, 6, 5, 2, 4], [3, -8, 4, 4, 4]].forEach(([x, z, w, h, d]) => { const y = vH(210 + x, 170 + z); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); b.position.set(x, y + h / 2, z); PLANT.add(b);
      for (let k = 0; k < 4; k++) { const wi = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), wm); wi.position.set(x - w / 2 + 1 + k * (w - 2) / 3, y + h * 0.55, z + d / 2 + 0.02); PLANT.add(wi); } });
    for (let k = 0; k < 9; k++) { const pl = new THREE.PointLight(0xffc890, 6, 30, 1.5); pl.position.set(-12 + k * 3, vH(210, 170) + 6, 6); if (k % 3 === 0) PLANT.add(pl); } }
  const PIPES = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 60, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.6, roughness: 0.4 })); PIPES.position.set(180, vH(180, 172) + 1.2, 172); VOLC.add(PIPES);
  const updSteam = (t) => { const n = steamV.userData.n; for (let i = 0; i < n; i++) { const ph = (t * 0.08 + rand(i * 1.7)) % 1; let base, s;
      if (i < n * 0.6) { const a = rand(i * 3.1) * 6.283, r = rand(i * 4.1) * 10; base = V3(Math.cos(a) * r, vH(0, 0) + 4, Math.sin(a) * r); s = 10; }
      else { const k = i % 3; base = V3(210 + (k - 1) * 9, vH(210, 170) + 4, 170 + (k - 1) * 3); s = 4; }
      steamV.userData.set(i, V3(base.x + VCO.x + ph * ph * 30 + Math.sin(i + t * 0.3) * ph * s, base.y + ph * (i < n * 0.6 ? 160 : 60), base.z + VCO.z + Math.cos(i * 1.7) * ph * s), (2 + ph * 14) * (i < n * 0.6 ? 3 : 1.2), (1 - ph) * Math.min(1, ph * 8)); }
    steamV.userData.done(); };
  const volcLook = () => { E.renderer.toneMappingExposure = 1.0; setEnv({ L: V3(-0.4, 0.55, 0.7), LC: [0.22, 0.26, 0.38], amb: [0.04, 0.05, 0.075], fog: [0.025, 0.028, 0.045], fogD: [200, 1500] }); setSky({ day: 0, milky: 1 }); setStars(1);
    volcMat.uniforms.uGC.value.setRGB(2.6, 0.75, 0.2); steamV.material.uniforms.uLit.value.setRGB(0.35, 0.1, 0.02); followSky(); };

  // ======================= helpers =======================
  const GROUPS = { EARTH, ICE, BLOCK, MTN, CITY, SUNG, SOLAR, MOON, FOREST, UNDER, VENT, VOLC, CAVE };
  const show = (...names) => { for (const k in GROUPS) GROUPS[k].visible = names.includes(k); water.visible = names.includes('ICE') || names.includes('CITY'); sky.visible = true; };
  const label = (x, y, s, a = 1, size = 30, col = '#ffffff') => { if (a <= 0) return; const o = E.o; o.save(); o.font = `600 ${size}px Inter`; o.textAlign = 'center'; o.textBaseline = 'middle';
    { const w0 = o.measureText(s).width; const g = o.createRadialGradient(x, y, 0, x, y, w0 * 0.75 + 40); g.addColorStop(0, `rgba(0,0,0,${0.22 * clamp(a)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = g; o.save(); o.translate(x, y); o.scale(1, (size * 2.6) / (w0 * 1.5 + 80)); o.translate(-x, -y); o.fillRect(x - w0, y - w0, w0 * 2, w0 * 2); o.restore(); }
    o.globalAlpha = clamp(a);
    o.shadowColor = 'rgba(0,0,0,0.75)'; o.shadowBlur = 12; o.fillStyle = col; o.fillText(s, x, y); const w = o.measureText(s).width; o.globalAlpha = clamp(a) * 0.55; o.fillRect(x - w / 2, y + size * 0.72, w, 2); o.restore(); };
  const fadeBlack = (a) => { if (a > 0) { E.o.fillStyle = `rgba(0,0,0,${clamp(a)})`; E.o.fillRect(0, 0, 1080, 1920); } };
  const at = (w, after = 0) => E.at(w, after);
  const atN = (w, n) => { const nm = x => x.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿœæ0-9]/g, ''); const l = E.words.filter(x => nm(x.w) === nm(w)); if (!l[n]) throw new Error('mot ' + w + ' #' + n); return l[n].s; };
  const zoomIn = (d = 0.35, px = 14) => (t, lt) => lt < d ? `blur(${((d - lt) / d * px).toFixed(1)}px)` : null;
  const dipIn = (d = 0.35) => (t, lt) => lt < d ? `brightness(${(0.25 + 0.75 * lt / d).toFixed(2)})` : null;
  const look = (p, tg, fov = 42, roll = 0) => { cam.position.copy(p); cam.fov = fov; cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(tg); cam.rotation.z += roll; };
  const thermo = (t, t0, t1, v0, v1, y = 470, a = 1) => { const v = Math.round(lerp(v0, v1, easeIO(smooth(t0, t1, t)))); label(540, y, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' °C', a, 50, v < -30 ? '#bfe4ff' : '#e6f3ff'); };
  const clock = (t, t0, a, sub) => { const s = Math.max(0, 500 - Math.floor((t - t0) * 60)); const mm = Math.floor(s / 60), ss = s % 60; label(540, 470, `${mm} min ${String(ss).padStart(2, '0')} s`, a, 44, '#ffe1a0'); if (sub) label(540, 525, sub, a * 0.8, 24, '#e6eaf0'); };

  // ======================= temps (calés sur la voix) =======================
  const T = {
    maint: at('maintenant'), pire: at('pire'), pendant: at('Pendant'), n8: at('8'), ciel: at('ciel'), bleu: at('bleu'), cest2: atN("C'est", 1), lumiere: atN("lumière", 0), nous: atN("nous", 0),
    et3: atN("Et", 2), gravite: at('gravité'), alors: atN("Alors", 0), terre: atN("Terre", 0), rien2: atN("rien", 1), puis: at('Puis'), noir: at('noir'), lune: at('Lune'), seteint: at("s'éteint"), renvoyer: at('renvoyer'),
    plus: atN("Plus", 0), retient: at('retient'), la7: atN("La", 4), file: at('file'), droit: at('droit'), n30: at('30'), seconde: at('seconde'),
    et8: atN("Et", 3), froid: at('froid'), semaine: at('semaine'), n18: at('18'), en9: atN("En", 2), an: at('an'), n73: at('73'),
    plantes: at('plantes'), photo: at('photosynthèse'), plupart: at('plupart'), meurent: at('meurent'), mais: atN("Mais", 0), arbres: at('arbres'), decennies: at('décennies'),
    oceans: at('océans'), gelent: at('gèlent'), et13: atN("Et", 4), surprise: at('surprise'), cette: atN("cette", 0), couverture: at('couverture'), dessous: at('dessous'), liquide: at('liquide'),
    tout: atN("Tout", 1), sources: at('sources'), des15: atN("des", 1), bacteries: at('bactéries'), sans: atN("sans", 0), elles: at('Elles'), etnous: atN("Et", 5), scient: at('scientifiques'), sous: atN("sous", 0), chaleur: at('chaleur'), nucl: at('nucléaire'),
    un: atN("Un", 1), volcans: at('volcans'), islande: at("l'Islande"), refuge: at('refuge'),
    et18: atN("Et", 6), millions: at('millions'), environ: at('Environ'), n240: at('240'), meme: at('Même'), air: at("l'air"), geler: at('geler'), neige: at('neige'),
    rassure: at('Rassure-toi'), impossible: at('impossible'), le20: atN("Le", 6), eteindre: atN("s'éteindre", 0), alors21: atN("Alors", 1), soleil3: atN("soleil", 3), sa: atN("sa", 2), partie: at('partie'), n8c: atN("8", 2),
    et23: atN("Et", 8), toi: atN("toi", 0), dis: at('Dis-le'), abonne: at('abonne-toi'),
  };

  const SOLAR_EARTH_ANG = 0.5;   // position de la Terre sur son orbite au début
  const setSolar = (ang, lit, city = 1) => { const p = earthAt(ang); earthSm.position.copy(p); const toSun = SP.clone().sub(p).normalize();
    earthLook({ sun: toSun, dim: lit, amb: lit < 0.5 ? 0.012 : 0, city }); setSolarLook(); spin.rotation.y = 0;
    earthSm.children[0].rotation.y = 1.4; moonSm.position.copy(p).add(V3(Math.cos(ang * 6 + 1) * 9, 1.2, Math.sin(ang * 6 + 1) * 9)); moonUni.uSun.value.copy(toSun); moonUni.uOn.value = lit; moonUni.uAmb.value = 0.004; return p; };
  const setSolarLook = () => { };
  const behind = (p, back, h, tf = 0.45) => { const out = p.clone().normalize(); return [p.clone().add(out.multiplyScalar(back)).add(V3(0, h, 0)), p.clone().multiplyScalar(tf)]; };
  const solarCam = (p, dist, h, side = 1, f = 0.5) => { const mid = p.clone().multiplyScalar(f); const perp = V3(-p.z, 0, p.x).normalize().multiplyScalar(side); return [mid.clone().add(perp.multiplyScalar(dist)).add(V3(0, h, 0)), mid]; };

  const shots = [
    // 1 — ACCROCHE : le Soleil, granulation, taches, protubérances ; au mot « maintenant », le feu se retire et l'étoile s'éteint
    { name: 'soleil', start: 0, noFlash: true,
      update(t, lt, k) { show('SUNG'); sunUni.uT.value = t; const off = smooth(T.maint + 0.15, T.maint + 1.0, t); sunLook(1 - off); const s = easeIO(clamp(t / 3.1));
        look(V3(lerp(-8, 4, s), lerp(5, 2, s), lerp(72, 64, s)), V3(0, 0, 0), 45); corona.lookAt(cam.position); SUNG.rotation.y = t * 0.01; },
      hud(t) { fadeBlack(1 - t / 0.45); } },
    // 2 — TU NE REMARQUERAIS RIEN : la ville au bord de la mer, grand soleil, ciel bleu ; le compte à rebours de 8 min 20 s
    { name: 'ville-jour', start: T.pire, filter: dipIn(0.35),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; cityLook(0); const s = easeIO(k); look(V3(lerp(-300, -260, s), lerp(120, 105, s), lerp(420, 390, s)), V3(20, 70, -160), 44); followSky(); },
      hud(t) { clock(t, T.pendant, ease((t - T.pendant) / 0.4) * 0.92, 'avant que la Terre le remarque'); } },
    // 3 — LE TEMPS QUE MET SA LUMIÈRE : le Soleil s'est éteint mais sa dernière lumière file vers la Terre (front lumineux)
    { name: 'lumiere-voyage', start: T.cest2, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('SOLAR'); sunUni.uT.value = t; solarLook(0); const p = setSolar(SOLAR_EARTH_ANG, 1); const s = easeIO(k);
        const perp = V3(-p.z, 0, p.x).normalize(); const mid = p.clone().multiplyScalar(0.5); look(mid.clone().add(perp.multiplyScalar(lerp(100, 92, s))).add(V3(0, lerp(26, 22, s), 0)), mid, 50);
        const fr0 = lerp(7, ORB + 1, smooth(T.cest2, T.nous + 0.2, t)); for (let i = 0; i < 4; i++) E.ring(i, SP, Math.max(0.1, fr0 - i * 0.8), 0xffc27a, (0.7 - i * 0.15) * (1 - smooth(ORB - 2, ORB + 1, fr0)), V3(0, 1, 0));
      },
      hud(t) { const [x, y] = E.proj(earthSm.position.clone().add(V3(0, 3.2, 0))); label(x, Math.min(Math.max(y - 40, 560), 1220), 'Terre', ease((t - T.cest2 - 0.3) / 0.4) * 0.85, 28); const [sx, sy] = E.proj(SP); label(sx, Math.max(sy - 90, 560), 'Soleil (déjà éteint)', ease((t - T.cest2 - 0.5) / 0.4) * 0.75, 26, '#ffd9a8');
        label(540, 470, '150 millions de km', ease((t - T.lumiere) / 0.4) * 0.9, 34, '#ffe1a0'); } },
    // 4 — SA GRAVITÉ VOYAGE AUSSI VITE : onde gravitationnelle (anneaux) qui part du Soleil éteint
    { name: 'gravite', start: T.et3, filter: dipIn(0.35),
      update(t, lt, k) { show('SOLAR'); sunUni.uT.value = t; solarLook(0); const p = setSolar(SOLAR_EARTH_ANG + lt * 0.01, 1); const s = easeIO(k);
        look(V3(lerp(-10, 0, s), lerp(150, 140, s), lerp(110, 100, s)), V3(0, 0, 8), 48); E.line3(0, orbitPts, 0x8fb5ff, 0.25, 1);
        const g0 = smooth(T.gravite - 0.2, T.alors, t); for (let i = 0; i < 5; i++) E.ring(i, SP, Math.max(0.1, g0 * (ORB + 8) - i * 4), 0xb9d4ff, 0.5 * (1 - i * 0.18) * (1 - smooth(0.85, 1, g0)), V3(0, 1, 0)); },
      hud(t) { label(540, 470, 'gravité : même vitesse que la lumière', ease((t - T.gravite) / 0.4) * 0.85, 30, '#cfe2ff'); } },
    // 5 — LA TERRE CONTINUE DE TOURNER AUTOUR… DE RIEN : vue d'en haut, l'orbite, la Terre toujours éclairée, le centre vide
    { name: 'orbite-vide', start: T.alors, filter: zoomIn(0.35, 12),
      update(t, lt, k) { show('SOLAR'); sunUni.uT.value = t; solarLook(0); sunSmall.visible = coronaS.visible = t < T.rien2 - 0.2; const ang = SOLAR_EARTH_ANG + 0.04 + lt * 0.045; const p = setSolar(ang, 1);
        const s = easeIO(smooth(T.alors, T.rien2 + 0.3, t)); const tgt = p.clone().lerp(SP, s); const perp = V3(-p.z, 0, p.x).normalize(); const c0 = p.clone().add(perp.multiplyScalar(26)).add(p.clone().normalize().multiplyScalar(8)).add(V3(0, 7, 0)); look(c0.lerp(V3(0, 170, 110), s), tgt, 48);
        E.line3(0, orbitPts, 0x8fb5ff, 0.35, 1); },
      hud(t) { label(540, 470, '…autour de rien', ease((t - T.rien2) / 0.35) * 0.9, 34, '#ffffff'); } },
    // 6 — D'UN COUP, C'EST LE NOIR : la même ville, le ciel bleu s'éteint d'un seul coup, les lumières de la ville restent
    { name: 'noir', start: T.puis, filter: dipIn(0.3),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; const m = smooth(T.noir - 0.05, T.noir + 0.25, t);
        if (m < 0.5) cityLook(0); else cityLook(0, 'night');
        if (m > 0 && m < 1) { const u = skyMat.uniforms; u.uDay.value = 1 - m; L.key.intensity *= (1 - m); setStars(m); }
        const s = easeIO(k); look(V3(lerp(-250, -240, s), 95, lerp(380, 370, s)), V3(20, 15, -160), 44); followSky(); },
      hud(t) { fadeBlack(0.85 * (1 - smooth(T.noir, T.noir + 0.6, t)) * smooth(T.noir - 0.05, T.noir, t)); } },
    // 7 — LA LUNE S'ÉTEINT AUSSI : la Lune pleine, puis plus rien que sa silhouette sur les étoiles
    { name: 'lune', start: atN("La", 1), filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('MOON'); const off = smooth(T.seteint + 0.15, T.seteint + 1.3, t); moonLook(1 - off); moonUni.uSun.value.set(0.7, 0.15, 0.7).normalize(); moonUni.uAmb.value = 0.035 * off; const s = easeIO(k);
        look(V3(lerp(-8, 0, s), lerp(1, 2.5, s), lerp(44, 40, s)), V3(0, 0, 0), 42); MOON.rotation.y = 0.4 + t * 0.01; },
      hud(t) { label(540, 470, 'elle renvoie la lumière du Soleil', ease((t - T.renvoyer) / 0.4) * 0.8, 28, '#e6eaf0'); } },
    // 8 — PLUS RIEN NE LA RETIENT : la Terre dans le noir, seules les villes brillent, la Lune à côté
    { name: 'terre-noire', start: T.plus, filter: dipIn(0.35),
      update(t, lt, k) { show('EARTH'); earthLook({ sun: V3(-1, 0, -0.3).normalize(), dim: 0, amb: 0.015 }); cloudMat.uniforms.uT.value = t; spin.rotation.set(0.2, 1.6 + lt * 0.04, 0);
        camDir(V3(0.25, 0.25, 1), lerp(fitD(R, 40, 0.58), fitD(R, 40, 0.66), easeIO(k)), V3(0, 0, 0), 40); },
      hud(t) {} },
    // 9 — LA TERRE FILE TOUT DROIT : vue d'ensemble, l'ancienne orbite en pointillé, la Terre part sur la tangente
    { name: 'tout-droit', start: T.la7, filter: zoomIn(0.35, 12),
      update(t, lt, k) { show('SOLAR'); sunUni.uT.value = t; solarLook(0); sunSmall.visible = true; coronaS.visible = false; const a0 = SOLAR_EARTH_ANG + 0.3; const p0 = earthAt(a0); const tan = V3(-Math.sin(a0), 0, Math.cos(a0));
        const d = smooth(T.file - 0.1, T.seconde + 1.0, t) * 34; const p = p0.clone().add(tan.clone().multiplyScalar(d)); setSolar(a0, 0, 1); earthSm.position.copy(p); moonSm.position.copy(p).add(V3(8, 1, -3));
        earthMat.uniforms.uDim.value = 0; earthMat.uniforms.uAmbE.value = 0.09; moonUni.uOn.value = 0; moonUni.uAmb.value = 0.08;
        look(V3(lerp(-25, -15, k), 135, lerp(120, 110, k)), V3(10, 0, 26), 48);
        E.line3(0, orbitPts, 0x8fb5ff, 0.22, 1); const lp = []; for (let i = 0; i <= 60; i++) lp.push(p0.clone().add(tan.clone().multiplyScalar(i / 60 * d))); E.line3(1, lp, 0xffe1a0, 0.8, 1); },
      hud(t) { const [x, y] = E.proj(earthSm.position); label(x, Math.max(y - 80, 520), '30 km/s', ease((t - T.n30) / 0.4) * 0.92, 34, '#ffe1a0'); label(540, 470, 'tout droit', ease((t - T.droit) / 0.4) * 0.85, 30, '#ffffff'); } },
    // 10 — LE FROID ARRIVE : la ville la nuit, la neige tombe, tout blanchit ; −18 °C en une semaine
    { name: 'froid-ville', start: T.et8, filter: dipIn(0.4),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; cityLook(0, 'night'); seaUni.uSnow.value = smooth(T.et8, T.n18 + 0.9, t); waterMat.uniforms.uFreeze.value = 0.25 * smooth(T.semaine, T.n18 + 0.9 + 0.5, t);
        const s = easeIO(k); look(V3(lerp(-210, -190, s), lerp(90, 80, s), lerp(330, 310, s)), V3(10, 10, -120), 46); followSky(); snowFall(t, 2600, 1.6, 0.05, 26, 0x8a92a0); },
      hud(t) { thermo(t, T.semaine, T.n18 + 0.6, 12, -18, 470, ease((t - T.froid) / 0.4) * 0.95); label(540, 530, 'en une semaine', ease((t - T.semaine) / 0.4) * 0.8, 26, '#e6eaf0'); } },
    // 11 — EN UN AN, −73 °C : vallée de montagne gelée sous les étoiles
    { name: 'un-an', start: T.en9, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('MTN'); mtnLook(); setEnv({ L: V3(0.35, 0.55, 0.7), LC: [0.22, 0.27, 0.4], amb: [0.04, 0.05, 0.08], fog: [0.02, 0.025, 0.045], fogD: [200, 1300] }); setSky({ day: 0, milky: 1 }); setStars(1);
        mtnMat.uniforms.uSnowH.value = -60; glacUni.uFront.value = 260; look(V3(420 - lt * 9, 110, 70), V3(-150, 50, -10), 46); followSky(); starGrp.rotation.set(0, 0, lt * 0.02); },
      hud(t) { thermo(t, T.an - 0.2, T.n73 + 0.5, -18, -73, 470, 0.95); label(540, 530, 'au bout d\'un an', ease((t - T.an) / 0.4) * 0.8, 26, '#e6eaf0'); } },
    // 12 — PLUS DE PHOTOSYNTHÈSE : la prairie et la forêt dans le noir, l'herbe jaunit et meurt
    { name: 'plantes', start: T.plantes, filter: dipIn(0.35),
      update(t, lt, k) { show('FOREST'); ENV.uT.value = t; forestLook(smooth(T.plupart - 0.5, T.semaines + 0.8, t), 0.1 * k); const s = easeIO(k);
        look(V3(GR.x + lerp(-1.0, 0.8, s), fH(0, 7) + lerp(1.5, 1.6, s), 7.5).add(FO), V3(GR.x + 1, fH(0, -30) + 2.5, -34).add(FO), 46); followSky(); },
      hud(t) {} },
    // 13 — LES GRANDS ARBRES TIENNENT : contre-plongée sur les grands conifères, givre, étoiles
    { name: 'grands-arbres', start: T.mais, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('FOREST'); ENV.uT.value = t; forestLook(1, 0.35); const s = easeIO(k);
        look(V3(lerp(-2, 3, s), fH(0, -30) + 2, lerp(-30, -38, s)).add(FO), V3(0, fH(0, -90) + lerp(12, 22, s), -95).add(FO), 50); followSky(); snowFall(t, 900, 0.6, 0.04, 20, 0x7a8290); },
      hud(t) { label(540, 470, 'plusieurs décennies', ease((t - T.decennies) / 0.4) * 0.9, 34, '#ffe1a0'); } },
    // 14 — LES OCÉANS GÈLENT EN SURFACE : la banquise se forme sur la mer, la nuit
    { name: 'ocean-gele', start: T.oceans, filter: dipIn(0.4),
      update(t, lt, k) { show('ICE'); iceLook('day'); ENV.uT.value = t; setEnv({ L: V3(0.3, 0.5, 0.8), LC: [0.25, 0.3, 0.45], amb: [0.05, 0.065, 0.1], fog: [0.025, 0.032, 0.055], fogD: [250, 1300] }); setSky({ day: 0, milky: 1 }); setStars(1);
        waterMat.uniforms.uTop.value.setRGB(0.02, 0.03, 0.05); waterMat.uniforms.uHor.value.setRGB(0.05, 0.06, 0.08); waterMat.uniforms.uFreeze.value = smooth(T.oceans, T.surprise + 0.3, t);
        const s = easeIO(k); look(V3(lerp(160, 120, s), lerp(48, 40, s), lerp(420, 380, s)), V3(-60, 4, 120), 46); followSky(); },
      hud(t) { label(540, 470, 'la mer gèle en surface', ease((t - T.gelent) / 0.4) * 0.85, 30, '#dfeeff'); } },
    // 15 — LA GLACE COMME UNE COUVERTURE : sous la banquise, l'eau reste liquide, la neige marine flotte
    { name: 'sous-glace', start: T.cette, filter: dipIn(0.5),
      update(t, lt, k) { show('UNDER'); underLook(); const s = easeIO(k); look(V3(lerp(-6, 6, s), lerp(-22, -18, s), lerp(30, 18, s)).add(UO), V3(lerp(-2, 4, s), -4, -20).add(UO), 48); followSky(); marineSnow(t, 1800, 18, 0.45); },
      hud(t) { label(540, 470, 'glace', ease((t - T.couverture) / 0.4) * 0.75, 28, '#dfeeff'); label(540, 900, 'eau liquide', ease((t - T.liquide) / 0.4) * 0.85, 32, '#9fd6ff'); } },
    // 16 — TOUT AU FOND : les sources hydrothermales, fumeurs noirs éclairés par les projecteurs
    { name: 'sources', start: T.tout, filter: zoomIn(0.35, 12),
      update(t, lt, k) { show('VENT'); const s = easeIO(k); look(V3(lerp(-26, -20, s), lerp(9, 7, s), lerp(30, 24, s)).add(VO), V3(0, 9, -3).add(VO), 46); ventLook(); updVentSmoke(t); marineSnow(t, 900, 14); },
      hud(t) {} },
    // 17 — DES BACTÉRIES VIVENT SANS LUMIÈRE : gros plan au pied d'une cheminée, tapis bactériens et vers tubicoles
    { name: 'bacteries', start: T.des15, filter: dipIn(0.35),
      update(t, lt, k) { show('VENT'); const s = easeIO(k); look(V3(lerp(-9.5, -8.5, s), lerp(4.0, 3.4, s), lerp(10.5, 9.5, s)).add(VO), V3(-0.5, 1.2, 0.5).add(VO), 44); ventLook(); updVentSmoke(t); marineSnow(t, 1400, 6, 0.25);
        for (let i = 0; i < 0; i++) { const a = rand(i * 9.1) * 6.283, r = 2 + rand(i * 7.3) * 3; const x = Math.cos(a) * r, z = Math.sin(a) * r; E.dot(V3(x, vfH(x, z) + 0.05 + rand(i) * 0.15, z).add(VO), 0.02, 0x2a2a20); } },
      hud(t) { label(540, 470, 'bactéries', ease((t - T.bacteries) / 0.4) * 0.85, 32); label(540, 525, 'elles se nourrissent de chimie, pas de lumière', ease((t - T.sans) / 0.4) * 0.75, 24, '#e6eaf0'); } },
    // 18 — ET NOUS ? sous terre : une galerie creusée dans la roche, éclairée, avec un abri et une serre au fond
    { name: 'abri', start: T.etnous, filter: zoomIn(0.35, 12),
      update(t, lt, k) { show('CAVE'); caveLook(); scene.background.setRGB(0.02, 0.016, 0.012); const s = easeIO(k);
        look(V3(lerp(-1.2, 0.6, s), lerp(0.6, 0.9, s), lerp(-8, -62, s)).add(CO), V3(lerp(0.5, 0.8, s), lerp(0.4, 0.2, s), -118).add(CO), 46, 0.0);
        for (let i = 0; i < 700; i++) { const z = -4 - rand(i * 1.3) * 110, x = (rand(i * 2.1) - 0.5) * 8, y = -1 + rand(i * 3.7) * 5 + Math.sin(t * 0.3 + i) * 0.1; const d = Math.hypot(x - cam.position.x + CO.x, z - cam.position.z + CO.z);
          if (d < 22) E.dot(V3(x + Math.sin(t * 0.2 + i) * 0.2, y, z).add(CO), 0.012, new THREE.Color(0xffc890).multiplyScalar(0.35 * (1 - d / 22))); } },
      hud(t) { label(540, 470, 'chaleur de la Terre · nucléaire', ease((t - T.chaleur) / 0.4) * 0.85, 30, '#ffe1a0'); } },
    // 19 — L'ISLANDE : un volcan la nuit, la lave éclaire les nuages de vapeur, une centrale géothermique au pied
    { name: 'volcan', start: T.un, filter: dipIn(0.35),
      update(t, lt, k) { show('VOLC'); ENV.uT.value = t; volcLook(); updSteam(t); const s = easeIO(k); look(V3(lerp(250, 225, s), lerp(125, 118, s), lerp(230, 205, s)).add(VCO), V3(10, 62, 0).add(VCO), 46); followSky();
        for (let i = 0; i < 400; i++) { const ph = (t * 0.7 + rand(i * 1.3)) % 1; const a = rand(i * 2.7) * 6.283, v = 8 + rand(i * 3.9) * 18; const up = v * ph * 2 - 9.8 * ph * ph * 2;
          if (up < 0) continue; E.dot(V3(Math.cos(a) * ph * 8, vH(0, 0) + 3 + up, Math.sin(a) * ph * 8).add(VCO), 0.5 * (1 - ph), new THREE.Color(1.0, 0.45, 0.1).multiplyScalar(1.4 * (1 - ph))); } },
      hud(t) { label(540, 470, 'Islande : géothermie', ease((t - T.islande) / 0.4) * 0.85, 30, '#ffd9a8'); } },
    // 20 — DANS DES MILLIONS D'ANNÉES : la Terre entièrement gelée, à peine éclairée par les étoiles ; −240 °C
    { name: 'terre-gelee', start: T.et18, filter: zoomIn(0.4, 14),
      update(t, lt, k) { show('EARTH'); earthLook({ sun: V3(-0.6, 0.3, 0.75).normalize(), dim: 0.07, amb: 0.035, freeze: smooth(T.et18, T.n240, t), city: 0, clouds: false }); spin.rotation.set(0.3, 0.6 + lt * 0.03, 0);
        camDir(V3(-0.2, 0.3, 1), lerp(fitD(R, 40, 0.55), fitD(R, 40, 0.64), easeIO(k)), V3(0, 0, 0), 40); E.renderer.toneMappingExposure = 1.15; },
      hud(t) { thermo(t, T.environ - 0.3, T.n240 + 0.6, -73, -240, 470, ease((t - T.environ + 0.4) / 0.4) * 0.95); label(540, 530, 'dans des millions d\'années', ease((t - T.millions) / 0.4) * 0.8, 26, '#e6eaf0'); } },
    // 21 — L'AIR GÈLE ET TOMBE EN NEIGE : plateau polaire sans fin, la neige d'air tombe sous un ciel d'étoiles
    { name: 'neige-air', start: T.meme, filter: dipIn(0.4),
      update(t, lt, k) { show('BLOCK'); blockLook('night', ICE_H, false); E.renderer.toneMappingExposure = 1.1; setEnv({ L: V3(0.4, 0.3, -0.9), LC: [0.16, 0.19, 0.3], amb: [0.05, 0.06, 0.1], fog: [0.015, 0.02, 0.04], fogD: [120, 900] });
        look(V3(-40 + lt * 1.2, ICE_H + 1.6, 40), V3(-60, ICE_H + 9, -20), 48); followSky(); snowFall(t, 3500, 0.8, 0.022, 14, 0x95a0b5, 0.15); starGrp.rotation.set(-1.1, 0, lt * 0.02); },
      hud(t) { label(540, 470, 'l\'air gèle', ease((t - T.geler) / 0.4) * 0.85, 32, '#dfeeff'); } },
    // 22 — RASSURE-TOI : le Soleil se rallume (impossible qu'il s'éteigne d'un coup)
    { name: 'rallume', start: T.rassure, filter: dipIn(0.5),
      update(t, lt, k) { show('SUNG'); sunUni.uT.value = t; sunLook(smooth(T.rassure + 0.2, T.impossible + 0.4, t)); const s = easeIO(k); look(V3(lerp(40, 34, s), lerp(-10, -8, s), lerp(62, 56, s)), V3(0, 0, 0), 45); corona.lookAt(cam.position); },
      hud(t) { label(540, 470, 'physiquement impossible', ease((t - T.impossible) / 0.4) * 0.9, 34, '#ffe1a0'); } },
    // 23 — LE SOLEIL NE PEUT PAS S'ÉTEINDRE D'UN COUP : rase-motte au-dessus du bord, protubérance en contre-jour
    { name: 'protuberance', start: T.le20, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('SUNG'); sunUni.uT.value = t; sunLook(1); E.renderer.toneMappingExposure = 0.7; const s = easeIO(k); look(V3(lerp(-62, -58, s), lerp(14, 18, s), lerp(-20, -10, s)), V3(0, 1, 0), 45); corona.lookAt(cam.position); },
      hud(t) {} },
    // 24 — DEMAIN AU SOLEIL : lever de soleil doré sur la ville au bord de la mer
    { name: 'lever', start: T.alors21, filter: dipIn(0.4),
      update(t, lt, k) { show('CITY'); ENV.uT.value = t; cityLook(0, 'rise'); const s = easeIO(k); look(V3(lerp(80, 60, s), lerp(30, 26, s), lerp(330, 300, s)), V3(0, 22, -300), 44); followSky(); },
      hud(t) {} },
    // 25 — SA LUMIÈRE EST PARTIE IL Y A 8 MINUTES : le Soleil allumé, un front de lumière file vers la Terre
    { name: 'huit-minutes', start: T.sa, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('SOLAR'); sunUni.uT.value = t; solarLook(1); const p = setSolar(SOLAR_EARTH_ANG, 1); const s = easeIO(k);
        const perp = V3(-p.z, 0, p.x).normalize(); const mid = p.clone().multiplyScalar(0.5); look(mid.clone().add(perp.multiplyScalar(lerp(92, 100, s))).add(V3(0, lerp(20, 24, s), 0)), mid, 50); const ph = (lt * 0.45) % 1; for (let i = 0; i < 3; i++) { const r = 7 + ((ph + i / 3) % 1) * (ORB - 6); E.ring(i, SP, r, 0xffd08a, 0.45 * Math.sin(Math.PI * (r - 7) / (ORB - 6)), V3(0, 1, 0)); } },
      hud(t) { label(540, 470, '8 min 20 s de voyage', ease((t - T.partie) / 0.4) * 0.92, 36, '#ffe1a0'); } },
    // 26 — QUESTION FINALE : la Terre de jour, le soleil apparaît au ras de l'horizon
    { name: 'final', start: T.et23, filter: dipIn(0.4),
      update(t, lt, k) { show('EARTH'); earthLook({ sun: V3(0.95, 0.2, -0.3).normalize() }); cloudMat.uniforms.uT.value = t; spin.rotation.set(0, 0.3 + lt * 0.04, 0);
        camDir(V3(-0.25, 0.1, 1), lerp(fitD(R, 40, 0.56), fitD(R, 40, 0.62), easeIO(k)), V3(0, 0, 0), 40); },
      hud(t) { label(540, 470, 'Tu survivrais combien de temps ?', ease((t - T.toi) / 0.5) * 0.95, 40, '#ffffff'); fadeBlack(smooth(E.TOTAL - 0.9, E.TOTAL, t)); } },
  ];
  T.semaines = at('semaines');

  shots.forEach(sh => { const u = sh.update; sh.update = (t, lt, k) => { E.bloom.threshold = 0.88; E.bloom.strength = 0.32; E.bloom.radius = 0.5; chunk.visible = false; waterMat.uniforms.uFreeze.value = 0; seaUni.uSnow.value = 0;
    sunSmall.visible = coronaS.visible = true; starGrp.rotation.set(0, 0, 0); scene.background.setRGB(0, 0, 0); u(t, lt, k); if (scene.background.r > 0.001 || scene.background.g > 0.001) sky.visible = false; corona.lookAt(cam.position); coronaS.lookAt(cam.position); }; });
  const sfx = [
    { t: T.maint + 0.1, type: 'rise' }, { t: T.maint + 0.9, type: 'boom' }, { t: T.pendant + 0.1, type: 'click' }, { t: T.lumiere, type: 'pop' }, { t: T.gravite, type: 'rise' }, { t: T.rien2, type: 'pop' },
    { t: T.noir, type: 'boom' }, { t: T.seteint + 0.1, type: 'click' }, { t: T.n30, type: 'pop' }, { t: T.n18, type: 'ding' }, { t: T.n73, type: 'boom' }, { t: T.decennies, type: 'pop' },
    { t: T.surprise, type: 'rise' }, { t: T.liquide, type: 'ding' }, { t: T.bacteries, type: 'pop' }, { t: T.islande, type: 'pop' }, { t: T.n240, type: 'boom' }, { t: T.impossible, type: 'ding' }, { t: T.n8c, type: 'pop' },
  ];
  return { shots, sfx };
}
