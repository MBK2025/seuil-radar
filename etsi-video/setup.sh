#!/usr/bin/env bash
# Installe tout ce qu'il faut pour fabriquer les vidéos « science du quotidien » (à lancer depuis ce dossier).
set -e
cd "$(dirname "$0")"
npm install --silent
pip install -q --break-system-packages numpy scipy soundfile num2words piper-tts 2>/dev/null || pip install -q --break-system-packages numpy scipy soundfile num2words
node -e "require('playwright')" || { echo "Playwright introuvable"; exit 1; }
mkdir -p /tmp/quiz-voices
if [ ! -f /tmp/quiz-voices/fr_FR-tom-medium/fr_FR-tom-medium.onnx ]; then
  curl -sL --max-time 300 -o /tmp/quiz-voices/tom.tar.bz2 \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-fr_FR-tom-medium.tar.bz2 \
  && tar xjf /tmp/quiz-voices/tom.tar.bz2 -C /tmp/quiz-voices && mv /tmp/quiz-voices/vits-piper-fr_FR-tom-medium /tmp/quiz-voices/fr_FR-tom-medium || echo "(voix de secours non installée)"
fi
echo "Prêt."
