# Domaine `arome_france_convection` — design

**Date** : 2026-06-01
**Statut** : validé (brainstorm), prêt pour plan d'implémentation

## Contexte

Un nouveau pipeline batch (`infoclimat-pipelines/arome-france-forecast`) publie sur R2 un
nouveau domaine de prévision **AROME France métropole orienté convection / chasse à
l'orage**. Il faut l'exposer dans ce client SvelteKit + MapLibre (`omProtocol` /
`@openmeteo/weather-map-layer`), avec des colormaps dédiées (réflectivité dBZ, IR,
convectif) et deux champs **catégoriels** de type de précipitation.

⚠️ Le domaine s'appelle **`arome_france_convection`** (PAS `arome_france`) : le client
consomme déjà `arome_france` d'Open-Meteo (modèle général). Le suffixe `_convection` lève
la collision.

### Contrat producteur (en place côté R2, accès public, pas d'auth)

Layout identique au schéma `data_spatial` d'`arome_om_reunion` :

```
data_spatial/arome_france_convection/latest.json        # { reference_time, valid_times[], variables[] }
data_spatial/arome_france_convection/in-progress.json
data_spatial/arome_france_convection/{Y}/{M}/{D}/{HHMM}Z/meta.json
data_spatial/arome_france_convection/{Y}/{M}/{D}/{HHMM}Z/{YYYY-MM-DDTHHMM}.om   # 1 OMfile MULTI-VARIABLES / échéance
```

- Grille : 1121×717 à 0.025°, métropole (lon −12→16, lat 37.5→55.4), row 0 = sud (déjà flippé côté producteur).
- Runs toutes les 3 h ; horizon 51 h (échéances H+1→H+51).
- Chaque `.om` contient toutes les variables disponibles à cette échéance, lues via
  `reader.getChildByName(om_name)` (même mécanisme qu'`arome_om_reunion`).

## État du terrain (intégration existante d'`arome_om_reunion`)

Points d'intégration repérés, qui servent de modèle :

- **Enregistrement** : `src/lib/arome-om-domain.ts` déclare un objet `Domain`, le pousse dans
  `domainOptions` (mutable, importé du package) + un groupe dans `domainGroups`, gated sur
  `VITE_MODELS_BUCKET_URL`. Appelé depuis `src/lib/stores/variables.ts` (avant la 1re
  évaluation de `selectedDomain`).
- **Host / URL** : `src/lib/helpers.ts → getBaseUri()` route les domaines listés dans
  `BUCKET_DOMAINS` vers `getModelsBucketUrl()` (R2), sinon `map-tiles.open-meteo.com`.
  `src/lib/url.ts → getOMUrl()/getOMUrlFor()` construit le path
  `data_spatial/{domain}/{run}/{time}.om`. Le layout `data_spatial` est standard → **le
  resolver par défaut du package suffit** (le `customResolveRequest` d'`om-protocol-settings.ts`
  ne sert qu'aux URLs d'anomalie, qui ont un layout `/anomaly/...` différent).
- **Colormaps** : `omProtocolSettings.colorScales` est un `Record<variable → ColorScale>`.
  `standardColorScales` (`om-protocol-settings.ts`) = défaut package surchargé par nos palettes
  (`temperature`, `temperature_2m_anomaly`, `precipitation_sum`). Deux types natifs seulement :
  `breakpoint` (seuils → couleur via `findLastIndexLE`) et `rgba` (rampe linéaire). **Aucun type
  catégoriel natif.** Résolution `getColorScale` : clé exacte, puis préfixe `p0_p1`, puis `p0`.
- **Légende** : `src/lib/components/scale/scale.svelte` rend `breakpoint` (1 ligne/seuil, label =
  valeur numérique) ou `rgba` (25 paliers). Le champ `unit` pilote l'affichage du sélecteur
  d'unité.
- **Labels FR** : `src/lib/i18n/variables-fr.ts` — table `EXPLICIT` (libellé EN→FR ou clé
  snake_case en fallback) + transformer par composition.
- **Visibilité UI / vue** : `DOMAIN_ALLOWLIST`, `MODEL_DESCRIPTIONS`, `DOMAIN_DEFAULT_VIEWS`
  dans `src/lib/constants.ts`. La bascule de domaine (`src/routes/+page.svelte`, abonnement
  `domain.subscribe`) applique `DOMAIN_DEFAULT_VIEWS[domain]` via `flyTo`.

## Décisions (issues du brainstorm)

1. **Légende catégorielle = dédiée** : afficher les noms de catégories (Grêle, Neige sèche…)
   plutôt que des codes numériques.
2. **Source = même bucket R2** `VITE_MODELS_BUCKET_URL` ; domaine gaté (invisible si non
   configuré), comme `arome_om_reunion`.
3. **Variable par défaut = `radar_reflectivity`** quand on bascule sur le domaine.

## Les 9 variables

| om_name                     | grandeur                                  | unité           | plage typique              | colormap                                                                                      |
| --------------------------- | ----------------------------------------- | --------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| `radar_reflectivity`        | réflectivité radar simulée (max colonne)  | dBZ             | −10 → 70                   | échelle radar NWS (bleu→vert→jaune→rouge→magenta), seuils ~5/20/35/50/65 ; transparent <5 dBZ |
| `brightness_temperature`    | temp. brillance IR fenêtre (sommet nuage) | °C              | −80 → +40                  | IR « enhanced » : gris pour ciel clair (chaud), couleurs froides accentuées <−40 °C           |
| `brightness_temperature_wv` | temp. brillance IR vapeur d'eau 6.2 µm    | °C              | −70 → −10                  | palette vapeur d'eau (brun/sec → bleu/humide)                                                 |
| `cape`                      | énergie convective disponible             | J/kg            | 0 → 4000+                  | 0 transparent, vert→jaune→orange→rouge→violet (seuils ~500/1000/2000/3000)                    |
| `convective_inhibition`     | inhibition convective                     | J/kg (négatif)  | −1000 → 0                  | palette « couvercle » (plus négatif = plus marqué)                                            |
| `visibility`                | visibilité minimale 60 min                | m               | 0 → 20000 (plafonné 20 km) | rouge <1 km → orange → jaune → transparent au-delà ~10 km                                     |
| `lightning_density`         | densité de foudre (moyenne 3 h)           | densité         | 0 → ~5                     | 0 transparent, jaune→orange→rouge/violet ; **présent seulement H+3→H+51**                     |
| `precipitation_type`        | type de précip le plus **fréquent**       | code catégoriel | voir table                 | colormap discrète                                                                             |
| `precipitation_type_severe` | type de précip le plus **dangereux**      | code catégoriel | voir table                 | même colormap discrète                                                                        |

### Codes `precipitation_type*`

| code | type                 | code | type                 |
| ---- | -------------------- | ---- | -------------------- |
| 0    | aucune (transparent) | 11   | bruine               |
| 1    | pluie                | 12   | bruine verglaçante   |
| 3    | pluie verglaçante    | 193  | neige fondante       |
| 5    | neige sèche          | 201  | pluie intermittente  |
| 6    | neige humide         | 205  | neige sèche interm.  |
| 7    | pluie + neige        | 206  | neige humide interm. |
| 8    | granules de glace    | 207  | pluie+neige interm.  |
| 10   | grêle                |      |                      |

Variantes ≥193 = « intermittent / fondante » : regroupées visuellement avec leur type de base
(même teinte, opacité réduite) pour limiter le nombre de couleurs distinctes.

## Architecture de la solution

### Unité 1 — Enregistrement du domaine

**Nouveau** `src/lib/arome-france-convection-domain.ts` (calqué sur `arome-om-domain.ts`) :

```ts
const aromeFranceConvectionDomain: Domain = {
	value: AROME_FRANCE_CONVECTION_DOMAIN, // 'arome_france_convection'
	label: 'AROME Convection France',
	grid: {
		type: 'regular',
		nx: 1121,
		ny: 717,
		latMin: 37.5,
		lonMin: -12,
		dx: 0.025,
		dy: 0.025,
		zoom: 5.2
	},
	time_interval: 'hourly',
	model_interval: '3_hourly'
};

export function registerAromeFranceConvectionDomain(): void {
	if (!getModelsBucketUrl()) return; // gating bucket
	// groupe sélecteur dédié (pas de préfixe partagé avec un autre domaine)
	// push idempotent dans domainGroups + domainOptions
}
```

Le sélecteur range un domaine sous un groupe via `domain.value.startsWith(group.value)`.
`arome_france_convection` n'a pas de préfixe partagé → **groupe dédié** de valeur
`arome_france_convection` (label « AROME Convection »). (Choix : valeur de groupe = valeur de
domaine pour que `startsWith` matche sans capturer d'autres domaines `arome_france*` du package.)

**`src/lib/constants.ts`** :

- `export const AROME_FRANCE_CONVECTION_DOMAIN = 'arome_france_convection';`
- `DOMAIN_DEFAULT_VIEWS[AROME_FRANCE_CONVECTION_DOMAIN] = { center: [2.3, 46.6], zoom: 5 };`
- `DOMAIN_ALLOWLIST` : ajouter `'arome_france_convection'`.
- `MODEL_DESCRIPTIONS[...]` : « Infoclimat · 0,025° (~2,5 km), France métropole · convection / orage · ~51 h ».
- Nouvelle table `DOMAIN_DEFAULT_VARIABLES: Record<string,string>` avec
  `arome_france_convection → 'radar_reflectivity'`.

**`src/lib/helpers.ts`** : ajouter `AROME_FRANCE_CONVECTION_DOMAIN` à `BUCKET_DOMAINS`.

**`src/lib/stores/variables.ts`** : importer et appeler `registerAromeFranceConvectionDomain()`
à côté de `registerAromeOmDomain()`.

### Unité 2 — Variable par défaut du domaine

`src/lib/metadata.ts → matchVariableOrFirst()` : quand la variable courante est absente du
`meta.json`, avant le fallback `variables[0]`, consulter `DOMAIN_DEFAULT_VARIABLES[domain]` ;
si cette variable préférée est présente dans `meta.variables`, la sélectionner. Sinon
comportement actuel (préfixe de niveau, puis `variables[0]`). Préserve les URLs partagées
dont la variable est valide pour le domaine.

### Unité 3 — Colormaps

**Nouveau type app-local** (`src/lib/color-scales/types.ts`) :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

export interface CategoryEntry {
	code: number;
	label: string;
}

/** Colormap discrète : un BreakpointColorScale dont les breakpoints sont les codes
 *  catégoriels, plus un champ `categories` aligné index-par-index sur breakpoints/colors
 *  pour piloter la légende. Le moteur ignore `categories` (objet renvoyé tel quel par
 *  getColorScale/resolveColorScale), donc le rendu carte reste un breakpoint standard. */
export interface CategoricalColorScale extends BreakpointColorScale {
	categories: CategoryEntry[];
}
```

**Encodage catégoriel** : `breakpoints` = codes triés croissants `[0,1,3,5,6,7,8,10,11,12,193,201,205,206,207]` ;
`colors[i]` = couleur du code `breakpoints[i]` ; `categories[i] = { code: breakpoints[i], label }`.
Le moteur colore via `index = max(0, findLastIndexLE(breakpoints, px))` → chaque code exact tombe
sur sa propre couleur (les entiers intermédiaires inexistants, ex. 13..192, héritent de la
couleur du code inférieur le plus proche — inoffensif car ils n'apparaissent pas). Code 0 →
couleur alpha 0 (transparent).

**Fichiers** (un par colormap, `src/lib/color-scales/`) :
`radar-reflectivity.ts`, `brightness-temperature.ts`, `brightness-temperature-wv.ts`,
`cape.ts`, `convective-inhibition.ts`, `visibility.ts`, `lightning-density.ts`,
`precipitation-type.ts` (exporte une seule `CategoricalColorScale` partagée).

**Enregistrement** (`src/lib/stores/om-protocol-settings.ts → standardColorScales`) : ajouter
les clés exactes `radar_reflectivity`, `brightness_temperature`, `brightness_temperature_wv`,
`cape`, `convective_inhibition`, `visibility`, `lightning_density`, `precipitation_type`,
`precipitation_type_severe` (les deux dernières → même `CategoricalColorScale`). Les clés
exactes priment sur la résolution par préfixe et sur les défauts package (ex. `visibility`
package a une unité erronée « W/m² » ; `cape`/`convective_inhibition` package sont remplacés
par nos versions dédiées).

### Unité 4 — Légende discrète

**Nouveau helper pur** `src/lib/color-scales/legend.ts` :

```ts
export type LegendEntry = { color: RGBA; label: string } | { color: RGBA; value: number };
export function isCategorical(scale): scale is CategoricalColorScale {
	return 'categories' in scale;
}
export function legendEntriesFor(scale): LegendEntry[]; // catégoriel → {color,label} ; sinon paliers numériques existants
```

**`scale.svelte`** : remplacer `getLabeledColorsForLegend` par un appel à `legendEntriesFor` et
brancher l'affichage :

- catégoriel → afficher `entry.label` (nom de catégorie), pas de `formatValue`, pas de
  sélecteur d'unité (`unit` vide), pas de conversion. L'entrée code 0 (transparent) est
  masquée de la légende.
- continu → comportement actuel inchangé.

Le champ `categories` traverse `getColorScale`/`resolveColorScale` (objet retourné tel quel ;
nos colors sont des `RGBA[]` plats sans variantes light/dark). L'édition de couleur
(`customColorScales`) reste fonctionnelle (index aligné, `structuredClone` conserve `categories`).

### Unité 5 — Labels FR

`src/lib/i18n/variables-fr.ts`, table `EXPLICIT` :

- Clés snake_case (variables absentes des `variableOptions` package) :
  `radar_reflectivity: 'Réflectivité radar'`,
  `brightness_temperature: 'Température de brillance (IR fenêtre)'`,
  `brightness_temperature_wv: 'Température de brillance (vapeur d'eau)'`,
  `precipitation_type_severe: 'Type de précip. (le plus sévère)'`.
- Traductions EN→FR des libellés package : `'Lightning Density' → 'Densité de foudre'`,
  `'Convective Inhibition' → 'Inhibition convective (CIN)'`, `'Visibility' → 'Visibilité'`.
  (`CAPE` et `Precipitation Type` sont déjà traduits.)

## Flux de données

1. `registerAromeFranceConvectionDomain()` (au chargement de `variables.ts`, si bucket configuré)
   → domaine présent dans `domainOptions` + groupe dans `domainGroups`.
2. UI : `DOMAIN_ALLOWLIST` le rend visible dans `model-selector.svelte`.
3. Bascule domaine → `flyTo(DOMAIN_DEFAULT_VIEWS[...])` → fetch `latest.json`/`in-progress.json`
   via `getBaseUri()` (bucket R2) → `metaJson` → `matchVariableOrFirst()` choisit
   `radar_reflectivity`.
4. `getOMUrl()` → `om://{bucket}/data_spatial/arome_france_convection/{run}/{time}.om?variable=…`.
5. `omProtocol` (resolver par défaut) parse le domaine depuis le path, lit la variable via
   `getChildByName`, applique `colorScales[variable]`, rend la tuile.
6. `scale.svelte` lit `colorScales[variable]` → légende continue ou catégorielle.

## Gestion d'erreurs

- Bucket non configuré → domaine absent du sélecteur (gating). URL partagée d'un domaine non
  enregistré → fallback `DEFAULT_DOMAIN` (`selectedDomain` derived, déjà en place).
- `lightning_density` absente à H+1/H+2 : sélection à ces échéances → `getChildByName` échoue →
  pixel vide. Acceptable pour le MVP (concern producteur ; pas de garde côté client).
- NaN propagés (pixel source manquant) → transparent (comportement moteur).

## Tests (Vitest, `src/lib/tests/`, env node — logique pure uniquement)

- **`arome-france-convection-domain.test.ts`** (mirror `arome-om-domain.test.ts`) : push
  idempotent, gating `VITE_MODELS_BUCKET_URL`, dimensions grille (1121×717, dx/dy 0.025,
  `time_interval='hourly'`, `model_interval='3_hourly'`), groupe dédié enregistré.
- **`url-builder.test.ts`** (étendre) : `getBaseUri('arome_france_convection')` → bucket R2 ;
  `getOMUrlFor()` produit le path `data_spatial/arome_france_convection/{run}/{time}.om?variable=…`.
- **`color-scales.test.ts`** (nouveau) : pour chaque colormap, breakpoints triés croissants et
  `colors.length === breakpoints.length` ; pour la catégorielle, `categories.length === breakpoints.length`
  et `categories[i].code === breakpoints[i]` ; `getColor(scale, code)` rend la couleur attendue
  pour chaque code de la table ; `getColor(scale, 0)` a alpha 0 ; un entier hors-code (ex. 50)
  hérite du code inférieur attendu.
- **`legend.test.ts`** (nouveau) : `legendEntriesFor` renvoie des entrées `{label}` pour une
  `CategoricalColorScale` (code 0 masqué) et des paliers numériques pour un `breakpoint`/`rgba`.
- **`metadata.test.ts`** (nouveau ou étendu) : `matchVariableOrFirst()` choisit
  `radar_reflectivity` quand la variable courante est absente et que le domaine a un défaut ;
  conserve une variable valide partagée par URL ; fallback `variables[0]` sinon.

## Hors scope (notés)

- Whitelist `time_interval` côté worker — sans rapport (le worker ne sert pas ce domaine).
- Garde client sur l'absence de `lightning_density` aux 2 premières échéances.
- Niveaux de sondage vertical — le domaine n'expose pas de niveaux de pression.
- Refactor non lié des composants existants.

## Conventions

Svelte 5 runes, Tailwind v4, imports auto-triés (`npm run format`), titres de PR sémantiques
(`feat:`). TDD : test rouge → implémentation → vert, par unité.
