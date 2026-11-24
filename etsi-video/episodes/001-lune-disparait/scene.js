// Épisode 001 – Et si la Lune disparaissait ?
// Style classic photoréaliste. Toutes les zones sont centrées à l'origine et s'affichent selon le plan (show()).
// Zones : SPACE (Terre r=10, Lune, Soleil), LAND (paysage nocturne, village, mer), COAST (plage + port de jour),
// RULER (règle en macro), LUNAR (sol lunaire, lever de Terre). Le ciel (dôme + étoiles) suit la caméra.
export async function build(E) {
  const { THREE, V3, clamp, ease, easeIO, lerp, rand } = E;
  const scene = E.scene, cam = E.camera;
  E.mood('space');
  E.bloom.threshold = 0.88; E.bloom.strength = 0.42; E.bloom.radius = 0.5;
  const DEG = Math.PI / 180;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ======================= GLSL commun =======================
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

  // ======================= matériaux spatiaux =======================
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
        c += vec3(1.0, 0.92, 0.8) * spec * 0.9 * smoothstep(0.0, 0.2, ndl0);
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
  const moonMat = (seed = 0) => new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uDis: { value: 0 }, uSeed: { value: seed }, uBright: { value: 1 }, uShine: { value: 0.012 }, uBK: { value: 0.1 } },
    vertexShader: VS, transparent: true,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uDis; uniform float uSeed; uniform float uBright; uniform float uShine; uniform float uBK; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = normalize(vP) + uSeed;
        float dn = fbm(p * 3.0 + 11.0);
        if (dn < uDis) discard;
        float mare = smoothstep(0.50, 0.60, fbm(p * 1.4 + 2.0));
        float det = fbm(p * 14.0);
        float cr = craters(p * 4.0) * 0.55 + craters(p * 11.0) * 0.28 + craters(p * 27.0) * 0.12;
        vec3 base = mix(vec3(0.46, 0.45, 0.43), vec3(0.17, 0.17, 0.18), mare * 0.85) * (0.75 + 0.5 * det);
        base *= 1.0 + 0.25 * smoothstep(0.1, 0.3, cr);
        vec3 N = normalize(vN); vec3 Nb = bumpN(vW, N, cr * 0.6 + det * 0.25, uBK);
        vec3 L = normalize(uSun); vec3 V = normalize(cameraPosition - vW);
        float ndl = max(dot(Nb, L), 0.0), ndv = max(dot(N, V), 0.0);
        float ls = ndl / (ndl + ndv + 1e-3) * 2.0;
        float diff = mix(ndl, ls, 0.55) * smoothstep(-0.02, 0.08, dot(N, L));
        vec3 c = base * diff * 2.0 * uBright + base * uShine;
        float edge = 1.0 - smoothstep(0.0, 0.035, dn - uDis);
        c += vec3(1.0, 0.45, 0.12) * edge * 4.0 * step(0.001, uDis);
        gl_FragColor = vec4(c, 1.0); }` });

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

  // ======================= ESPACE =======================
  const SPACE = new THREE.Group(); scene.add(SPACE);
  const earth = new THREE.Group(); SPACE.add(earth);
  const earthTilt = new THREE.Group(); earthTilt.rotation.z = 23.5 * DEG; earth.add(earthTilt);
  const earthSpin = new THREE.Group(); earthTilt.add(earthSpin);
  earthSpin.add(new THREE.Mesh(new THREE.SphereGeometry(10, 128, 64), earthMat));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(10.08, 96, 48), cloudMat); earthSpin.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(10.45, 96, 48), atmoMat); earth.add(atmo);
  // axe de rotation (fine ligne lumineuse)
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 30, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); earthTilt.add(axis);
  const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 26, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false })); earth.add(vert);
  // bourrelet de marée (exagéré)
  const mkBulgeMat = (col) => { const m = new THREE.ShaderMaterial({ uniforms: { uOp: { value: 0 }, uCol: { value: new THREE.Color(col) } }, vertexShader: VS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
      gl_FragColor = vec4(uCol * (fr * 1.1) * uOp, 1.0); }` });
    Object.defineProperty(m, 'opacity', { get() { return this.uniforms.uOp.value; }, set(v) { if (this.uniforms) this.uniforms.uOp.value = v; } }); return m; };
  const bulgeMat = mkBulgeMat(0x3a9cff);
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(10.2, 96, 48), bulgeMat); earth.add(bulge);
  const bulge2 = new THREE.Mesh(new THREE.SphereGeometry(10.2, 96, 48), mkBulgeMat(0x7fd0ff)); earth.add(bulge2);
  const moonSpace = new THREE.Mesh(new THREE.SphereGeometry(2.7, 128, 64), moonMat(0)); SPACE.add(moonSpace);
  const moonGhostMat = new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false });
  const moonGhost = new THREE.Mesh(new THREE.SphereGeometry(2.7, 18, 12), moonGhostMat); SPACE.add(moonGhost);
  // Soleil (disque + couronne), utilisé dans l'espace et dans le ciel
  const sunCoreMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 } }, vertexShader: VS, fog: false,
    fragmentShader: `uniform float uK; varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float mu = max(dot(normalize(vN), V), 0.0);
      vec3 c = vec3(1.0, 0.86, 0.62) * (0.45 + 0.55 * pow(mu, 0.5)) * 9.0 * uK; gl_FragColor = vec4(c, 1.0); }` });
  const coronaMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 }, uT: { value: 0 }, uStreak: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + `uniform float uK; uniform float uT; uniform float uStreak; varying vec2 vU; void main(){ float r = length(vU); float a = atan(vU.y, vU.x);
      float st = fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, uT * 0.05)) ; float streak = pow(st, 2.0) * 2.2;
      float g = exp(-(r - 0.18) * 9.0) * (0.6 + streak * uStreak) + exp(-r * 3.0) * 0.25;
      g *= smoothstep(0.17, 0.2, r) * (1.0 - smoothstep(0.85, 1.0, r));
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * g * uK, 1.0); }` });
  const SUN = new THREE.Group(); scene.add(SUN);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), sunCoreMat); SUN.add(sunCore);
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), coronaMat); SUN.add(corona);
  const eclMoon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), moonMat(3)); eclMoon.material.uniforms.uShine.value = 0.02; scene.add(eclMoon);

  // ======================= PAYSAGE NOCTURNE (LAND) =======================
  const n2 = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const h = (a, b) => rand(a * 57.3 + b * 131.7 + 7.1); return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v); };
  const f2 = (x, z) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * n2(x, z); x = x * 2.02 + 3.1; z = z * 2.02 + 1.7; a *= 0.5; } return s / 0.97; };
  const landH = (x, z) => { const base = 7 + 26 * (f2(x / 260 + 4, z / 260 + 2) - 0.45) + 5 * (f2(x / 60, z / 60) - 0.5);
    const coast = smooth(70, 190, x + 30 * (f2(z / 150, 3) - 0.5)); const flat = Math.exp(-(x * x + z * z) / (70 * 70));
    return lerp(lerp(base, 7, flat * 0.8), -14, coast); };
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: { uL: { value: V3(0.6, 0.35, 0.5).normalize() }, uLC: { value: new THREE.Color(0.55, 0.65, 1.0) }, uAmb: { value: new THREE.Color(0.02, 0.03, 0.06) },
      uFog: { value: new THREE.Color(0.01, 0.02, 0.045) }, uFogD: { value: new THREE.Vector2(80, 900) }, uSnow: { value: 0 }, uDry: { value: 0 }, uSand: { value: 0 }, uWet: { value: -99 }, uLunar: { value: 0 } },
    vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uL; uniform vec3 uLC; uniform vec3 uAmb; uniform vec3 uFog; uniform vec2 uFogD; uniform float uSnow; uniform float uDry; uniform float uSand; uniform float uWet; uniform float uLunar;
      varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 w = vW; vec2 cell = floor(w.xz / vec2(26.0, 19.0) + vec2(fbm3(vec3(w.xz * 0.01, 1.0)), 0.0));
        float hc = hash(vec3(cell, 2.0)); float det = fbm(vec3(w.xz * 0.35, 0.0)); float big = fbm(vec3(w.xz * 0.02, 4.0));
        vec3 g1 = vec3(0.10, 0.16, 0.04), g2 = vec3(0.20, 0.20, 0.07), g3 = vec3(0.24, 0.16, 0.08), g4 = vec3(0.06, 0.10, 0.03);
        vec3 col = hc < 0.3 ? g1 : (hc < 0.55 ? g2 : (hc < 0.75 ? g3 : g4));
        vec2 fc = fract(w.xz / vec2(26.0, 19.0)); float hedge = smoothstep(0.035, 0.0, min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)));
        float rows = 0.5 + 0.5 * sin((hc > 0.5 ? w.x : w.z) * 3.0); col *= 0.85 + 0.2 * rows * step(0.3, hc) * step(hc, 0.75);
        col = mix(col, vec3(0.03, 0.06, 0.02), hedge * 0.9);
        col *= 0.7 + 0.6 * det; col = mix(col, vec3(0.18, 0.16, 0.12), smoothstep(0.62, 0.8, big) * 0.6);
        vec3 N = normalize(vN); float slope = 1.0 - N.y; col = mix(col, vec3(0.16, 0.14, 0.11), smoothstep(0.25, 0.5, slope));
        col = mix(col, vec3(0.55, 0.45, 0.25) * (0.85 + 0.3 * det), uDry * (0.6 + 0.4 * det));
        col = mix(col, vec3(0.62, 0.65, 0.7) * (0.8 + 0.25 * det), uSnow * smoothstep(0.2, 0.5, det + 0.3 - slope));
        vec3 sand = vec3(0.62, 0.52, 0.36) * (0.82 + 0.35 * det) * (0.97 + 0.05 * sin(w.x * 2.0 + det * 6.0));
        float wet = smoothstep(uWet + 0.15, uWet - 0.3, w.y);
        sand = mix(sand, sand * vec3(0.48, 0.45, 0.42), wet);
        col = mix(col, sand, uSand);
        float cr = craters(vec3(w.xz * 0.09, 0.5)) * 0.6 + craters(vec3(w.xz * 0.35, 1.5)) * 0.3 + craters(vec3(w.xz * 1.4, 2.5)) * 0.12;
        vec3 lun = vec3(0.30, 0.295, 0.285) * (0.75 + 0.45 * det) * (1.0 + 0.3 * smoothstep(0.05, 0.3, cr));
        col = mix(col, lun, uLunar);
        float hb = det * mix(0.25, 0.15, uSand) + uLunar * cr * 0.9 + uSand * 0.05 * sin(w.x * 2.0 + det * 6.0);
        vec3 Nb = bumpN(vW, N, hb, 1.0);
        float ndl = max(dot(Nb, normalize(uL)), 0.0);
        vec3 c = col * (uLC * ndl + uAmb);
        vec3 V = normalize(cameraPosition - vW);
        c += uLC * pow(max(dot(Nb, normalize(normalize(uL) + V)), 0.0), 60.0) * wet * uSand * 0.5;
        float d = length(cameraPosition - vW); float fg = smoothstep(uFogD.x, uFogD.y, d);
        c = mix(c, uFog, fg);
        gl_FragColor = vec4(c, 1.0); }` });
  const LAND = new THREE.Group(); scene.add(LAND);
  const tg = new THREE.PlaneGeometry(900, 900, 260, 260); tg.rotateX(-Math.PI / 2); tg.translate(80, 0, 0);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, landH(p.getX(i), p.getZ(i))); tg.computeVertexNormals(); }
  const terrain = new THREE.Mesh(tg, terrainMat); LAND.add(terrain);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uL: { value: V3(1, 0.3, 0).normalize() }, uLC: { value: new THREE.Color(0.7, 0.8, 1.0) }, uT: { value: 0 }, uTop: { value: new THREE.Color(0.002, 0.004, 0.012) }, uHor: { value: new THREE.Color(0.02, 0.035, 0.07) },
      uDeep: { value: new THREE.Color(0.002, 0.008, 0.015) }, uFog: { value: new THREE.Color(0.01, 0.02, 0.045) }, uFogD: { value: new THREE.Vector2(80, 900) }, uGlit: { value: 1 }, uSharp: { value: 260 }, uShallow: { value: 0 } },
    vertexShader: VS, transparent: true,
    fragmentShader: NOISE + `uniform vec3 uL; uniform vec3 uLC; uniform float uT; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uDeep; uniform vec3 uFog; uniform vec2 uFogD; uniform float uGlit; uniform float uSharp; uniform float uShallow;
      varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vec2 p = vW.xz; float t = uT; float dd = length(cameraPosition - vW); float att = 1.0 / (1.0 + dd * 0.012);
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.35 + t * 1.3) * 0.10;
        g += vec2(-0.3, 0.95) * cos(dot(p, vec2(-0.3, 0.95)) * 0.6 + t * 1.7) * 0.07;
        g += vec2(0.95, -0.2) * cos(dot(p, vec2(0.95, -0.2)) * 1.3 + t * 2.4) * 0.05;
        g += vec2(0.2, 0.98) * cos(dot(p, vec2(0.2, 0.98)) * 2.7 + t * 3.1) * 0.03;
        float n1 = noise(vec3(p * 1.8, t * 0.6)), n2 = noise(vec3(p * 1.8 + 3.3, t * 0.6));
        g += (vec2(n1, n2) - 0.5) * 0.12; g *= att * 1.4;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW); vec3 R = reflect(-V, N);
        float fr = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 skyc = mix(uHor, uTop, smoothstep(0.0, 0.5, R.y));
        float sp = pow(max(dot(R, normalize(uL)), 0.0), uSharp);
        vec3 c = mix(uDeep, skyc, fr) + uLC * sp * 3.0 * uGlit;
        c = mix(c, uDeep * 3.0 + vec3(0.02, 0.05, 0.05), uShallow * (1.0 - fr));
        float d = length(cameraPosition - vW); c = mix(c, uFog, smoothstep(uFogD.x, uFogD.y, d));
        gl_FragColor = vec4(c, mix(0.96, 0.75, uShallow)); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2), waterMat); water.position.y = 0; scene.add(water);
  // village : maisons (murs + toits) + fenêtres
  const houses = [];
  for (let i = 0; i < 400 && houses.length < 60; i++) {
    const r = 8 + rand(i * 3.3) * 58, a = rand(i * 5.1) * Math.PI * 2, x = Math.cos(a) * r - 10, z = Math.sin(a) * r;
    if (Math.abs(z - x * 0.15) < 4) continue;   // rue
    if (houses.some(h => Math.hypot(h.x - x, h.z - z) < 11)) continue;
    houses.push({ x, z, y: landH(x, z), rot: Math.round(rand(i) * 4) * Math.PI / 2 + (rand(i * 2) - 0.5) * 0.3, w: 6 + rand(i * 7) * 3, d: 8 + rand(i * 9) * 4, h: 4.5 + rand(i * 4) * 2.5 });
  }
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b3a690'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = rand(i) ; g.fillStyle = `rgba(${v > 0.5 ? '255,245,225' : '60,50,40'},${0.04 + rand(i * 3) * 0.08})`; g.beginPath(); g.arc(rand(i * 1.3) * w, rand(i * 2.9) * h, 1 + rand(i * 5) * 9, 0, 7); g.fill(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(40,35,30,0.1)'); gr.addColorStop(1, 'rgba(40,35,30,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const tiles = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a2a1d'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = rand(x * 7 + y * 13); g.fillStyle = `rgb(${95 + v * 45},${42 + v * 22},${30 + v * 14})`; g.fillRect(x + ((y / 16) % 2) * 8, y, 15, 14); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + ((y / 16) % 2) * 8, y + 12, 15, 3); } });
  tiles.repeat.set(3, 2);
  const leafTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1a2a12'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { const v = rand(i * 1.1); g.fillStyle = v > 0.6 ? `rgba(70,95,40,0.5)` : (v > 0.3 ? 'rgba(10,18,6,0.6)' : 'rgba(40,60,25,0.5)'); g.beginPath(); g.ellipse(rand(i * 2.1) * w, rand(i * 3.7) * h, 2 + rand(i) * 5, 1.5 + rand(i * 9) * 3, rand(i * 4) * 3, 0, 7); g.fill(); } });
  leafTex.repeat.set(2, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95, bumpMap: plaster, bumpScale: 0.02 });
  const roofMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.75, bumpMap: tiles, bumpScale: 0.04 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb25a, emissiveIntensity: 1.6 });
  const roofGeo = new THREE.CylinderGeometry(0.62, 0.62, 1, 3, 1); roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2); roofGeo.rotateY(Math.PI / 2);
  const wallI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, houses.length);
  const roofI = new THREE.InstancedMesh(roofGeo, roofMat, houses.length);
  const winI = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 1.1), winMat, houses.length * 2);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler();
  houses.forEach((h, i) => {
    Q.setFromEuler(EU.set(0, h.rot, 0));
    M.compose(V3(h.x, h.y + h.h / 2 - 1, h.z), Q, V3(h.w, h.h + 2, h.d)); wallI.setMatrixAt(i, M);
    M.compose(V3(h.x, h.y + h.h + 0.93, h.z), Q, V3(h.w * 0.98, 3, h.d + 1.2)); roofI.setMatrixAt(i, M);
    for (let k = 0; k < 2; k++) {
      const lit = rand(i * 13 + k) > 0.55; const off = V3((k - 0.5) * h.w * 0.45, h.h * 0.55, h.d / 2 + 0.02).applyQuaternion(Q);
      M.compose(V3(h.x, h.y, h.z).add(off), Q, lit ? V3(1, 1, 1) : V3(0.001, 0.001, 0.001)); winI.setMatrixAt(i * 2 + k, M);
    }
  });
  LAND.add(wallI, roofI, winI);
  const GRASS_C = V3(-150, 0, 165); GRASS_C.y = landH(GRASS_C.x, GRASS_C.z);
  // arbres (feuillus + conifères)
  const trees = []; for (let i = 0; i < 3000 && trees.length < 900; i++) {
    const x = -250 + rand(i * 1.3) * 420, z = -330 + rand(i * 2.7) * 660, y = landH(x, z);
    if (y < 1.5 || Math.hypot(x + 10, z) < 75 && rand(i) > 0.15 || Math.hypot(x - GRASS_C.x, z - GRASS_C.z) < 30) continue;
    const hedgeLike = f2(x / 40, z / 40) > 0.55 || rand(i * 5) > 0.8; if (!hedgeLike) continue;
    trees.push({ x, y, z, s: 0.7 + rand(i * 4) * 0.8, kind: rand(i * 6) > 0.7 });
  }
  const crownGeo = new THREE.SphereGeometry(1, 28, 18); { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 0.78 + 0.32 * f2(v.x * 1.6 + 5, v.y * 1.6 + v.z * 1.3); p.setXYZ(i, v.x * k, v.y * k * 1.1, v.z * k); } crownGeo.computeVertexNormals(); }
  const crownI = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ map: leafTex, bumpMap: leafTex, bumpScale: 0.15, roughness: 1 }), trees.length);
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }), trees.length);
  trees.forEach((t, i) => { M.compose(V3(t.x, t.y + 6 * t.s, t.z), Q.setFromEuler(EU.set(0, rand(i) * 6, 0)), V3(3.6 * t.s, (t.kind ? 5 : 3.8) * t.s, 3.6 * t.s)); crownI.setMatrixAt(i, M);
    M.compose(V3(t.x, t.y + 1.5 * t.s, t.z), Q, V3(t.s, 3.5 * t.s, t.s)); trunkI.setMatrixAt(i, M); });
  LAND.add(crownI, trunkI);
  const landMats = [wallMat, roofMat, crownI.material, trunkI.material];
  // lune du ciel (et 2e lune pour la fin)
  const skyMoon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), moonMat(0)); scene.add(skyMoon);
  const skyMoon2 = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), moonMat(5.3)); scene.add(skyMoon2);
  const haloMat = new THREE.SpriteMaterial({ map: E.radialTex('rgba(150,175,255,0.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const halo = new THREE.Sprite(haloMat); scene.add(halo);
  const halo2 = new THREE.Sprite(haloMat.clone()); scene.add(halo2);
  // herbe du premier plan + papillons de nuit + yeux
  const bladeGeo = new THREE.ConeGeometry(0.018, 0.55, 3, 1); bladeGeo.translate(0, 0.35, 0);
  const NG = 6000; const grass = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x24341a, roughness: 0.9 }), NG); LAND.add(grass);
  const gData = []; for (let i = 0; i < NG; i++) { const x = GRASS_C.x + (rand(i * 1.1) - 0.5) * 30, z = GRASS_C.z + (rand(i * 2.3) - 0.5) * 30; gData.push([x, landH(x, z), z, 0.6 + rand(i * 3.7) * 0.9, rand(i * 4.1) * 6]); }
  const updGrass = t => { gData.forEach((g, i) => { const sw = Math.sin(t * 1.4 + g[0] * 0.3 + g[2] * 0.2) * 0.12; M.compose(V3(g[0], g[1] - 0.05, g[2]), Q.setFromEuler(EU.set(sw, g[4], sw * 0.6)), V3(1, g[3], 1)); grass.setMatrixAt(i, M); }); grass.instanceMatrix.needsUpdate = true; };
  updGrass(0);
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, -0.35, 0, 0.2, -0.3, 0, -0.12, 0, 0, 0.12, -0.3, 0, -0.12, 0, 0, -0.1, 0, 0, 0.12, 0.35, 0, 0.2, 0.3, 0, -0.12, 0, 0, 0.12, 0.3, 0, -0.12, 0, 0, -0.1], 3)); wingGeo.computeVertexNormals();
  const NM = 70; const moths = new THREE.InstancedMesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0xb0a48e, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x15120d }), NM); LAND.add(moths);
  const eyeI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 0.7), toneMapped: false }), 12); LAND.add(eyeI);

  // ======================= CÔTE (plage + port, de jour) =======================
  const COAST = new THREE.Group(); scene.add(COAST);
  const coastH = (x, z) => -x * 0.07 + 1.2 * (f2(x / 30 + 9, z / 30) - 0.5) + 6 * smooth(-40, -140, x) * f2(x / 80, z / 80 + 3);
  const cg = new THREE.PlaneGeometry(700, 700, 240, 240); cg.rotateX(-Math.PI / 2); cg.translate(0, 0, 0);
  { const p = cg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, coastH(p.getX(i), p.getZ(i))); cg.computeVertexNormals(); }
  const sandMat = terrainMat.clone(); sandMat.uniforms.uSand.value = 1;
  const beach = new THREE.Mesh(cg, sandMat); COAST.add(beach);
  const rockGeo = new THREE.IcosahedronGeometry(1, 3); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 0.7 + 0.5 * f2(v.x * 1.5 + 3, v.z * 1.5 + v.y); p.setXYZ(i, v.x * k, v.y * k * 0.7, v.z * k); } rockGeo.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshPhysicalMaterial({ color: 0x3b3a36, roughness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.4 }), 70); COAST.add(rocks);
  for (let i = 0; i < 70; i++) { const x = -5 + rand(i * 2.1) * 60, z = -50 + rand(i * 3.9) * 100, s = 0.4 + Math.pow(rand(i * 5.5), 2) * 2.6; M.compose(V3(x, coastH(x, z) + s * 0.1, z), Q.setFromEuler(EU.set(0, rand(i) * 6, 0)), V3(s, s, s)); rocks.setMatrixAt(i, M); }
  // port : quai en pierre avec traces d'algues, ponton, bateaux
  const quayTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    for (let y = 0; y < 512; y += 32) for (let x = 0; x < 512; x += 64) { const o2 = (y / 32) % 2 ? 32 : 0; const v = 95 + rand(x * 3 + y) * 50; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(x + o2 - 64, y, 62, 30); g.fillRect(x + o2, y, 62, 30); }
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, 'rgba(25,40,15,0.85)'); gr.addColorStop(1, 'rgba(15,25,10,0.95)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); return t; })();
  const PORT = new THREE.Group(); COAST.add(PORT); PORT.position.set(0, 0, -200);
  const quay = new THREE.Mesh(new THREE.BoxGeometry(120, 12, 10), new THREE.MeshStandardMaterial({ map: quayTex, roughness: 0.9 })); quay.position.set(-10, -3, -12); PORT.add(quay);
  const quayTop = new THREE.Mesh(new THREE.BoxGeometry(140, 0.4, 60), new THREE.MeshStandardMaterial({ color: 0x8c877c, roughness: 0.95 })); quayTop.position.set(-10, 3.2, -42); PORT.add(quayTop);
  const hullGeo = new THREE.LatheGeometry([[0, -0.9], [0.9, -0.7], [1.35, -0.1], [1.45, 0.6], [1.4, 0.75]].map(([x, y]) => new THREE.Vector2(x, y)), 24); hullGeo.scale(1, 1, 3.2);
  const boats = []; const boatCols = [0xe9e6df, 0x1f3f6b, 0xb8342a, 0xe9e6df, 0x2d5a3d, 0xd9cfb8];
  for (let i = 0; i < 6; i++) { const b = new THREE.Group(); const hull = new THREE.Mesh(hullGeo, new THREE.MeshPhysicalMaterial({ color: boatCols[i], roughness: 0.35, clearcoat: 0.8 })); b.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 7.6), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 })); deck.position.y = 0.62; b.add(deck);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 2.2), new THREE.MeshPhysicalMaterial({ color: 0xf2f0ea, roughness: 0.4, clearcoat: 0.5 })); cab.position.set(0, 1.3, -0.6); b.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.8, roughness: 0.3 })); mast.position.set(0, 5, 0.8); if (i % 2 === 0) b.add(mast);
    b.position.set(-48 + i * 15 + rand(i) * 3, 0, -4); b.rotation.y = (rand(i * 3) - 0.5) * 0.3; PORT.add(b); boats.push(b); }
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }), 10); PORT.add(posts);
  for (let i = 0; i < 10; i++) { M.compose(V3(-55 + i * 11, -2, -6.5), Q.identity(), V3(1, 1, 1)); posts.setMatrixAt(i, M); }
  const qW = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, 11), qR = new THREE.InstancedMesh(roofGeo, roofMat, 11), qWin = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.1, metalness: 0.6 }), 11 * 6);
  for (let i = 0; i < 11; i++) { const w = 9.5, hh = 8 + rand(i * 5.5) * 5, x = -62 + i * 10.2; M.compose(V3(x, 3.2 + hh / 2, -36), Q.identity(), V3(w, hh, 10)); qW.setMatrixAt(i, M);
    M.compose(V3(x, 3.2 + hh + 0.93, -36), Q.setFromEuler(EU.set(0, Math.PI / 2, 0)), V3(10, 3, w + 0.6)); qR.setMatrixAt(i, M);
    for (let j = 0; j < 6; j++) { M.compose(V3(x - 2.6 + (j % 3) * 2.6, 3.2 + 2.5 + Math.floor(j / 3) * 3.2, -30.98), Q.identity(), V3(1, 1, 1)); qWin.setMatrixAt(i * 6 + j, M); } }
  PORT.add(qW, qR, qWin);

  // ======================= RÈGLE (macro) =======================
  const RULER = new THREE.Group(); scene.add(RULER); RULER.position.set(0, 0, 0);
  const woodMat = new THREE.ShaderMaterial({ uniforms: { uL: { value: V3(-0.4, 0.8, 0.3).normalize() } }, vertexShader: VS,
    fragmentShader: NOISE + `uniform vec3 uL; varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vec2 p = vW.xz;
      float ring = sin((p.y * 6.0 + fbm(vec3(p * vec2(0.4, 2.0), 0.0)) * 8.0)) * 0.5 + 0.5; float g = fbm(vec3(p.x * 0.6, p.y * 14.0, 1.0));
      vec3 c = mix(vec3(0.07, 0.035, 0.015), vec3(0.16, 0.085, 0.04), ring * 0.6 + g * 0.4);
      vec3 N = bumpN(vW, normalize(vN), ring * 0.02 + g * 0.03, 1.0); float ndl = max(dot(N, normalize(uL)), 0.0);
      vec3 V = normalize(cameraPosition - vW); float sp = pow(max(dot(N, normalize(normalize(uL) + V)), 0.0), 40.0);
      float d = length(vW.xz - vec2(1.5, 0.0)); float vig = 1.0 - smoothstep(4.0, 16.0, d);
      gl_FragColor = vec4((c * (0.15 + 1.6 * ndl) + vec3(1.0, 0.9, 0.8) * sp * 0.25) * vig, 1.0); }` });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), woodMat); RULER.add(table);
  const rulerTex = (() => { const c = document.createElement('canvas'); c.width = 2048; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#c9ccd0'); gr.addColorStop(0.5, '#e4e6ea'); gr.addColorStop(1, '#b8bcc2'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 256);
    for (let i = 0; i < 2048; i++) { g.fillStyle = `rgba(0,0,0,${rand(i) * 0.05})`; g.fillRect(i, 0, 1, 256); }
    g.fillStyle = '#17191c'; const mm = 2048 / 100; // 10 cm visibles, 1 mm = 20.48 px
    for (let i = 0; i <= 100; i++) { const x = 40 + i * mm * 0.96, l = i % 10 === 0 ? 90 : (i % 5 === 0 ? 62 : 40); g.fillRect(x, 0, 3, l); if (i % 10 === 0) { g.font = '600 54px Inter'; g.textAlign = 'center'; g.fillText(String(i / 10), x + 1, 150); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.08, 1.3), [new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 0.9, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 0.9, roughness: 0.35 }),
    new THREE.MeshPhysicalMaterial({ map: rulerTex, metalness: 0.75, roughness: 0.32, clearcoat: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x9da1a6, metalness: 0.9, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 0.9, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0xaeb2b8, metalness: 0.9, roughness: 0.35 })]);
  ruler.position.set(1.5, 0.04, 0); ruler.material.forEach(m => m.envMapIntensity = 0.45); ruler.rotation.y = 0; RULER.add(ruler);
  const CM = 10.4 * 0.96 / 10, R0 = 1.5 - 5.2 + 10.4 * 40 / 2048;   // position x du zéro et taille d'1 cm
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.0, depthWrite: false });
  const hi = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25).rotateX(-Math.PI / 2), hiMat); hi.position.set(R0, 0.085, 0); RULER.add(hi);
  const rulerLight = new THREE.PointLight(0xfff0dd, 0, 30, 1.5); rulerLight.position.set(-2, 6, 4); RULER.add(rulerLight);

  // ======================= SOL LUNAIRE =======================
  const LUNAR = new THREE.Group(); scene.add(LUNAR);
  const lg = new THREE.PlaneGeometry(800, 800, 200, 200); lg.rotateX(-Math.PI / 2);
  { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 8 * (f2(x / 90, z / 90) - 0.5) + 3 * (f2(x / 25 + 5, z / 25) - 0.5) - Math.max(0, (Math.hypot(x, z) - 250) * 0.06)); } lg.computeVertexNormals(); }
  const lunarMat = terrainMat.clone(); lunarMat.uniforms.uLunar.value = 1; lunarMat.uniforms.uFogD.value.set(900, 1000);
  const lunar = new THREE.Mesh(lg, lunarMat); LUNAR.add(lunar);

  // ======================= helpers =======================
  const GROUPS = { SPACE, LAND, COAST, RULER, LUNAR, SUN, eclMoon, water, skyMoon, skyMoon2, halo, halo2 };
  const show = (...names) => { for (const k in GROUPS) GROUPS[k].visible = names.includes(k); };
  const followSky = () => { sky.position.copy(cam.position); starGrp.position.copy(cam.position); };
  const setSky = (o) => { const u = skyMat.uniforms; u.uDay.value = o.day ?? 0; u.uSpace.value = o.space ?? 0; u.uMoonK.value = o.moonK ?? 0; u.uMilky.value = o.milky ?? 0.5; u.uWarm.value = o.warm ?? 0;
    if (o.sun) u.uSun.value.copy(o.sun); if (o.moon) u.uMoon.value.copy(o.moon); };
  const L = E.lights;
  const lightsOff = () => { L.key.intensity = 0; L.hemi.intensity = 0; L.rim.intensity = 0; };
  const nightLook = (moonK, moonDir) => {   // nuit au clair de lune (moonK = 1) ou nuit noire (0)
    E.renderer.toneMappingExposure = lerp(1.1, 1.6, 1 - moonK);
    const lc = new THREE.Color(0.55, 0.66, 1.0).multiplyScalar(lerp(0.035, 0.75, moonK));
    terrainMat.uniforms.uLC.value.copy(lc); terrainMat.uniforms.uL.value.copy(moonDir);
    terrainMat.uniforms.uAmb.value.setRGB(0.012, 0.016, 0.034).multiplyScalar(lerp(1, 1.2, moonK));
    terrainMat.uniforms.uFog.value.setRGB(0.008, 0.016, 0.04).multiplyScalar(lerp(0.35, 1, moonK));
    terrainMat.uniforms.uSnow.value = 0; terrainMat.uniforms.uDry.value = 0;
    L.key.color.setRGB(0.6, 0.7, 1); L.key.intensity = lerp(0.03, 0.7, moonK); L.key.position.copy(moonDir.clone().multiplyScalar(100));
    L.hemi.color.setRGB(0.2, 0.26, 0.45); L.hemi.groundColor.setRGB(0.02, 0.02, 0.03); L.hemi.intensity = lerp(0.12, 0.3, moonK); L.rim.intensity = 0;
    const wu = waterMat.uniforms; wu.uL.value.copy(moonDir); wu.uLC.value.setRGB(0.75, 0.82, 1.0).multiplyScalar(moonK); wu.uTop.value.setRGB(0.002, 0.004, 0.012); wu.uHor.value.setRGB(0.012, 0.022, 0.05).multiplyScalar(lerp(0.4, 1.2, moonK));
    wu.uDeep.value.setRGB(0.001, 0.004, 0.008); wu.uFog.value.copy(terrainMat.uniforms.uFog.value); wu.uFogD.value.set(80, 900); wu.uGlit.value = 1; wu.uSharp.value = 220; wu.uShallow.value = 0;
    scene.fog = null; water.position.y = 0; moths.visible = false; eyeI.visible = false;
    landMats.forEach(m => m.envMapIntensity = lerp(0.01, 0.12, moonK)); grass.material.envMapIntensity = 0.02; moths.material.envMapIntensity = 0.15;
    setSky({ day: 0, space: 0, moonK, milky: lerp(0.9, 0.25, moonK), moon: moonDir }); setStars(lerp(1, 0.4, moonK));
  };
  const placeSkyMoon = (m, h, dir, ang, sunDir, k = 1) => { m.position.copy(cam.position).add(dir.clone().multiplyScalar(800)); m.scale.setScalar(800 * Math.tan(ang * DEG / 2));
    m.material.uniforms.uSun.value.copy(sunDir); m.material.uniforms.uBright.value = k; m.material.uniforms.uDis.value = 0; m.material.uniforms.uBK.value = 0.1 * m.scale.x / 2.7;
    h.position.copy(m.position); h.scale.setScalar(m.scale.x * 7); h.material.opacity = 0.55 * k; };
  const spaceLook = () => { E.renderer.toneMappingExposure = 1.0; scene.fog = null; setSky({ space: 1, milky: 0.7 }); setStars(1); lightsOff(); L.key.intensity = 2.5; L.key.position.copy(SUN_DIR.clone().multiplyScalar(100)); L.key.color.setRGB(1, 0.96, 0.9);
    earth.position.set(0, 0, 0); earth.scale.setScalar(1); earthTilt.rotation.set(0, 0, 23.5 * DEG); axis.material.opacity = 0; vert.material.opacity = 0; bulgeMat.opacity = 0; bulge2.material.opacity = 0; moonGhostMat.opacity = 0;
    moonSpace.visible = true; moonSpace.material.uniforms.uDis.value = 0; moonSpace.material.uniforms.uSun.value.copy(SUN_DIR); atmo.visible = true; moonGhost.visible = false;
    [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(SUN_DIR)); };
  const dayLook = (sunDir, warm = 0.2) => {
    E.renderer.toneMappingExposure = 0.9;
    terrainMat.uniforms; // (sable : sandMat)
    for (const m of [sandMat]) { m.uniforms.uL.value.copy(sunDir); m.uniforms.uLC.value.setRGB(1.9, 1.62, 1.25); m.uniforms.uAmb.value.setRGB(0.22, 0.27, 0.36); m.uniforms.uFog.value.setRGB(0.55, 0.64, 0.76); m.uniforms.uFogD.value.set(250, 1300); }
    L.key.color.setRGB(1, 0.88, 0.7); L.key.intensity = 2.6; L.key.position.copy(sunDir.clone().multiplyScalar(100)); L.hemi.color.setRGB(0.6, 0.72, 0.95); L.hemi.groundColor.setRGB(0.35, 0.3, 0.22); L.hemi.intensity = 0.9;
    const wu = waterMat.uniforms; wu.uL.value.copy(sunDir); wu.uLC.value.setRGB(1.6, 1.3, 0.9); wu.uTop.value.setRGB(0.12, 0.26, 0.55); wu.uHor.value.setRGB(0.6, 0.68, 0.78); wu.uDeep.value.setRGB(0.01, 0.06, 0.08);
    wu.uFog.value.setRGB(0.55, 0.64, 0.76); wu.uFogD.value.set(300, 1500); wu.uGlit.value = 0.7; wu.uSharp.value = 120; wu.uShallow.value = 0.6;
    setSky({ day: 1, space: 0, sun: sunDir, warm }); setStars(0); scene.fog = null;
  };
  // petite étiquette élégante (texte fin + trait)
  const label = (x, y, s, a = 1, size = 30, col = '#ffffff') => { if (a <= 0) return; const o = E.o; o.save(); o.globalAlpha = a; o.font = `600 ${size}px Inter`; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.shadowColor = 'rgba(0,0,0,0.7)'; o.shadowBlur = 10; o.fillStyle = col; o.fillText(s, x, y); const w = o.measureText(s).width; o.globalAlpha = a * 0.6; o.fillRect(x - w / 2, y + size * 0.75, w, 2); o.restore(); };
  const fadeBlack = (a) => { if (a > 0) { E.o.fillStyle = `rgba(0,0,0,${clamp(a)})`; E.o.fillRect(0, 0, 1080, 1920); } };
  const at = (w, after = 0) => E.at(w, after);
  const fitD = (r, fov, frac = 0.65) => r / frac / Math.tan(Math.atan(Math.tan(fov * DEG / 2) * 1080 / 1920));

  // ======================= temps (calés sur la voix) =======================
  const T = {
    lune: at('Lune'), efface: at("s'efface"), a384: at('à', 6.5), premiere: at('Première'), noires: at('noires'), plus2: at('Plus', 15.5),
    toits: at('toits'), champs: at('champs'), mer: at('mer'), beaucoup2: at('beaucoup', 20.5), papillons: at('papillons'), et2: at('et', 26.3), predateurs: at('prédateurs'),
    ensuite: at('Ensuite'), marees: at('marées'), le2: at('Le', 34), soleil2: at('Soleil', 34), resultat: at('Résultat'), moitie: at('moitié'), les3: at('Les', 43.3), ports: at('ports'),
    fini: at('Fini'), eclipses: at('éclipses'), plus3: at('Plus', 50), mais: at('Mais', 52), la4: at('La', 55), n235: at('23,5'), saisons: at('saisons', 59), la5: at('La', 60.3),
    sans: at('Sans'), vaciller: at('vaciller'), des6: at('Des', 69), extremes: at('extrêmes'), etla: at('Et', 72.3), rebond: at('rebondissement'), la7: at('la', 74.5), partir: at('partir'),
    elle8: at('Elle', 77.5), n38: at('3,8'), a9: at('À', 81), ongles: at('ongles'), pas: at('Pas', 84), alors: at('Alors'), ce10: at('ce', 90.5), caillou: at('caillou'), nuits10: at('nuits', 92),
    et11: at('Et', 94.3), deux: at('deux', 97.5), dis: at('Dis-le'), abonne: at('abonne-toi'),
  };

  // directions de la lune dans le ciel nocturne (au-dessus de la mer, vers +x)
  const MOON_DIR = V3(0.93, 0.27, -0.25).normalize();
  const MOON_SUN = MOON_DIR.clone().negate().add(V3(0, 0.05, 0.08)).normalize();   // pleine Lune : Soleil derrière nous
  const moonInSky = (k = 1, ang = 2.2) => { skyMoon.visible = halo.visible = k > 0.01; placeSkyMoon(skyMoon, halo, MOON_DIR, ang, MOON_SUN, k); };
  const moonOrbit = a => V3(Math.cos(a) * 46, Math.sin(a) * 2.5, -Math.sin(a) * 46);

  const shots = [
    // 1 — ACCROCHE : mer de nuit sous la pleine Lune, grue qui monte lentement
    { name: 'nuit-lune', start: 0, noFlash: true,
      update(t, lt, k) { show('LAND', 'water', 'skyMoon', 'halo'); const p = V3(165, lerp(9, 15, easeIO(k)), 55); cam.position.copy(p); cam.fov = 42; cam.updateProjectionMatrix();
        cam.lookAt(p.clone().add(V3(0.93, lerp(0.05, 0.16, easeIO(k)), -0.3))); nightLook(1, MOON_DIR); moonInSky(1, 2.6); followSky(); waterMat.uniforms.uT.value = t; },
      hud(t) { fadeBlack(1 - t / 0.6); } },
    // 2 — LA LUNE vue de l'espace, la Terre en croissant derrière ; à « s'efface », elle se désintègre en particules
    { name: 'lune-espace', start: T.lune,
      update(t, lt, k) { show('SPACE'); spaceLook(); const mp = V3(-8, 3, 30); moonSpace.position.copy(mp); moonSpace.rotation.y = t * 0.02 + 1.2;
        const dir = V3(0.45, 0.12, 1).normalize(); const d = lerp(24, 20.5, easeIO(k)); cam.position.copy(mp.clone().add(dir.multiplyScalar(d))); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(mp.clone().add(V3(-0.8, -0.6, 0)));
        earthSpin.rotation.y = t * 0.01; const dis = clamp((t - T.efface) / 1.7); moonSpace.material.uniforms.uDis.value = dis < 0.001 ? 0 : lerp(0.28, 0.95, dis);
        if (t > T.efface) { const tt = t - T.efface; for (let i = 0; i < 1800; i++) { const u = rand(i * 1.37) * 2 - 1, a = rand(i * 2.71) * 6.283, s = Math.sqrt(1 - u * u); const n = V3(Math.cos(a) * s, u, Math.sin(a) * s);
            const t0 = rand(i * 4.2) * 1.5; if (tt < t0) continue; const age = tt - t0; const pos = mp.clone().add(n.multiplyScalar(2.7 + age * (0.6 + rand(i * 3.3) * 1.6))).add(V3(age * age * 0.3, 0, 0));
            E.dot(pos, 0.035 * (1 - clamp(age / 3)) + 0.01, age < 0.3 ? 0xffa060 : 0x6a6660); } } } },
    // 3 — ORBITE VIDE : la Terre seule, l'orbite où était la Lune, distance
    { name: 'orbite-vide', start: T.a384, sfx: 'whoosh',
      update(t, lt, k) { show('SPACE'); spaceLook(); moonSpace.visible = false; earthSpin.rotation.y = t * 0.012;
        const ang = lerp(0.9, 1.25, easeIO(k)); const d = lerp(78, 95, easeIO(k)); cam.position.set(Math.sin(ang) * d, lerp(26, 32, k), Math.cos(ang) * d); cam.fov = 45; cam.updateProjectionMatrix(); cam.lookAt(V3(0, -4, 0));
        const pts = []; for (let i = 0; i <= 240; i++) pts.push(moonOrbit(i / 240 * 6.2832)); E.line3(0, pts, 0x8fb0ff, 0.35 * ease(lt / 0.8), 1);
        const mp = moonOrbit(0.5); moonGhost.position.copy(mp); moonGhostMat.opacity = 0.18 * ease(lt / 0.6); E.line3(1, [V3(0, 0, 0), mp], 0xffffff, 0.5 * ease((lt - 0.3) / 0.6), ease((lt - 0.3) / 1.2)); },
      hud(t, lt) { const mp = moonOrbit(0.5); const [x, y, z] = E.proj(mp.clone().multiplyScalar(0.5)); const v = Math.round(384000 * ease(clamp((t - T.a384) / 0.9)) / 1000) * 1000;
        label(540, 470, v.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' km', ease((lt - 0.2) / 0.5), 36, '#e8eefc'); } },
    // 4 — VILLAGE DE NUIT : au clair de lune puis tout devient noir à « noires »
    { name: 'village-nuit', start: T.premiere,
      update(t, lt, k) { show('LAND', 'water', 'skyMoon', 'halo'); const mk = 1 - smooth(T.noires - 0.6, T.noires + 0.4, t);
        nightLook(mk, MOON_DIR); moonInSky(0, 2.2); skyMoon.visible = halo.visible = false; winMat.emissiveIntensity = 1.4;
        const a = lerp(-0.25, -0.05, easeIO(k)); const p = V3(-95 + lerp(0, 18, easeIO(k)), 48 - lerp(0, 6, k), 70 + lerp(0, -10, k)); cam.position.copy(p); cam.fov = 45; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 2, -5 + a * 10)); followSky(); waterMat.uniforms.uT.value = t; } },
    // 5 — TRAVELLING : toits → champs → mer, plus de lumière argentée
    { name: 'travelling', start: T.plus2,
      update(t, lt, k) { show('LAND', 'water'); nightLook(0.2, MOON_DIR); winMat.emissiveIntensity = 1.4;
        const s = easeIO(k); const x = lerp(-30, 150, s), z = lerp(25, -20, s); const y = Math.max(landH(x, z), 0) + lerp(22, 16, s);
        cam.position.set(x, y, z + 40); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(x + 40, Math.max(landH(x + 40, z), 0) + 4, z - 10)); followSky(); waterMat.uniforms.uT.value = t; },
    },
    // 6 — ANIMAUX NOCTURNES : prairie très sombre, papillons de nuit qui tournent sans repère
    { name: 'papillons', start: T.beaucoup2,
      update(t, lt, k) { show('LAND', 'water'); nightLook(0.12, MOON_DIR); winMat.emissiveIntensity = 1.2; L.hemi.intensity = 0.22;
        const c = GRASS_C.clone().add(V3(0, 1.2, 0)); const ang = lerp(2.4, 2.1, easeIO(k)); cam.position.set(c.x + Math.sin(ang) * 6, c.y + 0.4, c.z + Math.cos(ang) * 6); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(c.clone().add(V3(0, 2.6, 0)));
        updGrass(t); followSky();
        for (let i = 0; i < NM; i++) { const ph = rand(i * 3.1) * 6.28, sp = 0.8 + rand(i * 1.9) * 1.2, r = 0.6 + rand(i * 7.7) * 2.6;
          const lost = t < T.papillons ? 1 : 1; const tt = t * sp + ph;
          const p = c.clone().add(V3(Math.cos(tt) * r + Math.sin(tt * 2.3) * 0.5 * lost, 0.4 + rand(i * 2.2) * 2.4 + Math.sin(tt * 3.1) * 0.6, Math.sin(tt * 1.3) * r + Math.cos(tt * 1.7) * 0.6));
          const fl = Math.abs(Math.sin(t * 26 + i)) * 0.85 + 0.15; M.compose(p, Q.setFromEuler(EU.set(0.9 + Math.sin(tt) * 0.4, -tt, 0.2)), V3(fl * 0.32, 0.32, 0.32)); moths.setMatrixAt(i, M); }
        moths.instanceMatrix.needsUpdate = true; moths.visible = true; eyeI.visible = false; } },
    // 7 — PRÉDATEURS : des yeux qui brillent dans l'herbe noire
    { name: 'predateurs', start: T.et2,
      update(t, lt, k) { show('LAND', 'water'); nightLook(0.04, MOON_DIR); L.hemi.intensity = 0.12; winMat.emissiveIntensity = 0;
        const c = GRASS_C.clone().add(V3(4, 0.6, -4)); cam.position.set(c.x - 2 + lerp(0, 1.2, k), c.y + 0.45, c.z + 9 - lerp(0, 2.2, easeIO(k))); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(c.clone().add(V3(0, 0, -6)));
        updGrass(t); followSky(); moths.visible = false; eyeI.visible = true;
        const eyes = [[-1.5, 0.35, -6, 0.6], [2.3, 0.5, -9, 1.4], [0.4, 0.25, -4.5, 2.0], [-4, 0.55, -11, 2.6], [4.5, 0.3, -7, 3.1], [-0.8, 0.45, -13, 1.0]];
        eyes.forEach(([x, y, z, d], i) => { const on = smooth(T.et2 + d * 0.6, T.et2 + d * 0.6 + 0.3, t); const blink = Math.abs(Math.sin(t * 0.9 + i * 2)) > 0.97 ? 0.1 : 1; const s = on * blink;
          for (let e = 0; e < 2; e++) { M.compose(V3(c.x + x + e * 0.16, c.y + y, c.z + z), Q.identity(), V3(s, s * 0.8, s)); eyeI.setMatrixAt(i * 2 + e, M); } });
        eyeI.instanceMatrix.needsUpdate = true; } },
    // 8 — L'OCÉAN depuis l'espace, puis le bourrelet de marée tiré par la Lune (fantôme)
    { name: 'maree-espace', start: T.ensuite,
      update(t, lt, k) { show('SPACE'); spaceLook(); moonSpace.visible = false; earthSpin.rotation.y = 2.2 + t * 0.012; earthMat.uniforms.uCity.value = 1;
        const mp = V3(46, 0, -4); moonGhost.position.copy(mp); const g = smooth(T.marees - 0.2, T.marees + 0.8, t); moonGhostMat.opacity = 0.22 * g; moonSpace.visible = true; moonSpace.position.copy(mp); moonSpace.material.uniforms.uDis.value = g < 0.99 ? lerp(1.05, 0.06, g) : 0;
        bulge.scale.set(1 + 0.11 * g, 1 - 0.03 * g, 1 - 0.03 * g); bulge.rotation.set(0, Math.atan2(4, 46), 0); bulgeMat.opacity = 0.9 * g;
        const s = easeIO(k); cam.position.set(lerp(10, 26, s), lerp(40, 60, s), lerp(66, 92, s)); cam.fov = 42; cam.updateProjectionMatrix(); cam.lookAt(V3(lerp(0, 18, s), lerp(0, -4, s), 0)); } },
    // 9 — LE SOLEIL aussi : marée solaire plus faible (environ la moitié)
    { name: 'maree-soleil', start: T.le2,
      update(t, lt, k) { show('SPACE', 'SUN'); spaceLook(); earthSpin.rotation.y = 2.2 + t * 0.012; moonSpace.visible = true; const mp = V3(5, 33, -2); moonSpace.position.copy(mp);
        const sp = V3(8, -29, 22); SUN.position.copy(sp); SUN.scale.setScalar(2.6); sunCoreMat.uniforms.uK.value = 1; coronaMat.uniforms.uK.value = 0.5; coronaMat.uniforms.uStreak.value = 0.25; corona.scale.setScalar(1);
        const sdir = sp.clone().normalize(); [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(sdir)); moonSpace.material.uniforms.uSun.value.copy(sdir.clone().add(V3(0.6, 0, 0.6)).normalize());
        const X = V3(1, 0, 0); bulge.quaternion.setFromUnitVectors(X, mp.clone().normalize()); bulge.scale.set(1.11, 0.97, 0.97); bulgeMat.opacity = 0.9 * (1 - 0.35 * smooth(T.soleil2, T.soleil2 + 1.2, t));
        const g = smooth(T.soleil2, T.soleil2 + 1.2, t); bulge2.quaternion.setFromUnitVectors(X, sdir); bulge2.scale.set(1 + 0.05 * g, 1 - 0.015 * g, 1 - 0.015 * g); bulge2.material.opacity = 0.9 * g;
        const s = easeIO(k); cam.position.set(lerp(30, 22, s), lerp(2, -2, s), lerp(96, 102, s)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(0, -3, 0)); corona.lookAt(cam.position); },
      hud(t, lt) { const [x1, y1, z1] = E.proj(V3(5, 33, -2).add(V3(0, 4, 0))); const [x2, y2, z2] = E.proj(V3(8, -29, 22).add(V3(9, 3, 0)));
        if (z1 < 1) label(x1, y1 - 40, 'Lune', ease(lt / 0.6), 28, '#dfe6ff'); if (z2 < 1) label(Math.min(x2 + 150, 860), y2, 'Soleil : effet ≈ 2× plus faible', ease((t - T.soleil2) / 0.6), 28, '#ffe2b0'); },
    },
    // 10 — PLAGE : time-lapse des marées, l'amplitude diminue de plus de moitié
    { name: 'plage', start: T.resultat,
      update(t, lt, k) { show('COAST', 'water'); const sunDir = V3(0.5, 0.28, -0.82).normalize(); dayLook(sunDir, 0.35); PORT.visible = false; beach.visible = true; rocks.visible = true;
        const amp = lerp(2.6, 1.1, smooth(T.moitie - 0.6, T.moitie + 0.8, t)); const lev = Math.sin(lt * 2.4) * amp; water.position.y = lev; sandMat.uniforms.uWet.value = amp;
        waterMat.uniforms.uT.value = t * 0.8; cam.position.set(lerp(-60, -52, k), 12, lerp(48, 40, k)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(20, 3, -14)); followSky();
        const dk = 0.5 + 0.5 * Math.sin(lt * 2.4); for (let i = 0; i < 260; i++) { const z = -60 + i * 0.5; const x = (-lev / 0.07) + Math.sin(i * 0.7 + t * 2) * 1.2; E.dot(V3(x, lev + 0.05, z), 0.09 + 0.05 * rand(i), 0x8a9098); } },
    },
    // 11 — PORT : bateaux qui montent et descendent le long du quai (traces d'algues = ancienne marée haute)
    { name: 'port', start: T.les3,
      update(t, lt, k) { show('COAST', 'water'); PORT.visible = true; beach.visible = false; rocks.visible = false; const sunDir = V3(0.5, 0.28, -0.82).normalize(); dayLook(sunDir, 0.35);
        const lev = -1.4 + Math.sin(lt * 1.6) * 0.8; water.position.y = lev; boats.forEach((b, i) => { b.position.y = lev + 0.15 + Math.sin(t * 1.3 + i) * 0.08; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.03; });
        waterMat.uniforms.uT.value = t; const s = easeIO(k); cam.position.set(lerp(30, 18, s), lerp(9, 7, s), -200 + lerp(36, 30, s)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(-14, 0, -212)); followSky(); } },
    // 12 — ÉCLIPSE totale vue du sol, puis la Lune n'est plus là : plein Soleil
    { name: 'eclipse', start: T.fini,
      update(t, lt, k) { show('LAND', 'SUN', 'eclMoon'); const g = smooth(T.plus3 - 0.2, T.plus3 + 1.4, t);
        const sd = V3(0.86, 0.42, -0.3).normalize(); cam.position.set(-60, 26, 20); cam.fov = 38; cam.updateProjectionMatrix(); cam.lookAt(cam.position.clone().add(sd.clone().add(V3(0, lerp(-0.1, -0.32, smooth(T.plus3, T.mais, t)), 0))));
        nightLook(0.25, sd); terrainMat.uniforms.uLC.value.setRGB(0.6, 0.45, 0.3).multiplyScalar(lerp(0.06, 1.2, g)); terrainMat.uniforms.uAmb.value.setRGB(0.02, 0.025, 0.04).multiplyScalar(lerp(1, 6, g));
        terrainMat.uniforms.uFog.value.setRGB(0.04, 0.05, 0.09).lerp(new THREE.Color(0.5, 0.58, 0.7), g); terrainMat.uniforms.uFogD.value.set(60, 700);
        setSky({ day: g, warm: lerp(0.9, 0.12, g), sun: sd, milky: 0, moonK: 0 }); setStars(0.5 * (1 - g)); E.renderer.toneMappingExposure = lerp(1.2, 0.7, g);
        L.key.intensity = lerp(0.05, 2, g); L.key.color.setRGB(1, 0.9, 0.75); L.key.position.copy(sd.clone().multiplyScalar(100)); L.hemi.intensity = lerp(0.1, 0.8, g); L.hemi.color.setRGB(0.6, 0.7, 0.9);
        winMat.emissiveIntensity = lerp(1.2, 0, g);
        SUN.position.copy(cam.position).add(sd.clone().multiplyScalar(700)); SUN.scale.setScalar(700 * Math.tan(0.75 * DEG)); corona.lookAt(cam.position);
        sunCoreMat.uniforms.uK.value = lerp(0.0, 0.22, g); coronaMat.uniforms.uK.value = lerp(1.25, 0.06, g); E.bloom.strength = lerp(0.42, 0.18, g); coronaMat.uniforms.uStreak.value = lerp(1, 0.2, g); coronaMat.uniforms.uT.value = t; corona.scale.setScalar(1);
        const slide = ease(smooth(T.plus3 - 0.2, T.plus3 + 1.6, t)); const side = new THREE.Vector3().crossVectors(sd, V3(0, 1, 0)).normalize();
        eclMoon.position.copy(cam.position).add(sd.clone().multiplyScalar(690)).add(side.multiplyScalar(slide * 30)); eclMoon.scale.setScalar(690 * Math.tan(0.78 * DEG)); eclMoon.material.uniforms.uSun.value.copy(sd); eclMoon.material.uniforms.uDis.value = g > 0.5 ? lerp(0, 1.05, (g - 0.5) * 2) : 0;
        followSky(); },
    },
    // 13 — LE PLUS FOU EST INVISIBLE : la Terre dans l'ombre, puis l'axe penché de 23,5°
    { name: 'inclinaison', start: T.mais,
      update(t, lt, k) { show('SPACE'); spaceLook(); moonSpace.visible = false; earthSpin.rotation.y = t * 0.05; const s = easeIO(k);
        const sdir = V3(1, 0.1, 0.2).normalize(); [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(sdir));
        const ax = smooth(T.n235 - 0.6, T.n235 + 0.4, t); axis.material.opacity = 0.9 * ax; vert.material.opacity = 0.35 * ax;
        const ang = lerp(-0.6, 0.25, s); const d = lerp(fitD(10, 44, 0.75), fitD(15, 44, 0.75), s); cam.position.set(Math.sin(ang) * d, lerp(4, 6, s), Math.cos(ang) * d); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 0, 0));
        if (ax > 0.01) { const pts = []; for (let i = 0; i <= 30; i++) { const a = 23.5 * DEG * i / 30 * ease(ax); pts.push(V3(Math.sin(-a) * 12.5 * -1, Math.cos(a) * 12.5, 0)); } E.line3(2, pts, 0xffd27a, 0.9 * ax, 1); } },
      hud(t, lt) { const [x, y, z] = E.proj(V3(-2.6, 13.6, 0)); if (z < 1) label(x - 20, y - 50, '23,5°', ease((t - T.n235) / 0.4), 40, '#ffe1a0');
        const [x2, y2, z2] = E.proj(V3(0, -12.5, 0)); if (z2 < 1) label(x2, y2 + 60, 'saisons', ease((t - T.saisons) / 0.5) * 0.9, 28, '#e8eefc'); } },
    // 14 — LA LUNE STABILISE l'axe (orbite + Lune qui tourne autour, axe immobile)
    { name: 'stabilise', start: T.la5,
      update(t, lt, k) { show('SPACE'); spaceLook(); earthSpin.rotation.y = t * 0.05; axis.material.opacity = 0.9; vert.material.opacity = 0.3;
        const a = 0.4 + lt * 0.35; const mp = moonOrbit(a).multiplyScalar(0.62); moonSpace.position.copy(mp); moonSpace.rotation.y = -a;
        const pts = []; for (let i = 0; i <= 200; i++) pts.push(moonOrbit(i / 200 * 6.2832).multiplyScalar(0.62)); E.line3(0, pts, 0x9fb8ff, 0.28, 1);
        const s = easeIO(k); cam.position.set(lerp(30, 20, s), lerp(30, 24, s), lerp(48, 56, s)); cam.fov = 45; cam.updateProjectionMatrix(); cam.lookAt(V3(0, -2, 0)); } },
    // 15 — SANS ELLE : l'axe vacille (exagéré, très lentement en réalité)
    { name: 'vacille', start: T.sans,
      update(t, lt, k) { show('SPACE'); spaceLook(); moonSpace.visible = false; earthSpin.rotation.y = t * 0.05; axis.material.opacity = 0.95; vert.material.opacity = 0.3;
        const w = smooth(T.vaciller - 0.5, T.vaciller + 0.8, t); const tilt = 23.5 * DEG + w * Math.sin(lt * 1.6) * 30 * DEG; earthTilt.rotation.set(w * Math.sin(lt * 1.1) * 0.35, 0, tilt);
        const s = easeIO(k); cam.position.set(lerp(-8, 8, s), lerp(6, 9, s), fitD(15, 44, 0.75)); cam.fov = 44; cam.updateProjectionMatrix(); cam.lookAt(V3(0, 0, 0));
        // trace de l'extrémité de l'axe
        const pts = []; for (let i = 0; i <= 120; i++) { const tt = Math.max(0, lt - i * 0.03); const ww = smooth(T.vaciller - 0.5, T.vaciller + 0.8, T.sans + tt); const ti = 23.5 * DEG + ww * Math.sin(tt * 1.6) * 30 * DEG; const tx = ww * Math.sin(tt * 1.1) * 0.35;
          pts.push(V3(0, 15, 0).applyEuler(new THREE.Euler(tx, 0, ti))); } E.line3(3, pts, 0xff9a5a, 0.7 * w, 1); },
      hud(t, lt) { label(540, 330, 'mouvement accéléré', 0.75 * ease((t - T.vaciller) / 0.5), 24, '#cfd6e6'); } },
    // 16 — SAISONS BOULEVERSÉES : time-lapse jour/nuit, neige ↔ sécheresse
    { name: 'saisons-folles', start: T.des6,
      update(t, lt, k) { show('LAND', 'water'); const ph = lt * 2.6; const day = clamp(Math.sin(ph) * 1.6 + 0.3); const sd = V3(Math.cos(ph) * 0.8, Math.sin(ph) * 0.6 + 0.1, -0.4).normalize();
        nightLook(0.6, sd); terrainMat.uniforms.uLC.value.setRGB(1.7, 1.45, 1.15).multiplyScalar(day + 0.03); terrainMat.uniforms.uAmb.value.setRGB(0.12, 0.15, 0.2).multiplyScalar(day + 0.15); terrainMat.uniforms.uFog.value.setRGB(0.4, 0.48, 0.6).multiplyScalar(day * 0.9 + 0.05);
        terrainMat.uniforms.uSnow.value = clamp(Math.sin(lt * 1.4 + 0.5) * 1.5); terrainMat.uniforms.uDry.value = clamp(-Math.sin(lt * 1.4 + 0.5) * 1.5);
        setSky({ day: day, sun: sd, warm: 0.3 * (1 - Math.abs(day - 0.5) * 2), moonK: 0, milky: 0.6 }); setStars(1 - day); E.renderer.toneMappingExposure = lerp(1.4, 0.9, day);
        L.key.intensity = 2.2 * day; L.key.position.copy(sd.clone().multiplyScalar(100)); L.hemi.intensity = 0.1 + 0.6 * day; winMat.emissiveIntensity = 1.2 * (1 - day);
        const wu = waterMat.uniforms; wu.uL.value.copy(sd); wu.uLC.value.setRGB(1.4, 1.2, 0.9).multiplyScalar(day); wu.uTop.value.setRGB(0.1, 0.22, 0.5).multiplyScalar(day + 0.02); wu.uHor.value.setRGB(0.5, 0.58, 0.7).multiplyScalar(day + 0.03); wu.uFog.value.copy(terrainMat.uniforms.uFog.value);
        cam.position.set(-120 + lt * 3, 60, 120); cam.fov = 46; cam.updateProjectionMatrix(); cam.lookAt(V3(10, 0, -10)); followSky(); waterMat.uniforms.uT.value = t * 3; } },
    // 17 — REBONDISSEMENT : la Lune est revenue… et elle s'éloigne (spirale exagérée)
    { name: 'eloignement', start: T.etla,
      update(t, lt, k) { show('SPACE'); spaceLook(); earthSpin.rotation.y = t * 0.03;
        const back = smooth(T.rebond - 0.3, T.rebond + 0.6, t); moonSpace.material.uniforms.uDis.value = back < 0.999 ? lerp(1.05, 0.05, back) : 0;
        const go = smooth(T.partir - 1.5, T.partir + 3.5, t); const r = lerp(30, 52, go), a = 0.9 + lt * 0.18; moonSpace.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r); moonSpace.rotation.y = -a;
        const pts = []; for (let i = 0; i <= 300; i++) { const aa = 0.9 + (i / 300) * lt * 0.18 - 0; const gg = smooth(T.partir - 1.5, T.partir + 3.5, T.etla + (i / 300) * lt); const rr = lerp(30, 52, gg); pts.push(V3(Math.cos(aa) * rr, 0, -Math.sin(aa) * rr)); }
        E.line3(0, pts, 0x9fb8ff, 0.4 * go, 1);
        const s = easeIO(k); cam.position.set(lerp(14, 4, s), lerp(46, 70, s), lerp(46, 60, s)); cam.fov = 46; cam.updateProjectionMatrix(); cam.lookAt(V3(lerp(8, 6, s), 0, -lerp(10, 14, s))); } },
    // 18 — 3,8 CM PAR AN : compteur sur la distance Terre–Lune
    { name: 'compteur', start: T.elle8,
      update(t, lt, k) { show('SPACE'); spaceLook(); earthSpin.rotation.y = t * 0.03; const mp = V3(34, 0, -4); moonSpace.position.copy(mp); moonSpace.rotation.y = t * 0.02;
        E.line3(1, [V3(10.6, 0, -1.2), mp.clone().add(V3(-2.9, 0, 0.35))], 0xffffff, 0.45, ease(lt / 0.8));
        const s = easeIO(k); cam.position.set(lerp(16, 18, s), lerp(-6, -9, s), lerp(150, 138, s)); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(V3(16, -1, -2)); },
      hud(t, lt) { const [x, y] = E.proj(V3(18, 4, -2)); label(x, y - 30, '+ 3,8 cm / an', ease((t - T.n38) / 0.4), 40, '#ffe1a0'); } },
    // 19 — MACRO : règle en acier, 3,8 cm surlignés (≈ pousse des ongles en un an)
    { name: 'regle', start: T.a9,
      update(t, lt, k) { show('RULER'); E.renderer.toneMappingExposure = 1.0; scene.fog = null; setSky({ space: 1, milky: 0 }); setStars(0); lightsOff();
        L.key.intensity = 2.2; L.key.color.setRGB(1, 0.95, 0.88); L.key.position.set(-30, 60, 25); L.hemi.intensity = 0.25; L.hemi.color.setRGB(0.7, 0.75, 0.9); rulerLight.intensity = 8;
        const g = ease(clamp((t - T.a9 - 0.3) / 1.6)); hi.scale.x = Math.max(0.001, 3.8 * CM * g); hi.position.x = R0 + 3.8 * CM * g / 2; hiMat.opacity = 0.7;
        const s = easeIO(k); cam.position.set(lerp(-1.6, -1.3, s), lerp(10.5, 9.4, s), lerp(11, 9.8, s)); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(V3(R0 + 2.2, 0, 0.1)); followSky(); },
      hud(t, lt) { const [x, y] = E.proj(V3(R0 + 1.9 * CM, 0.1, -0.7)); label(x, y - 60, '3,8 cm', ease((t - T.a9 - 0.6) / 0.5), 38, '#ffe1a0');
        label(540, 1110, '≈ ce que poussent tes ongles en un an', ease((t - T.ongles + 0.3) / 0.5) * 0.9, 30, '#e6e6e6'); } },
    // 20 — PAS DE PANIQUE : lever de Terre depuis le sol lunaire
    { name: 'lever-terre', start: T.pas,
      update(t, lt, k) { show('LUNAR', 'SPACE'); spaceLook(); moonSpace.visible = false; const sd = V3(-0.9, 0.12, -0.2).normalize(); lunarMat.uniforms.uL.value.copy(sd); lunarMat.uniforms.uLC.value.setRGB(2.2, 2.1, 2.0); lunarMat.uniforms.uAmb.value.setRGB(0.01, 0.012, 0.016); lunarMat.uniforms.uFog.value.setRGB(0, 0, 0);
        [earthMat, cloudMat, atmoMat].forEach(m => m.uniforms.uSun.value.copy(sd)); earth.position.set(40, lerp(-22, 4, easeIO(k)), -380); earth.scale.setScalar(4.6); earthSpin.rotation.y = 1 + t * 0.02;
        cam.position.set(lerp(0, 4, k), 6, 40); cam.fov = 40; cam.updateProjectionMatrix(); cam.lookAt(V3(30, 8, -300)); followSky(); setStars(0.9); } },
    // 21 — RETOUR SUR TERRE : la mer de nuit, on lève les yeux vers la Lune, puis gros plan sur le « caillou »
    { name: 'retour-lune', start: T.alors,
      update(t, lt, k) { show('LAND', 'water', 'skyMoon', 'halo'); nightLook(1, MOON_DIR); winMat.emissiveIntensity = 1.4; earth.position.set(0, 0, 0); earth.scale.setScalar(1);
        const p = V3(170, 7, 30); cam.position.copy(p); const z = smooth(T.ce10 - 0.4, T.ce10 + 1.6, t); cam.fov = lerp(44, 9, easeIO(z)); cam.updateProjectionMatrix();
        cam.lookAt(p.clone().add(MOON_DIR.clone().multiplyScalar(10)).add(V3(0, lerp(-1.6, 0, easeIO(clamp(k * 2))), 0)));
        moonInSky(1, 2.4); skyMoon.rotation.y = t * 0.01; followSky(); waterMat.uniforms.uT.value = t; },
    },
    // 22 — ET TOI ? deux Lunes au-dessus de la mer, puis retour dans l'espace
    { name: 'deux-lunes', start: T.et11,
      update(t, lt, k) { show('LAND', 'water', 'skyMoon', 'halo', 'skyMoon2', 'halo2'); nightLook(1, MOON_DIR); winMat.emissiveIntensity = 1.4;
        const p = V3(185, lerp(10, 16, easeIO(k)), 70); cam.position.copy(p); cam.fov = 46; cam.updateProjectionMatrix(); cam.lookAt(p.clone().add(V3(0.92, 0.22, -0.35)));
        moonInSky(1, 2.5); const d2 = V3(0.8, 0.42, -0.5).normalize(); const g = smooth(T.deux - 0.3, T.deux + 0.7, t); skyMoon2.visible = halo2.visible = g > 0.01;
        placeSkyMoon(skyMoon2, halo2, d2, 1.5, d2.clone().negate().add(V3(0.5, 0.1, 0.3)).normalize(), g); followSky(); waterMat.uniforms.uT.value = t; },
      hud(t) { fadeBlack(smooth(E.TOTAL - 1.0, E.TOTAL, t)); } },
  ];

  shots.forEach(sh => { const u = sh.update; sh.update = (t, lt, k) => { E.bloom.strength = 0.42; u(t, lt, k); }; });
  const sfx = [
    { t: T.lune, type: 'pop' }, { t: T.efface - 0.1, type: 'boom' }, { t: T.a384 + 1.0, type: 'click' }, { t: T.noires - 0.4, type: 'rise' }, { t: T.noires + 0.2, type: 'boom' },
    { t: T.predateurs, type: 'pop' }, { t: T.marees, type: 'pop' }, { t: T.soleil2 + 0.2, type: 'ding' }, { t: T.moitie, type: 'boom' }, { t: T.eclipses - 0.6, type: 'rise' }, { t: T.plus3 + 0.1, type: 'boom' },
    { t: T.n235, type: 'click' }, { t: T.vaciller, type: 'rise' }, { t: T.rebond, type: 'boom' }, { t: T.n38, type: 'ding' }, { t: T.a9 + 0.6, type: 'pop' }, { t: T.deux, type: 'pop' },
  ];
  return { shots, sfx };
}
