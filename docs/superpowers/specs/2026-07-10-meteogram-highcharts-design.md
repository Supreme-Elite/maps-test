# Meteogram Highcharts — graphe unique façon yr.no dans l'espace point

**Date** : 2026-07-10
**Statut** : conçu (spec) — implémentation à planifier
**Branche** : `feat/meteogram-point` (PR #114 ouverte — cette évolution s'y empile ou la suit)
**Évolue** : `2026-07-03-meteogram-espace-point-design.md` — le tiroir, le couplage temporel, le
client API et le mapping modèles sont **conservés** ; seule la **couche rendu** change.
**Référence visuelle** : démo officielle Highcharts « Meteogram » (yr.no) fournie par l'utilisateur.

## Objectif

Remplacer le rendu SVG maison du meteogram (jugé trop bas de gamme pour le public cible — les
**prévisionnistes Infoclimat**) par un **graphe Highcharts unique et dense façon yr.no** :
température en spline (rouge, bleu sous 0 °C), précipitations en colonnes avec valeurs,
pression pointillée sur axe dédié, **windbarbs** sous le plot, **rangée de symboles météo**
(icônes yr) au-dessus de la courbe, tooltip partagé, crosshair, zoom X et plot scrollable.

Le squelette « espace point » ne bouge pas : tiroir bas, déclencheur popup, couplage temporel
bidirectionnel avec la carte, client API forecast maison (`getForecastApiUrl()`, sans clé).

### Non-goals (v1)

- Pas de panneaux secondaires (nébulosité, CAPE, probabilité de précip) : le graphe unique les
  écarte — réintroduisibles plus tard en panneaux repliables sous le chart (approche hybride).
- Pas d'export serveur : PNG **client-side** via `offline-exporting` (jamais l'export-server
  Highsoft — données privées).
- Pas de refonte du tiroir, du popup, du couplage temporel ni du client API.
- Pas de thème clair : le chart s'accorde au tiroir sombre existant.

## Décisions de cadrage (issues du brainstorming)

| Question | Décision |
| --- | --- |
| Licence Highcharts | **CC BY-NC gratuite** (Infoclimat = association à but non lucratif, produit open source non monétisé). Note README : un fork commercial devrait acquérir une licence. Intégration confinée à un module de rendu, remplaçable. |
| Forme | **Graphe unique façon yr.no** (3 axes Y + windbarbs + symboles), pas de pile de panneaux. |
| Symboles météo | **Oui en v1** : `weather_code` (WMO) + `is_day` de l'API maison → icônes **NRK/yr (MIT) bundlées** dans `static/weather-symbols/` (~40 SVG, pas de CDN). |
| Chargement | `highcharts` + modules en **import dynamique** à la première ouverture du tiroir (~70 KB gzip différés, zéro impact sur le bundle carte). |

## Architecture

### Conservé tel quel

- `src/lib/meteogram/api.ts` (URL + fetch + parse + `trimTrailingNulls`), `model-map.ts`,
  `snap.ts`, `types.ts` (étendu), store `stores/point-workspace.ts`,
  `components/point-workspace/point-drawer.svelte`, déclencheur dans `popup.ts`.

### Données

- `HOURLY_VARIABLES` : **ajouter** `weather_code`, `is_day` ; **retirer** `cloud_cover_low/mid/high`,
  `cape`, `precipitation_probability` (plus affichés par le graphe unique).
- `types.ts` : `MeteogramKey` suit la nouvelle liste.
- Nouveau module pur `src/lib/meteogram/weather-symbols.ts` :
  `symbolForWmo(code: number, isDay: boolean): { icon: string; label: string }` — mapping
  WMO 4677 → nom de fichier d'icône yr + libellé FR ; code inconnu → fallback (icône nuage,
  libellé générique). Variantes jour/nuit pour les codes qui en ont.
- Icônes : sous-ensemble (~40) de `nrkno/yr-weather-symbols` (MIT) copié dans
  `static/weather-symbols/` avec mention de licence (`LICENSE` du set recopiée).

### Rendu

- Nouveau `src/lib/meteogram/meteogram-chart.ts` — **builder pur** :
  `buildChartOptions(data: MeteogramData, opts: { onTimeClick(date: Date): void }): Highcharts.Options`.
  Contenu calqué sur le démo yr.no, adapté au tiroir sombre :
  - double axe X datetime (heures en bas, jours liés en haut), `crosshair`, bornes = données
    rognées (`trimTrailingNulls` déjà appliqué) ;
  - 3 axes Y : T° (`spline`, `color #FF3333`, `negativeColor #48AFE8`, plotLine zéro), précip
    (`column`, dataLabels > 0), pression (`shortdot`, axe opposé « hPa ») ;
  - série `windbarb` (module officiel), 1 point sur 2, données déjà en m/s ;
  - tooltip partagé avec libellé du symbole météo au header ;
  - `scrollablePlotArea.minWidth` pour mobile ; zoom X (`chart.zooming.type = 'x'`) ;
  - thème sombre inline (fond transparent, gridlines `rgba(255,255,255,0.08)`, textes clairs).
  Builder = données → objet options ; **aucun accès DOM** → testable en node.
- `components/point-workspace/meteogram/meteogram.svelte` — réécrit : `import()` dynamique de
  Highcharts + modules au premier montage, création du chart, post-load
  (`drawWeatherSymbols` : une icône toutes les 2 h, `<img>` du renderer vers
  `/weather-symbols/<icon>.svg` ; séparateurs de barbes façon démo), destruction propre au
  démontage, re-création sur nouveau `MeteogramData`.
- **Couplage temporel préservé** : playhead = `plotLine` X (id fixe) repositionnée via
  `removePlotLine`/`addPlotLine` à chaque changement du store `time` (pas de re-render) ; clic
  sur le chart → `snap.ts` → `goToValidTime()` (logique inchangée, rebranchée sur l'événement
  `click` Highcharts).
- **Supprimés** (remplacés par Highcharts) : `meteogram/panel.svelte`, `wind-direction.svelte`,
  `paths.ts`, `scales.ts`, `png-export.ts` + leurs tests (`meteogram-paths.test.ts`,
  `meteogram-scales.test.ts`). Export PNG = bouton existant du tiroir rebranché sur
  `chart.exportChartLocal()` (module `offline-exporting`).

### États (inchangés dans le tiroir)

Chargement / erreur+recharger / « aucune donnée » restent gérés par le tiroir comme aujourd'hui ;
le chart n'est monté que quand `MeteogramData` est disponible et non vide.

## Fichiers

**Créés** : `src/lib/meteogram/meteogram-chart.ts`, `src/lib/meteogram/weather-symbols.ts`,
`static/weather-symbols/*.svg` (+ licence), tests `meteogram-chart.test.ts`,
`weather-symbols.test.ts`.
**Modifiés** : `api.ts`/`types.ts` (variables), `meteogram.svelte` (réécrit),
`point-drawer.svelte` (bouton PNG rebranché), `package.json` (dep `highcharts`), `README.md`
(note licence).
**Supprimés** : `panel.svelte`, `wind-direction.svelte`, `paths.ts`, `scales.ts`,
`png-export.ts`, `meteogram-paths.test.ts`, `meteogram-scales.test.ts`.

## Tests & vérification

- **Unitaires** : `buildChartOptions` (3 axes Y, séries dans l'ordre, bornes X = données,
  windbarbs 1/2, callbacks branchés), `symbolForWmo` (codes clés 0/1/2/3/45/61/63/65/71/95…,
  jour/nuit, code inconnu → fallback). Tests api/model-map/snap existants inchangés.
- **Headless** : ouvrir le tiroir sur `arome_france`, vérifier le rendu (courbes + barbes +
  icônes), le tooltip partagé, le clic → déplacement de l'échéance carte, l'export PNG local.
- `npm run check` + `npx vitest run` + `rtk proxy npm run lint`.

## Risques / points ouverts

- **Licence** : CC BY-NC couvre l'usage Infoclimat ; fork commercial non couvert → note README.
- **Poids** : ~70 KB gzip, différés par l'import dynamique — acceptable.
- **Highcharts en test node** : seul le builder (pur) est testé ; la création du chart n'est
  vérifiée qu'en headless.
- **Densité des icônes** : une icône / 2 h comme le démo ; à ajuster si l'horizon AROME (51 h)
  les fait se chevaucher sur petits écrans (le `scrollablePlotArea` amortit déjà).
