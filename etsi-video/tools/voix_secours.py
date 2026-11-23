"""Voix de secours (Piper, hors ligne) si ElevenLabs est indisponible.
usage : python3 tools/voix_secours.py episodes/NNN-slug/voix.txt episodes/NNN-slug/voix.wav
Insère une courte pause après chaque phrase pour que align.py retrouve le découpage."""
import re, sys, wave, io
import numpy as np, soundfile as sf
from piper import PiperVoice, SynthesisConfig

MODEL = "/tmp/quiz-voices/fr_FR-tom-medium/fr_FR-tom-medium.onnx"
voice = PiperVoice.load(MODEL)
cfg = SynthesisConfig(length_scale=1.0)
text = open(sys.argv[1], encoding="utf-8").read().strip()
parts = [p.strip() for p in re.split(r"(?<=[.!?…:,])\s+", text) if p.strip()]
out, sr0 = [], None
for p in parts:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w: voice.synthesize_wav(p, w, syn_config=cfg)
    buf.seek(0); d, sr = sf.read(buf, dtype="float32"); sr0 = sr
    if d.ndim > 1: d = d.mean(axis=1)
    nz = np.where(np.abs(d) > 0.01)[0]
    if len(nz): d = d[nz[0]: nz[-1] + 1]
    out += [d, np.zeros(int(sr * (0.45 if p[-1] in ".!?…:" else 0.28)), dtype=np.float32)]
sf.write(sys.argv[2], np.concatenate(out), sr0)
print("voix de secours :", sys.argv[2])
