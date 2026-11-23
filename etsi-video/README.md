# « Et si… ? » – vidéos 3D verticales pour le compte TikTok de Moubarak

Une vidéo par jour (1080x1920, **65 à 100 s** : plus d'une minute pour être rémunérée par TikTok) qui répond à une question « Et si… ? » de façon spectaculaire mais **exacte** : « Et si la Lune disparaissait ? », « Et si tu ne dormais plus pendant une semaine ? », « Et si Internet s'arrêtait 24 h ? ». Public visé : jeunes Français de 15 à 25 ans.

Le moteur est le même que `science-video/` (three.js, bloom, sous-titres mot à mot, bruitages), copié ici pour être réglé à part : **lis `../science-video/README.md`** pour l'API complète d'une scène (`E.at`, `E.fit`, `E.shell`, `E.dot`, `E.tag3`, `E.panel`, accessoires `E.P`…). Seules les différences sont décrites ici.

## Différences avec science-video
- **Sous-titres plus petits et plus fluides** (demande de Moubarak : « trop gros, pas assez fluide ») : Montserrat ExtraBold 62 px, 1 à 4 mots, apparition en fondu + légère montée, le mot prononcé passe en jaune, les mots à venir légèrement transparents. `^MOT^` = 104 px. Ne pas les regrossir.
- **Style visuel « cinéma »** (pas l'hologramme bleu de science-video) : dans `meta.json`, `"style": "classic"`. Des objets 3D soignés et colorés (matériaux physiques `E.std` / `E.phys`, lumières, bloom modéré), de vraies ambiances (`E.mood('space' | 'night' | 'day' | 'studio' | 'lab')`), particules, explosions, vues en coupe. Moubarak veut un rendu « très réalisé, propre, avec des effets comme dans CapCut » : chaque plan doit être beau, jamais une forme isolée sur fond vide.
- **Ambiance musicale discrète** générée (libre de droits) : `render.js full` mixe par défaut `--music-volume 0.06`. Mettre `--music-volume 0` si la voix est couverte.
- **Signature** : `config.json` → `@loliz802`.

## Chaîne de fabrication
```
./setup.sh
mkdir episodes/NNN-slug          # NNN = numéro sur 3 chiffres (historique.json)
# script.txt + voix.txt + meta.json (voir ../science-video/README.md, mêmes balises *mot* ^MOT^ mot[n])
# voix.mp3 (ElevenLabs) → align → scene.js → aperçus → rendu
python3 tools/align.py episodes/NNN-slug/script.txt episodes/NNN-slug/voix.mp3 episodes/NNN-slug/words.json
node tools/render.js episodes/NNN-slug preview
node tools/render.js episodes/NNN-slug full        # → out/NNN-slug.mp4 (≈ 1 s par image : en arrière-plan)
```
Modèle d'épisode complet : `episodes/000-modele-saisons/` (scène riche, 20 plans, bruitages calés sur les mots).

## Voix (ElevenLabs, `eleven_v4`, generations_count 1)
| Voix | voice_id | Quand |
|---|---|---|
| Hugo – créateur punchy (voix principale) | `3Tp5mYhT9wrfnry9pzvV` | par défaut |
| Kevin – créateur de contenu | `zVrWtLr70jn6SeaARX0i` | sujets « chiffres chocs », 1 jour sur 4 environ |
| Loïc – conteur | `mgJuPHzoFzHp7TakLEYb` | scénarios longs, catastrophes, espace |
Indications de jeu dans `voix.txt` uniquement : `[intrigued]`, `[serious]`, `[excited]`, `[whispers]`, `[playful]` (au plus une toutes les 2 ou 3 phrases).

## Écriture d'un épisode
- Accroche en moins de 3 s : la question « Et si… » + une image choc dès la première seconde.
- 3 à 5 conséquences concrètes, de la plus immédiate à la plus folle, avec des chiffres vérifiés et une comparaison parlante ; un rebondissement avant la fin ; conclusion qui boucle sur l'accroche ; question pour faire commenter + « abonne-toi pour le prochain Et si ».
- Tutoiement, phrases courtes, ton jeune et vivant ; 230 à 300 mots (65 à 100 s).
- Chaque fait est vérifié sur 2 sources fiables. Quand c'est un scénario hypothétique, dire « les scientifiques pensent que », « probablement » : jamais présenter une spéculation comme une certitude.
- Interdits : faits divers et personnes réelles identifiables, sujets médicaux donnant des conseils, politique, religion, contenu choquant ou violent, logos et personnages protégés.

## Historique, compte et hébergement
- `historique.json` : un sujet par épisode, jamais deux fois le même ni un sujet trop proche.
- `config.json` : marque Metricool « kiss » (blogId 7655184), compte TikTok `@loliz802` (le compte de 60 000 abonnés de Moubarak).
- Les vidéos ne sont pas versionnées sur `main`. La vidéo du jour est hébergée sur la branche **`videos-etsi`**, en commit NORMAL (le push forcé est refusé) : `git clone --depth 1 --branch videos-etsi https://github.com/MBK2025/seuil-radar /tmp/host`, `git rm` des anciennes vidéos, ajout de la nouvelle, commit, `git -c push.negotiate=true push origin HEAD:videos-etsi`. URL publique : `https://raw.githubusercontent.com/MBK2025/seuil-radar/videos-etsi/<fichier>.mp4`. Ne jamais toucher aux branches `videos` (Quiz) et `videos-science`.
