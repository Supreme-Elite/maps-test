# Météogramme — améliorations « retour lecteur »

**Date** : 2026-07-14
**Branche** : `feat/meteogram-feedback-lecteur`
**Contexte** : retour d'un utilisateur sur la feature météogramme (PR #114/#115). Quatre axes
de « forme » : réduire les clics pour ouvrir le météogramme, lisibilité des courbes,
fusion heures+dates, quelques réglages fins. La remarque « des modèles moins chauds 🙄 »
est une boutade météo — **hors scope**.

## Objectifs

1. **Sélection** — raccourcir le chemin vers le météogramme et afficher des infos de point
   lisibles (altitude, coordonnées) via le **clic droit**.
2. **Lisibilité des courbes** — le lecteur confond les courbes (il croit voir pression =
   vert et humidité = jaune, alors que vert = point de rosée, jaune = pression, et
   **aucune courbe d'humidité n'existe**). Symptôme d'une **légende absente**. On ajoute :
   légende explicite, courbe d'humidité (Hr) réellement demandée, et vent en chiffres.
3. **Axe temps** — fusionner heures et dates pour alléger le cadre.
4. **Réglages fins** — police des précip, échelle de température auto-adaptable.

## Non-objectifs (YAGNI)

- Multi-modèles / comparaison de modèles dans le météogramme (« modèles moins chauds » =
  boutade).
- « Survol renforcé » (marqueurs + tooltip enrichi) : écarté par l'utilisateur au profit de
  la légende. Le tooltip partagé existant est conservé tel quel (hors alignement d'unité
  vent, cf. bloc 2c).
- Emprunt de l'humidité pour AROME HD (voir réserve bloc 2b).

---

## Bloc 1 — Sélection : clic droit → bulle enrichie

### Interaction (`src/lib/popup.ts`)

Nouveau handler `map.on('contextmenu', …)` dans `addPopup()` :

- `e.preventDefault()` — supprime le menu contextuel natif du navigateur.
- Ignoré si `get(terraDrawActive)` (cohérent avec le handler `click`).
- Force `popupMode.set('drag')` (état épinglé), (ré)arme le `mousemove` comme le fait le
  `click`, puis `renderPopup(e.lngLat)`.
- **Résultat desktop** : 1 clic droit → bulle épinglée, boutons visibles immédiatement (vs
  3 clics gauche aujourd'hui : follow → pin → bouton).

Le handler `click` (gauche) est **inchangé** : viseur en suivi, épinglage au 2ᵉ clic, etc.

### Contenu enrichi de la bulle (état épinglé uniquement)

Quand `mode === 'drag'` (déjà la condition d'affichage des boutons dans
`updatePopupContent`) :

- **Ligne viseur conservée** : valeur + unité + vent (comportement actuel).
- **Nouvelle ligne d'infos point** : coordonnées `lat, lng` à **4 décimales** + **altitude
  lisible** — libellé « Alt. 342 m » en police normale, au lieu du minuscule label
  actuellement positionné en absolu au-dessus de la bulle (`.popup-elevation`,
  `font-size: smaller`).
- Boutons (sondage si applicable, météogramme) : inchangés.

En mode « suivi » (non épinglé) : la bulle reste le **viseur compact** d'aujourd'hui
(valeur/unité/vent), coordonnées masquées. L'altitude compacte du viseur peut rester
telle quelle en suivi.

### CSS (`src/styles.css`)

- La bulle a des hauteurs **fixes** (`.popup { height: 58px }` desktop, `110px` mobile). À
  l'état épinglé enrichi elle doit croître : introduire une classe `.popup--pinned`
  (togglée sur l'élément `el` dans `updatePopupContent` selon `mode`) qui passe la hauteur
  en **auto** et empile proprement viseur → ligne infos → boutons.
- Nouvelle règle `.popup-coords` (coordonnées) et restyle `.popup-elevation` en version
  lisible **quand la bulle est épinglée** (le viseur en suivi garde le rendu compact).

### Mobile

Pas de clic droit. Le 1ᵉʳ tap épingle déjà (mode `drag`) → l'info enrichie
(coords + altitude lisible) apparaît en **bonus**, flux 2 taps inchangé. Vérifier que la
hauteur mobile (110px → auto) ne casse pas le positionnement du stem/dot.

---

## Bloc 2 — Chart : légende + humidité + vent chiffré (`src/lib/meteogram/meteogram-chart.ts`)

### 2a. Légende

- `legend.enabled: true`, thème sombre : `itemStyle.color = TEXT_STRONG`, `~11px`,
  `verticalAlign: 'top'`, `align: 'center'`, symboles compacts.
- `itemHiddenStyle` / `itemHoverStyle` explicites (sinon défauts clairs Highcharts).
- Légende **cliquable** (comportement par défaut) → masquer/afficher une série. Sert de
  soupape si l'humidité charge trop le graphe.
- Coût : ~18 px de zone de tracé. Police compacte pour limiter l'impact sur le chart
  mobile (déjà à marges resserrées). Vérifier en headless viewport mobile.
- Les noms de séries existent déjà (Température, Point de rosée, Précipitations, Pression,
  Vent) ; ajout de « Humidité ». La série windbarb reste dans la légende (libellé
  « Vent ») — ajuster le symbole si le rendu est disgracieux.

### 2b. Humidité relative (Hr)

- `src/lib/meteogram/types.ts` : ajouter `'relative_humidity_2m'` à `MeteogramKey`.
- `src/lib/meteogram/api.ts` : ajouter `'relative_humidity_2m'` à `HOURLY_VARIABLES`.
  Variable réelle du modèle (toujours renseignée pour ces modèles) → participe sainement
  au `trimTrailingNulls` (pas dans `TRIM_EXCLUDED`).
- `src/lib/components/point-workspace/meteogram/meteogram.svelte` : nouvelle entrée
  `humidity: seriesValues('relative_humidity_2m')` (base `'%'` → passe-plat des unités,
  aucune conversion), transmise à l'input du builder.
- `meteogram-chart.ts` :
  - **Nouvel axe Y dédié** 0-100 %, à droite (`opposite: true`), à côté de l'axe pression.
    Libellés réduits (0/50/100), petite police, teinte violette.
  - **Série ligne** « Humidité », couleur `#c084fc` (violet, distincte de rouge/vert/
    cyan/ambre/sky déjà utilisés), `lineWidth: 1`, marqueurs off.
  - Défaut **visible** ; désactivable via la légende.
- **Tension assumée** : on atteint 4 axes Y (T° gauche, précip masqué gauche, pression
  droite, humidité droite) sur un graphe déjà dense. Mitigations : ligne fine, libellés
  d'axe minimaux, toggle légende.
- **Bonus abandonnable (décision utilisateur)** : l'humidité est un « nice to have ». Si le
  4ᵉ axe complique le rendu ou **dégrade la lisibilité globale** du graphe (encombrement,
  chevauchement des axes droite, casse du rendu mobile), on la **retire** — pas de prise de
  risque sur la lisibilité, qui est l'objectif premier du retour lecteur. La légende + les
  autres blocs restent l'apport principal. À évaluer à l'étape vérification headless.
- **Réserve** : si un modèle ne diffuse pas `relative_humidity_2m` (AROME HD ?), la courbe
  aura des trous — **pas d'emprunt prévu** (contrairement à `weather_code`/`pressure_msl`).
  Acceptable pour cette itération.

### 2c. Vent en chiffres

- `dataLabels` sur la série `windbarb` : vitesse **entière** près de chaque barbule,
  `allowOverlap: false` (Highcharts élague les collisions sur horizon long — les barbes
  sont déjà 1/2). Police 8-9 px, couleur sky.
- **Respect de l'unité de vent des préférences** (km/h par défaut) : la valeur du windbarb
  **reste en m/s** (nécessaire au tracé des plumes / calcul Beaufort). On fait passer dans
  l'input du builder un `windDisplay: { factor: number; unit: string }` dérivé de
  `convertValue`/`getDisplayUnit` (les conversions vitesse sont **affines/linéaires** :
  m/s→km/h ×3,6, →mph ×2,237, →kn ×1,944). Le `dataLabel.formatter` et le
  `tooltip.pointFormatter` utilisent ce `windDisplay` — **corrige au passage** le tooltip,
  aujourd'hui figé sur km/h codé en dur.

---

## Bloc 3 — Axe temps : heures + dates fusionnés (`meteogram-chart.ts`)

- **Supprimer** le 2ᵉ axe X « opposite » (l'axe date du haut). `xAxis` devient un seul axe.
- Sur l'axe bas : labels d'heure (`%H`) par défaut ; **à minuit local, afficher la date en
  gras** (`%a %e %b`) à la place de l'heure, via `labels.formatter` utilisant
  `this.axis.chart.time.dateFormat(...)` (respecte `time.timezone`).
- **Séparateurs de jour** : redessinés en `plotLines` verticales (couleur `GRID_DAY`)
  calculées aux **minuits locaux** dans le builder pur — scan de `input.times` +
  `Intl.DateTimeFormat(input.timezone)` pour repérer les changements de jour local.
- **Edge case accepté** (cohérent avec la limite DST déjà documentée) : fuseaux à offset
  non-entier (ex. Inde +5:30) désaligneraient le repère « minuit » vs les ticks 6 h. Cible
  = France/Europe (offsets entiers) → non pertinent.

---

## Bloc 4 — Réglages fins (`meteogram-chart.ts`)

- **Police des précip** : étiquettes de la série `column` `8px` → `10px`.
- **Échelle de T° auto-adaptable** : retirer `tickInterval: 1` (grille à 1° → ~25 lignes un
  jour de canicule) ; laisser Highcharts choisir l'intervalle (auto), **conserver**
  `minRange: 8` (un jour plat garde du relief). Ajuster `maxPadding` si nécessaire pour
  laisser respirer la courbe.
- **Altitude lisible** : traitée au bloc 1.

---

## Fichiers touchés

- `src/lib/popup.ts` — handler `contextmenu`, classe `.popup--pinned`, ligne coords +
  altitude lisible à l'épinglage.
- `src/styles.css` — `.popup--pinned`, `.popup-coords`, restyle altitude épinglée.
- `src/lib/meteogram/types.ts` — clé `relative_humidity_2m`.
- `src/lib/meteogram/api.ts` — `HOURLY_VARIABLES` + humidité.
- `src/lib/meteogram/meteogram-chart.ts` — légende, axe/série humidité, dataLabels vent +
  `windDisplay`, axe temps fusionné, police précip, échelle T° auto.
- `src/lib/components/point-workspace/meteogram/meteogram.svelte` — série humidité +
  `windDisplay` dans l'input.

## Tests

Suivre le TDD du repo (test rouge → vert) :

- `src/lib/tests/meteogram-api.test.ts` — `relative_humidity_2m` présent dans l'URL /
  parsé dans les séries.
- `src/lib/tests/meteogram-chart.test.ts` — légende activée ; série + axe humidité
  présents ; un seul axe X (date fusionnée) ; dataLabels vent activés ; `windDisplay`
  appliqué (label + tooltip) ; police précip 10px ; T° sans `tickInterval` forcé ;
  `plotLines` de séparation de jour calculées.
- Vérification **headless** (playwright, cf. mémoire `headless-map-verification`) : clic
  droit → bulle enrichie (coords + altitude), chart avec légende/humidité/vent chiffré,
  cadre temps fusionné — desktop **et** viewport mobile (légende ne doit pas écraser la
  zone de tracé).

## Réserves tranchées (à l'oral)

- Humidité **visible par défaut, désactivable via la légende** — validé.
- Humidité **abandonnable sans risque** si elle dégrade la lisibilité globale (cf. bloc 2b)
  — validé. Priorité : ne pas dégrader le graphe.
