# Meteogram — « Espace point » couplé au temps de la carte

**Date** : 2026-07-03
**Statut** : conception (spec validée, plan à venir)
**Branche** : `feat/meteogram-point`
**Source de données** : API JSON Open-Meteo (`api.open-meteo.com/v1/forecast`) — contrat vérifié dans `../open-meteo/openapi/forecast.yml`

## Objectif

Offrir un **meteogram** (série temporelle multi-panneaux en un point) de qualité pro, façon MetPy, accessible depuis le popup de valeur au clic sur la carte. Deux différenciateurs :

1. **Couplage temporel bidirectionnel** avec la carte (feature phare) : le meteogram et la timeline pilotent la même échéance.
2. **Espace point extensible** : le meteogram est le premier module d'un tiroir qui accueillera d'autres analyses « au point » plus tard (sondage refait, dispersion d'ensemble, comparaison multi-modèles, table horaire…).

Ce n'est **pas** une évolution du panneau de sondage existant (`src/lib/components/sounding/`), jugé trop dense/éclaté. On repart sur une surface neuve ; le sondage reste tel quel (hors scope) et pourra devenir un module de l'espace point ultérieurement.

### Non-goals (v1)

- Pas de mode « suivi au survol » (une requête par déplacement → fragile côté quotas). Le meteogram se charge **au clic** (point épinglé).
- Pas d'export CSV (PNG uniquement en v1).
- Pas de support du pseudo-domaine maison `arome_france` (Infoclimat, bucket) : absent de l'API publique. Bouton masqué sur ce domaine.
- Pas de migration du sondage vertical dans l'espace point.
- Pas de persistance / sync URL de l'état du tiroir (MVP : perdu au rechargement).
- Pas de comparaison multi-points (un seul point épinglé à la fois).

## Architecture

Découpage en unités isolées et testables indépendamment :

```
src/lib/meteogram/
  api.ts          # client Open-Meteo : URL builder + fetch + parse → MeteogramData
  model-map.ts    # résolution domaine→modèle (table DOMAIN_TO_API_MODEL dans constants.ts)
  scales.ts       # échelles pures temps↔x, valeur↔y (testables sans DOM)
  paths.ts        # génération des paths SVG (lignes, barres, flèches) — pures
  types.ts        # MeteogramData, MeteogramSeries, PanelSpec
src/lib/stores/
  point-workspace.ts   # { open, lat, lng } — non persisté (MVP)
src/lib/components/point-workspace/
  point-drawer.svelte  # tiroir bas : shell, en-tête, redimensionnement, export, close
  meteogram/
    meteogram.svelte      # module : orchestration fetch + rendu des panneaux
    panel.svelte          # un panneau SVG générique (axes, playhead, hover)
    wind-direction.svelte # bande de flèches de direction sous l'axe temps
src/lib/
  time-navigation.ts   # goToValidTime(date) partagé (extrait de time-selector)
```

### 1. Flux de données — une requête par point, pas par échéance

`fetchMeteogram(lat, lng, model)` construit **une seule** requête :

```
GET api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lng}
  &models={model}
  &timezone=UTC
  &hourly=temperature_2m,dew_point_2m,apparent_temperature,
          precipitation,precipitation_probability,
          wind_speed_10m,wind_gusts_10m,wind_direction_10m,
          pressure_msl,cloud_cover_low,cloud_cover_mid,cloud_cover_high,
          cape,freezing_level_height
```

- **Unités** : on demande les **unités métriques de base** (défauts API : °C, mm, km/h→ on force `wind_speed_unit=ms` pour coller à la base interne `m/s`) et on **convertit côté client** via `convertValue` / `unitPreferences` (`src/lib/stores/units.ts`). → le meteogram respecte les préférences d'unités de l'utilisateur et reste cohérent avec la légende/popup.
- **Horizon** : on prend la série native renvoyée par l'API (horizon du modèle). Pas de `forecast_days` forcé en v1.
- **Parse** : la réponse (`hourly.time[]` + un tableau par variable) est transposée en `MeteogramData` : `{ times: Date[], series: Record<string, number[]>, model, units }`. NaN/`null` préservés (trous de données → segments interrompus).

**Point clé quotas** : on **ne refait un fetch que si le point ou le modèle change**. Scruber le temps ne déclenche **aucune** requête réseau — toute la série est déjà chargée, on ne fait que bouger le playhead. Mémoïsation de session par clé `(lat.toFixed(3), lng.toFixed(3), model)` pour éviter un refetch en ré-épinglant à proximité.

### 2. Correspondance domaine → modèle API

Table `DOMAIN_TO_API_MODEL` (dans `constants.ts`, source de vérité unique) :

| Domaine affiché (app) | `models=` (API) |
|---|---|
| `meteofrance_arpege_europe` | `meteofrance_arpege_europe` |
| `meteofrance_arpege_world` | `meteofrance_arpege_world` |
| `meteofrance_arome_france0025` | `meteofrance_arome_france_hd` |
| `meteofrance_arome_france` (bucket) | *(non mappé → bouton masqué)* |
| `ecmwf_ifs025` | `ecmwf_ifs025` |
| `dwd_icon` / `icon_eu` / `icon_d2` | `icon_seamless` / `icon_eu` / `icon_d2` |
| `ncep_gfs*` | `ncep_gfs_seamless` |

Beaucoup d'identifiants sont **identiques** ; la table gère les écarts et l'exclusion (`arome_france` maison). Un domaine absent de la table ⇒ pas d'entrée meteogram (bouton masqué). Table couverte par un test. **À l'implémentation** : vérifier les identifiants de domaine exacts contre `MODEL_SELECTOR_GROUPS` (`constants.ts`) et les valeurs `models=` contre l'enum du `forecast.yml` (le tableau ci-dessus est indicatif, à confirmer entrée par entrée).

### 3. Rendu — SVG sur mesure, sans dépendance

Panneaux tracés en **SVG Svelte 5** (runes). Logique **pure** extraite dans `scales.ts` / `paths.ts` (échelles, génération de paths) → testée sans DOM, façon `vector-styles.ts` / `skewt-coords.ts`. Pas de librairie de charts (bundle léger, contrôle total du thème verre bleu-nuit, export PNG trivial).

Panneaux v1 (empilés, axe temps commun aligné) :

1. **Température** — `temperature_2m` (trait plein) + `dew_point_2m` (pointillé) + `apparent_temperature` (fin/estompé). Séries différenciées **style de trait + couleur** (accessibilité, pas la couleur seule).
2. **Précipitations** — `precipitation` en **barres** (mm/h) + `precipitation_probability` en courbe (%, axe secondaire 0-100).
3. **Vent** — `wind_speed_10m` (plein) + `wind_gusts_10m` (pointillé), et **bande de flèches** `wind_direction_10m` sous l'axe temps.
4. **Avancés** — `pressure_msl` (courbe), couverture nuageuse bas/moy/haut (bandes empilées %), `cape` + `freezing_level_height`.

Interactions par panneau : **hover crosshair** synchronisé sur tous les panneaux (même position temporelle) + tooltip valeurs exactes ; direct-labeling des min/max où utile. Grille discrète (`gray` faible contraste). Axe temps : granularité claire (jours/heures) avec repères de minuit marqués.

Mobile : panneaux empilés verticalement, axe temps scrollable horizontalement si nécessaire (`overflow-x`), densité réduite (moins de ticks).

### 4. Contenant — tiroir bas extensible (« espace point »)

`point-drawer.svelte` : tiroir ancré **en bas**, pleine largeur, verre bleu-nuit (`bg-glass`, `glass-blur`, thème sombre permanent du chrome), **hauteur redimensionnable** (poignée ; défaut ~40 % viewport), aligné **au-dessus de la timeline** (la carte reste interactive et visible au-dessus).

- **En-tête** : coordonnées du point épinglé + **`<Modèle> · dernier run`** (libellé explicite, voir §9) + bouton **Export PNG** + bouton fermer.
- **Contenu** : liste de **modules empilés**. v1 = un seul module (meteogram). Un module = `{ id, title, component, isAvailable(domain) }` → seam d'extension pour les features futures (pas sur-construit en v1, mais le rendu itère déjà sur une liste de modules).
- **Pin carte** : un marqueur MapLibre matérialise le point analysé (distinct du popup de valeur).
- **Store** : `point-workspace.ts` (`{ open, lat, lng }`), non persisté (MVP).
- **Mobile** : le tiroir devient un **bottom-sheet** (réutilise le pattern `chrome/mobile-dock.svelte`).

On ne touche **pas** au sondage existant.

### 5. Couplage temporel bidirectionnel (feature phare)

- **Carte → meteogram** : un **playhead vertical** est tracé à `x($time)` sur tous les panneaux, réactif via `$derived` sur le store `time`. Scruber la timeline (ou lecture play) fait glisser le playhead en direct.
- **Meteogram → carte** : clic/drag sur un panneau → position temporelle → **snap à la `valid_time` la plus proche** disponible dans `$metaJson.valid_times` (car la carte ne rend que les échéances du run courant, parfois 3-horaires) → appel de `goToValidTime(date)` → la carte re-rend le champ spatial.
- **`goToValidTime(date)`** : helper partagé extrait de `playbackAdvance` (`time-selector.svelte:301`) vers `src/lib/time-navigation.ts` — set `$time` + `updateUrl('time', …)` + `changeOMfileURL()` + centrage. La timeline **et** le meteogram l'appellent → comportement rigoureusement identique, une seule source de vérité pour « aller à cette échéance ». Refactor à périmètre minimal (déplacer la fonction, la réimporter dans `time-selector`).

### 6. Export PNG

Bouton export dans l'en-tête du tiroir → sérialisation du `<svg>` composite (les panneaux dans un seul SVG ou composés sur un canvas) → `XMLSerializer` → `Image` (data URL) → dessin sur `<canvas>` → `canvas.toBlob('image/png')` → téléchargement `meteogram_{lat}_{lng}_{run}.png`. Zéro dépendance.

Piège à traiter : le PNG hors-DOM ne voit pas le CSS externe → styles **inline** dans le SVG exporté (couleurs, tailles, `font-family` système explicite) ; en-tête « Infoclimat · modèle · dernier run · point » gravé dans l'image pour un partage autonome.

### 7. Déclenchement

Bouton **« Meteogram »** dans le popup de valeur (`src/lib/popup.ts`), à côté de « Sondage vertical ». Affiché **uniquement** si le domaine courant est présent dans `DOMAIN_TO_API_MODEL`. Clic → épingle le point (`point-workspace.open(lat, lng)`) + ouvre le tiroir. (Contrairement au sondage, pas de gate « niveaux de pression » : le meteogram marche sur tout domaine mappé.)

### 8. Erreurs / quotas

- Échec réseau / **429 (rate-limit)** / réponse invalide → **message inline** dans le module + bouton « Réessayer » ; le tiroir reste ouvert, pas de spam console.
- États : `loading` (skeleton/shimmer, pas d'axe vide), `error` (message + retry), `empty` (point hors couverture du modèle → message explicite).
- Debounce léger sur l'épinglage.
- Durcissement quota (auth/proxy) hors scope v1 : l'API publique Open-Meteo suffit au POC ; si les quotas explosent, bascule vers une stack Open-Meteo auto-hébergée (même contrat) — noté comme évolution, pas implémenté.

### 9. « Dernier run » explicite

L'API publique sert le **dernier run disponible**, pas forcément le run affiché sur la carte (que l'utilisateur peut avoir figé sur un run antérieur). Pour lever toute ambiguïté :

- L'en-tête du tiroir affiche toujours **`<Modèle> · dernier run`** (libellé explicite).
- Si le run affiché sur la carte ≠ dernier run (comparaison `$modelRun` vs le run le plus récent connu de `$metaJson`), un **indice discret** signale que le meteogram s'appuie sur le run le plus récent (donc données/playhead potentiellement décalés du champ carte).
- **Mapping du playhead** : par **timestamp absolu**. Si l'échéance carte sort de la série API, on **clampe/masque** le playhead plutôt que d'afficher une position fausse. Acceptable en v1 (le dernier run couvre en général « maintenant → +N j », qui recouvre les échéances carte).

### 10. Tests (Vitest)

Purs, sans DOM ni carte :

- `DOMAIN_TO_API_MODEL` : mapping + exclusion `arome_france`.
- `api.ts` : builder d'URL (params, liste de variables, `timezone=UTC`) ; parseur réponse → `MeteogramData` (transposition, NaN, unités).
- `scales.ts` : temps↔x, valeur↔y, bornes/nice ticks.
- `paths.ts` : génération de paths (segments interrompus sur NaN, barres, flèches direction).
- Snapping : temps meteogram → `valid_time` la plus proche.
- Câblage conversion d'unités (m/s → préférence, °C → °F…).

Vérif du **couplage bidirectionnel** et du rendu réel : **headless** (playwright-core + chrome système + swiftshader, cf. méthode `headless-map-verification`) en follow-up — `queryRenderedFeatures`/DOM pour vérifier playhead ↔ `$time`.

## Étapes (macro, détaillées dans le plan)

1. `time-navigation.ts` — extraire `goToValidTime`, rebrancher `time-selector`.
2. `meteogram/model-map.ts` + `api.ts` + `types.ts` + tests.
3. `stores/point-workspace.ts`.
4. `meteogram/scales.ts` + `paths.ts` + tests.
5. Composants : `panel.svelte`, `wind-direction.svelte`, `meteogram.svelte`.
6. `point-drawer.svelte` (shell, redimensionnement, en-tête, mobile bottom-sheet).
7. Couplage playhead (carte→meteogram) + drive (meteogram→carte).
8. Export PNG.
9. Bouton déclencheur dans `popup.ts` + pin carte.
10. Mise à jour docs (`.claude/rules/architecture.md` + `components.md` + `stores.md`).

## Suivi docs

À la fin : documenter l'espace point / meteogram dans `.claude/rules/architecture.md` (nouveau flux API + couplage temps), `components.md` (`point-workspace/`), `stores.md` (`point-workspace.ts`), et le seam de modules extensible.
