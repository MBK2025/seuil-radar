"""Instrumental de fond libre de droits, synthétisé (aucun sample externe).

Chaque vidéo reçoit une variante différente (tempo, tonalité, progression, motif d'arpège)
selon une graine : `make_instrumental(duree_s, sr, seed)` renvoie un tableau float32 mono.
"""
import numpy as np

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
PROGS = {  # degrés en demi-tons depuis la tonique + qualité
    "pop":   [(0, "maj"), (7, "maj"), (9, "min"), (5, "maj")],     # I V vi IV
    "epic":  [(0, "min"), (8, "maj"), (3, "maj"), (10, "maj")],    # i VI III VII
    "drive": [(0, "min"), (10, "maj"), (8, "maj"), (10, "maj")],   # i VII VI VII
    "bright": [(0, "maj"), (5, "maj"), (9, "min"), (7, "maj")],    # I IV vi V
}
QUAL = {"maj": (0, 4, 7), "min": (0, 3, 7)}


def _hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def _env(n, sr, a=0.005, d=0.25):
    t = np.arange(n) / sr
    return (np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)).astype(np.float32)


def _saw(f, t, harm=6):
    return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, harm + 1))


def _lowpass(x, alpha):
    # filtre passe-bas d'ordre 1 vectorisé par blocs (rapide et suffisant pour des nappes)
    from scipy.signal import lfilter
    return lfilter([alpha], [1, alpha - 1], x).astype(np.float32)


def _highpass(x, alpha):
    return (x - _lowpass(x, alpha)).astype(np.float32)


def make_instrumental(dur, sr=44100, seed=0):
    rng = np.random.default_rng(seed)
    bpm = float(rng.choice([96, 100, 104, 108, 112]))
    root = 48 + NOTE[str(rng.choice(["C", "D", "E", "F", "G", "A"]))] % 12  # vers C3
    prog = PROGS[str(rng.choice(list(PROGS)))]
    arp_pat = rng.choice([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]])
    beat = 60.0 / bpm; bar = 4 * beat
    n = int(dur * sr) + sr
    out = np.zeros(n, np.float32)
    pad = np.zeros(n, np.float32); bass = np.zeros(n, np.float32); arp = np.zeros(n, np.float32)
    drums = np.zeros(n, np.float32)

    def put(buf, clip, at):
        i = int(at * sr)
        if i >= n: return
        m = min(len(clip), n - i); buf[i:i + m] += clip[:m]

    # sons de batterie pré-calculés
    kn = int(0.35 * sr); kt = np.arange(kn) / sr
    kick = (np.sin(2 * np.pi * (45 * kt + (120 - 45) * 0.04 * (1 - np.exp(-kt / 0.04)))) * np.exp(-kt / 0.12)).astype(np.float32)
    sn = int(0.2 * sr)
    snare = _highpass(rng.standard_normal(sn).astype(np.float32), 0.25) * _env(sn, sr, 0.001, 0.06) * 0.6
    snare += (np.sin(2 * np.pi * 190 * np.arange(sn) / sr) * _env(sn, sr, 0.001, 0.04) * 0.4).astype(np.float32)
    hn = int(0.05 * sr)
    hat = _highpass(rng.standard_normal(hn).astype(np.float32), 0.5) * _env(hn, sr, 0.0005, 0.015)

    bars = int(dur / bar) + 2
    for b in range(bars):
        t0 = b * bar
        deg, q = prog[b % len(prog)]
        chord = [root + 12 + deg + i for i in QUAL[q]]
        # nappe (pad) : accords tenus sur une mesure, attaque douce
        pn = int(bar * sr); pt = np.arange(pn) / sr
        p = sum(_saw(_hz(m), pt, 4) for m in chord) / 3
        penv = np.minimum(1, pt / 0.35) * np.minimum(1, (bar - pt) / 0.25)
        put(pad, (p * penv).astype(np.float32), t0)
        # basse : croches sur la fondamentale, une octave en dessous
        for e in range(8):
            bn = int(beat / 2 * sr); bt = np.arange(bn) / sr
            f = _hz(root + deg - 12 + (12 if e in (3, 7) else 0))
            put(bass, ((np.sin(2 * np.pi * f * bt) + 0.3 * np.sin(4 * np.pi * f * bt)) * _env(bn, sr, 0.004, 0.18)).astype(np.float32), t0 + e * beat / 2)
        # arpège en doubles croches, une octave au-dessus
        tones = chord + [chord[0] + 12]
        for s in range(16):
            an = int(beat / 4 * sr * 1.6); at_ = np.arange(an) / sr
            f = _hz(tones[arp_pat[s % 4]] + 12)
            tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * at_))
            put(arp, (tri * _env(an, sr, 0.002, 0.09)).astype(np.float32), t0 + s * beat / 4)
        # batterie : kick 1 & 3 (+ contretemps), caisse claire 2 & 4, charleston en croches
        if b >= 1:  # la première mesure sert d'intro (sans batterie)
            for k in (0, 2, 2.5):
                put(drums, kick * 0.9, t0 + k * beat)
            for k in (1, 3):
                put(drums, snare * 0.5, t0 + k * beat)
            for e in range(8):
                put(drums, hat * (0.25 if e % 2 else 0.16), t0 + e * beat / 2)

    pad = _lowpass(pad, 0.06)
    out = 0.30 * pad + 0.45 * bass + 0.16 * arp + 0.55 * drums
    out = out[: int(dur * sr)]
    out /= max(1e-6, float(np.abs(out).max()))
    # fondu d'entrée / de sortie
    fi, fo = int(1.0 * sr), int(2.5 * sr)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    return out.astype(np.float32)


def duck(music, voice, sr=44100, depth=0.55, attack=0.02, release=0.35):
    """Baisse la musique quand la voix parle (side-chain)."""
    env = np.abs(voice)
    win = max(1, int(0.03 * sr))
    env = np.convolve(env, np.ones(win) / win, mode="same")
    level = np.clip(env / 0.05, 0, 1)
    # lissage attaque/relâche par blocs de 10 ms
    blk = int(0.01 * sr); nb = len(level) // blk + 1
    lv = np.array([level[i * blk:(i + 1) * blk].max() if i * blk < len(level) else 0 for i in range(nb)])
    a_up = 1 - np.exp(-0.01 / attack); a_dn = 1 - np.exp(-0.01 / release)
    g = np.zeros(nb); cur = 0.0
    for i, x in enumerate(lv):
        cur += (a_up if x > cur else a_dn) * (x - cur); g[i] = cur
    gain = 1 - depth * np.repeat(g, blk)[: len(music)]
    return (music * gain).astype(np.float32)
