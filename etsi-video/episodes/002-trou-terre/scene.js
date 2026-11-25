// Épisode 002 – Et si tu creusais un trou à travers la Terre et que tu sautais dedans ?
// Style classic photoréaliste. Zones (show) : CUT (Terre en coupe r=10, couches, tunnel), SHAFT (puits dans la campagne),
// KOLA (couvercle rouillé dans la toundra), TUBE (intérieur du tunnel de verre), FIG (personnage), SUNG (Soleil), ROOM (salon), PEND (pendule).
export async function build(E) {
  const { THREE, V3, clamp, ease, easeIO, lerp, rand } = E;
  const scene = E.scene, cam = E.camera;
  E.mood('space');
  E.bloom.threshold = 0.88; E.bloom.strength = 0.4; E.bloom.radius = 0.5;
  const DEG = Math.PI / 180;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const NOISE = `
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
    float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.07 + vec3(4.7, 1.2, 8.1); a *= 0.5; } return s / 0.875; }
    float craters(vec3 p){ vec3 i = floor(p), f = fract(p); float h = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
        vec3 g = vec3(float(x), float(y), float(z)); vec3 o = vec3(hash(i + g), hash(i + g + 7.1), hash(i + g + 3.3));
        float r = 0.18 + 0.32 * hash(i + g + 5.7); float d = length(g + o - f) / r;
        h += d < 1.0 ? (d * d - 1.0) * 0.7 : (d < 1.5 ? 0.22 * (1.0 - (d - 1.0) / 0.5) : 0.0); }
      return h; }
    vec3 bumpN(vec3 pos, vec3 n, float h, float k){ vec3 sx = dFdx(pos), sy = dFdy(pos); vec3 r1 = cross(sy, n), r2 = cross(n, sx);
      float det = dot(sx, r1); vec3 g = sign(det) * (dFdx(h) * k * r1 + dFdy(h) * k * r2); return normalize(abs(det) * n - g); }`;
  const VS = `varying vec3 vP; varying vec3 vN; varying vec3 vW;
    void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const SUN_DIR = V3(1, 0.12, 0.45).normalize();
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uCity: { value: 1 } },
    vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uCity; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP);
        float h = fbm(p * 2.1 + vec3(3.1, 1.7, 0.4) + (fbm(p * 4.0 + 2.0) - 0.5) * 0.9); float det = fbm(p * 11.0); float lat = abs(p.y);
        float land = smoothstep(0.525, 0.545, h + det * 0.03);
        vec3 ocean = mix(vec3(0.003, 0.014, 0.045), vec3(0.008, 0.05, 0.10), smoothstep(0.38, 0.53, h));
        vec3 green = mix(vec3(0.03, 0.08, 0.02), vec3(0.07, 0.11, 0.035), det);
        vec3 desert = mix(vec3(0.36, 0.25, 0.13), vec3(0.50, 0.38, 0.22), det);
        float dry = smoothstep(0.48, 0.66, fbm(p * 2.6 + 7.0)) * (1.0 - smoothstep(0.35, 0.6, lat));
        vec3 lc = mix(green, desert, dry); lc = mix(lc, vec3(0.16, 0.14, 0.11), smoothstep(0.62, 0.74, h + det * 0.1));
        float ice = smoothstep(0.80, 0.86, lat + (det - 0.5) * 0.12);
        vec3 col = mix(ocean, lc, land); col = mix(col, vec3(0.80, 0.84, 0.90), ice);
        vec3 N = normalize(vN); vec3 Nb = bumpN(vW, N, land * (h + det * 0.4), 0.35);
        vec3 L = normalize(uSun); vec3 V = normalize(cameraPosition - vW);
        float ndl = dot(Nb, L), ndl0 = dot(N, L);
        float diff = clamp(ndl, 0.0, 1.0) * smoothstep(-0.08, 0.12, ndl0);
        vec3 c = col * diff * 2.2;
        float spec = pow(max(dot(N, normalize(L + V)), 0.0), 260.0) * (1.0 - land) * (1.0 - ice) + pow(max(dot(N, normalize(L + V)), 0.0), 30.0) * (1.0 - land) * 0.04;
        c += vec3(1.0, 0.92, 0.8) * spec * 0.45 * smoothstep(0.0, 0.2, ndl0);
        float term = smoothstep(-0.1, 0.05, ndl0) * (1.0 - smoothstep(0.05, 0.3, ndl0));
        c += vec3(0.20, 0.07, 0.02) * term * 0.08;
        float night = 1.0 - smoothstep(-0.12, 0.04, ndl0);
        float city = step(0.7, noise(p * 90.0)) * smoothstep(0.45, 0.7, fbm(p * 8.0 + 2.0)) * land * (1.0 - ice) * (1.0 - dry * 0.7);
        c += vec3(1.0, 0.62, 0.25) * city * night * 0.9 * uCity;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        c += vec3(0.25, 0.5, 1.0) * fr * smoothstep(-0.2, 0.4, ndl0) * 0.9;
        gl_FragColor = vec4(c, 1.0); }` });
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uT: { value: 0 } }, vertexShader: VS, transparent: true, depthWrite: false,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP); vec3 q = p * 3.2 + vec3(uT * 0.01, 0.0, 0.0);
        float w = fbm(q + fbm(q * 1.5) * 1.4); float a = smoothstep(0.50, 0.74, w) * (0.75 + 0.25 * fbm(p * 20.0));
        a *= 1.0 - smoothstep(0.75, 0.95, abs(p.y)) * 0.6;
        float ndl = dot(normalize(vN), normalize(uSun)); float diff = smoothstep(-0.1, 0.5, ndl);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (0.02 + 2.0 * diff * clamp(ndl + 0.15, 0.0, 1.0)), a * 0.92); }` });
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() } }, vertexShader: VS, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 uSun; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = -normalize(vN);
        float rim = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 1.6); float lit = smoothstep(-0.35, 0.5, dot(-N, normalize(uSun)));
        float a = smoothstep(0.0, 0.35, abs(dot(N, V)));
        gl_FragColor = vec4(mix(vec3(0.5, 0.35, 0.3), vec3(0.25, 0.5, 1.0), smoothstep(-0.25, 0.2, dot(-N, normalize(uSun)))) * a * lit * 1.1 * (1.0 - rim * 0.3), 1.0); }` });
  // ======================= ciel (dôme + étoiles) =======================
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: 0 }, uSpace: { value: 1 }, uSun: { value: SUN_DIR.clone() }, uMoon: { value: V3(0, 0.3, 1).normalize() }, uMoonK: { value: 1 }, uMilky: { value: 0.6 }, uWarm: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uDay; uniform float uSpace; uniform vec3 uSun; uniform vec3 uMoon; uniform float uMoonK; uniform float uMilky; uniform float uWarm; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 night = mix(vec3(0.008, 0.015, 0.036), vec3(0.0015, 0.003, 0.009), smoothstep(-0.05, 0.6, y));
        night += vec3(0.03, 0.045, 0.09) * pow(max(dot(d, normalize(uMoon)), 0.0), 8.0) * uMoonK;
        night += vec3(0.008, 0.013, 0.028) * uMoonK * (1.0 - smoothstep(0.0, 0.5, y));
        vec3 day = mix(vec3(0.42, 0.58, 0.82), vec3(0.06, 0.18, 0.52), smoothstep(-0.02, 0.5, y));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        day += vec3(1.0, 0.7, 0.4) * pow(sd, 16.0) * 0.35 + vec3(1.0, 0.85, 0.6) * pow(sd, 400.0) * 0.8;
        vec3 warm = vec3(0.9, 0.42, 0.15) * pow(1.0 - clamp(y, 0.0, 1.0), 6.0) * uWarm;
        vec3 c = mix(night, day, uDay) + warm;
        vec3 bn = normalize(vec3(0.3, 0.55, -0.78)); float band = exp(-pow(dot(d, bn), 2.0) * 22.0);
        float mw = band * (0.35 + fbm(d * 6.0)) * smoothstep(0.35, 0.75, fbm(d * 3.0 + 5.0) + 0.25) ;
        float dust = band * smoothstep(0.55, 0.7, fbm(d * 9.0 + 1.0));
        c += (vec3(0.11, 0.10, 0.12) * mw - vec3(0.04) * dust * mw) * uMilky * (1.0 - uDay);
        c = max(c, 0.0);
        c = mix(c, vec3(0.0) + vec3(0.12, 0.11, 0.14) * mw * uMilky + vec3(0.01, 0.006, 0.02) * fbm(d * 2.5), uSpace);
        float horizonCut = uSpace > 0.5 ? 1.0 : 1.0;
        gl_FragColor = vec4(c * horizonCut, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), skyMat); sky.renderOrder = -10; scene.add(sky);
  const starGrp = new THREE.Group(); scene.add(starGrp);
  const mkStars = (n, size, seed, R) => {
    const g = new THREE.BufferGeometry(), pos = [], col = [];
    for (let i = 0; i < n; i++) {
      const u = rand(i * 3.1 + seed) * 2 - 1, a = rand(i * 7.3 + seed + 1) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.push(Math.cos(a) * s * R, u * R, Math.sin(a) * s * R);
      const k = 0.35 + 0.65 * Math.pow(rand(i + seed * 3), 3), tint = rand(i * 1.7 + seed);
      const c = new THREE.Color().setRGB(tint < 0.3 ? 1 : 0.8, 0.85, tint > 0.75 ? 1 : 0.85).multiplyScalar(k);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
    const pts = new THREE.Points(g, m); pts.renderOrder = -9; starGrp.add(pts); return pts;
  };
  const starsS = mkStars(5000, 1.3, 1, 950), starsB = mkStars(500, 2.4, 9, 950);
  const setStars = k => { starsS.material.opacity = clamp(k); starsB.material.opacity = clamp(k); starGrp.visible = k > 0.01; };
  const coronaMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 }, uT: { value: 0 }, uStreak: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uK; uniform float uT; uniform float uStreak; varying vec2 vU; void main(){ float r = length(vU); float a = atan(vU.y, vU.x);
      float st = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, uT * 0.05)) ; float streak = pow(st, 2.0) * 2.2;
      float g = exp(-(r - 0.18) * 9.0) * (0.6 + streak * uStreak) + exp(-r * 3.0) * 0.25;
      g *= smoothstep(0.17, 0.2, r) * (1.0 - smoothstep(0.85, 1.0, r));
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * g * uK, 1.0); }` });  const followSky = () => { sky.position.copy(cam.position); starGrp.position.copy(cam.position); };
  const setSky = (o) => { const u = skyMat.uniforms; u.uDay.value = o.day ?? 0; u.uSpace.value = o.space ?? 0; u.uMoonK.value = o.moonK ?? 0; u.uMilky.value = o.milky ?? 0.5; u.uWarm.value = o.warm ?? 0;
    if (o.sun) u.uSun.value.copy(o.sun); if (o.moon) u.uMoon.value.copy(o.moon); };
  const L = E.lights;
  const lightsOff = () => { L.key.intensity = 0; L.hemi.intensity = 0; L.rim.intensity = 0; };

  // ======================= textures canvas (béton, rouille, bois, plâtre) =======================
  const canvasTex = (w, h, draw, rep = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t; };
  const speckle = (g, w, h, n, cols, smin, smax, a = 0.5) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * rand(i * 1.3 + 0.2); g.fillStyle = cols[i % cols.length];
    const s = smin + rand(i * 2.7) * (smax - smin); g.beginPath(); g.ellipse(rand(i * 3.1) * w, rand(i * 5.9) * h, s, s * (0.5 + rand(i)), rand(i * 7) * 3, 0, 6.3); g.fill(); } g.globalAlpha = 1; };
  const concreteTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#77736b'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, ['#5f5b54', '#8a867d', '#6b665d', '#4b4741'], 20, 120, 0.25); speckle(g, w, h, 6000, ['#3d3a35', '#9a968c'], 1, 3, 0.6);
    g.strokeStyle = 'rgba(30,28,25,0.55)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); let x = rand(i * 9) * w, y = rand(i * 4) * h; g.moveTo(x, y);
      for (let j = 0; j < 14; j++) { x += (rand(i * 31 + j) - 0.5) * 90; y += (rand(i * 17 + j * 3) - 0.3) * 70; g.lineTo(x, y); } g.stroke(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(60,50,35,0)'); gr.addColorStop(1, 'rgba(60,50,35,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const rustTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#5a2e17'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1400, ['#7a3a17', '#3b1d0e', '#8f4a1f', '#4a2a1a', '#6b5a48'], 10, 90, 0.35); speckle(g, w, h, 9000, ['#2a140a', '#a05a2a', '#c07a3a'], 1, 4, 0.5); });
  const woodTex = canvasTex(1024, 1024, (g, w, h) => { for (let i = 0; i < 8; i++) { const y = i * h / 8; g.fillStyle = ['#4a3020', '#55372a', '#43291b', '#5a3b26'][i % 4]; g.fillRect(0, y, w, h / 8);
      for (let k = 0; k < 160; k++) { g.globalAlpha = 0.12; g.fillStyle = rand(i * 100 + k) > 0.5 ? '#2a170c' : '#7a5236'; g.fillRect(0, y + rand(i * 50 + k * 3) * h / 8, w, 1 + rand(k) * 2); }
      g.globalAlpha = 1; g.fillStyle = '#1a0f08'; g.fillRect(0, y, w, 3); g.fillRect(rand(i * 7) * w, y, 3, h / 8); } }, 6);
  const plasterTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#2b2a2e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#232227', '#36353a', '#2f2e33'], 2, 18, 0.4); }, 4);

  // ======================= terrain générique (relief + trou central optionnel) =======================
  const n2 = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const h = (a, b) => rand(a * 57.3 + b * 131.7 + 7.1); return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v); };
  const f2 = (x, z) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * n2(x, z); x = x * 2.02 + 3.1; z = z * 2.02 + 1.7; a *= 0.5; } return s / 0.97; };
  const groundMat = () => new THREE.ShaderMaterial({
    uniforms: { uL: { value: V3(0.5, 0.4, 0.3).normalize() }, uLC: { value: new THREE.Color(1.6, 1.4, 1.1) }, uAmb: { value: new THREE.Color(0.2, 0.24, 0.3) },
      uFog: { value: new THREE.Color(0.55, 0.62, 0.72) }, uFogD: { value: new THREE.Vector2(60, 700) }, uTundra: { value: 0 }, uRim: { value: 1 } },
    vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uL; uniform vec3 uLC; uniform vec3 uAmb; uniform vec3 uFog; uniform vec2 uFogD; uniform float uTundra; uniform float uRim;
      varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 w = vW; float d1 = fbm(vec3(w.xz * 0.06, 0.0)), d2 = fbm(vec3(w.xz * 0.5, 1.0)), d3 = fbm(vec3(w.xz * 3.0, 2.0)), d4 = noise(vec3(w.xz * 5.0, 3.0));
        vec3 grass = mix(vec3(0.06, 0.10, 0.03), vec3(0.17, 0.17, 0.06), d1); grass = mix(grass, vec3(0.20, 0.16, 0.07), smoothstep(0.55, 0.7, d2) * 0.6);
        vec3 moss = mix(vec3(0.16, 0.15, 0.09), vec3(0.28, 0.24, 0.14), d1); moss = mix(moss, vec3(0.36, 0.20, 0.10), smoothstep(0.6, 0.72, d2) * 0.7);
        vec3 col = mix(grass, moss, uTundra);
        vec3 soil = mix(vec3(0.12, 0.09, 0.06), vec3(0.25, 0.20, 0.14), d3);
        float rr = length(w.xz); float near = 1.0 - smoothstep(4.0, 9.0 + 4.0 * d2, rr);
        col = mix(col, soil, clamp(smoothstep(0.58, 0.72, d2) * 0.7 + near * 0.8 * uRim, 0.0, 1.0));
        float grav = smoothstep(5.8, 4.4, rr + d3) * uRim; col = mix(col, vec3(0.30, 0.29, 0.27) * (0.6 + 0.6 * noise(vec3(w.xz * 7.0, 9.0))), grav);
        float snow = smoothstep(0.62, 0.66, fbm(vec3(w.xz * 0.12, 7.0)) + d3 * 0.08) * uTundra; col = mix(col, vec3(0.78, 0.80, 0.84), snow);
        col *= 0.65 + 0.55 * d3 + 0.25 * (d4 - 0.5);
        vec3 N = bumpN(w, normalize(vN), d3 * 0.25 + d4 * 0.06 + d2 * 0.4, 1.0);
        float ndl = max(dot(N, normalize(uL)), 0.0); vec3 c = col * (uAmb + uLC * ndl);
        float fd = smoothstep(uFogD.x, uFogD.y, length(w - cameraPosition)); c = mix(c, uFog, fd);
        gl_FragColor = vec4(c, 1.0); }` });
  const mkTerrain = (holeR, mat, flatR = 30) => {
    const NR = 150, NA = 220, pos = [], idx = [];
    for (let i = 0; i <= NR; i++) { const r = holeR + Math.pow(i / NR, 2.2) * 900; for (let j = 0; j <= NA; j++) { const a = j / NA * Math.PI * 2; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const far = smooth(flatR, flatR * 6, r); const y = (f2(x / 40, z / 40) - 0.5) * 1.2 * smooth(holeR + 3, holeR + 12, r) + far * (f2(x / 180 + 3, z / 180) - 0.3) * 70; pos.push(x, y, z); } }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, mat); };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler();
  const mkRocks = (n, rMin, rMax, mat, seed = 1, size = 0.35) => { const geo = new THREE.IcosahedronGeometry(1, 2); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 0.75 + 0.5 * n2(v.x * 2 + 5, v.z * 2 + v.y * 3); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * 0.6, v.z); } geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) { const a = rand(i * 3.3 + seed) * 6.283, r = rMin + Math.pow(rand(i * 7.1 + seed), 1.6) * (rMax - rMin); const s = size * (0.2 + Math.pow(rand(i * 1.9 + seed), 3) * 1.6);
      M.compose(V3(Math.cos(a) * r, s * 0.15, Math.sin(a) * r), Q.setFromEuler(EU.set(rand(i) * 3, rand(i * 2) * 6, rand(i * 4) * 3)), V3(s, s, s)); im.setMatrixAt(i, M); }
    return im; };

  // ======================= TERRE EN COUPE (CUT) =======================
  const R = 10;
  earthMat.uniforms.uCutK = { value: 0 }; cloudMat.uniforms.uCutK = { value: 0 };
  const CUT_GLSL = 'uniform float uCutK; void main(){ vec3 p = normalize(vP); if (vP.x > 0.0 && vP.z > 0.0 && atan(vP.z, vP.x) < uCutK * 1.5708) discard;';
  earthMat.fragmentShader = earthMat.fragmentShader.replace('void main(){ vec3 p = normalize(vP);', CUT_GLSL);
  cloudMat.fragmentShader = cloudMat.fragmentShader.replace('void main(){ vec3 p = normalize(vP);', CUT_GLSL);
  const layerMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uDense: { value: 0 }, uGlow: { value: 1 }, uCutK: { value: 0 } }, vertexShader: VS, side: THREE.DoubleSide,
    fragmentShader: NOISE + `uniform float uT; uniform float uDense; uniform float uGlow; uniform float uCutK; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ float r = length(vP) / 10.0; vec3 q = vP * 0.35;
        vec3 c;
        if (r > 0.972) { c = mix(vec3(0.10, 0.085, 0.07), vec3(0.24, 0.20, 0.15), fbm(q * 9.0)) * (0.8 + 0.4 * fbm(vec3(r * 300.0, q.y, 0.0))); }
        else if (r > 0.545) { float m = (0.972 - r) / 0.427; float conv = fbm(q * 1.3 + vec3(0.0, -uT * 0.03, uT * 0.01) + fbm(q * 2.2 + 4.0) * 1.6);
          c = mix(vec3(0.20, 0.035, 0.012), vec3(0.85, 0.27, 0.05), pow(m, 1.4)) * (0.45 + 0.95 * conv); c += vec3(0.25, 0.05, 0.0) * smoothstep(0.62, 0.75, conv) * m; }
        else if (r > 0.19) { float m = (0.545 - r) / 0.355; vec3 qq = q * 2.2; float sw = fbm(qq + vec3(uT * 0.09, 0.0, -uT * 0.06) + fbm(qq * 1.7 + uT * 0.05) * 2.2);
          c = mix(vec3(0.80, 0.30, 0.04), vec3(1.0, 0.52, 0.13), m) * (0.55 + 0.75 * sw * sw + 0.2 * sw); }
        else { float m = 1.0 - r / 0.19; float cr = fbm(q * 7.0); float fac = abs(fract(cr * 6.0) - 0.5);
          c = mix(vec3(0.92, 0.52, 0.18), vec3(1.0, 0.66, 0.30), m) * (0.75 + 0.35 * cr + 0.15 * fac); }
        float b = min(min(abs(r - 0.972), abs(r - 0.545)), abs(r - 0.19)); c *= 0.6 + 0.4 * smoothstep(0.0, 0.006, b);
        c *= uGlow; c = mix(c, c * vec3(1.25, 1.12, 1.0), uDense * (1.0 - smoothstep(0.53, 0.56, r)));
        c *= 1.0 - 0.25 * smoothstep(0.985, 1.0, r);
        gl_FragColor = vec4(c, 1.0); }` });
  const CUT = new THREE.Group(); scene.add(CUT);
  const cutG = new THREE.Group(); CUT.add(cutG);
  const earthS = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), earthMat); cutG.add(earthS);
  const cloudS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 128, 64), cloudMat); cutG.add(cloudS);
  const atmoS = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 96, 48), atmoMat); CUT.add(atmoS);
  const faceA = new THREE.Mesh(new THREE.CircleGeometry(R * 0.999, 256, -Math.PI / 2, Math.PI).rotateY(-Math.PI / 2), layerMat); cutG.add(faceA); faceA.renderOrder = 1;
  const faceB = new THREE.Mesh(new THREE.CircleGeometry(R * 0.999, 256, -Math.PI / 2, Math.PI), layerMat); cutG.add(faceB);
  const tunnelMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, R * 2.06, 16, 1, true), tunnelMat); cutG.add(tunnel);
  const tunnelCore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, R * 2.06, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); cutG.add(tunnelCore);
  const youDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); cutG.add(youDot);
  const youHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: E.radialTex('rgba(170,220,255,0.9)', 'rgba(120,180,255,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); cutG.add(youHalo);
  const setYou = (y, vis = true) => { youDot.visible = youHalo.visible = vis; youDot.position.set(0.14, y, 0.14); youHalo.position.copy(youDot.position); youHalo.lookAt(cam.position); };
  const cutLook = (cutK = 1, sun = V3(-0.3, 0.35, 1).normalize()) => {
    E.renderer.toneMappingExposure = 0.95; scene.fog = null; setSky({ space: 1, milky: 0.7 }); setStars(1); lightsOff(); followSky();
    [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(sun)); earthMat.uniforms.uCutK.value = cloudMat.uniforms.uCutK.value = layerMat.uniforms.uCutK.value = cutK;
    faceA.visible = faceB.visible = cutK > 0.001; faceA.rotation.y = Math.PI / 2 - cutK * Math.PI / 2; tunnelMat.opacity = 0; tunnelCore.material.opacity = 0; youDot.visible = youHalo.visible = false; layerMat.uniforms.uDense.value = 0; layerMat.uniforms.uGlow.value = 1;
    cutG.rotation.set(0, 0, 0); CUT.position.set(0, 0, 0); CUT.scale.setScalar(1); };
  const camDir = (dir, dist, look = V3(0, 0, 0), fov = 42) => { cam.position.copy(look).add(dir.clone().normalize().multiplyScalar(dist)); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(look); };
  const fitD = (r, fov, frac = 0.62) => 0.8 * r / frac / Math.tan(Math.atan(Math.tan(fov * DEG / 2) * 1080 / 1920));
  // direction de vue standard sur la coupe (dans le quartier enlevé)
  const CUTDIR = V3(1, 0.32, 1);

  // ======================= PUITS (SHAFT) : trou parfait dans la campagne =======================
  const SHAFT = new THREE.Group(); scene.add(SHAFT);
  const HOLE = 3;
  const gMat = groundMat(); const terrain = mkTerrain(HOLE + 2.3, gMat); SHAFT.add(terrain);
  const apronMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 });
  const apron = new THREE.Mesh(new THREE.RingGeometry(HOLE, HOLE + 2.4, 128, 2).rotateX(-Math.PI / 2), apronMat); apron.position.y = 0.02; SHAFT.add(apron);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.12, 0.16, 24, 160).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x8d9196, metalness: 0.9, roughness: 0.32, clearcoat: 0.3, envMapIntensity: 0.8 })); collar.position.y = 0.1; SHAFT.add(collar);
  const boltI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x5a5e63, metalness: 0.9, roughness: 0.4 }), 48);
  for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; M.compose(V3(Math.cos(a) * (HOLE + 0.55), 0.05, Math.sin(a) * (HOLE + 0.55)), Q.identity(), V3(1, 1, 1)); boltI.setMatrixAt(i, M); } SHAFT.add(boltI);
  const wallMat = new THREE.ShaderMaterial({ uniforms: { uTop: { value: 1 }, uLC: { value: new THREE.Color(1, 0.95, 0.9) }, uLights: { value: 1 } }, vertexShader: VS, side: THREE.BackSide,
    fragmentShader: NOISE + `uniform float uTop; uniform vec3 uLC; uniform float uLights; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ float y = vW.y; float a = atan(vW.z, vW.x); vec3 p = vec3(cos(a) * 3.0, y, sin(a) * 3.0);
        float strata = fbm(vec3(p.x * 0.25, y * 0.9, p.z * 0.25)); float det = fbm(p * 2.5);
        vec3 conc = mix(vec3(0.30, 0.29, 0.27), vec3(0.42, 0.40, 0.37), det) * (0.8 + 0.3 * strata);
        float seam = 1.0 - smoothstep(0.0, 0.05, abs(fract(y / 4.0) - 0.5) - 0.45) * 0.0; float sm = smoothstep(0.47, 0.5, abs(fract(y / 4.0) - 0.5));
        float vs = smoothstep(0.485, 0.5, abs(fract(a / 6.2832 * 24.0) - 0.5));
        vec3 col = conc * (1.0 - 0.45 * max(sm, vs * 0.6)) * (0.7 + 0.45 * fbm(vec3(a * 9.0, y * 0.12, 1.0))) * (0.85 + 0.2 * noise(vec3(a * 60.0, y * 3.0, 0.0)));
        float lr = abs(fract(y / 14.0 + 0.5) - 0.5) * 14.0; float lamp = exp(-lr * lr * 30.0) * step(0.3, fract(a / 6.2832 * 12.0)) * uLights;
        float top = exp(y / 22.0) * uTop; float local = uLights * (0.05 + 0.6 * exp(-lr * 0.5));
        vec3 c = col * (top * uLC + local * vec3(1.0, 0.86, 0.66) * 0.55 + 0.004) + vec3(1.0, 0.9, 0.75) * lamp * 0.9;
        c *= 1.0 - smoothstep(-160.0, -300.0, y);
        gl_FragColor = vec4(c, 1.0); }` });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HOLE, HOLE, 320, 96, 1, true), wallMat); wall.position.y = -160; SHAFT.add(wall);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a554e, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
  const rocks = mkRocks(260, HOLE + 2.6, 40, rockMat, 3, 0.45); SHAFT.add(rocks);
  // barrières de chantier + projecteur
  const postMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), postMat); p.position.set(Math.cos(a) * (HOLE + 2.2), 0.55, Math.sin(a) * (HOLE + 2.2)); SHAFT.add(p); }
  { const pts = []; for (let i = 0; i <= 140; i++) { const a = i / 140 * 6.283; pts.push(V3(Math.cos(a) * (HOLE + 2.2), 1.05, Math.sin(a) * (HOLE + 2.2))); }
    SHAFT.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 280, 0.025, 6, true), postMat)); }
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const NG = 14000; const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.018, 0.32, 3, 1).translate(0, 0.16, 0), grassMat, NG); SHAFT.add(grass);
  for (let i = 0; i < NG; i++) { const a = rand(i * 1.1) * 6.283, r = Math.sqrt(rand(i * 2.3)) * 11; const x = -27 + Math.cos(a) * r, z = 14 + Math.sin(a) * r; const h = 0.5 + rand(i * 3.7) * 1.1;
    M.compose(V3(x, (f2(x / 40, z / 40) - 0.5) * 1.2 - 0.03, z), Q.setFromEuler(EU.set((rand(i * 5) - 0.5) * 0.6, rand(i) * 6, (rand(i * 7) - 0.5) * 0.6)), V3(1, h, 1)); grass.setMatrixAt(i, M);
    const c = new THREE.Color().setRGB(0.10 + rand(i * 9) * 0.10, 0.16 + rand(i * 4) * 0.12, 0.04 + rand(i * 6) * 0.04); if (rand(i * 8) > 0.85) c.setRGB(0.32, 0.27, 0.12); grass.setColorAt(i, c); }
  const shaftLook = (mode) => { grass.visible = false;   // 'dusk' | 'day' (autre côté)
    lightsOff(); setStars(mode === 'dusk' ? 0.35 : 0); const u = gMat.uniforms;
    if (mode === 'dusk') { const sd = V3(-0.8, 0.12, -0.5).normalize(); u.uL.value.copy(sd); u.uLC.value.setRGB(1.25, 0.72, 0.42); u.uAmb.value.setRGB(0.10, 0.11, 0.17); u.uFog.value.setRGB(0.42, 0.33, 0.33); u.uFogD.value.set(40, 650);
      setSky({ day: 0.55, warm: 0.9, sun: sd, milky: 0.2 }); L.key.color.setRGB(1, 0.66, 0.4); L.key.intensity = 1.6; L.key.position.copy(sd.clone().multiplyScalar(100)); L.hemi.color.setRGB(0.45, 0.5, 0.7); L.hemi.groundColor.setRGB(0.12, 0.1, 0.08); L.hemi.intensity = 0.55;
      E.renderer.toneMappingExposure = 1.05; wallMat.uniforms.uLC.value.setRGB(0.42, 0.34, 0.3); }
    else { const sd = V3(0.45, 0.75, 0.3).normalize(); u.uL.value.copy(sd); u.uLC.value.setRGB(1.7, 1.55, 1.3); u.uAmb.value.setRGB(0.24, 0.28, 0.36); u.uFog.value.setRGB(0.62, 0.70, 0.80); u.uFogD.value.set(80, 800);
      setSky({ day: 1, warm: 0.05, sun: sd }); L.key.color.setRGB(1, 0.95, 0.85); L.key.intensity = 2.4; L.key.position.copy(sd.clone().multiplyScalar(100)); L.hemi.color.setRGB(0.65, 0.75, 0.95); L.hemi.groundColor.setRGB(0.3, 0.27, 0.2); L.hemi.intensity = 0.8;
      E.renderer.toneMappingExposure = 0.85; wallMat.uniforms.uLC.value.setRGB(0.55, 0.53, 0.5); }
    gMat.uniforms.uTundra.value = 0; scene.fog = null; followSky(); };

  // ======================= KOLA : couvercle rouillé dans la toundra =======================
  const KOLA = new THREE.Group(); scene.add(KOLA);
  const kMat = groundMat(); kMat.uniforms.uTundra.value = 1; kMat.uniforms.uRim.value = 0; const kTer = mkTerrain(0.01, kMat, 40); KOLA.add(kTer);
  const slab = new THREE.Mesh(new E.RoundedBoxGeometry(3.4, 0.35, 3.4, 3, 0.04), new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, envMapIntensity: 0.3 })); slab.position.y = 0.1; KOLA.add(slab);
  const rustMat = new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.85, metalness: 0.35, envMapIntensity: 0.4 });
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.06, 48), rustMat); flange.position.y = 0.3; KOLA.add(flange);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.11, 48), rustMat); cap.position.y = 0.37; KOLA.add(cap);
  const capBolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6), rustMat, 16);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; M.compose(V3(Math.cos(a) * 0.36, 0.345, Math.sin(a) * 0.36), Q.identity(), V3(1, 1, 1)); capBolts.setMatrixAt(i, M); } KOLA.add(capBolts);
  const weld = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 8, 64).rotateX(Math.PI / 2), rustMat); weld.position.y = 0.33; KOLA.add(weld);
  // débris : tuyaux rouillés, plaques, gravats
  [[1.9, 0.08, 1.2, 0.07, 2.4, 0.3], [-2.4, 0.1, 0.6, 0.11, 1.8, 1.4], [0.6, 0.06, -2.3, 0.05, 1.6, 2.2], [-1.2, 0.08, -2.6, 0.09, 2.8, 0.7]].forEach(([x, y, z, r, l, a]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 16, 1, true), rustMat); p.material.side = THREE.DoubleSide; p.rotation.set(Math.PI / 2, 0, a); p.position.set(x, y + r, z); KOLA.add(p); });
  KOLA.add(mkRocks(180, 2.2, 30, new THREE.MeshStandardMaterial({ color: 0x6b675f, roughness: 0.95, envMapIntensity: 0.25 }), 11, 0.3));
  // ruines au loin (bâtiments de béton aux fenêtres vides)
  const ruinTex = canvasTex(512, 512, (g, w, h) => { g.drawImage(concreteTex.image, 0, 0, w, h); g.fillStyle = 'rgba(20,20,22,0.92)';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) if (rand(r * 7 + c) > 0.12) g.fillRect(30 + c * 80, 40 + r * 92, 46, 52); });
  const ruinMat = new THREE.MeshStandardMaterial({ map: ruinTex, roughness: 0.95, envMapIntensity: 0.2 });
  [[-60, -150, 26, 22, 14, 0.2], [15, -175, 40, 16, 16, -0.1], [70, -160, 18, 28, 12, 0.4], [-110, -200, 30, 18, 14, 0.1]].forEach(([x, z, w, h, d, a]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ruinMat); b.position.set(x, h / 2 - 1, z); b.rotation.y = a; KOLA.add(b); });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 38, 12), ruinMat); tower.position.set(-25, 18, -170);
  const kolaLook = () => { lightsOff(); const sd = V3(-0.4, 0.5, -0.6).normalize(); const u = kMat.uniforms; u.uL.value.copy(sd); u.uLC.value.setRGB(0.9, 0.9, 0.95); u.uAmb.value.setRGB(0.32, 0.34, 0.38); u.uFog.value.setRGB(0.58, 0.61, 0.66); u.uFogD.value.set(25, 260);
    setSky({ day: 1, warm: 0, sun: sd }); setStars(0); L.key.color.setRGB(0.95, 0.95, 1); L.key.intensity = 1.1; L.key.position.copy(sd.clone().multiplyScalar(100)); L.hemi.color.setRGB(0.75, 0.78, 0.85); L.hemi.groundColor.setRGB(0.25, 0.24, 0.2); L.hemi.intensity = 1.1;
    E.renderer.toneMappingExposure = 0.85; scene.fog = new THREE.Fog(0x949ba6, 30, 240); followSky(); };

  // ======================= TUBE : intérieur du tunnel de verre =======================
  const TUBE = new THREE.Group(); scene.add(TUBE);
  const TR = 2.4, TL = 700;
  const tubeMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uZone: { value: 0 }, uK: { value: 1 }, uZoff: { value: 0 }, uStr: { value: 0 } }, vertexShader: VS, side: THREE.BackSide,
    fragmentShader: NOISE + `uniform float uT; uniform float uZone; uniform float uK; uniform float uZoff; uniform float uStr; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ float a = atan(vW.y, vW.x); float z = (vW.z - uZoff) / (1.0 + uStr); vec3 p = vec3(cos(a) * 2.4, sin(a) * 2.4, z);
        vec3 rock = mix(vec3(0.10, 0.085, 0.07), vec3(0.26, 0.21, 0.16), fbm(p * vec3(0.7, 0.7, 0.25))) * (0.5 + 0.6 * fbm(p * 3.0));
        rock += vec3(0.5, 0.12, 0.02) * smoothstep(0.6, 0.75, fbm(p * 0.9 + 3.0)) * 0.35;
        float conv = fbm(p * 0.45 + vec3(0.0, uT * 0.05, 0.0) + fbm(p * 1.1 + 2.0) * 1.8);
        vec3 mant = mix(vec3(0.22, 0.035, 0.01), vec3(0.95, 0.32, 0.06), conv) * (0.5 + 0.7 * fbm(p * 2.4));
        vec3 qq = p * 0.55; float sw = fbm(qq + vec3(uT * 0.5, -uT * 0.35, uT * 0.25) + fbm(qq * 1.4 + vec3(uT * 0.2)) * 2.6);
        vec3 liq = mix(vec3(0.45, 0.11, 0.015), vec3(1.15, 0.58, 0.16), sw * sw) * (0.8 + 0.3 * fbm(p * 4.0 + uT));
        float cr = fbm(p * 2.2); float fac = abs(fract(cr * 7.0 + fbm(p * 0.7)) - 0.5) * 2.0;
        float cg = fbm(p * 0.8 + vec3(0.0, 0.0, uT * 0.05) + fbm(p * 1.6) * 1.2); vec3 core = mix(vec3(0.55, 0.2, 0.04), vec3(1.1, 0.66, 0.26), cg * cg * 1.4) * (0.8 + 0.3 * fbm(p * 6.0)) + vec3(0.25, 0.16, 0.06) * smoothstep(0.75, 0.95, noise(p * 9.0));
        float zn = uZone; vec3 c = rock;
        c = mix(c, mant, clamp(zn, 0.0, 1.0)); c = mix(c, liq, clamp(zn - 1.0, 0.0, 1.0)); c = mix(c, core, clamp(zn - 2.0, 0.0, 1.0));
        vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 5.0); c += vec3(0.6, 0.7, 0.85) * fr * 0.08;
        c *= uK; gl_FragColor = vec4(c, 1.0); }` });
  const tubeWall = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TL, 96, 1, true).rotateX(Math.PI / 2), tubeMat); tubeWall.position.z = -TL / 2 + 20; TUBE.add(tubeWall);
  const ribMat = new THREE.MeshPhysicalMaterial({ color: 0x6a6e74, metalness: 0.95, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 0.5 });
  const NRIB = 120; const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(TR - 0.04, 0.045, 10, 128), ribMat, NRIB);
  for (let i = 0; i < NRIB; i++) { M.compose(V3(0, 0, 20 - i * 6), Q.identity(), V3(1, 1, 1)); ribs.setMatrixAt(i, M); } TUBE.add(ribs);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, TL), ribMat, 6);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5; M.compose(V3(Math.cos(a) * (TR - 0.12), Math.sin(a) * (TR - 0.12), -TL / 2 + 20), Q.identity(), V3(1, 1, 1)); rails.setMatrixAt(i, M); } TUBE.add(rails);
  const tl1 = new THREE.PointLight(0xff8a3d, 0, 14, 1.4), tl2 = new THREE.PointLight(0xff8a3d, 0, 14, 1.4); TUBE.add(tl1, tl2);
  const ZCOL = [[0.6, 0.45, 0.35], [1.0, 0.35, 0.1], [1.0, 0.55, 0.18], [1.0, 0.82, 0.55]];
  const tubeLook = (zone, t) => { lightsOff(); setStars(0); setSky({ space: 1, milky: 0 }); scene.fog = null; tubeMat.uniforms.uZone.value = zone; tubeMat.uniforms.uT.value = t; tubeMat.uniforms.uK.value = 1; tubeMat.uniforms.uZoff.value = 0; tubeMat.uniforms.uStr.value = 0;
    const zi = Math.min(3, Math.floor(zone)), zf = zone - zi, c0 = ZCOL[zi], c1 = ZCOL[Math.min(3, zi + 1)]; const col = new THREE.Color(lerp(c0[0], c1[0], zf), lerp(c0[1], c1[1], zf), lerp(c0[2], c1[2], zf));
    tl1.color.copy(col); tl2.color.copy(col); tl1.intensity = tl2.intensity = lerp(5, 9, clamp(zone / 3)); L.hemi.color.copy(col); L.hemi.groundColor.copy(col).multiplyScalar(0.4); L.hemi.intensity = 0.15 + 0.15 * clamp(zone / 3);
    E.renderer.toneMappingExposure = lerp(1.0, 0.85, clamp(zone / 3)); };

  // ======================= PERSONNAGE en combinaison =======================
  const FIG = new THREE.Group(); scene.add(FIG);
  const suit = new THREE.MeshPhysicalMaterial({ color: 0x96928a, roughness: 0.78, metalness: 0, clearcoat: 0.05, sheen: 0.35, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.6 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.5, metalness: 0.6 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.2 });
  const cap3 = (r, l, mat, x, y, z, rx = 0, rz = 0, par = FIG) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 16), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); par.add(m); return m; };
  const body = new THREE.Group(); FIG.add(body);
  cap3(0.26, 0.42, suit, 0, 0.0, 0, 0, 0, body);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 24), suit); helmet.position.set(0, 0.56, 0); body.add(helmet);
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.205, 32, 24, -1.1, 2.2, 0.6, 1.4), visor); vis.position.set(0, 0.56, 0.05); vis.rotation.y = 0; body.add(vis);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24).rotateX(Math.PI / 2), joint); neck.position.y = 0.38; body.add(neck);
  const pack = new THREE.Mesh(new E.RoundedBoxGeometry(0.42, 0.55, 0.2, 3, 0.05), suit); pack.position.set(0, 0.05, -0.3); body.add(pack);
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.7, metalness: 0.2 });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 32).rotateX(Math.PI / 2), dark); belt.position.y = -0.2; body.add(belt);
  const chest = new THREE.Mesh(new E.RoundedBoxGeometry(0.26, 0.16, 0.06, 2, 0.02), dark); chest.position.set(0, 0.12, 0.25); body.add(chest);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshStandardMaterial({ color: 0xd96a1e, roughness: 0.6 })); flag.position.set(0.17, 0.2, 0.235); flag.rotation.y = 0.5; body.add(flag);
  const limbs = {};
  const mkLimb = (name, x, y, side) => { const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g); cap3(0.1, 0.3, suit, 0, -0.24, 0, 0, 0, g); const g2 = new THREE.Group(); g2.position.y = -0.48; g.add(g2);
    const j = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), joint); g2.add(j); cap3(0.08, 0.3, suit, 0, -0.22, 0, 0, 0, g2);
    const end = name[1] === 'a' ? new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), dark) : new THREE.Mesh(new E.RoundedBoxGeometry(0.15, 0.13, 0.24, 2, 0.04), dark); end.position.set(0, -0.48, name[1] === 'a' ? 0 : 0.04); g2.add(end); limbs[name] = [g, g2]; };
  [[-0.3, 0.27], [0.3, 0.27], [-0.13, -0.36], [0.13, -0.36]].forEach(([x, y]) => { const sp = new THREE.Mesh(new THREE.SphereGeometry(y > 0 ? 0.13 : 0.12, 16, 12), suit); sp.position.set(x, y, 0); body.add(sp); });
  mkLimb('la', -0.33, 0.25), mkLimb('ra', 0.33, 0.25), mkLimb('ll', -0.13, -0.38), mkLimb('rl', 0.13, -0.38);
  const pose = (t, spread = 1, calm = 0) => { const w = Math.sin(t * lerp(3, 0.8, calm)) * lerp(0.25, 0.12, calm);
    limbs.la[0].rotation.z = -lerp(0.4, 1.25, spread) + w; limbs.ra[0].rotation.z = lerp(0.4, 1.25, spread) - w; limbs.la[1].rotation.z = -0.3 + w * 0.5; limbs.ra[1].rotation.z = 0.3 - w * 0.5;
    limbs.ll[0].rotation.z = -lerp(0.1, 0.35, spread) - w * 0.5; limbs.rl[0].rotation.z = lerp(0.1, 0.35, spread) + w * 0.5; limbs.ll[0].rotation.x = 0.25 + w; limbs.rl[0].rotation.x = -0.15 - w; limbs.ll[1].rotation.x = -0.4; limbs.rl[1].rotation.x = -0.3; };

  // ======================= SOLEIL =======================
  const SUNG = new THREE.Group(); scene.add(SUNG);
  const sunMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: VS,
    fragmentShader: NOISE + `uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP); vec3 V = normalize(cameraPosition - vW); float mu = max(dot(normalize(vN), V), 0.0);
        float g1 = noise(p * 90.0 + vec3(uT * 0.3)); float g2 = noise(p * 190.0 - vec3(uT * 0.4)); float gran = 0.6 * g1 + 0.4 * g2; gran = smoothstep(0.25, 0.8, gran);
        float big = fbm(p * 5.0 + vec3(uT * 0.02)); float spots = smoothstep(0.70, 0.74, fbm(p * 3.2 + 5.0)); float pen = smoothstep(0.66, 0.70, fbm(p * 3.2 + 5.0));
        float fac = smoothstep(0.6, 0.7, fbm(p * 9.0 + 2.0)) * 0.25;
        float limb = 0.18 + 0.82 * pow(mu, 0.75);
        vec3 c = vec3(1.25, 0.56, 0.14) * (0.62 + 0.55 * gran) * (0.9 + 0.2 * big) * limb; c += vec3(0.3, 0.2, 0.08) * fac * (1.0 - mu);
        c *= 1.0 - 0.45 * pen - 0.45 * spots; gl_FragColor = vec4(c, 1.0); }` });
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(10, 128, 64), sunMat); SUNG.add(sunBall);
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), coronaMat); SUNG.add(corona);

  // ======================= SALON (épisode de série) =======================
  const ROOM = new THREE.Group(); scene.add(ROOM);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.45, clearcoat: 0.4, envMapIntensity: 0.25 })); ROOM.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95, envMapIntensity: 0.15 })); back.position.set(0, 3, -3.2); ROOM.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), back.material); side.position.set(-5, 3, 1); side.rotation.y = Math.PI / 2; ROOM.add(side);
  const screenTex = canvasTex(1280, 720, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2f52'); gr.addColorStop(0.55, '#d07a43'); gr.addColorStop(0.6, '#2c4a66'); gr.addColorStop(1, '#0c1a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,220,170,0.85)'; g.beginPath(); g.arc(w * 0.62, h * 0.5, 46, 0, 6.3); g.fill(); g.filter = 'blur(6px)'; g.fillStyle = '#0a0f18';
    g.beginPath(); g.moveTo(0, h * 0.62); for (let x = 0; x <= w; x += 40) g.lineTo(x, h * 0.58 - 40 * Math.sin(x * 0.006) - 25 * rand(x)); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.filter = 'none';
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, h - 70, w, 70); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(60, h - 38, w - 260, 6); g.fillStyle = '#e8e8e8'; g.fillRect(60, h - 38, (w - 260) * 0.995, 6);
    g.font = '600 30px Inter'; g.fillStyle = '#eee'; g.textAlign = 'right'; g.fillText('38:11', w - 50, h - 26); });
  screenTex.wrapS = screenTex.wrapT = THREE.ClampToEdgeWrapping; screenTex.repeat.set(1, 1);
  const tv = new THREE.Mesh(new E.RoundedBoxGeometry(3.3, 1.95, 0.08, 3, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.25, clearcoat: 1, metalness: 0.2 })); tv.position.set(0.4, 1.9, -3.1); ROOM.add(tv);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.18, 1.79), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: true })); screen.position.set(0.4, 1.9, -3.055); ROOM.add(screen);
  const stand = new THREE.Mesh(new E.RoundedBoxGeometry(3.6, 0.45, 0.5, 3, 0.03), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 })); stand.position.set(0.4, 0.23, -2.9); ROOM.add(stand);
  const fabric = new THREE.MeshPhysicalMaterial({ color: 0x4a5260, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a7080), envMapIntensity: 0.3 });
  const sofa = new THREE.Group(); ROOM.add(sofa); sofa.position.set(0.2, 0, 2.2);
  [[0, 0.25, 0, 3.4, 0.5, 1.1], [0, 0.75, 0.42, 3.4, 0.8, 0.28], [-1.62, 0.55, 0, 0.26, 0.6, 1.1], [1.62, 0.55, 0, 0.26, 0.6, 1.1], [-0.82, 0.56, -0.08, 1.55, 0.16, 0.9], [0.82, 0.56, -0.08, 1.55, 0.16, 0.9]].forEach(([x, y, z, w, h, d]) => {
    const m = new THREE.Mesh(new E.RoundedBoxGeometry(w, h, d, 4, 0.07), fabric); m.position.set(x, y, z); sofa.add(m); });
  const tvLight = new THREE.PointLight(0x9fb4ff, 0, 14, 1.2); tvLight.position.set(0.4, 1.9, -2.2); ROOM.add(tvLight);
  const lampLight = new THREE.PointLight(0xffa860, 0, 8, 1.8); lampLight.position.set(-3.6, 1.6, -1.5); ROOM.add(lampLight);
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.4, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffa860, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.9 })); lampShade.position.set(-3.6, 1.6, -1.5); ROOM.add(lampShade);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 })); lampPole.position.set(-3.6, 0.75, -1.5); ROOM.add(lampPole);
  const roomLook = () => { lightsOff(); setStars(0); setSky({ space: 1, milky: 0 }); scene.fog = null; tvLight.intensity = 9; lampLight.intensity = 9; L.hemi.color.setRGB(0.4, 0.45, 0.6); L.hemi.groundColor.setRGB(0.1, 0.08, 0.06); L.hemi.intensity = 0.35; E.renderer.toneMappingExposure = 1.1; };

  // ======================= PENDULE (laiton) =======================
  const PEND = new THREE.Group(); scene.add(PEND);
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.22, clearcoat: 0.5, envMapIntensity: 1.0 });
  const pFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x6a5a50, roughness: 0.35, clearcoat: 0.7, envMapIntensity: 0.3 })); PEND.add(pFloor);
  const pWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ map: plasterTex, color: 0x9a9088, roughness: 0.95, envMapIntensity: 0.1 })); pWall.position.set(0, 10, -4); PEND.add(pWall);
  const frame = new THREE.Group(); PEND.add(frame);
  const darkWood = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x5a3a28, roughness: 0.4, clearcoat: 0.8 });
  [[-1.6, 2.2, 0, 0.14, 4.4, 0.3], [1.6, 2.2, 0, 0.14, 4.4, 0.3], [0, 4.45, 0, 3.5, 0.18, 0.36], [0, 0.06, 0, 3.8, 0.12, 1.2]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new E.RoundedBoxGeometry(w, h, d, 2, 0.02), darkWood); m.position.set(x, y, z); frame.add(m); });
  const pivot = new THREE.Group(); pivot.position.set(0, 4.3, 0.05); frame.add(pivot);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.2, 12), brass); rod.position.y = -1.6; pivot.add(rod);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 32), brass); bob.position.y = -3.35; bob.scale.set(1, 1, 0.55); pivot.add(bob);
  const pSpot = new THREE.SpotLight(0xffe2b8, 0, 30, 0.5, 0.6, 1.2); pSpot.position.set(2, 9, 6); pSpot.target.position.set(0, 2, 0); PEND.add(pSpot, pSpot.target);
  const pendLook = () => { lightsOff(); setStars(0); setSky({ space: 1, milky: 0 }); scene.fog = null; pSpot.intensity = 260; L.hemi.color.setRGB(0.5, 0.45, 0.4); L.hemi.groundColor.setRGB(0.1, 0.08, 0.06); L.hemi.intensity = 0.15; E.renderer.toneMappingExposure = 1.0; };

  // ======================= helpers =======================
  const GROUPS = { CUT, SHAFT, KOLA, TUBE, FIG, SUNG, ROOM, PEND };
  const show = (...names) => { for (const k in GROUPS) GROUPS[k].visible = names.includes(k); tvLight.visible = lampLight.visible = names.includes('ROOM'); tl1.visible = tl2.visible = names.includes('TUBE'); pSpot.visible = names.includes('PEND'); };
  const label = (x, y, s, a = 1, size = 30, col = '#ffffff') => { if (a <= 0) return; const o = E.o; o.save(); o.globalAlpha = clamp(a); o.font = `600 ${size}px Inter`; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.shadowColor = 'rgba(0,0,0,0.75)'; o.shadowBlur = 12; o.fillStyle = col; o.fillText(s, x, y); const w = o.measureText(s).width; o.globalAlpha = clamp(a) * 0.55; o.fillRect(x - w / 2, y + size * 0.72, w, 2); o.restore(); };
  const fadeBlack = (a) => { if (a > 0) { E.o.fillStyle = `rgba(0,0,0,${clamp(a)})`; E.o.fillRect(0, 0, 1080, 1920); } };
  const fr = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  const at = (w, after = 0) => E.at(w, after);
  const zoomIn = (d = 0.35, px = 14) => (t, lt) => lt < d ? `blur(${((d - lt) / d * px).toFixed(1)}px)` : null;
  const dipIn = (d = 0.35) => (t, lt) => lt < d ? `brightness(${(0.25 + 0.75 * lt / d).toFixed(2)})` : null;
  // trajet dans le tunnel (modèle sans air, oscillation harmonique) : y = R cos(phase)
  const fallY = (u) => R * Math.cos(Math.PI * clamp(u));

  // ======================= temps (calés sur la voix) =======================
  const T = {
    trou: at('trou'), travers: at('travers'), et1: at('et', 2.5), sautais: at('sautais'), le2: at('Le', 4), c6400: at('6400'), et3: at('Et', 8), n12: at('12'), russie: at('Russie'), labas: at('Là-bas'), n180: at('180'),
    alors: at('Alors'), tunnel: at('tunnel'), vide: at('vidé'), sautes: at('sautes'), tu5: at('Tu', 21.5), vite: at('vite'), tu6: at('Tu', 23.5), croute: at('croûte'), manteau: at('manteau'),
    a2900: at('À', 26.5), n2900: at('2900'), noyau: at('noyau'), liquides: at('liquides'), puis8: at('Puis', 32), coeur: at('cœur'), n5000: at('5000'), apeu: at('À', 37.5), soleil: at('Soleil', 39),
    au: at('Au', 40.5), n8: at('8'), plus10: at('Plus', 44), n28: at('28'), etla: at('Et', 46.5), rien: at('rien'), la11: at('La', 50), cotes: at('côtés'), flottes: at('flottes'),
    puis12: at('Puis', 54), freine: at('freine'), et13: at('et', 56.5), ressors: at('ressors'), planete: at('planète', 58), combien: at('Combien'), n42: at('42'), mais: at('Mais', 65), n38: at('38'),
    le15: at('Le', 69.4), serie: at('série'), et16: at('Et', 71.7), rebond: at('rebondissement'), retombes: at('retombes'), tu17: at('Tu', 76), encore: at('encore'), pendule: at('pendule'),
    alors18: at('Alors', 81), sol: at('sol'), sous: at('sous', 84.9), ocean: at('océan'), et19: at('et', 88.3), n38b: at('38', 89.5), et20: at('Et', 91.7), dis: at('Dis-le'), abonne: at('abonne-toi'),
  };

  const shots = [
    // 1 — ACCROCHE : la Terre depuis l'espace ; au mot « travers », un quartier s'ouvre et révèle le tunnel qui la traverse
    { name: 'terre-accroche', start: 0, noFlash: true,
      update(t, lt, k) { show('CUT'); const ck = smooth(T.travers - 0.1, T.travers + 0.9, t); cutLook(ck); cutG.rotation.y = lerp(-0.35, 0.05, easeIO(k));
        tunnelMat.opacity = 0.55 * smooth(T.travers + 0.5, T.travers + 1.0, t); tunnelCore.material.opacity = 0.8 * tunnelMat.opacity; layerMat.uniforms.uT.value = t;
        camDir(V3(1, lerp(0.42, 0.3, k), 1), lerp(fitD(R, 42, 0.5), fitD(R, 42, 0.64), easeIO(k)), V3(0, 0, 0), 42); },
      hud(t) { fadeBlack(1 - t / 0.5); } },
    // 2 — LE PUITS : vue plongeante dans un trou parfait creusé au milieu des champs (crépuscule)
    { name: 'puits', start: T.et1, filter: zoomIn(),
      update(t, lt, k) { show('SHAFT'); shaftLook('dusk'); wallMat.uniforms.uLights.value = 1; wallMat.uniforms.uTop.value = 1;
        const s = easeIO(k); cam.position.set(lerp(15, 11.5, s), lerp(6.2, 5.4, s), lerp(13, 10, s)); cam.fov = 46; cam.updateProjectionMatrix(); cam.lookAt(V3(-1.5, lerp(-0.2, -1.2, s), -1.5)); followSky(); } },
    // 3 — 6 400 KM : la Terre en coupe, le trajet jusqu'au centre se dessine
    { name: 'coupe-centre', start: T.le2, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.05 + lt * 0.01; layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.25;
        camDir(V3(1, 0.36, 1), lerp(fitD(R, 40, 0.62), fitD(R, 40, 0.68), easeIO(k)), V3(0, 0.6, 0), 40);
        const g = ease(clamp((t - T.c6400 + 0.4) / 1.4)); E.line3(0, [V3(0.18, R * 1.02, 0.18), V3(0.18, R * (1.02 - 1.02 * g), 0.18)], 0xffffff, 0.9, 1); setYou(R * (1 - g), g > 0.01 && g < 0.999 || g >= 0.999); },
      hud(t, lt) { const g = ease(clamp((t - T.c6400 + 0.4) / 1.4)); const [x, y] = E.proj(V3(0.18, R * 0.5, 0.18)); label(Math.min(x + 170, 900), y, fr(6400 * g) + ' km', ease((t - T.c6400 + 0.4) / 0.4), 40, '#ffe1a0');
        const [x2, y2] = E.proj(V3(0, 0, 0)); label(x2 + 150, y2 + 70, 'centre', ease((t - T.c6400 - 1.0) / 0.4) * 0.9, 28, '#f2f2f2'); } },
    // 4 — KOLA : un couvercle rouillé soudé sur une dalle de béton, dans la toundra (le forage le plus profond)
    { name: 'kola', start: T.et3, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('KOLA'); kolaLook(); const s = easeIO(k);
        const a = lerp(0.65, 0.9, s); const d = lerp(6.2, 2.1, s); cam.position.set(Math.sin(a) * d, lerp(1.9, 1.05, s), Math.cos(a) * d); cam.fov = lerp(44, 40, s); cam.updateProjectionMatrix(); cam.lookAt(V3(0, lerp(0.6, 0.3, s), 0)); followSky(); },
      hud(t, lt) { label(540, 520, 'Forage de Kola', ease((t - T.russie) / 0.5) * 0.85 * (1 - ease((t - T.labas - 0.4) / 0.4)), 30, '#f0f0f0');
        const a12 = ease((t - T.n12) / 0.4); label(540, 430, '12 km de profondeur', a12 * (1 - ease((t - T.labas - 0.4) / 0.4)), 40, '#ffe1a0');
        const a180 = ease((t - T.n180 + 0.3) / 0.4); if (a180 > 0) label(540, 470, fr(180 * ease(clamp((t - T.n180 + 0.3) / 0.9))) + ' °C au fond', a180, 44, '#ffb27a'); } },
    // 5 — TUNNEL PARFAIT : retour à la coupe, le tube de verre apparaît d'un pôle à l'autre ; l'air est aspiré
    { name: 'tunnel-parfait', start: T.alors, filter: dipIn(0.4),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = lerp(0.25, 0.1, easeIO(k)); layerMat.uniforms.uT.value = t; const g = smooth(T.tunnel - 0.2, T.tunnel + 0.8, t);
        tunnelMat.opacity = 0.6 * g; tunnelCore.material.opacity = 0.7 * g; tunnel.scale.set(1, Math.max(0.001, g), 1); tunnelCore.scale.copy(tunnel.scale);
        camDir(V3(1, lerp(0.15, 0.05, k), 1.1), fitD(R * 1.05, 42, 0.6), V3(0, 0, 0), 42);
        if (t > T.vide - 0.2) { const tt = t - T.vide + 0.2; for (let i = 0; i < 260; i++) { const y0 = (rand(i * 1.3) * 2 - 1) * R; const sgn = y0 > 0 ? 1 : -1; const y = y0 + sgn * tt * (4 + rand(i) * 8);
          if (Math.abs(y) < R * 1.25) E.dot(V3(0.12 + (rand(i * 5) - 0.5) * 0.1, y, 0.12 + (rand(i * 7) - 0.5) * 0.1), 0.035, 0x9fd8ff); } } },
      hud(t, lt) { label(540, 480, 'tunnel sans air', ease((t - T.vide) / 0.4) * 0.85, 30, '#cfe8ff'); } },
    // 6 — TU SAUTES : depuis le bord, la caméra bascule et plonge dans le puits ; les anneaux de lumière défilent de plus en plus vite
    { name: 'plongeon', start: T.sautes, filter: zoomIn(0.25, 10),
      update(t, lt, k) { show('SHAFT'); shaftLook('dusk'); wallMat.uniforms.uLights.value = 1.2; const s = easeIO(clamp(lt / 1.0));
        const y = 2.2 - 3 * lt * lt - 2 * lt; const x = lerp(2.0, 0.0, s); cam.position.set(x, y, lerp(1.6, 0, s)); cam.fov = 50; cam.updateProjectionMatrix(); cam.lookAt(V3(x * 0.2, y - 10, -lerp(1.4, 0.2, s) * 0)); cam.rotation.z += Math.sin(lt * 2) * 0.08 + lt * 0.15; followSky();
        for (let i = 0; i < 160; i++) { const yy = y - 2 - ((i * 1.7 + rand(i) * 4) % 60); const a = rand(i * 3) * 6.283, r = 0.6 + rand(i * 9) * 2.0; E.dot(V3(Math.cos(a) * r, yy, Math.sin(a) * r), 0.012, 0x6a6050); } } },
    // 7 — CROÛTE, MANTEAU : sur la coupe, le point (toi) descend ; les couches s'étiquettent
    { name: 'coupe-chute', start: T.tu6, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.12; layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.45; tunnelCore.material.opacity = 0.5;
        const u = clamp((t - T.tu6) / (T.a2900 + 0.5 - T.tu6)) * 0.27; setYou(fallY(u));
        camDir(V3(1, 0.5, 1), lerp(fitD(R, 40, 0.66), fitD(R * 0.7, 40, 0.66), easeIO(k)), V3(0, lerp(3, 6, easeIO(k)), 0), 40);
        E.line3(1, [V3(0.14, R, 0.14), V3(0.14, fallY(u), 0.14)], 0xbfe6ff, 0.6, 1); },
      hud(t, lt) { const [x1, y1] = E.proj(V3(0, R * 0.985, 2.5)); label(x1 - 120, y1 - 10, 'croûte', ease((t - T.croute) / 0.4) * 0.95, 30, '#f2e6d6');
        const [x2, y2] = E.proj(V3(0, R * 0.77, 4.6)); label(x2 - 60, y2, 'manteau', ease((t - T.manteau) / 0.4) * 0.95, 30, '#ffc49a'); } },
    // 8 — NOYAU : à l'intérieur du tube de verre ; roche brûlante puis, à « noyau », un océan de métal liquide qui tourbillonne
    { name: 'tube-noyau', start: T.a2900, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('TUBE'); const zone = lerp(1.0, 2.0, smooth(T.noyau - 0.5, T.noyau + 0.6, t)); tubeLook(zone, t);
        const dist = lt * 26; tubeMat.uniforms.uZoff.value = -dist; tubeMat.uniforms.uStr.value = 1.5; const z = -30 - (dist % 6); cam.position.set(Math.sin(lt * 0.6) * 0.35, 0.3 + Math.cos(lt * 0.5) * 0.2, z); cam.fov = 50; cam.updateProjectionMatrix(); cam.lookAt(V3(0.2, 0, z - 10)); cam.rotation.z += lt * 0.04;
        tl1.position.set(1.2, 1.2, z - 3); tl2.position.set(-1.2, -1.2, z - 12); },
      hud(t, lt) { label(540, 440, fr(2900 * ease(clamp((t - T.n2900 + 0.2) / 0.8))) + ' km', ease((t - T.n2900 + 0.2) / 0.3) * (1 - ease((t - T.noyau) / 0.4)), 40, '#ffe1a0');
        label(540, 440, 'fer + nickel liquides', ease((t - T.liquides + 0.4) / 0.4) * 0.9, 32, '#ffd7a8'); } },
    // 9 — LE CŒUR : gros plan sur la coupe, la graine solide brûlante
    { name: 'graine', start: T.puis8, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.12; layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.35; tunnelCore.material.opacity = 0.4;
        setYou(fallY(lerp(0.33, 0.43, k))); const s = easeIO(k); camDir(V3(1, lerp(0.55, 0.3, s), 1), lerp(fitD(R * 0.9, 40, 0.66), fitD(R * 0.5, 40, 0.62), s), V3(0, lerp(1.5, 0.3, s), 0), 40); },
      hud(t, lt) { const [x, y] = E.proj(V3(0, -R * 0.12, 1.6)); const a = ease((t - T.n5000 + 0.3) / 0.4); label(Math.min(x + 140, 880), Math.min(y + 120, 1180), 'plus de ' + fr(5000 * ease(clamp((t - T.n5000 + 0.3) / 0.9))) + ' °C', a, 40, '#ffe1a0');
        const [x2, y2] = E.proj(V3(0, R * 0.22, 1.2)); label(x2 - 110, y2 - 60, 'métal solide', ease((t - T.coeur - 1.0) / 0.4) * 0.9, 28, '#fff0d8'); } },
    // 10 — COMME LE SOLEIL : la surface du Soleil, granulation et taches
    { name: 'soleil', start: T.apeu, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('SUNG'); lightsOff(); setStars(0.6); setSky({ space: 1, milky: 0.3 }); scene.fog = null; E.renderer.toneMappingExposure = 0.72; sunMat.uniforms.uT.value = t; coronaMat.uniforms.uT.value = t; coronaMat.uniforms.uK.value = 0.55; coronaMat.uniforms.uStreak.value = 0.6;
        SUNG.rotation.y = t * 0.01; camDir(V3(0.2, 0.1, 1), lerp(fitD(10, 40, 0.6), fitD(10, 40, 0.68), easeIO(k)), V3(0, 0, 0), 40); corona.lookAt(cam.position); followSky(); },
      hud(t, lt) { label(540, 470, 'surface du Soleil', ease((t - T.soleil + 0.2) / 0.4) * 0.9, 30, '#ffe6c0'); } },
    // 11 — 8 KM/S : dans le tube au centre, la silhouette file, les arceaux défilent à toute vitesse
    { name: 'vitesse', start: T.au, filter: zoomIn(0.25, 14),
      update(t, lt, k) { show('TUBE', 'FIG'); const sp = lerp(60, 140, smooth(T.au, T.n8, t)); const dist = lt * sp; tubeLook(lerp(2.6, 3.0, k), t); tubeMat.uniforms.uZoff.value = -dist; tubeMat.uniforms.uStr.value = sp / 12; const z = -300 - (dist % 6);
        const side = smooth(T.plus10 - 0.2, T.plus10 + 0.6, t);
        FIG.position.set(0, 0, z - 4.2); FIG.rotation.set(-Math.PI / 2 + 0.15, 0, Math.sin(lt * 0.7) * 0.2); FIG.scale.setScalar(1); pose(t, 0.25, 0);
        if (side < 0.5) { cam.position.set(0.4 + Math.sin(t * 9) * 0.02, 0.75 + Math.cos(t * 11) * 0.02, z); cam.lookAt(V3(0, 0, z - 4.6)); } else { cam.position.set(0.7 + Math.sin(t * 9) * 0.02, 0.6 + Math.cos(t * 11) * 0.02, z - 9.6); cam.lookAt(V3(0, 0, z - 4.2)); } cam.fov = 50; cam.updateProjectionMatrix();
        tl1.position.set(1.5, 1.2, z - 2); tl2.position.set(-1.2, -1.4, z - 7); },
      hud(t, lt) { label(540, 430, fr(8 * ease(clamp((t - T.n8 + 0.2) / 0.6))) + ' km/s', ease((t - T.n8 + 0.2) / 0.3) * (1 - ease((t - T.plus10) / 0.3)), 46, '#ffe1a0');
        label(540, 430, '> ' + fr(28000 * ease(clamp((t - T.n28 + 0.2) / 0.8))) + ' km/h', ease((t - T.n28 + 0.2) / 0.3), 44, '#ffe1a0'); } },
    // 12 — APESANTEUR : au centre, tout ralentit ; la silhouette flotte au milieu de poussières en suspension
    { name: 'apesanteur', start: T.etla, filter: dipIn(0.5),
      update(t, lt, k) { show('TUBE', 'FIG'); tubeLook(3, 30 + t * 0.15); const z = -60;
        FIG.position.set(0, Math.sin(lt * 0.8) * 0.12, z); FIG.rotation.set(-0.3 + lt * 0.05, lt * 0.12, 0.4 + lt * 0.06); FIG.scale.setScalar(1); pose(t, 1, 1);
        const a = lerp(-0.25, 0.25, easeIO(k)); cam.position.set(Math.sin(a) * 1.3, 0.4, z + 5.4 - lerp(0, 0.6, easeIO(k))); cam.fov = 48; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 0, z));
        tl1.position.set(1.4, 1.5, z - 1.2); tl2.position.set(-1.4, -1.0, z - 1.5);
        for (let i = 0; i < 900; i++) { const p = V3((rand(i) - 0.5) * 4.4, (rand(i * 2) - 0.5) * 4.4, z + (rand(i * 3) - 0.5) * 14); if (p.x * p.x + p.y * p.y > 4.2) continue; p.x += Math.sin(t * 0.3 + i) * 0.1; p.y += Math.cos(t * 0.25 + i * 1.3) * 0.1; E.dot(p, 0.008 + 0.01 * rand(i * 5), 0xffd8a0); } },
      hud(t, lt) { label(540, 430, '0 kg', ease((t - T.rien + 0.1) / 0.3) * 0.95, 46, '#ffe1a0'); } },
    // 13 — ATTIRÉ DE TOUS LES CÔTÉS, puis freiné : sur la coupe, des lignes convergent vers le centre et s'équilibrent ; puis le point remonte en ralentissant
    { name: 'equilibre', start: T.la11, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.1; layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.4; tunnelCore.material.opacity = 0.45;
        const up = clamp((t - T.puis12) / (T.et13 + 0.3 - T.puis12)); const u = 0.5 + 0.48 * Math.sin(up * Math.PI / 2); setYou(fallY(t < T.puis12 ? 0.5 : u));
        const gl = smooth(T.la11 + 0.3, T.cotes, t) * (1 - smooth(T.puis12 - 0.3, T.puis12 + 0.3, t));
        for (let i = 0; i < 16; i++) { const ph = -Math.PI / 2 + (i % 8 + 0.5) / 8 * Math.PI; const onB = i < 8;
          const d = onB ? V3(Math.cos(ph), Math.sin(ph), 0) : V3(0, Math.sin(ph), Math.cos(ph)); const off = onB ? V3(0, 0, 0.08) : V3(0.08, 0, 0);
          const a = d.clone().multiplyScalar(R * 0.97).add(off); const b = d.clone().multiplyScalar(lerp(R * 0.97, 0.5, ease(gl))).add(off); E.line3(2 + i, [a, b], 0xdff2ff, 0.7 * gl, 1);
          for (let j = 0; j < 5; j++) { const pul = (t * 0.45 + j / 5 + i * 0.13) % 1; E.dot(d.clone().multiplyScalar(lerp(R * 0.95, 0.6, pul)).add(off), 0.09 * gl * (0.4 + 0.6 * Math.sin(pul * Math.PI)), 0xe8f6ff); } }
        const s = easeIO(k); camDir(V3(1, 0.25, 1), lerp(fitD(R, 42, 0.62), fitD(R, 42, 0.66), s), V3(0, lerp(0, 1.2, s), 0), 42); },
      hud(t, lt) { const a = ease((t - T.freine) / 0.4) * 0.9; label(540, 470, 'la gravité te freine', a, 30, '#cfe8ff'); } },
    // 14 — L'AUTRE CÔTÉ : en plein jour, de l'autre côté de la planète, la silhouette jaillit du puits et s'arrête pile au bord
    { name: 'sortie', start: T.et13, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('SHAFT', 'FIG'); shaftLook('day'); wallMat.uniforms.uLights.value = 0.6; wallMat.uniforms.uTop.value = 0.7;
        const tp = T.ressors + 0.9; const y = t < tp ? lerp(-9, 0.9, 1 - Math.pow(1 - clamp((t - T.et13) / (tp - T.et13)), 2)) : 0.9 + Math.sin(t * 1.2) * 0.02;
        FIG.position.set(0, y, 0); FIG.rotation.set(0, -0.6, 0); FIG.scale.setScalar(1); pose(t, lerp(0.3, 1, clamp((t - tp + 0.6) / 0.8)), 1);
        cam.position.set(lerp(7.5, 6.8, k), lerp(5.4, 4.6, k), lerp(6.8, 6.0, k)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 0.2, 0)); followSky(); },
      hud(t, lt) { label(540, 470, 'l\'autre côté de la planète', ease((t - T.planete + 0.2) / 0.4) * 0.85, 30, '#ffffff'); } },
    // 15 — LE CHRONO : la coupe vue de face, le point fait le trajet entier ; chrono 42:12 puis, avec la vraie densité (noyau plus dense qui s'illumine), 38:11
    { name: 'chrono', start: T.combien, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = lerp(0.3, 0.0, easeIO(k)); layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.5; tunnelCore.material.opacity = 0.5;
        const dur = T.n42 + 0.6 - T.combien; const u = ((t - T.combien) / dur) % 1; const u2 = t < T.mais ? u : ((t - T.mais) / (T.n38 + 0.5 - T.mais)) % 1; setYou(fallY(t < T.mais ? u : u2));
        layerMat.uniforms.uDense.value = smooth(T.mais + 0.5, T.mais + 1.5, t) * (0.85 + 0.15 * Math.sin(t * 5));
        const s = easeIO(k); camDir(V3(lerp(1, 0.75, s), lerp(0.2, 0.12, s), 1), fitD(R * 1.05, 42, 0.6), V3(0, 0, 0), 42); },
      hud(t, lt) { const sec = t < T.mais ? 2532 * ease(clamp((t - T.combien - 0.5) / (T.n42 + 0.4 - T.combien - 0.5))) : lerp(2532, 2291, ease(clamp((t - T.n38 + 0.5) / 0.6)));
        const mm = Math.floor(sec / 60), ss = Math.floor(sec % 60); const sz = 64; const o = E.o; o.save(); o.globalAlpha = ease((t - T.combien) / 0.4);
        o.font = `600 ${sz}px Inter`; o.textAlign = 'center'; o.shadowColor = 'rgba(0,0,0,0.7)'; o.shadowBlur = 14; o.fillStyle = t > T.n38 - 0.3 ? '#ffe1a0' : '#ffffff'; o.fillText(`${mm}:${String(ss).padStart(2, '0')}`, 540, 470);
        o.font = '500 26px Inter'; o.globalAlpha *= 0.8; o.fillStyle = '#dfe6f0'; o.fillText(t < T.mais ? 'modèle simple' : 'avec la vraie densité', 540, 520); o.restore(); } },
    // 16 — UN ÉPISODE DE SÉRIE : salon dans la pénombre, la télé allumée
    { name: 'serie', start: T.le15, filter: zoomIn(0.3, 10),
      update(t, lt, k) { show('ROOM'); roomLook(); tvLight.intensity = 26 + Math.sin(t * 7) * 2 + Math.sin(t * 2.3) * 1.5; const s = easeIO(k);
        cam.position.set(lerp(-1.1, -0.6, s), lerp(2.0, 1.85, s), lerp(6.6, 5.9, s)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(0.3, 1.25, -3)); } },
    // 17 — REBONDISSEMENT : vue du dessus, la silhouette retombe dans le puits
    { name: 'retombe', start: T.et16, filter: zoomIn(0.3, 12),
      update(t, lt, k) { show('SHAFT', 'FIG'); shaftLook('day'); wallMat.uniforms.uLights.value = 0.8; wallMat.uniforms.uTop.value = 0.7;
        const f = clamp((t - T.retombes + 0.2) / 2.2); const y = 0.9 - 26 * f * f; FIG.position.set(0, y, 0); FIG.rotation.set(0.1 + f * 0.3, -0.6 + t * 0.1, 0.05); pose(t, lerp(1, 0.6, f), lerp(1, 0.2, f));
        cam.position.set(lerp(4.2, 3.6, k), lerp(6.5, 7.2, k), lerp(3.8, 3.2, k)); cam.fov = 46; cam.updateProjectionMatrix(); cam.lookAt(V3(0, lerp(0.2, -6, f), 0)); followSky(); },
      hud(t, lt) { label(540, 470, 'personne pour t\'attraper…', ease((t - T.rebond - 0.6) / 0.4) * 0.85 * (1 - ease((t - T.retombes - 0.2) / 0.4)), 30, '#ffffff'); } },
    // 18 — ALLER-RETOUR : sur la coupe, le point oscille d'un bout à l'autre, encore et encore (accéléré), avec sa traînée
    { name: 'aller-retour', start: T.tu17, filter: dipIn(),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.1 + lt * 0.03; layerMat.uniforms.uT.value = t; tunnelMat.opacity = 0.5; tunnelCore.material.opacity = 0.5;
        const ph = (tt) => Math.cos(Math.PI * Math.max(0, tt) / 1.35); setYou(R * ph(lt));
        const pts = []; for (let i = 0; i <= 40; i++) pts.push(V3(0.14, R * ph(lt - i * 0.012), 0.14)); E.line3(1, pts, 0xbfe6ff, 0.8, 1);
        camDir(V3(1, 0.15, 1), fitD(R * 1.05, 42, 0.58), V3(0, 0, 0), 42); },
      hud(t, lt) { label(540, 470, 'accéléré', 0.7 * ease(lt / 0.5), 24, '#cfd6e6'); } },
    // 19 — COMME UN PENDULE : pendule en laiton dans un intérieur sombre
    { name: 'pendule', start: T.pendule - 0.35, filter: zoomIn(0.25, 10),
      update(t, lt, k) { show('PEND'); pendLook(); pivot.rotation.z = 0.42 * Math.cos(lt * 3.4 + 0.3);
        cam.position.set(lerp(1.8, 1.3, k), lerp(2.6, 2.5, k), lerp(11.5, 10.8, k)); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 2.3, 0)); } },
    // 20 — LE SOL SOUS TES PIEDS : la campagne au crépuscule, la caméra descend vers l'herbe
    { name: 'sol', start: T.alors18, filter: dipIn(0.5),
      update(t, lt, k) { show('SHAFT'); shaftLook('day'); grass.visible = true; const s = easeIO(k); cam.position.set(-40 + lerp(0, 4, s), lerp(4.5, 1.8, s), 30); cam.fov = 44; cam.updateProjectionMatrix();
        cam.lookAt(V3(-28 + lerp(0, 2, s), lerp(1.2, -0.2, s), 14)); followSky(); } },
    // 21 — L'OCÉAN DE FER LIQUIDE : la coupe, on plonge sur le noyau externe qui tourbillonne
    { name: 'ocean-fer', start: T.sous, filter: zoomIn(0.35, 14),
      update(t, lt, k) { show('CUT'); cutLook(1); cutG.rotation.y = 0.15; layerMat.uniforms.uT.value = t * 1.5; tunnelMat.opacity = 0.3; tunnelCore.material.opacity = 0.35; layerMat.uniforms.uGlow.value = 1 + 0.15 * smooth(T.ocean, T.ocean + 0.8, t);
        const s = easeIO(k); camDir(V3(1, lerp(0.9, 0.5, s), 1), lerp(fitD(R, 40, 0.62), fitD(R * 0.58, 40, 0.68), s), V3(0, lerp(2, 2.6, s), 0), 40); },
      hud(t, lt) { label(540, 470, 'noyau externe : fer liquide', ease((t - T.ocean) / 0.4) * 0.9, 30, '#ffd7a8'); } },
    // 22 — 38 MINUTES : la Terre entière, le tunnel lumineux la traverse d'un bout du monde à l'autre ; conclusion
    { name: 'final', start: T.et19, filter: dipIn(0.5),
      update(t, lt, k) { show('CUT'); const ck = 1 - smooth(T.et19 + 0.2, T.et19 + 1.6, t); cutLook(ck); cutG.rotation.y = lerp(0.1, 0.9, easeIO(k)); layerMat.uniforms.uT.value = t;
        tunnelMat.opacity = 0.6; tunnelCore.material.opacity = 0.75; const u = ((t - T.et19) / 3.2) % 1; setYou(fallY(u));
        const a = smooth(T.et19, T.et19 + 1.5, t); E.line3(1, [V3(0.0, R * 1.35, 0.0), V3(0.0, R * 1.02, 0.0)], 0xbfe6ff, 0.7 * a, 1); E.line3(2, [V3(0.0, -R * 1.02, 0.0), V3(0.0, -R * 1.35, 0.0)], 0xbfe6ff, 0.7 * a, 1);
        const s = easeIO(k); camDir(V3(1, lerp(0.25, 0.4, s), 1), lerp(fitD(R * 1.35, 42, 0.62), fitD(R * 1.35, 42, 0.5), s), V3(0, 0, 0), 42); },
      hud(t, lt) { label(540, 470, '38 min', ease((t - T.n38b + 0.2) / 0.4) * (1 - ease((t - T.et20) / 0.5)), 52, '#ffe1a0');
        label(540, 470, 'Tu sauterais ?', ease((t - T.et20 - 0.6) / 0.5), 48, '#ffffff'); fadeBlack(smooth(E.TOTAL - 0.9, E.TOTAL, t)); } },
  ];

  shots.forEach(sh => { const u = sh.update; sh.update = (t, lt, k) => { E.bloom.threshold = 0.88; E.bloom.strength = 0.35; E.bloom.radius = 0.5; FIG.visible = false; wallMat.uniforms.uTop.value = 1; u(t, lt, k); }; });
  const sfx = [
    { t: T.travers, type: 'rise' }, { t: T.travers + 0.9, type: 'boom' }, { t: T.c6400, type: 'pop' }, { t: T.n12, type: 'boom' }, { t: T.n180, type: 'pop' },
    { t: T.tunnel, type: 'pop' }, { t: T.vide, type: 'rise' }, { t: T.croute, type: 'pop' }, { t: T.manteau, type: 'pop' },
    { t: T.noyau, type: 'boom' }, { t: T.n5000, type: 'ding' }, { t: T.n8, type: 'rise' }, { t: T.n28 + 0.3, type: 'boom' }, { t: T.rien, type: 'ding' },
    { t: T.ressors + 0.3, type: 'pop' }, { t: T.n42, type: 'click' }, { t: T.n38, type: 'ding' }, { t: T.pendule, type: 'click' },
  ];
  return { shots, sfx };
}
