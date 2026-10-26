"""Fabrique une vidéo quiz verticale 1080x1920, animée (30 i/s), avec voix off et une image par question.

Usage :
  node render_images.mjs quiz.json IMAGES/
  python3 make_quiz.py quiz.json sortie.mp4 --images IMAGES/ --voice MODELE.onnx [--speaker N]

quiz.json : {"titre": "...", "theme": "...", "intro": "(option)", "outro": "(option)", "questions": [
   {"q": "...", "choix": ["A","B","C","D"], "bonne": 0, "info": "phrase après la réponse", "image": {...}}]}
"""
import argparse, io, json, math, os, subprocess, tempfile, wave
TMPD = tempfile.mkdtemp(); TMPV = os.path.join(TMPD, "v.mp4"); TMPA = os.path.join(TMPD, "a.wav")
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from piper import PiperVoice, SynthesisConfig

W, H, FPS, SR = 1080, 1920, 30, 44100
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FC = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
NAVY1, NAVY2 = (18, 28, 60), (5, 9, 22)
GOLD, WHITE, MUTED = (255, 196, 0), (246, 248, 252), (150, 162, 188)
CARD, GOOD, DIM, RED = (28, 40, 72), (34, 197, 94), (44, 50, 68), (255, 68, 56)
LET = "ABCD"
COUNT = 5
IMG_BOX = (90, 500, 990, 1020)            # cadre de l'image
OPT_Y0, OPT_H, OPT_GAP = 1065, 120, 22   # options
TRANS = 0.45                              # durée des entrées / sorties


# ---------- utilitaires ----------
_fonts = {}
def F(path, size):
    k = (path, size)
    if k not in _fonts: _fonts[k] = ImageFont.truetype(path, size)
    return _fonts[k]

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_in(x): x = clamp(x); return x ** 3
def ease_back(x):
    x = clamp(x); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
def lerp(a, b, t): return a + (b - a) * t
def mix(c1, c2, t): return tuple(int(lerp(a, b, clamp(t))) for a, b in zip(c1, c2))

def wrap(text, f, maxw):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def text_block(lines, f, fill, width, gap=12, align="center", stroke=0):
    h = len(lines) * (f.size + gap) - gap + 8
    im = Image.new("RGBA", (width, max(h, 1)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    y = 0
    for ln in lines:
        w = d.textlength(ln, font=f)
        x = (width - w) / 2 if align == "center" else 0
        d.text((x, y), ln, font=f, fill=fill, stroke_width=stroke, stroke_fill=(5, 9, 22))
        y += f.size + gap
    return im

def rounded(size, r, fill, outline=None, width=0):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=fill, outline=outline, width=width)
    return im

def shadowed(im, blur=18, off=10, alpha=140):
    pad = blur * 2
    sh = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: v * alpha // 255)
    sh.paste((0, 0, 0, 255), (pad, pad + off), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    sh.alpha_composite(im, (pad, pad))
    return sh, pad

def fade(im, a):
    if a >= 0.999: return im
    im = im.copy(); al = im.split()[3].point(lambda v: int(v * clamp(a))); im.putalpha(al); return im

def paste(base, im, x, y, alpha=1.0, scale=1.0):
    if alpha <= 0.01: return
    if abs(scale - 1) > 0.003:
        w, h = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        x += (im.width - w) / 2; y += (im.height - h) / 2
        im = im.resize((w, h), Image.BILINEAR)
    base.alpha_composite(fade(im, alpha), (int(round(x)), int(round(y))))


# ---------- fond animé ----------
def make_bg():
    big = Image.new("RGB", (W, H + 400))
    g = np.linspace(0, 1, H + 400)[:, None]
    arr = np.array(NAVY1)[None, :] * (1 - g) + np.array(NAVY2)[None, :] * g
    big = Image.fromarray(np.repeat(arr[:, None, :], W, axis=1).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(big)
    for i in range(-H, W + H + 400, 80):
        d.line([(i, 0), (i - (H + 400), H + 400)], fill=(24, 36, 70, 255), width=2)
    glow = Image.new("RGBA", (W, H + 400), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W * 0.15, 150, W * 0.85, 950], fill=(255, 196, 0, 28))
    big.alpha_composite(glow.filter(ImageFilter.GaussianBlur(160)))
    return big

BG = None
def bg_at(t):
    off = int((t * 18) % 80)  # léger défilement continu des diagonales
    return BG.crop((0, off, W, off + H)).copy()


# ---------- éléments ----------
def header(theme, i, n):
    im = Image.new("RGBA", (W, 230), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = F(FC, 44); tw = d.textlength(theme.upper(), font=f)
    d.rounded_rectangle([(W - tw) / 2 - 40, 70, (W + tw) / 2 + 40, 150], 40, fill=(0, 0, 0, 200))
    d.text(((W - tw) / 2, 86), theme.upper(), font=f, fill=GOLD)
    if i is not None:
        s = f"QUESTION {i + 1} / {n}"; f2 = F(FB, 36); w2 = d.textlength(s, font=f2)
        d.text(((W - w2) / 2, 172), s, font=f2, fill=MUTED)
    return im

def progress_dots(i, n, t_in):
    im = Image.new("RGBA", (W, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    gap = 30; total = (n - 1) * gap; x0 = (W - total) / 2
    for k in range(n):
        x = x0 + k * gap
        if k < i: col, r = GOLD, 7
        elif k == i: col, r = GOLD, 7 + 3 * ease_back(t_in)
        else: col, r = (60, 72, 100), 6
        d.ellipse([x - r, 12 - r, x + r, 12 + r], fill=col)
    return im

def question_card(q):
    f = F(FB, 58); lines = wrap(q, f, W - 200)
    if len(lines) > 3: f = F(FB, 48); lines = wrap(q, f, W - 200)
    tb = text_block(lines, f, WHITE, W - 160, gap=12)
    card = rounded((W - 120, tb.height + 56), 34, CARD + (245,))
    card.alpha_composite(tb, (20, 28))
    return card

def image_panel(path):
    x0, y0, x1, y1 = IMG_BOX; w, h = x1 - x0, y1 - y0
    panel = rounded((w, h), 36, (12, 22, 46, 255))
    if path and os.path.exists(path):
        src = Image.open(path).convert("RGBA")
        sc = max(w / src.width, h / src.height) if src.getpixel((2, 2))[3] > 200 else min(w / src.width, h / src.height) * 1.0
        src = src.resize((int(src.width * sc), int(src.height * sc)), Image.LANCZOS)
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        if src.getpixel((2, 2))[3] <= 200:  # illustration détourée : halo doré derrière
            glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            ImageDraw.Draw(glow).ellipse([w * 0.25, h * 0.1, w * 0.75, h * 0.9], fill=(255, 196, 0, 70))
            panel.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))
        layer.alpha_composite(src, ((w - src.width) // 2, (h - src.height) // 2))
        mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 36, fill=255)
        panel.paste(layer, (0, 0), Image.composite(layer.split()[3], Image.new("L", (w, h), 0), mask))
    ImageDraw.Draw(panel).rounded_rectangle([0, 0, w - 1, h - 1], 36, outline=(255, 255, 255, 40), width=3)
    return panel

def option_pill(k, text, state):
    w, h = W - 140, OPT_H
    fill = {"n": CARD, "good": GOOD, "bad": DIM}[state]
    im = rounded((w, h), h // 2, fill + (255,), outline=(255, 255, 255, 30), width=2)
    d = ImageDraw.Draw(im)
    bc = GOLD if state != "bad" else (90, 98, 120)
    if state == "good": bc = WHITE
    d.ellipse([14, 12, 14 + h - 24, h - 12], fill=bc)
    fl = F(FB, 52); lw = d.textlength(LET[k], font=fl)
    d.text((14 + (h - 24) / 2 - lw / 2, h / 2 - 32), LET[k], font=fl, fill=(10, 14, 28) if state != "good" else GOOD)
    fo = F(FB, 50); s = text
    while d.textlength(s, font=fo) > w - h - 60 and len(s) > 3: s = s[:-2]
    if s != text: s = s.rstrip() + "…"
    d.text((h + 20, h / 2 - 31), s, font=fo, fill=WHITE if state != "bad" else (170, 176, 192))
    if state == "good":
        cx, cy = w - 70, h / 2
        d.line([(cx - 22, cy), (cx - 6, cy + 18), (cx + 26, cy - 20)], fill=WHITE, width=12, joint="curve")
    return im

def timer_badge(rem, frac):
    s = 190; im = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([10, 10, s - 10, s - 10], fill=(8, 12, 26, 235))
    col = mix(GOLD, RED, 1 - frac)
    d.arc([16, 16, s - 16, s - 16], -90, -90 + 360 * frac, fill=col, width=16)
    n = str(max(1, math.ceil(rem))); f = F(FB, 92); tw = d.textlength(n, font=f)
    d.text(((s - tw) / 2, s / 2 - 56), n, font=f, fill=WHITE)
    return im

def info_band(text):
    f = F(FB, 38); lines = wrap(text, f, IMG_BOX[2] - IMG_BOX[0] - 70)[:3]
    tb = text_block(lines, f, WHITE, IMG_BOX[2] - IMG_BOX[0] - 40, gap=10)
    band = rounded((IMG_BOX[2] - IMG_BOX[0], tb.height + 44), 30, (5, 9, 22, 225))
    band.alpha_composite(tb, (20, 22))
    return band

def title_card(data, sub):
    f = F(FB, 96); lines = wrap(data["titre"], f, W - 160)
    t = text_block(lines, f, WHITE, W - 120, gap=16, stroke=0)
    s = text_block(wrap(sub, F(FR, 46), W - 200), F(FR, 46), MUTED, W - 120, gap=10)
    return t, s


# ---------- audio ----------
def tone(freq, dur, vol=0.22, decay=12.0):
    t = np.arange(int(SR * dur)) / SR
    return (np.sin(2 * np.pi * freq * t) * np.exp(-decay * t) * vol).astype(np.float32)

def tick(last=False):
    return tone(1320 if last else 990, 0.09, 0.22, 30)

def chime():
    a = tone(784, 0.6, 0.18, 5) ; b = tone(1175, 0.6, 0.16, 5)
    out = np.zeros(int(SR * 0.75), np.float32); out[:len(a)] += a; out[int(SR * 0.09):int(SR * 0.09) + len(b)] += b
    return out

def whoosh(dur=0.45, vol=0.10):
    n = int(SR * dur); rng = np.random.default_rng(7); x = rng.standard_normal(n).astype(np.float32)
    k = np.linspace(0.02, 0.4, n); y = np.zeros(n, np.float32); acc = 0.0
    for i in range(n): acc += k[i] * (x[i] - acc); y[i] = acc  # passe-bas qui s'ouvre
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return (y / (np.abs(y).max() + 1e-6) * env * vol).astype(np.float32)


class Timeline:
    def __init__(self):
        self.audio = np.zeros(SR * 600, np.float32); self.voice = np.zeros(SR * 600, np.float32)
        self.scenes = []; self.t = 0.0
    def put(self, clip, at, voice=False):
        i = int(at * SR); m = clip[: max(0, len(self.audio) - i)]
        self.audio[i:i + len(m)] += m
        if voice: self.voice[i:i + len(m)] += m
    def scene(self, kind, dur, **kw):
        self.scenes.append(dict(kind=kind, start=self.t, dur=dur, **kw)); self.t += dur


def main():
    global BG
    ap = argparse.ArgumentParser()
    ap.add_argument("quiz"); ap.add_argument("out")
    ap.add_argument("--images", default=""); ap.add_argument("--voice", default="")
    ap.add_argument("--audio-dir", default="", help="dossier de voix déjà générées (intro.mp3, q1.mp3, r1.mp3, ..., outro.mp3)")
    ap.add_argument("--script-out", default="", help="écrit seulement les textes à lire (JSON clé -> texte) puis s'arrête")
    ap.add_argument("--music", default="synth", help="'synth' (instrumental généré, défaut), 'none', ou chemin d'un fichier audio libre de droits")
    ap.add_argument("--music-seed", type=int, default=None, help="variante de l'instrumental (par défaut : dérivée du titre)")
    ap.add_argument("--music-volume", type=float, default=0.20, help="niveau de la musique sous la voix (0-1)")
    ap.add_argument("--speaker", type=int, default=None); ap.add_argument("--rate", type=float, default=0.95)
    a = ap.parse_args()
    data = json.load(open(a.quiz, encoding="utf-8")); qs = data["questions"]; n = len(qs)
    theme = data.get("theme", "Quiz")
    intro = data.get("intro", f"{data['titre']} ! {n} questions, cinq secondes pour chacune. Note tes points, et donne ton score en commentaire !")
    outro = data.get("outro", "Alors, combien de bonnes réponses ? Dis-le en commentaire, et abonne-toi pour le quiz de demain !")
    texts = {"intro": intro}
    for i, q in enumerate(qs):
        opts = ". ".join(f"{LET[k]} : {c}" for k, c in enumerate(q["choix"]))
        texts[f"q{i + 1}"] = f"Question {i + 1}. {q['q']} {opts}."
        texts[f"r{i + 1}"] = f"Réponse {LET[q['bonne']]} : {q['choix'][q['bonne']]} ! " + q.get("info", "")
    texts["outro"] = outro
    if a.script_out:
        json.dump(texts, open(a.script_out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"Textes écrits dans {a.script_out} ({sum(len(t) for t in texts.values())} caractères)"); return

    voice = PiperVoice.load(a.voice) if a.voice else None
    cfg = SynthesisConfig(speaker_id=a.speaker, length_scale=a.rate)
    used = {"fichier": 0, "piper": 0}

    def load_file(path):
        wavp = os.path.join(TMPD, "dec.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), wavp], check=True)
        d, _ = sf.read(wavp, dtype="float32")
        nz = np.where(np.abs(d) > 0.01)[0]  # retire les silences au début et à la fin
        if len(nz): d = d[max(0, nz[0] - int(0.05 * SR)): nz[-1] + int(0.15 * SR)]
        return d * 0.95

    def say(key):
        text = texts[key]
        if a.audio_dir:
            for ext in ("mp3", "wav", "m4a"):
                p = os.path.join(a.audio_dir, f"{key}.{ext}")
                if os.path.exists(p): used["fichier"] += 1; return load_file(p)
        if voice is None: raise SystemExit(f"Voix manquante pour « {key} » et aucune voix Piper (--voice) en secours")
        used["piper"] += 1
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w: voice.synthesize_wav(text, w, syn_config=cfg)
        buf.seek(0); d, sr = sf.read(buf, dtype="float32")
        if d.ndim > 1: d = d.mean(axis=1)
        if sr != SR: d = np.interp(np.linspace(0, len(d), int(len(d) * SR / sr), endpoint=False), np.arange(len(d)), d).astype(np.float32)
        return d * 0.95

    tl = Timeline()
    v = say("intro"); tl.put(whoosh(), 0.0); tl.put(v, 0.5, True)
    tl.scene("title", max(3.2, len(v) / SR + 1.1), sub=f"{n} questions · 5 secondes chacune · Ton score en commentaire")

    for i, q in enumerate(qs):
        v = say(f"q{i + 1}")
        start = tl.t; tl.put(whoosh(), start); tl.put(v, start + 0.55, True)
        tl.scene("ask", len(v) / SR + 0.9, i=i)
        start = tl.t
        for c in range(COUNT): tl.put(tick(c == COUNT - 1), start + c)
        tl.scene("count", float(COUNT), i=i)
        v = say(f"r{i + 1}"); start = tl.t; tl.put(chime(), start); tl.put(v, start + 0.45, True)
        tl.scene("reveal", max(3.0, len(v) / SR + 1.2), i=i)

    v = say("outro"); tl.put(whoosh(), tl.t); tl.put(v, tl.t + 0.5, True)
    tl.scene("end", max(3.2, len(v) / SR + 1.4), sub="Ton score en commentaire · Un nouveau quiz chaque jour")
    total = tl.t

    # pré-rendu des éléments fixes
    BG = make_bg()
    hdr_title = header(theme, None, n)
    pre = []
    for i, q in enumerate(qs):
        img = os.path.join(a.images, f"q{i + 1}.png") if a.images else ""
        panel, pad = shadowed(image_panel(img))
        pre.append(dict(
            hdr=header(theme, i, n), card=question_card(q["q"]), panel=panel, pad=pad,
            opts={s: [option_pill(k, c, s) for k, c in enumerate(q["choix"])] for s in ("n", "good", "bad")},
            info=info_band(q["info"]) if q.get("info") else None))
    titles = {s["kind"]: title_card(data, s["sub"]) for s in tl.scenes if s["kind"] in ("title", "end")}

    def draw_question(fr, s, lt):
        i = s["i"]; P = pre[i]; q = qs[i]
        ask_t = lt if s["kind"] == "ask" else 99
        out_a = 1.0
        if s["kind"] == "reveal": out_a = 1 - ease_in((lt - (s["dur"] - TRANS)) / TRANS)
        paste(fr, P["hdr"], 0, 0, out_a)
        paste(fr, progress_dots(i, n, ask_t / 0.6), 0, 222, out_a)
        e = ease_out(ask_t / TRANS)
        paste(fr, P["card"], 60, 262 + (1 - e) * 40, e * out_a)
        # image : apparition + léger zoom continu
        x0, y0 = IMG_BOX[0] - P["pad"], IMG_BOX[1] - P["pad"]
        e_img = ease_back((ask_t - 0.15) / 0.55)
        since = sum(ss["dur"] for ss in tl.scenes if ss.get("i") == i and ss["start"] < s["start"]) + lt
        zoom = 0.82 + 0.18 * e_img + 0.02 * clamp(since / 12)
        paste(fr, P["panel"], x0, y0, clamp(e_img * 1.4) * out_a, zoom)
        # options
        for k in range(4):
            y = OPT_Y0 + k * (OPT_H + OPT_GAP)
            e_o = ease_out((ask_t - 0.35 - 0.12 * k) / 0.45)
            if s["kind"] == "reveal":
                good = k == q["bonne"]; e_r = ease_out(lt / 0.35)
                pill = P["opts"]["good" if good else "bad"][k]
                if good:
                    sc = 1 + 0.06 * math.sin(clamp(lt / 0.5) * math.pi)
                    paste(fr, pill, 70, y, out_a, sc)
                else:
                    paste(fr, P["opts"]["n"][k], 70, y, (1 - e_r) * out_a); paste(fr, pill, 70, y, e_r * out_a)
            else:
                paste(fr, P["opts"]["n"][k], 70 + (1 - e_o) * 260, y, e_o * out_a)
        # minuteur
        if s["kind"] == "count":
            rem = COUNT - lt; frac = clamp(rem / COUNT)
            pulse = 1 + 0.08 * (1 - (lt % 1.0)) ** 4
            e_t = ease_back(lt / 0.35)
            paste(fr, timer_badge(rem, frac), W - 250, IMG_BOX[1] - 70, clamp(e_t * 1.5), pulse * (0.6 + 0.4 * e_t))
            bar = int((W - 180) * frac)
            ImageDraw.Draw(fr).rounded_rectangle([90, OPT_Y0 - 28, 90 + max(bar, 12), OPT_Y0 - 16], 6, fill=mix(GOLD, RED, 1 - frac) + (255,))
        if s["kind"] == "reveal" and P["info"] is not None:
            e_i = ease_out((lt - 0.4) / 0.4)
            paste(fr, P["info"], IMG_BOX[0], IMG_BOX[3] - P["info"].height - 18 + (1 - e_i) * 30, e_i * out_a)

    def draw_title(fr, s, lt):
        t, sub = titles[s["kind"]]
        a_in = ease_out(lt / 0.6); a_out = 1 - ease_in((lt - (s["dur"] - TRANS)) / TRANS)
        paste(fr, hdr_title, 0, 380, a_in * a_out)
        paste(fr, t, 60, 720, a_in * a_out, 0.85 + 0.15 * ease_back(lt / 0.7))
        paste(fr, sub, 60, 760 + t.height + (1 - ease_out((lt - 0.3) / 0.6)) * 40, ease_out((lt - 0.3) / 0.6) * a_out)

    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                           "-pix_fmt", "yuv420p", TMPV], stdin=subprocess.PIPE)
    frames = int(total * FPS); si = 0
    for f_i in range(frames):
        t = f_i / FPS
        while si < len(tl.scenes) - 1 and t >= tl.scenes[si]["start"] + tl.scenes[si]["dur"]: si += 1
        s = tl.scenes[si]; lt = t - s["start"]
        fr = bg_at(t)
        if s["kind"] in ("title", "end"): draw_title(fr, s, lt)
        else: draw_question(fr, s, lt)
        ff.stdin.write(fr.convert("RGB").tobytes())
    ff.stdin.close(); ff.wait()

    audio = tl.audio[: int(total * SR)]
    mus_info = "aucune"
    if a.music != "none":
        from instrumental import make_instrumental, duck
        if a.music == "synth":
            seed = a.music_seed if a.music_seed is not None else sum(map(ord, data["titre"]))
            mus = make_instrumental(total, SR, seed); mus_info = f"instrumental généré (variante {seed})"
        else:
            mus = load_file(a.music) / 0.95
            mus = np.tile(mus, int(len(audio) / max(1, len(mus))) + 1)[: len(audio)]
            fo = int(2.5 * SR); mus[-fo:] *= np.linspace(1, 0, fo); mus_info = os.path.basename(a.music)
        mus = mus[: len(audio)]; mus = np.pad(mus, (0, len(audio) - len(mus)))
        mus = duck(mus / max(1e-6, float(np.abs(mus).max())), tl.voice[: len(audio)], SR)
        audio = audio + a.music_volume * mus
    audio = audio / max(1.0, float(np.abs(audio).max()) / 0.95)
    sf.write(TMPA, audio, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", TMPV, "-i", TMPA,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", a.out], check=True)
    print(f"OK {a.out} — {total:.0f} s, {n} questions — voix : {used['fichier']} fichiers fournis, {used['piper']} en Piper (secours) — musique : {mus_info}")


if __name__ == "__main__":
    main()
