// Rendu d'un épisode.
//   node tools/render.js episodes/NNN-slug preview 1.5,8,20   → images d'aperçu dans episodes/NNN-slug/prev/
//   node tools/render.js episodes/NNN-slug clip 0,12             → out/NNN-slug.clip.mp4 (extrait avec la voix, pour vérifier vite)
//   node tools/render.js episodes/NNN-slug full                → out/NNN-slug.mp4 (vidéo + voix + musique + bruitages)
// Options : --rs 0.65 (échelle 3D), --handle @compte, --fps 25, --seed N, --style holo|classic (sinon meta.json « style »)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const EP = args[0].replace(/\/$/, ''), MODE = args[1] || 'preview';
const FPS = Number(opt('fps', 25)), RS = Number(opt('rs', 0.65));
const cfg = fs.existsSync(path.join(ROOT, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'))) : {};
const HANDLE = opt('handle', cfg.handle || '@ton.compte');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const epDir = path.join(ROOT, EP);
  const data = JSON.parse(fs.readFileSync(path.join(epDir, 'words.json'), 'utf8'));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let pageErr = null;
  page.on('pageerror', e => { pageErr = e; console.log('ERREUR PAGE :', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE :', m.text()); });
  await page.goto(`http://localhost:${port}/engine/page.html?rs=${RS}` + (opt('style') ? `&style=${opt('style')}` : ''));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 90000 });
  await page.evaluate(async () => { for (const f of ['500 62px Inter', '600 62px Inter', '700 62px Inter', '800 62px Inter', '900 62px Inter', '800 30px Mono', '500 30px Mono', '900 96px Caption', '800 96px Caption']) await document.fonts.load(f); });
  const info = await page.evaluate(([d, e, h]) => setup(d, e, h), [data, EP, HANDLE]);
  console.log('Plans :', info.shots.map(s => `${s.start.toFixed(1)}s ${s.name}`).join(' | '));
  const grab = async t => Buffer.from((await page.evaluate(t => frame(t), t)).split(',')[1], 'base64');

  if (MODE === 'preview') {
    const dir = path.join(epDir, 'prev'); fs.mkdirSync(dir, { recursive: true });
    const times = (args[2] || info.shots.map(s => (s.start + 1).toFixed(2)).join(',')).split(',').map(Number);
    for (const t of times) { const t0 = Date.now(); fs.writeFileSync(path.join(dir, `f_${t.toFixed(2).padStart(6, '0')}.jpg`), await grab(t)); console.log(`aperçu ${t}s (${Date.now() - t0} ms)`); }
    if (pageErr) process.exitCode = 1;
  } else if (MODE === 'clip') {
    const [a, b] = (args[2] || '0,10').split(',').map(Number), outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
    const slug = path.basename(EP), out = path.join(outDir, slug + '.clip.mp4');
    const voice = ['voix.mp3', 'voix.wav'].map(f => path.join(epDir, f)).find(f => fs.existsSync(f));
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-ss', String(a), '-t', String(b - a), '-i', voice,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = Math.round(a * FPS); i < Math.round(b * FPS); i++) { const buf = await grab(i / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('EXTRAIT :', out);
  } else {
    const outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
    const slug = path.basename(EP), silent = path.join(outDir, slug + '.video.mp4'), wav = path.join(outDir, slug + '.wav'), final = path.join(outDir, slug + '.mp4');
    const frames = Math.ceil(info.total * FPS);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const buf = await grab(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`image ${i}/${frames} – ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    const tl = path.join(outDir, slug + '.timeline.json');
    fs.writeFileSync(tl, JSON.stringify({ total: info.total, shots: info.shots, sfx: info.sfx }));
    const voice = ['voix.mp3', 'voix.wav'].map(f => path.join(epDir, f)).find(f => fs.existsSync(f));
    execFileSync('python3', [path.join(ROOT, 'tools/mix.py'), voice, tl, wav, '--seed', String(opt('seed', parseInt(slug) || 1))], { stdio: 'inherit' });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    console.log('VIDÉO :', final, `(${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
