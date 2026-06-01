# Domaine `arome_france_convection` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer un nouveau domaine de prévision `arome_france_convection` (AROME France métropole, orienté convection/orage) dans le client SvelteKit + MapLibre, avec 9 variables, leurs colormaps dédiées (7 continues + 1 catégorielle partagée par 2 variables) et une légende discrète pour les types de précipitation.

**Architecture:** Le domaine est un pseudo-domaine servi depuis le bucket R2 (`VITE_MODELS_BUCKET_URL`) au layout `data_spatial` standard, calqué sur `arome_om_reunion`. On enregistre l'objet `Domain` dans `domainOptions` (gating bucket), on route le host via `BUCKET_DOMAINS`, on déclare les colormaps par clé exacte dans `standardColorScales`, et on étend la légende pour rendre les codes catégoriels comme des noms de catégories. Aucune modification du resolver `omProtocol` (le resolver par défaut gère le layout `data_spatial`).

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, `@openmeteo/weather-map-layer`, Tailwind v4, Vitest (env node).

**Référence spec :** `docs/superpowers/specs/2026-06-01-arome-france-convection-design.md`

---

## File Structure

**Créés :**
- `src/lib/arome-france-convection-domain.ts` — enregistrement du domaine (objet `Domain` + groupe + gating bucket).
- `src/lib/color-scales/types.ts` — type app-local `CategoricalColorScale` + `CategoryEntry`.
- `src/lib/color-scales/radar-reflectivity.ts`
- `src/lib/color-scales/brightness-temperature.ts`
- `src/lib/color-scales/brightness-temperature-wv.ts`
- `src/lib/color-scales/cape.ts`
- `src/lib/color-scales/convective-inhibition.ts`
- `src/lib/color-scales/visibility.ts`
- `src/lib/color-scales/lightning-density.ts`
- `src/lib/color-scales/precipitation-type.ts` — `CategoricalColorScale` partagée par `precipitation_type` et `precipitation_type_severe`.
- `src/lib/color-scales/legend.ts` — helpers purs `isCategorical()` / `categoricalLegendEntries()`.
- `src/lib/components/scale/categorical-legend.svelte` — rendu de la légende discrète.
- `src/lib/tests/arome-france-convection-domain.test.ts`
- `src/lib/tests/convection-color-scales.test.ts`
- `src/lib/tests/legend.test.ts`
- `src/lib/tests/match-variable.test.ts`

**Modifiés :**
- `src/lib/constants.ts` — constante domaine, `DOMAIN_DEFAULT_VIEWS`, `DOMAIN_ALLOWLIST`, `MODEL_DESCRIPTIONS`, nouvelle table `DOMAIN_DEFAULT_VARIABLES`.
- `src/lib/helpers.ts` — `BUCKET_DOMAINS`.
- `src/lib/stores/variables.ts` — appel `registerAromeFranceConvectionDomain()`.
- `src/lib/metadata.ts` — `matchVariableOrFirst()` consulte `DOMAIN_DEFAULT_VARIABLES`.
- `src/lib/stores/om-protocol-settings.ts` — enregistrement des 9 colormaps dans `standardColorScales`.
- `src/lib/components/scale/scale.svelte` — branche catégorielle de la légende.
- `src/lib/i18n/variables-fr.ts` — libellés FR.
- `src/lib/tests/url-builder.test.ts` — cas du nouveau domaine.

---

## Task 1: Constante de domaine + table des variables par défaut

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Ajouter la constante et les entrées de config**

Dans `src/lib/constants.ts`, après le bloc `AROME_OM_REUNION_DOMAIN` (ligne ~12), ajouter :

```ts
/** Pseudo-domaine AROME France métropole orienté convection/orage (servi depuis
 *  le bucket R2, produit par le pipeline `arome-france-forecast`). Distinct du
 *  `arome_france` général d'Open-Meteo (le suffixe `_convection` lève la collision). */
export const AROME_FRANCE_CONVECTION_DOMAIN = 'arome_france_convection';
```

Dans l'objet `DOMAIN_DEFAULT_VIEWS`, ajouter l'entrée métropole (garder l'entrée Réunion existante) :

```ts
export const DOMAIN_DEFAULT_VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
	[AROME_OM_REUNION_DOMAIN]: { center: [50.2, -15.97], zoom: 4.47 },
	[AROME_FRANCE_CONVECTION_DOMAIN]: { center: [2.3, 46.6], zoom: 5 }
};
```

Juste après `DOMAIN_DEFAULT_VIEWS`, ajouter la nouvelle table :

```ts
/** Variable affichée par défaut quand l'utilisateur bascule sur un domaine et que
 *  la variable courante n'existe pas dans son meta.json. Consulté par
 *  `matchVariableOrFirst()` avant le fallback `variables[0]`. */
export const DOMAIN_DEFAULT_VARIABLES: Record<string, string> = {
	[AROME_FRANCE_CONVECTION_DOMAIN]: 'radar_reflectivity'
};
```

Dans `DOMAIN_ALLOWLIST`, ajouter (sous le bloc « AROME-OM Outre-Mer ») :

```ts
	// AROME Convection France (pseudo-domaine, visible seulement si le bucket est configuré)
	'arome_france_convection',
```

Dans `MODEL_DESCRIPTIONS`, ajouter l'entrée :

```ts
	arome_france_convection:
		'Infoclimat · 0,025° (~2,5 km), France métropole · convection / orage · ~51 h',
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run check`
Expected: PASS (0 erreur). `DOMAIN_DEFAULT_VARIABLES` est encore inutilisé mais exporté — pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(arome-convection): déclare la constante de domaine et sa config UI"
```

---

## Task 2: Enregistrement du domaine

**Files:**
- Create: `src/lib/arome-france-convection-domain.ts`
- Test: `src/lib/tests/arome-france-convection-domain.test.ts`
- Modify: `src/lib/stores/variables.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/tests/arome-france-convection-domain.test.ts` :

```ts
import { domainGroups, domainOptions } from '@openmeteo/weather-map-layer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('registerAromeFranceConvectionDomain', () => {
	beforeEach(() => {
		const idx = domainOptions.findIndex((d) => d.value === 'arome_france_convection');
		if (idx >= 0) domainOptions.splice(idx, 1);
		const gidx = domainGroups.findIndex((g) => g.value === 'arome_france_convection');
		if (gidx >= 0) domainGroups.splice(gidx, 1);
		vi.resetModules();
	});

	it('registers a dedicated selector group so the domain is shown', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceConvectionDomain } = await import(
			'$lib/arome-france-convection-domain'
		);
		registerAromeFranceConvectionDomain();
		expect(domainGroups.filter((g) => g.value === 'arome_france_convection').length).toBe(1);
		// Le lien groupe↔domaine repose sur startsWith.
		expect('arome_france_convection'.startsWith('arome_france_convection')).toBe(true);
	});

	it('pushes arome_france_convection with the producer grid dimensions', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceConvectionDomain } = await import(
			'$lib/arome-france-convection-domain'
		);
		registerAromeFranceConvectionDomain();
		const d = domainOptions.find((x) => x.value === 'arome_france_convection');
		expect(d).toBeDefined();
		expect(d?.grid.nx).toBe(1121);
		expect(d?.grid.ny).toBe(717);
		if (d?.grid.type === 'regular') {
			expect(d.grid.dx).toBeCloseTo(0.025, 6);
			expect(d.grid.dy).toBeCloseTo(0.025, 6);
			expect(d.grid.lonMin).toBeCloseTo(-12, 6);
			expect(d.grid.latMin).toBeCloseTo(37.5, 6);
		} else {
			throw new Error('arome_france_convection grid must be of type "regular"');
		}
		expect(d?.time_interval).toBe('hourly');
		expect(d?.model_interval).toBe('3_hourly');
	});

	it('is idempotent (no duplicate push)', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceConvectionDomain } = await import(
			'$lib/arome-france-convection-domain'
		);
		registerAromeFranceConvectionDomain();
		registerAromeFranceConvectionDomain();
		expect(domainOptions.filter((x) => x.value === 'arome_france_convection').length).toBe(1);
	});

	it('does not push when bucket URL is empty', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', '');
		const { registerAromeFranceConvectionDomain } = await import(
			'$lib/arome-france-convection-domain'
		);
		registerAromeFranceConvectionDomain();
		expect(domainOptions.find((x) => x.value === 'arome_france_convection')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/arome-france-convection-domain.test.ts`
Expected: FAIL — `Cannot find module '$lib/arome-france-convection-domain'`.

- [ ] **Step 3: Implémenter le module**

Créer `src/lib/arome-france-convection-domain.ts` :

```ts
import { type Domain, domainGroups, domainOptions } from '@openmeteo/weather-map-layer';

import { AROME_FRANCE_CONVECTION_DOMAIN } from '$lib/constants';
import { getModelsBucketUrl } from '$lib/runtime-env';

/** Groupe (fournisseur) dédié sous lequel le sélecteur range le domaine convection.
 *  Le sélecteur affiche un domaine sous un groupe si `domain.value` commence par
 *  `group.value`. On prend la valeur de domaine entière comme valeur de groupe pour
 *  ne capturer aucun autre domaine `arome_france*` du package. */
const AROME_FRANCE_CONVECTION_GROUP = AROME_FRANCE_CONVECTION_DOMAIN;

/** Domaine AROME France métropole orienté convection / chasse à l'orage.
 *  Grille 1121×717 à 0.025°, métropole (lon −12→16, lat 37.5→55.4).
 *  Runs toutes les 3 h, horizon 51 h. Voir spec
 *  `2026-06-01-arome-france-convection-design.md`. */
const aromeFranceConvectionDomain: Domain = {
	value: AROME_FRANCE_CONVECTION_DOMAIN,
	label: 'AROME Convection France',
	grid: {
		type: 'regular',
		nx: 1121,
		ny: 717,
		latMin: 37.5,
		lonMin: -12,
		dx: 0.025,
		dy: 0.025,
		// Même résolution native que AROME France 0.025° → même zoom de référence.
		zoom: 5.2
	},
	time_interval: 'hourly',
	model_interval: '3_hourly'
};

/**
 * Pousse le pseudo-domaine `arome_france_convection` dans `domainOptions` (mutable).
 * Idempotent. Ne fait rien si `VITE_MODELS_BUCKET_URL` n'est pas configuré — le
 * domaine reste alors absent du sélecteur (gating analogue à anomaly / arome-om).
 */
export function registerAromeFranceConvectionDomain(): void {
	if (!getModelsBucketUrl()) return;
	if (!domainGroups.some((g) => g.value === AROME_FRANCE_CONVECTION_GROUP)) {
		domainGroups.push({ value: AROME_FRANCE_CONVECTION_GROUP, label: 'AROME Convection' });
	}
	if (domainOptions.some((d) => d.value === AROME_FRANCE_CONVECTION_DOMAIN)) return;
	domainOptions.push(aromeFranceConvectionDomain);
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/arome-france-convection-domain.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Câbler l'enregistrement au démarrage**

Dans `src/lib/stores/variables.ts`, ajouter l'import (après `registerAromeOmDomain`) et l'appel.

Import (avec les autres `$lib/...`) :

```ts
import { registerAromeFranceConvectionDomain } from '$lib/arome-france-convection-domain';
```

Appel (juste après `registerAromeOmDomain();`) :

```ts
registerAromeOmDomain();
registerAromeFranceConvectionDomain();
```

- [ ] **Step 6: Vérifier la compilation et les tests**

Run: `npm run check && npx vitest run src/lib/tests/arome-france-convection-domain.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/arome-france-convection-domain.ts src/lib/stores/variables.ts src/lib/tests/arome-france-convection-domain.test.ts
git commit -m "feat(arome-convection): enregistre le domaine (gating bucket R2)"
```

---

## Task 3: Routage du host vers le bucket R2

**Files:**
- Modify: `src/lib/helpers.ts`
- Modify: `src/lib/tests/url-builder.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/lib/tests/url-builder.test.ts`, ajouter ce cas dans le `describe('getOMUrlFor', ...)` :

```ts
	it('routes arome_france_convection to the R2 bucket data_spatial path', () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		d.set('arome_france_convection');
		const url = getOMUrlFor('radar_reflectivity');
		expect(url).toContain('https://bucket.test/data_spatial/arome_france_convection/');
		expect(url).toContain('variable=radar_reflectivity');
		expect(url).not.toContain('map-tiles.open-meteo.com');
	});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/url-builder.test.ts -t "routes arome_france_convection"`
Expected: FAIL — l'URL pointe vers `map-tiles.open-meteo.com` (domaine pas encore dans `BUCKET_DOMAINS`).

- [ ] **Step 3: Ajouter le domaine à BUCKET_DOMAINS**

Dans `src/lib/helpers.ts`, modifier l'import et le set :

```ts
import { ANOMALY_DOMAIN, AROME_FRANCE_CONVECTION_DOMAIN, AROME_OM_REUNION_DOMAIN } from '$lib/constants';
```

```ts
const BUCKET_DOMAINS: ReadonlySet<string> = new Set([
	ANOMALY_DOMAIN,
	AROME_OM_REUNION_DOMAIN,
	AROME_FRANCE_CONVECTION_DOMAIN
]);
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/url-builder.test.ts`
Expected: PASS (tous les cas, y compris le nouveau).

- [ ] **Step 5: Commit**

```bash
git add src/lib/helpers.ts src/lib/tests/url-builder.test.ts
git commit -m "feat(arome-convection): route le domaine vers le bucket R2"
```

---

## Task 4: Variable par défaut du domaine (`matchVariableOrFirst`)

**Files:**
- Modify: `src/lib/metadata.ts`
- Test: `src/lib/tests/match-variable.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/tests/match-variable.test.ts` (les stores sont des writables/persisted : lire avec `get(...)` de `svelte/store`) :

```ts
import { get } from 'svelte/store';

import { beforeEach, describe, expect, it } from 'vitest';

import { metaJson as mJ } from '$lib/stores/time';
import { domain as d, variable as v } from '$lib/stores/variables';

import { matchVariableOrFirst } from '$lib/metadata';

const meta = (variables: string[]) => ({
	completed: true,
	last_modified_time: '',
	reference_time: '2026-06-01T00:00:00Z',
	valid_times: ['2026-06-01T01:00'],
	variables
});

describe('matchVariableOrFirst', () => {
	beforeEach(() => {
		d.set('arome_france_convection');
	});

	it('picks the domain default variable when the current one is absent', () => {
		v.set('temperature_2m');
		mJ.set(meta(['cape', 'radar_reflectivity', 'visibility']));
		matchVariableOrFirst();
		expect(get(v)).toBe('radar_reflectivity');
	});

	it('keeps a valid shared-URL variable that exists in the domain', () => {
		v.set('cape');
		mJ.set(meta(['cape', 'radar_reflectivity']));
		matchVariableOrFirst();
		expect(get(v)).toBe('cape');
	});

	it('falls back to the first variable when no domain default applies', () => {
		d.set('meteofrance_arome_france0025');
		v.set('not_a_real_variable');
		mJ.set(meta(['precipitation', 'cloud_cover']));
		matchVariableOrFirst();
		expect(get(v)).toBe('precipitation');
	});
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/match-variable.test.ts`
Expected: FAIL — le 1er test attend `radar_reflectivity` mais reçoit `cape` (1re variable du meta, comportement actuel).

- [ ] **Step 3: Implémenter le défaut par domaine**

Dans `src/lib/metadata.ts` :

Ajouter l'import du domaine et de la table (avec les imports `$lib/...` existants) :

```ts
import { DOMAIN_DEFAULT_VARIABLES } from '$lib/constants';
```

Modifier `matchVariableOrFirst()` pour consulter la table avant le fallback :

```ts
export const matchVariableOrFirst = () => {
	const variable = get(v);
	const metaJson = get(mJ);
	if (!metaJson || metaJson.variables.includes(variable)) return;
	if (variable === 'temperature_2m_anomaly') return;

	let matched: string | undefined;
	const prefix = variable.match(VARIABLE_PREFIX)?.groups?.prefix;

	if (prefix) {
		matched = metaJson.variables.find((mv) => mv.startsWith(prefix));
	}

	// Défaut par domaine (ex. arome_france_convection → radar_reflectivity) avant le
	// fallback `variables[0]`, à condition que la variable préférée soit publiée.
	const domainDefault = DOMAIN_DEFAULT_VARIABLES[get(d)];
	if (!matched && domainDefault && metaJson.variables.includes(domainDefault)) {
		matched = domainDefault;
	}

	v.set(matched ?? metaJson.variables[0]);
};
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/match-variable.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metadata.ts src/lib/tests/match-variable.test.ts
git commit -m "feat(arome-convection): variable par défaut radar_reflectivity sur bascule de domaine"
```

---

## Task 5: Type catégoriel + colormaps continues

**Files:**
- Create: `src/lib/color-scales/types.ts`
- Create: `src/lib/color-scales/radar-reflectivity.ts`
- Create: `src/lib/color-scales/brightness-temperature.ts`
- Create: `src/lib/color-scales/brightness-temperature-wv.ts`
- Create: `src/lib/color-scales/cape.ts`
- Create: `src/lib/color-scales/convective-inhibition.ts`
- Create: `src/lib/color-scales/visibility.ts`
- Create: `src/lib/color-scales/lightning-density.ts`
- Test: `src/lib/tests/convection-color-scales.test.ts`

- [ ] **Step 1: Écrire le test qui échoue (colormaps continues)**

Créer `src/lib/tests/convection-color-scales.test.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';
import { describe, expect, it } from 'vitest';

import { brightnessTemperatureScale } from '$lib/color-scales/brightness-temperature';
import { brightnessTemperatureWvScale } from '$lib/color-scales/brightness-temperature-wv';
import { capeScale } from '$lib/color-scales/cape';
import { convectiveInhibitionScale } from '$lib/color-scales/convective-inhibition';
import { lightningDensityScale } from '$lib/color-scales/lightning-density';
import { radarReflectivityScale } from '$lib/color-scales/radar-reflectivity';
import { visibilityScale } from '$lib/color-scales/visibility';

const continuous: [string, BreakpointColorScale][] = [
	['radar', radarReflectivityScale],
	['brightness', brightnessTemperatureScale],
	['brightness_wv', brightnessTemperatureWvScale],
	['cape', capeScale],
	['cin', convectiveInhibitionScale],
	['visibility', visibilityScale],
	['lightning', lightningDensityScale]
];

describe('continuous convection color scales', () => {
	it.each(continuous)('%s has aligned, ascending breakpoints', (_name, scale) => {
		expect(scale.type).toBe('breakpoint');
		const colors = scale.colors as number[][];
		expect(Array.isArray(colors)).toBe(true);
		expect(colors.length).toBe(scale.breakpoints.length);
		for (let i = 1; i < scale.breakpoints.length; i++) {
			expect(scale.breakpoints[i]).toBeGreaterThan(scale.breakpoints[i - 1]);
		}
		for (const c of colors) {
			expect(c.length).toBe(4);
			expect(c[3]).toBeGreaterThanOrEqual(0);
			expect(c[3]).toBeLessThanOrEqual(1);
		}
	});

	it('radar reflectivity is transparent below the first threshold', () => {
		// colors[0] couvre px < breakpoints[1] (cf. findLastIndexLE) → doit être alpha 0.
		expect(radarReflectivityScale.breakpoints[0]).toBe(0);
		expect((radarReflectivityScale.colors as number[][])[0][3]).toBe(0);
	});

	it('cape and lightning are transparent at zero', () => {
		expect((capeScale.colors as number[][])[0][3]).toBe(0);
		expect((lightningDensityScale.colors as number[][])[0][3]).toBe(0);
	});
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/convection-color-scales.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Créer le type catégoriel**

Créer `src/lib/color-scales/types.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

/** Une catégorie discrète (code producteur + libellé FR pour la légende). */
export interface CategoryEntry {
	code: number;
	label: string;
}

/**
 * Colormap discrète : un `BreakpointColorScale` dont les `breakpoints` sont les
 * codes catégoriels triés croissants, augmenté d'un champ `categories` aligné
 * index-par-index sur `breakpoints` / `colors`. Le moteur de rendu ignore
 * `categories` (l'objet est renvoyé tel quel par `getColorScale` / `resolveColorScale`
 * car nos `colors` sont des `RGBA[]` plats sans variantes light/dark), donc le rendu
 * carte reste un breakpoint standard ; `categories` ne sert qu'à la légende.
 */
export interface CategoricalColorScale extends BreakpointColorScale {
	categories: CategoryEntry[];
}
```

- [ ] **Step 4: Créer les 7 colormaps continues**

Créer `src/lib/color-scales/radar-reflectivity.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Réflectivité radar simulée (max colonne), échelle de type NWS.
// Bande de tête transparente (breakpoint 0, alpha 0) : tout px < 5 dBZ est rendu
// transparent (le moteur retombe sur colors[0] pour px < breakpoints[1]).
export const radarReflectivityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'dBZ',
	breakpoints: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
	colors: [
		[0, 0, 0, 0], // <5 transparent
		[4, 233, 231, 0.85], // 5
		[1, 159, 244, 0.88], // 10
		[3, 0, 244, 0.9], // 15
		[2, 253, 2, 0.9], // 20
		[1, 197, 1, 0.92], // 25
		[0, 142, 0, 0.92], // 30
		[253, 248, 2, 0.94], // 35
		[229, 188, 0, 0.94], // 40
		[253, 149, 0, 0.96], // 45
		[253, 0, 0, 0.97], // 50
		[212, 0, 0, 0.98], // 55
		[188, 0, 0, 0.99], // 60
		[248, 0, 253, 1], // 65
		[152, 84, 198, 1] // 70
	]
};
```

Créer `src/lib/color-scales/brightness-temperature.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Température de brillance IR fenêtre (sommet de nuage), enhanced IR.
// Tops froids (<−40 °C) en couleurs saturées ; ciel clair / nuages chauds en
// niveaux de gris (du clair vers le foncé quand la surface se réchauffe).
export const brightnessTemperatureScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '°C',
	breakpoints: [-80, -70, -60, -50, -40, -30, -20, -10, 0, 20, 40],
	colors: [
		[255, 255, 255, 1], // -80 tops les plus froids, blanc
		[255, 0, 255, 1], // -70 magenta
		[180, 0, 220, 1], // -60 violet
		[255, 0, 0, 1], // -50 rouge
		[255, 150, 0, 1], // -40 orange
		[255, 255, 0, 1], // -30 jaune
		[200, 200, 200, 1], // -20 gris clair
		[170, 170, 170, 1], // -10
		[140, 140, 140, 1], // 0
		[90, 90, 90, 1], // 20
		[40, 40, 40, 1] // 40 surface chaude, gris foncé
	]
};
```

Créer `src/lib/color-scales/brightness-temperature-wv.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Température de brillance IR vapeur d'eau 6.2 µm.
// BT froide = haute humidité (blanc/bleu) ; BT chaude = air sec (brun).
export const brightnessTemperatureWvScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '°C',
	breakpoints: [-70, -60, -50, -40, -30, -20, -10],
	colors: [
		[255, 255, 255, 1], // -70 le plus humide, blanc
		[150, 200, 255, 1], // -60 bleu clair
		[40, 120, 220, 1], // -50 bleu
		[20, 70, 140, 1], // -40 bleu profond (humide)
		[110, 90, 50, 1], // -30 transition brun
		[150, 110, 50, 1], // -20 brun
		[110, 80, 40, 1] // -10 sec, brun foncé
	]
};
```

Créer `src/lib/color-scales/cape.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Énergie convective disponible (CAPE). 0 transparent, puis
// vert→jaune→orange→rouge→violet selon l'intensité.
export const capeScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'J/kg',
	breakpoints: [0, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000],
	colors: [
		[0, 0, 0, 0], // 0 transparent
		[0, 128, 0, 0.55], // 100
		[60, 170, 0, 0.65], // 250
		[160, 210, 0, 0.72], // 500
		[255, 235, 0, 0.8], // 1000
		[255, 190, 0, 0.85], // 1500
		[255, 140, 0, 0.9], // 2000
		[255, 70, 0, 0.93], // 2500
		[220, 0, 0, 0.96], // 3000
		[150, 0, 160, 1] // 4000+
	]
};
```

Créer `src/lib/color-scales/convective-inhibition.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Inhibition convective (CIN, négative). Plus c'est négatif, plus le « couvercle »
// est marqué (violet foncé) ; proche de 0 = pas d'inhibition = transparent.
// Breakpoints croissants (contrainte moteur) : du plus négatif vers 0.
export const convectiveInhibitionScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'J/kg',
	breakpoints: [-1000, -500, -200, -100, -50, -25, 0],
	colors: [
		[40, 0, 60, 0.95], // -1000 couvercle le plus fort
		[80, 0, 90, 0.9], // -500
		[120, 30, 110, 0.82], // -200
		[150, 70, 120, 0.7], // -100
		[170, 120, 140, 0.5], // -50
		[190, 170, 175, 0.3], // -25
		[200, 200, 200, 0] // 0 transparent (pas d'inhibition)
	]
};
```

Créer `src/lib/color-scales/visibility.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Visibilité minimale 60 min (m). Faible visibilité = alarmant (rouge) ;
// au-delà de ~10 km, transparent (bonne visibilité, rien à signaler).
export const visibilityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'm',
	breakpoints: [0, 200, 500, 1000, 2000, 5000, 10000],
	colors: [
		[180, 0, 0, 0.95], // 0 brouillard dense
		[230, 0, 0, 0.9], // 200
		[255, 90, 0, 0.85], // 500
		[255, 170, 0, 0.78], // 1000
		[255, 230, 0, 0.6], // 2000
		[255, 255, 160, 0.35], // 5000
		[255, 255, 255, 0] // 10000 → transparent
	]
};
```

Créer `src/lib/color-scales/lightning-density.ts` :

```ts
import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Densité de foudre (moyenne 3 h). 0 transparent, puis jaune→orange→rouge→violet.
// Pas d'unité standard affichée. Variable présente seulement H+3→H+51.
export const lightningDensityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '',
	breakpoints: [0, 0.1, 0.5, 1, 2, 3, 5],
	colors: [
		[0, 0, 0, 0], // 0 transparent
		[255, 255, 150, 0.7], // 0.1
		[255, 230, 0, 0.8], // 0.5
		[255, 170, 0, 0.88], // 1
		[255, 90, 0, 0.93], // 2
		[230, 0, 0, 0.97], // 3
		[150, 0, 160, 1] // 5+
	]
};
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/convection-color-scales.test.ts`
Expected: PASS.

- [ ] **Step 6: Vérifier la compilation**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/color-scales/types.ts src/lib/color-scales/radar-reflectivity.ts src/lib/color-scales/brightness-temperature.ts src/lib/color-scales/brightness-temperature-wv.ts src/lib/color-scales/cape.ts src/lib/color-scales/convective-inhibition.ts src/lib/color-scales/visibility.ts src/lib/color-scales/lightning-density.ts src/lib/tests/convection-color-scales.test.ts
git commit -m "feat(arome-convection): colormaps continues + type catégoriel"
```

---

## Task 6: Colormap catégorielle `precipitation_type`

**Files:**
- Create: `src/lib/color-scales/precipitation-type.ts`
- Modify: `src/lib/tests/convection-color-scales.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `src/lib/tests/convection-color-scales.test.ts` (nouveaux imports en tête + bloc describe) :

```ts
import { getColor } from '@openmeteo/weather-map-layer';

import { precipitationTypeScale } from '$lib/color-scales/precipitation-type';
```

```ts
describe('precipitation_type categorical scale', () => {
	const scale = precipitationTypeScale;
	const colors = scale.colors as number[][];

	it('aligns breakpoints, colors and categories index-by-index', () => {
		expect(colors.length).toBe(scale.breakpoints.length);
		expect(scale.categories.length).toBe(scale.breakpoints.length);
		for (let i = 0; i < scale.breakpoints.length; i++) {
			expect(scale.categories[i].code).toBe(scale.breakpoints[i]);
		}
	});

	it('has ascending breakpoints covering every producer code', () => {
		const codes = [0, 1, 3, 5, 6, 7, 8, 10, 11, 12, 193, 201, 205, 206, 207];
		expect(scale.breakpoints).toEqual(codes);
		for (let i = 1; i < scale.breakpoints.length; i++) {
			expect(scale.breakpoints[i]).toBeGreaterThan(scale.breakpoints[i - 1]);
		}
	});

	it('renders code 0 (aucune) transparent', () => {
		expect(getColor(scale, 0)[3]).toBe(0);
	});

	it('maps each exact code to its own color via findLastIndexLE bucketing', () => {
		// La grêle (10) et la neige fondante (193) doivent rendre des couleurs distinctes
		// et égales à l'entrée de leur index respectif.
		const idxHail = scale.breakpoints.indexOf(10);
		const idxSleet = scale.breakpoints.indexOf(193);
		expect(getColor(scale, 10)).toEqual(colors[idxHail]);
		expect(getColor(scale, 193)).toEqual(colors[idxSleet]);
		expect(getColor(scale, 1)).toEqual(colors[scale.breakpoints.indexOf(1)]);
	});

	it('maps a non-existent intermediate integer to the nearest lower code color', () => {
		// 50 n'est pas un code → hérite de la couleur du code 12 (dernier ≤ 50).
		expect(getColor(scale, 50)).toEqual(colors[scale.breakpoints.indexOf(12)]);
	});
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/convection-color-scales.test.ts -t "categorical"`
Expected: FAIL — `Cannot find module '$lib/color-scales/precipitation-type'`.

- [ ] **Step 3: Implémenter la colormap catégorielle**

Créer `src/lib/color-scales/precipitation-type.ts` :

```ts
import type { CategoricalColorScale } from './types';

// Type de précipitation (codes producteur catégoriels). Une seule définition,
// partagée par `precipitation_type` (le plus fréquent) et `precipitation_type_severe`
// (le plus dangereux).
//
// Encodage : `breakpoints` = codes triés croissants. Le moteur colore via
// `index = max(0, findLastIndexLE(breakpoints, px))`, donc chaque code exact tombe
// sur sa propre couleur ; les entiers intermédiaires inexistants (ex. 13..192)
// héritent du code inférieur le plus proche (inoffensif, ils n'apparaissent pas).
// Code 0 (aucune) → alpha 0 (transparent).
//
// Variantes « intermittent / fondante » (≥193) : même teinte que leur type de base,
// opacité réduite, pour limiter le nombre de couleurs distinctes.
export const precipitationTypeScale: CategoricalColorScale = {
	type: 'breakpoint',
	unit: '',
	breakpoints: [0, 1, 3, 5, 6, 7, 8, 10, 11, 12, 193, 201, 205, 206, 207],
	colors: [
		[0, 0, 0, 0], // 0 aucune
		[0, 200, 0, 0.9], // 1 pluie
		[230, 0, 80, 0.95], // 3 pluie verglaçante
		[120, 180, 255, 0.9], // 5 neige sèche
		[80, 140, 230, 0.9], // 6 neige humide
		[0, 180, 200, 0.9], // 7 pluie + neige
		[200, 100, 255, 0.95], // 8 granules de glace
		[255, 0, 0, 1], // 10 grêle
		[120, 230, 120, 0.85], // 11 bruine
		[255, 120, 180, 0.9], // 12 bruine verglaçante
		[80, 140, 230, 0.55], // 193 neige fondante (base : neige humide)
		[0, 200, 0, 0.55], // 201 pluie intermittente
		[120, 180, 255, 0.55], // 205 neige sèche intermittente
		[80, 140, 230, 0.5], // 206 neige humide intermittente
		[0, 180, 200, 0.55] // 207 pluie+neige intermittente
	],
	categories: [
		{ code: 0, label: 'Aucune' },
		{ code: 1, label: 'Pluie' },
		{ code: 3, label: 'Pluie verglaçante' },
		{ code: 5, label: 'Neige sèche' },
		{ code: 6, label: 'Neige humide' },
		{ code: 7, label: 'Pluie + neige' },
		{ code: 8, label: 'Granules de glace' },
		{ code: 10, label: 'Grêle' },
		{ code: 11, label: 'Bruine' },
		{ code: 12, label: 'Bruine verglaçante' },
		{ code: 193, label: 'Neige fondante' },
		{ code: 201, label: 'Pluie interm.' },
		{ code: 205, label: 'Neige sèche interm.' },
		{ code: 206, label: 'Neige humide interm.' },
		{ code: 207, label: 'Pluie+neige interm.' }
	]
};
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/convection-color-scales.test.ts`
Expected: PASS (tous les blocs).

- [ ] **Step 5: Commit**

```bash
git add src/lib/color-scales/precipitation-type.ts src/lib/tests/convection-color-scales.test.ts
git commit -m "feat(arome-convection): colormap catégorielle precipitation_type"
```

---

## Task 7: Helper de légende (pur)

**Files:**
- Create: `src/lib/color-scales/legend.ts`
- Test: `src/lib/tests/legend.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/tests/legend.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

import { precipitationTypeScale } from '$lib/color-scales/precipitation-type';
import { radarReflectivityScale } from '$lib/color-scales/radar-reflectivity';
import { categoricalLegendEntries, isCategorical } from '$lib/color-scales/legend';

describe('isCategorical', () => {
	it('detects a categorical scale', () => {
		expect(isCategorical(precipitationTypeScale)).toBe(true);
	});
	it('rejects a plain breakpoint scale', () => {
		expect(isCategorical(radarReflectivityScale)).toBe(false);
	});
});

describe('categoricalLegendEntries', () => {
	it('returns one entry per category, aligned to colors', () => {
		const entries = categoricalLegendEntries(precipitationTypeScale);
		expect(entries.length).toBe(precipitationTypeScale.categories.length);
		expect(entries[0]).toMatchObject({ code: 0, label: 'Aucune', index: 0 });
		const hailIdx = precipitationTypeScale.breakpoints.indexOf(10);
		const hail = entries.find((e) => e.code === 10);
		expect(hail?.label).toBe('Grêle');
		expect(hail?.index).toBe(hailIdx);
		expect(hail?.color).toEqual((precipitationTypeScale.colors as number[][])[hailIdx]);
	});
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run src/lib/tests/legend.test.ts`
Expected: FAIL — `Cannot find module '$lib/color-scales/legend'`.

- [ ] **Step 3: Implémenter le helper**

Créer `src/lib/color-scales/legend.ts` :

```ts
import type { RenderableColorScale } from '@openmeteo/weather-map-layer';

import type { RGBA } from '$lib/color';

import type { CategoricalColorScale } from './types';

export interface CategoricalLegendEntry {
	color: RGBA;
	label: string;
	code: number;
	/** Index dans `colors` / `breakpoints` (pour l'édition de couleur éventuelle). */
	index: number;
}

/** Vrai si l'échelle porte des catégories discrètes (champ `categories`). */
export function isCategorical(
	scale: RenderableColorScale
): scale is RenderableColorScale & CategoricalColorScale {
	const maybe = scale as Partial<CategoricalColorScale>;
	return Array.isArray(maybe.categories);
}

/**
 * Entrées de légende pour une échelle catégorielle, alignées index-par-index sur
 * `colors` / `breakpoints` / `categories`. L'entrée code 0 (aucune) est conservée
 * (l'appelant décide de l'afficher ou non).
 */
export function categoricalLegendEntries(scale: CategoricalColorScale): CategoricalLegendEntry[] {
	const colors = scale.colors as RGBA[];
	return scale.categories.map((cat, index) => ({
		color: colors[index],
		label: cat.label,
		code: cat.code,
		index
	}));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run src/lib/tests/legend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/color-scales/legend.ts src/lib/tests/legend.test.ts
git commit -m "feat(arome-convection): helper de légende catégorielle"
```

---

## Task 8: Enregistrer les colormaps dans `standardColorScales`

**Files:**
- Modify: `src/lib/stores/om-protocol-settings.ts`

- [ ] **Step 1: Ajouter les imports**

Dans `src/lib/stores/om-protocol-settings.ts`, après les imports de color-scales existants (lignes ~13-15) :

```ts
import { brightnessTemperatureScale } from '$lib/color-scales/brightness-temperature';
import { brightnessTemperatureWvScale } from '$lib/color-scales/brightness-temperature-wv';
import { capeScale } from '$lib/color-scales/cape';
import { convectiveInhibitionScale } from '$lib/color-scales/convective-inhibition';
import { infoclimatTemperatureScale } from '$lib/color-scales/infoclimat-temperature';
import { lightningDensityScale } from '$lib/color-scales/lightning-density';
import { precipitationSumScale } from '$lib/color-scales/precipitation-sum';
import { precipitationTypeScale } from '$lib/color-scales/precipitation-type';
import { radarReflectivityScale } from '$lib/color-scales/radar-reflectivity';
import { temperatureAnomalyScale } from '$lib/color-scales/temperature-anomaly';
import { visibilityScale } from '$lib/color-scales/visibility';
```

> Conserver l'ordre auto-trié par prettier — lancer `npm run format` après édition plutôt que d'ordonner à la main.

- [ ] **Step 2: Enregistrer les colormaps par clé exacte**

Étendre l'objet `standardColorScales` (les clés exactes priment sur la résolution par préfixe et sur les défauts package) :

```ts
export const standardColorScales = {
	...defaultOmProtocolSettings.colorScales,
	temperature: infoclimatTemperatureScale,
	temperature_2m_anomaly: temperatureAnomalyScale,
	// Clé exacte `precipitation_sum` : prioritaire sur la résolution par famille
	// du package (qui mapperait sinon vers l'échelle `precipitation` saturant à
	// 30 mm). Voir color-scales/precipitation-sum.ts.
	precipitation_sum: precipitationSumScale,

	// Domaine arome_france_convection — clés exactes (priment sur les défauts package
	// et la résolution par préfixe). `precipitation_type` et `precipitation_type_severe`
	// partagent la même colormap catégorielle.
	radar_reflectivity: radarReflectivityScale,
	brightness_temperature: brightnessTemperatureScale,
	brightness_temperature_wv: brightnessTemperatureWvScale,
	cape: capeScale,
	convective_inhibition: convectiveInhibitionScale,
	visibility: visibilityScale,
	lightning_density: lightningDensityScale,
	precipitation_type: precipitationTypeScale,
	precipitation_type_severe: precipitationTypeScale
};
```

- [ ] **Step 3: Formater et vérifier la compilation**

Run: `npm run format && npm run check`
Expected: PASS. La `CategoricalColorScale` est assignable à `ColorScale` (sous-type de `BreakpointColorScale`).

- [ ] **Step 4: Lancer toute la suite**

Run: `npm run test -- --run`
Expected: PASS (aucune régression).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/om-protocol-settings.ts
git commit -m "feat(arome-convection): enregistre les 9 colormaps dans standardColorScales"
```

---

## Task 9: Légende discrète dans l'UI

**Files:**
- Create: `src/lib/components/scale/categorical-legend.svelte`
- Modify: `src/lib/components/scale/scale.svelte`

- [ ] **Step 1: Créer le composant de légende catégorielle**

Créer `src/lib/components/scale/categorical-legend.svelte`. Il rend la pile de pastilles + libellés (du bas vers le haut, comme la légende numérique), réutilisant le style verre. Il reçoit les entrées déjà calculées et l'opacité globale.

```svelte
<script lang="ts">
	import type { CategoricalLegendEntry } from '$lib/color-scales/legend';
	import { textWhite } from '$lib/helpers';

	interface Props {
		entries: CategoricalLegendEntry[];
		opacity: number;
		isDark: boolean;
	}

	let { entries, opacity, isDark }: Props = $props();

	// Code 0 (« Aucune » = transparent) masqué de la liste : rien à montrer.
	const visible = $derived(entries.filter((e) => e.code !== 0));
</script>

<div class="bg-glass/45 backdrop-blur-md flex flex-col rounded-b-lg">
	{#each visible as entry (entry.code)}
		{@const alpha = entry.color[3] ?? 1}
		<div class="flex items-center gap-2 px-2 py-1">
			<span
				class="inline-block size-3.5 shrink-0 rounded-sm border border-white/30"
				style="background: rgb({entry.color[0]}, {entry.color[1]}, {entry
					.color[2]}); opacity: {(alpha * opacity) / 100};"
			></span>
			<span
				class="text-xs whitespace-nowrap"
				style="color: {textWhite(entry.color, isDark, opacity) ? 'white' : 'white'};"
			>
				{entry.label}
			</span>
		</div>
	{/each}
</div>
```

> Note : le chrome verre est sombre ; le texte est blanc dans tous les cas (la pastille porte la couleur). `textWhite` est conservé pour cohérence d'API mais le label reste blanc.

- [ ] **Step 2: Brancher la légende catégorielle dans `scale.svelte`**

Dans `src/lib/components/scale/scale.svelte`, ajouter les imports (avec les autres `$lib/...`) :

```ts
import { categoricalLegendEntries, isCategorical } from '$lib/color-scales/legend';

import CategoricalLegend from './categorical-legend.svelte';
```

Après la définition de `colorScale` (ligne ~49), ajouter :

```ts
const categorical = $derived(isCategorical(colorScale));
const categoryEntries = $derived(categorical ? categoricalLegendEntries(colorScale) : []);
```

Dans la vue **dépliée** (bloc `{:else}` de `$scaleCollapsed`), remplacer le conteneur des pastilles numériques par une branche. Localiser le `<div class="flex flex-col-reverse bg-glass/45 backdrop-blur-md rounded-b-lg">` (les blocs de couleur, lignes ~179-211) et l'envelopper :

```svelte
{#if categorical}
	<CategoricalLegend entries={categoryEntries} opacity={$opacity} {isDark} />
{:else}
	<div class="flex flex-col-reverse bg-glass/45 backdrop-blur-md rounded-b-lg">
		<!-- ... contenu existant des pastilles numériques inchangé ... -->
	</div>

	<!-- Labels column - positioned between buttons -->
	<div class="flex flex-col-reverse" style="width: {labelWidth}px;">
		<!-- ... contenu existant de la colonne de labels inchangé ... -->
	</div>
{/if}
```

> Important : la colonne de labels numériques (le second `<div class="flex flex-col-reverse">`) doit passer DANS le `{:else}` (les catégories portent leur propre libellé). Le bloc `{#if colorScale.unit}` (sélecteur d'unité) reste hors du `{#if categorical}` : comme `unit === ''` pour les échelles catégorielles, il ne s'affiche pas (condition `{#if colorScale.unit}` fausse). Les boutons reset / repli restent inchangés.

- [ ] **Step 3: Vérifier la compilation**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Vérification manuelle dans l'app**

Run: `npm run dev`, puis ouvrir (bucket R2 requis dans `.env.local` : `VITE_MODELS_BUCKET_URL=...`) :
- Basculer sur le modèle « AROME Convection France ». Vérifier : la carte centre sur la métropole, la variable par défaut est « Réflectivité radar », la légende dBZ s'affiche (transparent sous 5 dBZ).
- Choisir « Type de précipitations » → la légende affiche des noms de catégories (Pluie, Neige sèche, Grêle…), pas de sélecteur d'unité.
- Choisir CAPE, Visibilité, Foudre → légendes continues correctes.

Expected: comportements ci-dessus OK.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scale/categorical-legend.svelte src/lib/components/scale/scale.svelte
git commit -m "feat(arome-convection): légende discrète pour precipitation_type"
```

---

## Task 10: Libellés FR

**Files:**
- Modify: `src/lib/i18n/variables-fr.ts`

- [ ] **Step 1: Ajouter les libellés à la table EXPLICIT**

Dans `src/lib/i18n/variables-fr.ts`, table `EXPLICIT`, ajouter (respecter l'ordre alphabétique approximatif existant ; `npm run format` ne réordonne pas les clés d'objet, donc placer manuellement de façon lisible) :

Traductions EN→FR de libellés package existants :

```ts
	'Convective Inhibition': 'Inhibition convective (CIN)',
	'Lightning Density': 'Densité de foudre',
	Visibility: 'Visibilité',
```

Clés snake_case (variables absentes des `variableOptions` package — le libellé affiché est la valeur brute) :

```ts
	radar_reflectivity: 'Réflectivité radar',
	brightness_temperature: 'Température de brillance (IR fenêtre)',
	brightness_temperature_wv: "Température de brillance (vapeur d'eau)",
	precipitation_type_severe: 'Type de précip. (le plus sévère)',
```

> `CAPE` et `Precipitation Type` sont déjà traduits dans la table (ne pas dupliquer). La clé `brightness_temperature_wv` doit être placée AVANT (ou de toute façon, JS résout par clé exacte donc l'ordre n'affecte pas la correction — mais éviter une 2e clé `brightness_temperature` qui masquerait).

- [ ] **Step 2: Vérifier la compilation et le lint**

Run: `npm run check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/variables-fr.ts
git commit -m "feat(arome-convection): libellés FR des variables convection"
```

---

## Task 11: Vérification finale

**Files:** aucun (vérification globale)

- [ ] **Step 1: Suite de tests complète**

Run: `npm run test -- --run`
Expected: PASS (tous les fichiers, dont les 4 nouveaux + url-builder étendu).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Build statique**

Run: `npm run build`
Expected: build réussi (`./build` généré).

- [ ] **Step 4: Vérification manuelle de bout en bout**

Avec `VITE_MODELS_BUCKET_URL` configuré et le bucket peuplé, lancer `npm run preview` et valider le scénario complet de la Task 9 Step 4, plus :
- URL partagée avec `?domain=arome_france_convection&variable=cape` → ouvre directement sur CAPE.
- Bascule vers un autre domaine puis retour → vue et variable par défaut réappliquées.
- Sans `VITE_MODELS_BUCKET_URL` → le modèle n'apparaît pas dans le sélecteur (gating).

Expected: tous OK.

- [ ] **Step 5: Mettre à jour la doc projet si nécessaire**

Si l'architecture a changé pour un futur lecteur, ajouter une mention du domaine `arome_france_convection` dans `.claude/rules/architecture.md` (section « Domain allowlist » / pseudo-domaines bucket) et/ou `README.md`. Commit séparé :

```bash
git add .claude/rules/architecture.md README.md
git commit -m "docs(arome-convection): mentionne le domaine dans les rules/README"
```

---

## Notes d'implémentation

- **Pas de modif du resolver `omProtocol`** : le layout `data_spatial/{domain}/…` est géré par le resolver par défaut. Le `customResolveRequest` d'`om-protocol-settings.ts` ne concerne que les URLs d'anomalie.
- **Transparence sous seuil** : encodée par une bande de tête `colors[0]` à alpha 0 (le moteur applique `alpha = 255 * color[3]` et n'a aucune transparence implicite sous `breakpoints[0]`).
- **Catégoriel via breakpoint** : sûr car `getColor` utilise `findLastIndexLE` (recherche du dernier seuil ≤ valeur) ; chaque code étant un breakpoint, il tombe sur sa propre couleur.
- **`lightning_density` absente H+1/H+2** : non gardé côté client (concern producteur) ; sélection à ces échéances → pixel vide. Documenté hors-scope.
- **Hors scope** : whitelist `time_interval` worker, niveaux de sondage, refactors non liés.
