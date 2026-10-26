# Quiz vidéo TikTok (Foot & Culture G)

Fabrique chaque jour une vidéo quiz verticale 1080x1920, animée, avec voix off et une image par question.

1. `./setup.sh`
2. Écrire `quiz.json` (voir `exemple.json`)
3. `node render_images.mjs quiz.json img/`
4. `python3 make_quiz.py quiz.json --script-out script.json` (textes à faire lire par la voix)
5. Générer `intro.mp3`, `q1.mp3`, `r1.mp3`, …, `outro.mp3` dans `voix/` (ElevenLabs)
6. `python3 make_quiz.py quiz.json sortie.mp4 --images img/ --audio-dir voix/ --voice /tmp/quiz-voices/fr_FR-tom-medium/fr_FR-tom-medium.onnx`

`historique.json` garde les questions déjà posées pour ne jamais les répéter.
Illustrations : OpenMoji (CC BY-SA 4.0) et Natural Earth via world-atlas.
