# Science du quotidien – vidéos 3D verticales

Une vidéo explicative par jour (1080x1920, plus de 90 s) : un phénomène scientifique ou un objet du quotidien expliqué simplement, en **3D animée** (three.js, bloom, caméras qui bougent) + surcouches façon HUD, sous-titres mot à mot, voix off captivante et bruitages synchronisés (sans musique).

## Chaîne de fabrication

```
./setup.sh                                                     # une fois par session
mkdir episodes/NNN-slug                                        # NNN = numéro sur 3 chiffres
# écrire script.txt (affichage) + voix.txt (lecture) + meta.json
# générer voix.mp3 (ElevenLabs) — ou voix.wav (Piper, secours)
python3 tools/align.py episodes/NNN-slug/script.txt episodes/NNN-slug/voix.mp3 episodes/NNN-slug/words.json
# écrire episodes/NNN-slug/scene.js (voir l'API plus bas et l'exemple 001-radar)
node tools/render.js episodes/NNN-slug preview            # 1 image au début de chaque plan → episodes/NNN-slug/prev/
node tools/render.js episodes/NNN-slug preview 3,12.5,40  # images aux instants choisis
node tools/render.js episodes/NNN-slug full               # → out/NNN-slug.mp4 (≈ 1 à 1,3 s par image : lancer en arrière-plan)
```
Options de `render.js` : `--fps 25` (défaut), `--rs 0.65` (échelle du rendu 3D), `--handle @compte` (sinon `config.json`), `--seed N` (variante musicale).

## Voix (ElevenLabs, modèle `eleven_v4`, generations_count 1)
Trois voix captivantes, choisies selon le sujet — jamais la même 3 jours de suite (voir `historique.json`, champ `voix_id`) :
| Voix | voice_id | Quand |
|---|---|---|
| Maxence – jeune, dynamique, naturel | `GGkMUTZaJ8IyPwaHimUq` | objets du quotidien, technologie, sujets fun ou surprenants |
| Loïc – conteur engageant | `mgJuPHzoFzHp7TakLEYb` | mécanismes à expliquer pas à pas : corps humain, espace, physique, histoire d'une invention |
| Kevin – créateur de contenu, punchy | `zVrWtLr70jn6SeaARX0i` | chiffres chocs, idées reçues démontées, défis « tu savais que… » |

`voix.txt` peut contenir des indications de jeu entre crochets que la voix interprète sans les lire : `[curious]` (question, accroche), `[excited]` (révélation), `[whispers]` (confidence), `[serious]`, `[laughs softly]`. Au plus une toutes les 2 ou 3 phrases, en début de phrase. Elles n'apparaissent PAS dans `script.txt`.
Voix de secours (si ElevenLabs est indisponible) : `python3 tools/voix_secours.py voix.txt voix.wav` (retirer les crochets avant).

## Fichiers d'un épisode
- `script.txt` — le texte affiché en sous-titres, **mot pour mot identique** à ce qui est prononcé. Balises : `*mot*` = mot accentué en jaune, `^MOT^` = mot géant (1 à 3 mots, pour les chiffres choc et les mots clés), `mot[5]` = forcer 5 syllabes (sigles, unités : `km/h[5]`). Les nombres peuvent rester en chiffres (`97`).
- `voix.txt` — le même texte, sans balises, nombres et unités **écrits en toutes lettres** (c'est ce que lit la voix), plus les indications de jeu `[...]` (voir Voix).
- `voix.mp3` (ElevenLabs) ou `voix.wav` (Piper) — non versionné.
- `words.json` — produit par `align.py` (instant de chaque mot, déduit des pauses de la voix).
- `scene.js` — la mise en scène (voir ci-dessous).
- `meta.json` — `{titre, domaine, legende, hashtags[], sources[], voix}`.

## API d'une scène (`scene.js`)
```js
export async function build(E) {
  const { THREE, V3, P, clamp, ease, easeIO, lerp, COL, o } = E;
  E.mood('studio');                       // 'night' | 'studio' | 'space' | 'day' | 'lab'
  const t1 = E.at('onde');                // instant où le mot « onde » est prononcé (E.at(mot, après_s))
  const shots = [
    { name: 'accroche', start: 0,
      update(t, lt, k) { /* placer objets + caméra : E.camSet(pos, cible, fov) ou E.orbit(cible, angle, hauteur, distance) */ },
      hud(t, lt, k)    { /* dessin 2D par-dessus : E.tag3(V3, 'TEXTE'), E.panel(...), E.arrow2(...)… */ } },
    { name: 'zoom', start: t1, filter: 'blur(10px) brightness(0.55)', sfx: 'whoosh', update(t){…}, hud(t){…} },
    { name: 'schéma', start: E.at('donc'), no3d: true, bg: '#05070c', hud(t){…} },  // plan 100 % 2D
  ];
  return { shots, sfx: [{ t: E.at('clic'), type: 'click' }] };
}
```
`t` = temps global (s), `lt` = temps depuis le début du plan, `k` = avancement du plan (0→1). Un plan dure jusqu'au `start` du suivant.
**Son (obligatoire)** — PAS de musique de fond (choix de Moubarak : elle couvre la voix). `tools/mix.py` (appelé par `render.js full`) mixe la voix et les bruitages puis normalise le volume (−15 LUFS). Pour réactiver une musique : `--music-volume 0.08`.
Bruitages : `whoosh` joué automatiquement à chaque changement de plan (mettre `sfx: 'none'` sur un plan pour l'enlever), et la liste `sfx` renvoyée par `build` pour les moments clés, **calés sur un mot** avec `E.at(...)` : `boom` (révélation, chiffre choc), `pop` (apparition d'une étiquette ou d'un élément), `ding` (résultat, bonne réponse), `click` (déclic, photo, interrupteur), `rise` (montée de tension avant une révélation). Viser 8 à 15 bruitages par vidéo, jamais deux à moins de 0,4 s.

**3D** — `E.scene`, `E.camera`, `E.THREE`, `E.RoundedBoxGeometry`, matériaux `E.std(couleur, rugosité, métal, émissif, intensité)`, `E.phys(couleur, {…})`, `E.glassMat()`, `E.glowMat(couleur, opacité)` (additif, lumineux), `E.radialTex()`, `E.lights.{hemi,key,rim}`, `E.bloom` (strength, threshold).
Effets en pool (à rappeler **à chaque image** dans `update`, ils sont remis à zéro automatiquement) :
- `E.shell(i, centre, direction, rayon, couleur, opacité)` — front d'onde lumineux (radar, son, lumière, wifi…)
- `E.ring(i, centre, rayon, couleur, opacité, normale)` — anneau (ondes sonores, ondulations)
- `E.dot(position, taille, couleur)` — jusqu'à 4000 particules (molécules, électrons, photons, gouttes…)
- `E.line3(i, [V3…], couleur, opacité, part)` — trajectoire / rayon / ligne de champ dessinée progressivement
- `E.snapshot(filtreCSS)` — capture l'image 3D courante (pour une « photo », un insert).

**Accessoires** (`E.P`) : `studio()` (sol + halo + projecteur, pour présenter un objet), `nightRoad()`, `car({color, plate})` (+ `userData.drive(x, z)`), `ambulance()`, `radarTower()`, `human({color})` (+ `userData.walk(phase)`), `arrow3D(couleur)` (+ `userData.point(a, b)`), `planet({r, c1, c2})`, `trees()`, `streetLamp()`, `stars()`, `contactShadow()`, `textTexture(lignes)`.
Pour un objet absent (frigo, micro-ondes, cœur, neurone, avion…), le construire avec les primitives three.js (`RoundedBoxGeometry`, `CylinderGeometry`, `TorusGeometry`, `LatheGeometry`, `TubeGeometry`, `ExtrudeGeometry`…) : formes simples, matériaux soignés, une couleur d'accent par élément important. Une **vue en coupe** (moitié de l'objet en `glassMat`, intérieur visible) explique très bien un mécanisme.

**2D** (`E.o` = contexte canvas 1080x1920) — `E.txt(s, x, y, taille, couleur, police 'Inter'|'Mono', graisse, align)`, `E.glass(x,y,w,h)`, `E.tag(texte, x, y, couleur, opacité)`, `E.tag3(V3, texte, dx, dy, couleur, opacité)` (étiquette reliée à un point 3D), `E.leader`, `E.arrow2`, `E.wave2` (sinusoïde), `E.reticle`, `E.bigNumber`, `E.bar`, `E.panel(titre, [[ligne, couleur]…])`, `E.flash(a)`, `E.scanlines()`, `E.P2.speedSign/envelope/gauge/count`, `E.proj(V3) → [x, y, z]`. Couleurs : `E.COL.acc` (jaune), `cyan`, `orange`, `red`, `green`, `violet`.

## Règles de mise en scène
- **Zone réservée** aux sous-titres : y de 250 à 600 px. Rien d'important dedans. HUD et panneaux entre 700 et 1750 px.
- Un plan toutes les 4 à 9 s ; jamais plus de 10 s sans changement de caméra, de plan ou d'élément nouveau.
- La caméra bouge toujours un peu (travelling, orbite lente, zoom) ; ralenti / retour arrière / vue en coupe / vision spéciale pour les moments clés.
- Une idée = une image : chaque phrase du script a un visuel qui la montre.
- Les phares, écrans et émissifs face caméra saturent avec le bloom : baisser leur intensité dans ces plans.
- Pas de logo de marque, pas de personne réelle, pas d'emblème protégé (croix rouge sur fond blanc, etc.).

## Historique et publication
- `historique.json` : un sujet par épisode, jamais deux fois le même (ni un sujet trop proche).
- `config.json` : marque Metricool du compte (`blogId`, `handle`, `networks`), remplie par l'agent.
- Les vidéos ne sont **pas** versionnées sur `main` : la vidéo du jour est poussée seule sur la branche `videos-science` (URL publique `https://raw.githubusercontent.com/MBK2025/seuil-radar/videos-science/<fichier>.mp4`). Ne jamais toucher à la branche `videos` (agent Quiz).
