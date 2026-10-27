"""Bande son finale : voix + bruitages (+ instrumental optionnel avec --music-volume > 0 ; désactivé par défaut).

usage : python3 tools/mix.py voix.mp3 timeline.json sortie.wav [--seed N] [--music-volume 0.12]
timeline.json (écrit par render.js) : {"total": s, "shots": [{"start": s, "sfx": "whoosh|none|..."}], "sfx": [{"t": s, "type": "click"}]}
Bruitages disponibles : whoosh, click, ding, boom, pop, rise, none. Tout est synthétisé (aucun son externe, libre de droits).
"""
import argparse, json, os, subprocess, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True  # ne pas modifier le __pycache__ versionné du dossier quiz-video
sys.path.insert(0, os.path.join(HERE, "..", "..", "quiz-video"))
from instrumental import make_instrumental, duck  # noqa: E402

SR = 44100
rng = np.random.default_rng(7)


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lowpass(x, alpha):
    from scipy.signal import lfilter
    return lfilter([alpha], [1, alpha - 1], x)


def sfx(kind):
    if kind == "whoosh":
        n = int(0.55 * SR); t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        # balayage de filtre : passe-bas qui s'ouvre puis se referme
        out = np.zeros(n); y = 0.0
        cut = 0.02 + 0.25 * np.sin(np.pi * t / t[-1]) ** 2
        for i in range(n):
            y += cut[i] * (noise[i] - y); out[i] = y
        return 0.55 * out * np.sin(np.pi * t / t[-1]) ** 1.5 / max(1e-6, np.abs(out).max())
    if kind == "click":
        n = int(0.09 * SR); t = np.arange(n) / SR
        return 0.8 * (np.sin(2 * np.pi * 2200 * t) * env(n, 0.0005, 0.012) + 0.6 * rng.standard_normal(n) * env(n, 0.0002, 0.006))
    if kind == "ding":
        n = int(1.2 * SR); t = np.arange(n) / SR
        return 0.35 * (np.sin(2 * np.pi * 1318 * t) + 0.4 * np.sin(2 * np.pi * 2636 * t)) * env(n, 0.002, 0.35)
    if kind == "boom":
        n = int(1.4 * SR); t = np.arange(n) / SR
        f = 90 * np.exp(-t * 2.2) + 35
        return 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.45)
    if kind == "pop":
        n = int(0.12 * SR); t = np.arange(n) / SR
        f = 900 * np.exp(-t * 30) + 300
        return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.04)
    if kind == "rise":
        n = int(1.6 * SR); t = np.arange(n) / SR
        noise = lowpass(rng.standard_normal(n), 0.08)
        return 0.4 * noise / np.abs(noise).max() * (t / t[-1]) ** 2
    return np.zeros(1)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice"); ap.add_argument("timeline"); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=1); ap.add_argument("--music-volume", type=float, default=0.0, help="0 = pas de musique (choix de Moubarak)")
    ap.add_argument("--sfx-volume", type=float, default=0.35)
    a = ap.parse_args()
    tl = json.load(open(a.timeline))
    total = float(tl["total"]); n = int(total * SR)
    voice = np.zeros(n); v = load(a.voice)[:n]; voice[: len(v)] = v
    mix = voice.copy()
    if a.music_volume > 0:
        mus = np.asarray(make_instrumental(total, SR, a.seed), dtype=np.float64)[:n]
        mus = np.pad(mus, (0, n - len(mus)))
        mus = duck(mus / max(1e-6, np.abs(mus).max()), voice.astype(np.float32), SR)
        fade = np.ones(n); f = int(1.5 * SR); fade[-f:] = np.linspace(1, 0, f); fade[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR))
        mix += a.music_volume * mus * fade
    events = [(s["start"], s.get("sfx", "whoosh")) for s in tl["shots"][1:]] + [(e["t"], e["type"]) for e in tl.get("sfx", [])]
    for t0, kind in events:
        if kind in (None, "none"): continue
        s = sfx(kind); i = int(max(0, t0 - (0.25 if kind == "whoosh" else 0)) * SR)
        if i >= n: continue
        seg = s[: n - i]; mix[i:i + len(seg)] += a.sfx_volume * seg
    peak = np.abs(mix).max()
    if peak > 0.98: mix *= 0.98 / peak
    sf.write(a.out, mix.astype(np.float32), SR)
    print(f"mix OK : {total:.1f} s, {len(events)} bruitages, " + (f"musique variante {a.seed}" if a.music_volume > 0 else "sans musique"))


if __name__ == "__main__":
    main()
