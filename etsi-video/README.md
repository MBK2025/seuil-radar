# « Et si… ? » – vidéos 3D verticales pour le compte TikTok de Moubarak

Une vidéo par jour (1080x1920, **65 à 100 s** : plus d'une minute pour être rémunérée par TikTok) qui répond à une question « Et si… ? » de façon spectaculaire mais **exacte** : « Et si la Lune disparaissait ? », « Et si tu ne dormais plus pendant une semaine ? », « Et si Internet s'arrêtait 24 h ? ». Public visé : jeunes Français de 15 à 25 ans.

Le moteur est le même que `science-video/` (three.js, bloom, sous-titres mot à mot, bruitages), copié ici pour être réglé à part : **lis `../science-video/README.md`** pour l'API complète d'une scène (`E.at`, `E.fit`, `E.shell`, `E.dot`, `E.tag3`, `E.panel`, accessoires `E.P`…). Seules les différences sont décrites ici.

## Différences avec science-video
- **RÉALISME AVANT TOUT** (exigence n°1 de Moubarak, sur TOUTES les vidéos : « je ne veux pas un truc basique ») : tout est fait en code (three.js), ElevenLabs ne sert qu'à la voix. Donc chaque plan vise le photoréalisme :
  - matériaux physiques (`E.phys` / `MeshPhysicalMaterial`) avec rugosité, métal, clearcoat, transmission ; éclairage d'environnement (`scene.environment` via PMREM / `RoomEnvironment`) + lumière principale, contre-jour et ombres ;
  - textures procédurales riches cuites dans des shaders (relief, bruit fbm, normales calculées, nuages, océan spéculaire, atmosphère diffusante, cratères, rouille, végétation…), jamais de couleur unie sur une grande surface ;
  - ciel et décors complets (horizon, brume de profondeur `scene.fog`, étoiles, nébuleuse, sol détaillé), jamais un objet seul sur fond vide ;
  - caméra « cinéma » : focales 35–50 mm, mouvements lents et continus, légère profondeur de champ (passe Bokeh) sur les plans rapprochés, flou de mouvement simulé sur les transitions ;
  - particules en grand nombre (poussière, étincelles, eau, débris) pour la matière et l'échelle ;
  - étalonnage : le moteur applique contraste et saturation légers + vignette + grain ; bloom modéré (threshold ≥ 0.85), jamais d'image délavée ni cramée.
  Le style hologramme (`holo`) est INTERDIT ici : `"style": "classic"` dans meta.json. L'épisode modèle 000 est en holo : il sert uniquement d'exemple d'API (plans, E.at, bruitages), PAS de modèle visuel.
- **Sous-titres minimalistes** (demande de Moubarak : « le plus mini possible pour ne pas envahir la vidéo ») : Montserrat ExtraBold 46 px, 1 à 3 mots, fondu doux, le mot prononcé en jaune, placés bas (y ≈ 1330). **Zone réservée y de 1270 à 1400 px** : aucun HUD, panneau ou étiquette dedans. `^MOT^` (70 px) : au plus 3 fois par vidéo.
- **Voix parfaitement synchronisée** : chaque plan commence sur le mot qui l'annonce (`E.at`) ; ce qu'on voit = ce qu'on entend, à la demi-seconde près.
- **Transitions, effets et musique harmonieux** : whoosh doux à chaque plan, transitions variées (fondu, zoom de coupe, flash léger, glissé) mais cohérentes ; bruitages discrets ; ambiance musicale générée et discrète (`--music-volume 0.06`, jamais au-dessus de 0.08), la voix doit toujours dominer.
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
