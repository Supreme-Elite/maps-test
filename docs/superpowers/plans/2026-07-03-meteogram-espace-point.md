# Meteogram — Espace point : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un meteogram (série temporelle multi-panneaux en un point) alimenté par l'API JSON Open-Meteo, affiché dans un tiroir bas extensible, couplé bidirectionnellement au temps de la carte, exportable en PNG.

**Architecture:** Client API dédié (1 requête par point) → `MeteogramData` → panneaux SVG tracés par des builders purs → tiroir bas Svelte 5. Le curseur temps de la carte (`$time`) pilote un playhead sur le graphe et réciproquement, via un helper `goToValidTime` partagé avec la timeline.

**Tech Stack:** SvelteKit, Svelte 5 runes, Tailwind v4, MapLibre GL, Vitest. Aucune nouvelle dépendance npm (SVG maison, export canvas natif).

## Global Constraints

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`) — jamais de réactivité Svelte 4. Déléguer les éditions `.svelte`/`.svelte.ts` à l'agent `svelte-file-editor` et valider avec `svelte-autofixer` (MCP Svelte).
- **Prettier** : tabs, single quotes, pas de trailing commas, 100 col. Ne jamais ordonner les imports à la main — lancer `npm run format`.
- **Vérifier le lint via `rtk proxy npm run lint`** (le hook rtk cache la sortie et masque un échec CI).
- **Path aliases** `$lib/*` — pas de chemins relatifs entre répertoires.
- **Unités** : convertir côté client via `convertValue(value, baseUnit, units, variable?)` et `getDisplayUnit(baseUnit, units, variable?)` (`$lib/stores/units`), jamais demander les conversions à l'API.
- **Chrome toujours sombre** : styliser en `dark` (verre bleu-nuit, classes `bg-glass`, `glass-blur`, variantes `dark:`). Pas de thème adaptatif.
- **Semantic PR title** : `feat:`.
- Le pseudo-domaine maison `arome_france` (bucket) est **exclu** de l'API (bouton masqué).

---

## File Structure

- `src/lib/time-navigation.ts` *(créer)* — `goToValidTime(date)` extrait de `time-selector.svelte`.
- `src/lib/constants.ts` *(modifier)* — table `DOMAIN_TO_API_MODEL`.
- `src/lib/meteogram/model-map.ts` *(créer)* — `resolveApiModel(domain)`.
- `src/lib/meteogram/types.ts` *(créer)* — `MeteogramData`, `MeteogramSeries`.
- `src/lib/meteogram/api.ts` *(créer)* — `buildForecastUrl`, `parseForecast`, `fetchMeteogram`.
- `src/lib/meteogram/scales.ts` *(créer)* — échelles pures temps↔x, valeur↔y, ticks.
- `src/lib/meteogram/paths.ts` *(créer)* — génération de paths SVG (ligne, barres, flèches).
- `src/lib/meteogram/snap.ts` *(créer)* — `nearestValidTime(target, validTimes)`.
- `src/lib/stores/point-workspace.ts` *(créer)* — store `{ open, lat, lng }`.
- `src/lib/components/point-workspace/point-drawer.svelte` *(créer)* — shell tiroir bas.
- `src/lib/components/point-workspace/meteogram/meteogram.svelte` *(créer)* — orchestration.
- `src/lib/components/point-workspace/meteogram/panel.svelte` *(créer)* — panneau SVG générique.
- `src/lib/components/point-workspace/meteogram/wind-direction.svelte` *(créer)* — bande de flèches.
- `src/lib/components/point-workspace/meteogram/png-export.ts` *(créer)* — sérialisation SVG → PNG.
- `src/lib/popup.ts` *(modifier)* — bouton « Meteogram » + pin.
- `src/routes/+page.svelte` *(modifier)* — monter `<PointDrawer />`, init pin.
- Tests : `src/lib/tests/meteogram-model-map.test.ts`, `meteogram-api.test.ts`, `meteogram-scales.test.ts`, `meteogram-paths.test.ts`, `meteogram-snap.test.ts`, `point-workspace.test.ts`.

---

## Task 1: Extraire `goToValidTime` (helper temps partagé)

**Files:**
- Create: `src/lib/time-navigation.ts`
- Modify: `src/lib/components/time/time-selector.svelte:301-307` (remplacer le corps de `playbackAdvance`)

**Interfaces:**
- Produces: `goToValidTime(date: Date): void` — set `$time` + `updateUrl('time', …)` + `changeOMfileURL()`. **Ne fait pas** le centrage (spécifique à la timeline) ni `checkClosestModelRun` (l'échéance sort du run courant).

**Contexte :** `playbackAdvance` (`time-selector.svelte:301`) fait aujourd'hui : `$time = new SvelteDate(date)` ; `currentDate = …` ; `updateUrl('time', formatISOWithoutTimezone($time))` ; `changeOMfileURL()` ; `centerDateButton(date)`. Le meteogram a besoin des 3 effets « modèle » (store + URL + reload) mais pas du `currentDate`/centrage propres au composant. On extrait le cœur réutilisable.

- [ ] **Step 1: Créer le helper**

```ts
// src/lib/time-navigation.ts
import { SvelteDate } from 'svelte/reactivity';

import { time } from '$lib/stores/time';

import { changeOMfileURL } from '$lib/layers';
import { formatISOWithoutTimezone, updateUrl } from '$lib/url';

/**
 * Positionne l'échéance affichée par la carte sur `date` : store `time` + URL +
 * rechargement du champ spatial. Partagé par la timeline (playback) et le
 * meteogram (couplage temporel). Ne recale pas le run (l'échéance sort du run
 * courant côté playback) et ne centre pas la barre de dates (spécifique UI timeline).
 */
export const goToValidTime = (date: Date): void => {
	time.set(new SvelteDate(date));
	updateUrl('time', formatISOWithoutTimezone(new Date(date)));
	changeOMfileURL();
};
```

- [ ] **Step 2: Vérifier les exports consommés existent**

Run: `rg -n "export const formatISOWithoutTimezone|export .*updateUrl" src/lib/url.ts`
Expected: les deux symboles sont exportés depuis `$lib/url`. Si `formatISOWithoutTimezone` n'est pas exporté, l'exporter (retirer un éventuel `const` local non exporté).

- [ ] **Step 3: Rebrancher `playbackAdvance`** (déléguer à `svelte-file-editor`)

Dans `src/lib/components/time/time-selector.svelte`, importer le helper et réécrire `playbackAdvance` pour l'appeler :

```svelte
import { goToValidTime } from '$lib/time-navigation';

const playbackAdvance = (date: Date) => {
	currentDate = new SvelteDate(date);
	goToValidTime(date);
	centerDateButton(date);
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: 0 erreur.

- [ ] **Step 5: Régression playback (manuel rapide)**

Run: `npm run dev` puis lire une animation (bouton play). Expected: la lecture avance comme avant (aucun changement de comportement).

- [ ] **Step 6: Commit**

```bash
git add src/lib/time-navigation.ts src/lib/components/time/time-selector.svelte src/lib/url.ts
git commit -m "refactor(time): extraire goToValidTime pour partage timeline/meteogram"
```

---

## Task 2: Table domaine → modèle API + résolveur

**Files:**
- Modify: `src/lib/constants.ts` (ajouter `DOMAIN_TO_API_MODEL`)
- Create: `src/lib/meteogram/model-map.ts`
- Test: `src/lib/tests/meteogram-model-map.test.ts`

**Interfaces:**
- Produces: `DOMAIN_TO_API_MODEL: Readonly<Record<string, string>>`, `resolveApiModel(domain: string): string | null`, `hasMeteogram(domain: string): boolean`.

**Vérification préalable (obligatoire) :** confirmer chaque valeur de domaine dans `MODEL_SELECTOR_GROUPS` (`constants.ts`) et chaque valeur `models=` dans `../open-meteo/openapi/forecast.yml`. Valeurs connues à ce jour : domaines `meteofrance_arpege_europe`, `meteofrance_arpege_world025`, `arome_france_hd`, `arome_france` (bucket, exclu), `arome_france_convection` (bucket, exclu), `dwd_icon`, `dwd_icon_eu`, `dwd_icon_d2`, `meteoswiss_icon_ch1`, `meteoswiss_icon_ch2`, `ecmwf_ifs025`, `ecmwf_ifs`, `ecmwf_aifs025_single`, `ncep_gfs025`, `anomaly_europe` (exclu), `arome_om_*` (exclus). Enum API : `meteofrance_arpege_europe`, `meteofrance_arpege_world`, `meteofrance_arome_france_hd`, `meteofrance_arome_france`, `dwd_icon_seamless`/`icon_global`, `icon_eu`, `icon_d2`, `meteoswiss_icon_ch1`, `meteoswiss_icon_ch2`, `ecmwf_ifs025`, `ecmwf_ifs`, `ecmwf_aifs025_single`, `ncep_gfs_seamless`.

- [ ] **Step 1: Écrire le test**

```ts
// src/lib/tests/meteogram-model-map.test.ts
import { describe, expect, it } from 'vitest';

import { hasMeteogram, resolveApiModel } from '$lib/meteogram/model-map';

describe('resolveApiModel', () => {
	it('mappe un domaine servi par l’API', () => {
		expect(resolveApiModel('meteofrance_arpege_europe')).toBe('meteofrance_arpege_europe');
		expect(resolveApiModel('arome_france_hd')).toBe('meteofrance_arome_france_hd');
		expect(resolveApiModel('ecmwf_ifs025')).toBe('ecmwf_ifs025');
	});

	it('exclut le domaine maison bucket et les domaines non servis', () => {
		expect(resolveApiModel('arome_france')).toBeNull();
		expect(resolveApiModel('anomaly_europe')).toBeNull();
		expect(resolveApiModel('domaine_inconnu')).toBeNull();
	});

	it('hasMeteogram reflète la présence dans la table', () => {
		expect(hasMeteogram('ecmwf_ifs025')).toBe(true);
		expect(hasMeteogram('arome_france')).toBe(false);
	});
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `npx vitest run src/lib/tests/meteogram-model-map.test.ts`
Expected: FAIL (`Cannot find module '$lib/meteogram/model-map'`).

- [ ] **Step 3: Ajouter la table dans `constants.ts`**

```ts
// src/lib/constants.ts — après MODEL_SELECTOR_GROUPS
/**
 * Domaine affiché (app) → identifiant `models=` de l'API JSON Open-Meteo.
 * Un domaine absent = pas de meteogram (bouton masqué). `arome_france`/
 * `arome_france_convection` (bucket maison) et `anomaly_europe` sont volontairement
 * hors table : absents de l'API publique.
 */
export const DOMAIN_TO_API_MODEL: Readonly<Record<string, string>> = {
	meteofrance_arpege_europe: 'meteofrance_arpege_europe',
	meteofrance_arpege_world025: 'meteofrance_arpege_world',
	arome_france_hd: 'meteofrance_arome_france_hd',
	dwd_icon: 'dwd_icon_seamless',
	dwd_icon_eu: 'icon_eu',
	dwd_icon_d2: 'icon_d2',
	meteoswiss_icon_ch1: 'meteoswiss_icon_ch1',
	meteoswiss_icon_ch2: 'meteoswiss_icon_ch2',
	ecmwf_ifs025: 'ecmwf_ifs025',
	ecmwf_ifs: 'ecmwf_ifs',
	ecmwf_aifs025_single: 'ecmwf_aifs025_single',
	ncep_gfs025: 'ncep_gfs_seamless'
};
```

- [ ] **Step 4: Créer le résolveur**

```ts
// src/lib/meteogram/model-map.ts
import { DOMAIN_TO_API_MODEL } from '$lib/constants';

export const resolveApiModel = (domain: string): string | null =>
	DOMAIN_TO_API_MODEL[domain] ?? null;

export const hasMeteogram = (domain: string): boolean =>
	Object.prototype.hasOwnProperty.call(DOMAIN_TO_API_MODEL, domain);
```

- [ ] **Step 5: Lancer le test — succès attendu**

Run: `npx vitest run src/lib/tests/meteogram-model-map.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/meteogram/model-map.ts src/lib/tests/meteogram-model-map.test.ts
git commit -m "feat(meteogram): table domaine→modèle API + résolveur"
```

---

## Task 3: Types + client API (URL + parse + fetch)

**Files:**
- Create: `src/lib/meteogram/types.ts`, `src/lib/meteogram/api.ts`
- Test: `src/lib/tests/meteogram-api.test.ts`

**Interfaces:**
- Consumes: `resolveApiModel` (Task 2).
- Produces:
  - `interface MeteogramData { times: Date[]; series: Record<MeteogramKey, (number | null)[]>; model: string; }`
  - `type MeteogramKey` = union des 14 variables horaires.
  - `HOURLY_VARIABLES: readonly MeteogramKey[]`
  - `buildForecastUrl(lat: number, lng: number, model: string): string`
  - `parseForecast(json: unknown, model: string): MeteogramData`
  - `fetchMeteogram(lat: number, lng: number, model: string, signal?: AbortSignal): Promise<MeteogramData>`

- [ ] **Step 1: Écrire le test**

```ts
// src/lib/tests/meteogram-api.test.ts
import { describe, expect, it } from 'vitest';

import { buildForecastUrl, parseForecast } from '$lib/meteogram/api';

describe('buildForecastUrl', () => {
	it('inclut lat/lng, models, timezone UTC, wind en m/s et toutes les variables', () => {
		const url = buildForecastUrl(48.85, 2.35, 'meteofrance_arome_france_hd');
		expect(url).toContain('https://api.open-meteo.com/v1/forecast');
		expect(url).toContain('latitude=48.85');
		expect(url).toContain('longitude=2.35');
		expect(url).toContain('models=meteofrance_arome_france_hd');
		expect(url).toContain('timezone=UTC');
		expect(url).toContain('wind_speed_unit=ms');
		expect(url).toContain('temperature_2m');
		expect(url).toContain('precipitation_probability');
		expect(url).toContain('cape');
	});
});

describe('parseForecast', () => {
	it('transpose la réponse en times[] + series, préserve les null', () => {
		const json = {
			hourly: {
				time: ['2026-07-03T00:00', '2026-07-03T01:00'],
				temperature_2m: [12.3, null],
				precipitation: [0, 1.2]
			}
		};
		const data = parseForecast(json, 'ecmwf_ifs025');
		expect(data.model).toBe('ecmwf_ifs025');
		expect(data.times.map((d) => d.toISOString())).toEqual([
			'2026-07-03T00:00:00.000Z',
			'2026-07-03T01:00:00.000Z'
		]);
		expect(data.series.temperature_2m).toEqual([12.3, null]);
		expect(data.series.precipitation).toEqual([0, 1.2]);
	});

	it('lève sur réponse sans hourly.time', () => {
		expect(() => parseForecast({ error: true, reason: 'x' }, 'm')).toThrow();
	});
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Écrire les types**

```ts
// src/lib/meteogram/types.ts
export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
	| 'apparent_temperature'
	| 'precipitation'
	| 'precipitation_probability'
	| 'wind_speed_10m'
	| 'wind_gusts_10m'
	| 'wind_direction_10m'
	| 'pressure_msl'
	| 'cloud_cover_low'
	| 'cloud_cover_mid'
	| 'cloud_cover_high'
	| 'cape'
	| 'freezing_level_height';

export interface MeteogramData {
	times: Date[];
	series: Record<MeteogramKey, (number | null)[]>;
	model: string;
}
```

- [ ] **Step 4: Écrire le client API**

```ts
// src/lib/meteogram/api.ts
import type { MeteogramData, MeteogramKey } from './types';

export const HOURLY_VARIABLES: readonly MeteogramKey[] = [
	'temperature_2m',
	'dew_point_2m',
	'apparent_temperature',
	'precipitation',
	'precipitation_probability',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'pressure_msl',
	'cloud_cover_low',
	'cloud_cover_mid',
	'cloud_cover_high',
	'cape',
	'freezing_level_height'
];

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export const buildForecastUrl = (lat: number, lng: number, model: string): string => {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lng),
		models: model,
		timezone: 'UTC',
		wind_speed_unit: 'ms',
		hourly: HOURLY_VARIABLES.join(',')
	});
	return `${FORECAST_ENDPOINT}?${params.toString()}`;
};

interface ForecastResponse {
	hourly?: { time?: string[] } & Partial<Record<MeteogramKey, (number | null)[]>>;
}

export const parseForecast = (json: unknown, model: string): MeteogramData => {
	const hourly = (json as ForecastResponse).hourly;
	if (!hourly || !Array.isArray(hourly.time)) {
		throw new Error('Réponse Open-Meteo invalide (hourly.time manquant)');
	}
	// L'API renvoie les timestamps en heure locale du timezone demandé ; avec
	// timezone=UTC on ajoute le suffixe Z pour un parse Date déterministe.
	const times = hourly.time.map((t) => new Date(`${t}:00Z`.replace(/(:\d\d)?:\d\dZ$/, ':00Z')));
	const series = {} as Record<MeteogramKey, (number | null)[]>;
	for (const key of HOURLY_VARIABLES) {
		series[key] = hourly[key] ?? [];
	}
	return { times, series, model };
};

export const fetchMeteogram = async (
	lat: number,
	lng: number,
	model: string,
	signal?: AbortSignal
): Promise<MeteogramData> => {
	const res = await fetch(buildForecastUrl(lat, lng, model), { signal });
	if (res.status === 429) throw new Error('rate-limit');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return parseForecast(await res.json(), model);
};
```

Note : le format de `hourly.time` d'Open-Meteo est `YYYY-MM-DDTHH:MM`. Simplifier le parse à `new Date(`${t}Z`)` si les tests confirment ce format exact — ajuster la regex/parse en Step 5 selon l'échec.

- [ ] **Step 5: Lancer le test — ajuster le parse de date puis succès**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts`
Si l'assertion ISO échoue sur le format de date, remplacer la ligne `times` par :
```ts
const times = hourly.time.map((t) => new Date(`${t}Z`));
```
Expected après ajustement: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meteogram/types.ts src/lib/meteogram/api.ts src/lib/tests/meteogram-api.test.ts
git commit -m "feat(meteogram): client API Open-Meteo (URL + parse + fetch)"
```

---

## Task 4: Store `point-workspace`

**Files:**
- Create: `src/lib/stores/point-workspace.ts`
- Test: `src/lib/tests/point-workspace.test.ts`

**Interfaces:**
- Produces: `pointWorkspace` store `{ subscribe, open(lat, lng), close() }` où l'état est `{ open: boolean; lat: number | null; lng: number | null }`.

- [ ] **Step 1: Écrire le test**

```ts
// src/lib/tests/point-workspace.test.ts
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { pointWorkspace } from '$lib/stores/point-workspace';

describe('pointWorkspace', () => {
	it('open positionne le point et ouvre ; close réinitialise', () => {
		pointWorkspace.open(48.85, 2.35);
		expect(get(pointWorkspace)).toEqual({ open: true, lat: 48.85, lng: 2.35 });
		pointWorkspace.close();
		expect(get(pointWorkspace)).toEqual({ open: false, lat: null, lng: null });
	});
});
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `npx vitest run src/lib/tests/point-workspace.test.ts`
Expected: FAIL.

- [ ] **Step 3: Écrire le store**

```ts
// src/lib/stores/point-workspace.ts
import { writable } from 'svelte/store';

export interface PointWorkspaceState {
	open: boolean;
	lat: number | null;
	lng: number | null;
}

const initial: PointWorkspaceState = { open: false, lat: null, lng: null };

function createPointWorkspace() {
	const { subscribe, set } = writable<PointWorkspaceState>(initial);
	return {
		subscribe,
		open: (lat: number, lng: number) => set({ open: true, lat, lng }),
		close: () => set(initial)
	};
}

export const pointWorkspace = createPointWorkspace();
```

- [ ] **Step 4: Lancer — succès attendu**

Run: `npx vitest run src/lib/tests/point-workspace.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/point-workspace.ts src/lib/tests/point-workspace.test.ts
git commit -m "feat(meteogram): store point-workspace"
```

---

## Task 5: Échelles pures (temps↔x, valeur↔y, ticks)

**Files:**
- Create: `src/lib/meteogram/scales.ts`
- Test: `src/lib/tests/meteogram-scales.test.ts`

**Interfaces:**
- Produces:
  - `linScale(domainMin, domainMax, rangeMin, rangeMax): (v: number) => number`
  - `timeToX(times: Date[], width: number, padLeft: number, padRight: number): (t: Date) => number`
  - `niceExtent(values: (number|null)[], pad?: number): [number, number]`
  - `dayTicks(times: Date[]): { index: number; date: Date }[]` — index des minuits UTC.

- [ ] **Step 1: Écrire le test**

```ts
// src/lib/tests/meteogram-scales.test.ts
import { describe, expect, it } from 'vitest';

import { dayTicks, linScale, niceExtent, timeToX } from '$lib/meteogram/scales';

describe('linScale', () => {
	it('mappe linéairement domaine→range', () => {
		const s = linScale(0, 10, 0, 100);
		expect(s(0)).toBe(0);
		expect(s(5)).toBe(50);
		expect(s(10)).toBe(100);
	});
});

describe('timeToX', () => {
	it('mappe le 1er temps sur padLeft et le dernier sur width-padRight', () => {
		const times = [new Date('2026-07-03T00:00Z'), new Date('2026-07-03T12:00Z')];
		const x = timeToX(times, 200, 10, 10);
		expect(x(times[0])).toBeCloseTo(10);
		expect(x(times[1])).toBeCloseTo(190);
	});
});

describe('niceExtent', () => {
	it('ignore les null et ajoute une marge', () => {
		expect(niceExtent([0, null, 10], 0)).toEqual([0, 10]);
		const [lo, hi] = niceExtent([0, 10], 0.1);
		expect(lo).toBeLessThan(0);
		expect(hi).toBeGreaterThan(10);
	});
	it('renvoie une plage non nulle si toutes valeurs égales', () => {
		const [lo, hi] = niceExtent([5, 5, 5]);
		expect(hi).toBeGreaterThan(lo);
	});
});

describe('dayTicks', () => {
	it('repère les minuits UTC', () => {
		const times = [
			new Date('2026-07-03T22:00Z'),
			new Date('2026-07-03T23:00Z'),
			new Date('2026-07-04T00:00Z'),
			new Date('2026-07-04T01:00Z')
		];
		expect(dayTicks(times).map((t) => t.index)).toEqual([2]);
	});
});
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `npx vitest run src/lib/tests/meteogram-scales.test.ts`
Expected: FAIL.

- [ ] **Step 3: Écrire les échelles**

```ts
// src/lib/meteogram/scales.ts
export const linScale =
	(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) =>
	(v: number): number => {
		if (domainMax === domainMin) return rangeMin;
		return rangeMin + ((v - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
	};

export const timeToX = (
	times: Date[],
	width: number,
	padLeft: number,
	padRight: number
): ((t: Date) => number) => {
	const t0 = times[0]?.getTime() ?? 0;
	const t1 = times[times.length - 1]?.getTime() ?? 1;
	const s = linScale(t0, t1, padLeft, width - padRight);
	return (t: Date) => s(t.getTime());
};

export const niceExtent = (values: (number | null)[], pad = 0.08): [number, number] => {
	const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
	if (nums.length === 0) return [0, 1];
	let lo = Math.min(...nums);
	let hi = Math.max(...nums);
	if (lo === hi) {
		lo -= 1;
		hi += 1;
	}
	const margin = (hi - lo) * pad;
	return [lo - margin, hi + margin];
};

export const dayTicks = (times: Date[]): { index: number; date: Date }[] =>
	times
		.map((date, index) => ({ index, date }))
		.filter(({ date }) => date.getUTCHours() === 0);
```

- [ ] **Step 4: Lancer — succès attendu**

Run: `npx vitest run src/lib/tests/meteogram-scales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meteogram/scales.ts src/lib/tests/meteogram-scales.test.ts
git commit -m "feat(meteogram): échelles pures (temps/valeur/ticks)"
```

---

## Task 6: Génération de paths SVG + snapping

**Files:**
- Create: `src/lib/meteogram/paths.ts`, `src/lib/meteogram/snap.ts`
- Test: `src/lib/tests/meteogram-paths.test.ts`, `src/lib/tests/meteogram-snap.test.ts`

**Interfaces:**
- Produces:
  - `linePath(points: { x: number; y: number | null }[]): string` — `M/L`, coupe le trait sur `null`.
  - `barRects(points, x0Width, baselineY): { x, y, w, h }[]` — pour les barres de précip.
  - `nearestValidTime(target: Date, validTimes: Date[]): Date | null`

- [ ] **Step 1: Écrire les tests**

```ts
// src/lib/tests/meteogram-paths.test.ts
import { describe, expect, it } from 'vitest';

import { linePath } from '$lib/meteogram/paths';

describe('linePath', () => {
	it('génère un tracé continu', () => {
		expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 20 }])).toBe('M0,10 L5,20');
	});
	it('interrompt le trait sur null (nouveau sous-tracé)', () => {
		expect(
			linePath([{ x: 0, y: 10 }, { x: 5, y: null }, { x: 10, y: 30 }])
		).toBe('M0,10 M10,30');
	});
});
```

```ts
// src/lib/tests/meteogram-snap.test.ts
import { describe, expect, it } from 'vitest';

import { nearestValidTime } from '$lib/meteogram/snap';

describe('nearestValidTime', () => {
	const vts = [
		new Date('2026-07-03T00:00Z'),
		new Date('2026-07-03T03:00Z'),
		new Date('2026-07-03T06:00Z')
	];
	it('renvoie la valid_time la plus proche', () => {
		expect(nearestValidTime(new Date('2026-07-03T02:00Z'), vts)?.toISOString()).toBe(
			'2026-07-03T03:00:00.000Z'
		);
	});
	it('renvoie null si liste vide', () => {
		expect(nearestValidTime(new Date(), [])).toBeNull();
	});
});
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `npx vitest run src/lib/tests/meteogram-paths.test.ts src/lib/tests/meteogram-snap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Écrire `paths.ts` et `snap.ts`**

```ts
// src/lib/meteogram/paths.ts
export interface PathPoint {
	x: number;
	y: number | null;
}

export const linePath = (points: PathPoint[]): string => {
	let d = '';
	let penDown = false;
	for (const p of points) {
		if (p.y === null || !Number.isFinite(p.y)) {
			penDown = false;
			continue;
		}
		d += `${d ? ' ' : ''}${penDown ? 'L' : 'M'}${p.x},${p.y}`;
		penDown = true;
	}
	return d;
};

export interface Bar {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const barRects = (
	points: { x: number; value: number | null }[],
	barWidth: number,
	baselineY: number,
	valueToY: (v: number) => number
): Bar[] =>
	points
		.filter((p): p is { x: number; value: number } => p.value !== null && p.value > 0)
		.map((p) => {
			const y = valueToY(p.value);
			return { x: p.x - barWidth / 2, y, w: barWidth, h: baselineY - y };
		});
```

```ts
// src/lib/meteogram/snap.ts
export const nearestValidTime = (target: Date, validTimes: Date[]): Date | null => {
	if (validTimes.length === 0) return null;
	const tt = target.getTime();
	return validTimes.reduce((best, cur) =>
		Math.abs(cur.getTime() - tt) < Math.abs(best.getTime() - tt) ? cur : best
	);
};
```

- [ ] **Step 4: Lancer — succès attendu**

Run: `npx vitest run src/lib/tests/meteogram-paths.test.ts src/lib/tests/meteogram-snap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meteogram/paths.ts src/lib/meteogram/snap.ts src/lib/tests/meteogram-paths.test.ts src/lib/tests/meteogram-snap.test.ts
git commit -m "feat(meteogram): paths SVG + snapping valid_time"
```

---

## Task 7: Composant `panel.svelte` (SVG générique + playhead + hover)

**Files:**
- Create: `src/lib/components/point-workspace/meteogram/panel.svelte`

**Interfaces:**
- Consumes: `linePath`, `barRects` (Task 6), `linScale`, `timeToX`, `niceExtent`, `dayTicks` (Task 5).
- Props :
  ```ts
  interface PanelProps {
    title: string;
    times: Date[];
    width: number;
    height: number;
    series: { key: string; values: (number | null)[]; color: string; dash?: string; kind?: 'line' | 'bar' }[];
    unitLabel: string;
    playheadTime: Date | null;          // $time projeté
    hoverIndex: number | null;          // index survolé (partagé entre panneaux)
    onHover: (index: number | null) => void;
    onSeek: (t: Date) => void;          // clic → piloter la carte
  }
  ```

**Contexte :** composant **présentational** pur (aucun store, aucun fetch). Reçoit des données déjà converties dans l'unité d'affichage. Trace : grille jour (`dayTicks`), axes, chaque série (`line`/`bar`), le **playhead** vertical à `timeToX(playheadTime)`, un **crosshair** à `hoverIndex`. `onmousemove` sur un rect transparent → calcule l'index le plus proche → `onHover`. `onclick` → `onSeek(times[hoverIndex])`.

- [ ] **Step 1: Écrire le composant** (déléguer à `svelte-file-editor`)

Squelette (Svelte 5 runes ; compléter le SVG) :

```svelte
<script lang="ts">
	import { linScale, niceExtent, timeToX } from '$lib/meteogram/scales';
	import { barRects, linePath } from '$lib/meteogram/paths';

	let {
		title,
		times,
		width,
		height,
		series,
		unitLabel,
		playheadTime,
		hoverIndex,
		onHover,
		onSeek
	}: import('./panel-types').PanelProps = $props();

	const PAD = { left: 44, right: 12, top: 18, bottom: 16 };

	const x = $derived(timeToX(times, width, PAD.left, PAD.right));
	const allValues = $derived(series.flatMap((s) => s.values));
	const [lo, hi] = $derived(niceExtent(allValues));
	const y = $derived(linScale(lo, hi, height - PAD.bottom, PAD.top));
	const baselineY = $derived(height - PAD.bottom);

	function handleMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < times.length; i++) {
			const d = Math.abs(x(times[i]) - px);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		onHover(best);
	}
</script>

<figure class="m-0">
	<figcaption class="flex justify-between px-1 text-xs text-muted-foreground">
		<span>{title}</span><span class="tabular-nums">{unitLabel}</span>
	</figcaption>
	<svg
		{width}
		{height}
		role="img"
		aria-label={title}
		onmousemove={handleMove}
		onmouseleave={() => onHover(null)}
		onclick={() => hoverIndex !== null && onSeek(times[hoverIndex])}
	>
		<!-- grille jour -->
		<!-- séries : {#each series} line=linePath / bar=barRects -->
		<!-- playhead : {#if playheadTime}<line x1=x(playheadTime) ... />{/if} -->
		<!-- crosshair : {#if hoverIndex !== null}<line x1=x(times[hoverIndex]) ... />{/if} -->
	</svg>
</figure>
```

Créer aussi `panel-types.ts` avec l'interface `PanelProps` ci-dessus (import type-only côté `.svelte`).

- [ ] **Step 2: Valider Svelte**

Utiliser `svelte-autofixer` (MCP) sur `panel.svelte`. Corriger jusqu'à 0 avertissement.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/point-workspace/meteogram/panel.svelte src/lib/components/point-workspace/meteogram/panel-types.ts
git commit -m "feat(meteogram): panneau SVG générique (playhead + crosshair)"
```

---

## Task 8: Composant `wind-direction.svelte` (bande de flèches)

**Files:**
- Create: `src/lib/components/point-workspace/meteogram/wind-direction.svelte`

**Interfaces:**
- Props : `{ times: Date[]; directions: (number|null)[]; width: number; x: (t: Date) => number; step?: number }`.

**Contexte :** bande fine sous le panneau vent. Une flèche tous les `step` pas (défaut : ~toutes les 3 h en indices), orientée selon la direction météo (d'où vient le vent → flèche pointant *vers* où il va = `rotate(direction + 180)`). Réutilise l'`x` fourni par le parent pour l'alignement temporel.

- [ ] **Step 1: Écrire le composant** (déléguer à `svelte-file-editor`)

```svelte
<script lang="ts">
	let {
		times,
		directions,
		width,
		x,
		step = 3
	}: {
		times: Date[];
		directions: (number | null)[];
		width: number;
		x: (t: Date) => number;
		step?: number;
	} = $props();

	const H = 22;
	const arrows = $derived(
		times
			.map((t, i) => ({ t, i, dir: directions[i] }))
			.filter(({ i, dir }) => i % step === 0 && dir !== null && Number.isFinite(dir))
	);
</script>

<svg {width} height={H} role="img" aria-label="Direction du vent">
	{#each arrows as a (a.i)}
		<g transform={`translate(${x(a.t)}, ${H / 2}) rotate(${(a.dir ?? 0) + 180})`}>
			<line x1="0" y1="-6" x2="0" y2="6" stroke="currentColor" stroke-width="1.5" />
			<path d="M0,6 L-3,2 M0,6 L3,2" stroke="currentColor" stroke-width="1.5" fill="none" />
		</g>
	{/each}
</svg>
```

- [ ] **Step 2: Valider Svelte** (`svelte-autofixer`) + `npm run check`.
Expected: 0 avertissement / 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/point-workspace/meteogram/wind-direction.svelte
git commit -m "feat(meteogram): bande de flèches de direction du vent"
```

---

## Task 9: Composant `meteogram.svelte` (orchestration : fetch + conversion + états)

**Files:**
- Create: `src/lib/components/point-workspace/meteogram/meteogram.svelte`

**Interfaces:**
- Consumes: `fetchMeteogram` (Task 3), `resolveApiModel` (Task 2), `convertValue`/`getDisplayUnit`/`unitPreferences` (`$lib/stores/units`), `selectedDomain` (`$lib/stores/variables`), `time` (`$lib/stores/time`), `metaJson` (`$lib/stores/*`), `goToValidTime` (Task 1), `nearestValidTime` (Task 6), `Panel`, `WindDirection`.
- Props : `{ lat: number; lng: number }`.

**Contexte :** cœur du module. Récupère la série **une seule fois par (lat,lng,modèle)**, la convertit dans les unités d'affichage, définit les 4 groupes de panneaux, gère `loading`/`error`/`empty`, projette `$time` en playhead et route les clics vers `goToValidTime(nearestValidTime(...))`. Mémoïsation de session par clé `(lat.toFixed(3), lng.toFixed(3), model)`.

- [ ] **Step 1: Écrire le composant** (déléguer à `svelte-file-editor`)

Points d'implémentation obligatoires :

```svelte
<script lang="ts">
	import { get } from 'svelte/store';

	import { metaJson } from '$lib/stores/metadata'; // vérifier le chemin exact du store metaJson
	import { time } from '$lib/stores/time';
	import { convertValue, getDisplayUnit, unitPreferences } from '$lib/stores/units';
	import { selectedDomain } from '$lib/stores/variables';

	import { goToValidTime } from '$lib/time-navigation';
	import { fetchMeteogram } from '$lib/meteogram/api';
	import { resolveApiModel } from '$lib/meteogram/model-map';
	import { nearestValidTime } from '$lib/meteogram/snap';

	import Panel from './panel.svelte';
	import WindDirection from './wind-direction.svelte';

	import type { MeteogramData } from '$lib/meteogram/types';

	let { lat, lng }: { lat: number; lng: number } = $props();

	let data = $state<MeteogramData | null>(null);
	let loading = $state(false);
	let error = $state<'rate-limit' | 'network' | 'empty' | null>(null);
	let hoverIndex = $state<number | null>(null);

	const cache = new Map<string, MeteogramData>();
	let controller: AbortController | undefined;

	async function load() {
		const domain = get(selectedDomain).value;
		const model = resolveApiModel(domain);
		if (!model) return; // le bouton ne devrait pas apparaître, garde défensive
		const key = `${lat.toFixed(3)},${lng.toFixed(3)},${model}`;
		if (cache.has(key)) {
			data = cache.get(key)!;
			error = null;
			return;
		}
		controller?.abort();
		controller = new AbortController();
		loading = true;
		error = null;
		try {
			const d = await fetchMeteogram(lat, lng, model, controller.signal);
			if (d.times.length === 0) {
				error = 'empty';
				data = null;
			} else {
				cache.set(key, d);
				data = d;
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			error = (e as Error).message === 'rate-limit' ? 'rate-limit' : 'network';
			data = null;
		} finally {
			loading = false;
		}
	}

	// Recharge uniquement sur changement de point (pas sur scrub du temps).
	$effect(() => {
		void lat;
		void lng;
		load();
	});

	// Playhead = $time projeté (réactif au scrub, sans refetch).
	const playheadTime = $derived($time ? new Date($time) : null);

	function seek(t: Date) {
		const vts = get(metaJson)?.valid_times?.map((v: string) => new Date(v)) ?? [];
		const snapped = nearestValidTime(t, vts) ?? t;
		goToValidTime(snapped);
	}
</script>
```

Le rendu compose : conversion des séries dans l'unité d'affichage via `convertValue(v, baseUnit, $unitPreferences, key)` (température → `'°C'`, vent → `'m/s'`, précip → `'mm'`, pression → `'hPa'`, cape → `'J/kg'`, hauteur → `'m'`, `%` inchangé) ; unité affichée via `getDisplayUnit(baseUnit, $unitPreferences, key)`. Puis 4 blocs `<Panel …>` (Température : `temperature_2m` plein, `dew_point_2m` dash `4 3`, `apparent_temperature` estompé ; Précipitations : `precipitation` en `kind:'bar'` + `precipitation_probability` en line sur axe 0-100 ; Vent : `wind_speed_10m` + `wind_gusts_10m` dash, puis `<WindDirection>` ; Avancés : `pressure_msl`, `cloud_cover_*`, `cape`). `hoverIndex`/`onHover` partagés entre panneaux (crosshair synchronisé) ; `onSeek={seek}`.

États : `{#if loading}` skeleton ; `{:else if error === 'rate-limit'}` message quota + « Réessayer » (`onclick={load}`) ; `{:else if error}` message réseau + retry ; `{:else if error === 'empty'}` « Aucune donnée à ce point pour ce modèle. » ; `{:else if data}` les panneaux.

- [ ] **Step 2: Vérifier le chemin réel du store `metaJson`**

Run: `rg -n "export const metaJson" src/lib/stores`
Adapter l'import à l'emplacement réel et le type de `valid_times`.

- [ ] **Step 3: Valider Svelte** (`svelte-autofixer`) + `npm run check`.
Expected: 0 avertissement / 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/point-workspace/meteogram/meteogram.svelte
git commit -m "feat(meteogram): module orchestration (fetch, conversion, états, couplage)"
```

---

## Task 10: Composant `point-drawer.svelte` (tiroir bas + en-tête « dernier run »)

**Files:**
- Create: `src/lib/components/point-workspace/point-drawer.svelte`

**Interfaces:**
- Consumes: `pointWorkspace` (Task 4), `selectedDomain`, `Meteogram` (Task 9). Bouton export : `exportMeteogramPng` (Task 12, câblé après).

**Contexte :** shell du tiroir. `fixed` en bas, pleine largeur, `bg-glass glass-blur`, bord sky, hauteur redimensionnable via une poignée (drag → `$state` de hauteur, défaut `40vh`, bornes `220px`..`70vh`). En-tête : « Meteogram — {lat}, {lng} » + `<Modèle> · dernier run` + bouton Export + bouton fermer (`pointWorkspace.close()`). Sur mobile (`!desktop`), occupe une plus grande part / bottom-sheet. Décale les contrôles MapLibre comme la timeline si besoin (réutiliser `bottomChromeHeight` — voir `+page.svelte`).

- [ ] **Step 1: Écrire le composant** (déléguer à `svelte-file-editor`)

```svelte
<script lang="ts">
	import { pointWorkspace } from '$lib/stores/point-workspace';
	import { selectedDomain } from '$lib/stores/variables';

	import Meteogram from './meteogram/meteogram.svelte';

	let height = $state(Math.round(window.innerHeight * 0.4));

	function startResize(e: PointerEvent) {
		const startY = e.clientY;
		const startH = height;
		const move = (ev: PointerEvent) => {
			height = Math.max(220, Math.min(window.innerHeight * 0.7, startH + (startY - ev.clientY)));
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
</script>

{#if $pointWorkspace.open && $pointWorkspace.lat !== null && $pointWorkspace.lng !== null}
	<section
		class="bg-glass glass-blur fixed inset-x-0 bottom-0 z-40 border-t border-sky-500/30 text-white"
		style={`height:${height}px`}
		aria-label="Espace point — meteogram"
	>
		<div
			class="h-1.5 cursor-ns-resize"
			role="separator"
			aria-orientation="horizontal"
			onpointerdown={startResize}
		></div>
		<header class="flex items-center justify-between px-3 py-1 text-sm">
			<span class="tabular-nums">
				Meteogram — {$pointWorkspace.lat.toFixed(3)}, {$pointWorkspace.lng.toFixed(3)}
			</span>
			<span class="text-xs text-sky-300">{$selectedDomain.label} · dernier run</span>
			<div class="flex gap-2">
				<!-- bouton export câblé en Task 12 -->
				<button class="rounded px-2 py-1 hover:bg-white/10" onclick={() => pointWorkspace.close()}>
					✕
				</button>
			</div>
		</header>
		<div class="h-[calc(100%-2.5rem)] overflow-y-auto px-2">
			<Meteogram lat={$pointWorkspace.lat} lng={$pointWorkspace.lng} />
		</div>
	</section>
{/if}
```

- [ ] **Step 2: Valider Svelte** (`svelte-autofixer`) + `npm run check`.
Expected: 0 avertissement / 0 erreur (si `window` pose souci au typecheck SSR, garder derrière `$effect`/valeur initiale sûre).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/point-workspace/point-drawer.svelte
git commit -m "feat(meteogram): tiroir bas espace point (redim + en-tête dernier run)"
```

---

## Task 11: Monter le tiroir + déclencheur popup + pin carte

**Files:**
- Modify: `src/routes/+page.svelte` (monter `<PointDrawer />`)
- Modify: `src/lib/popup.ts` (bouton « Meteogram » + pin MapLibre)

**Interfaces:**
- Consumes: `pointWorkspace` (Task 4), `hasMeteogram` (Task 2), `PointDrawer` (Task 10).

**Contexte :** `popup.ts` a déjà le bouton « Sondage vertical » (`soundingBtn`, l.78-84) créé dans `initPopupDiv` et affiché/masqué dans `updatePopupContent` (l.95-98). On ajoute le même schéma pour un bouton « Meteogram », visible si `hasMeteogram(get(selectedDomain).value)`, qui appelle `pointWorkspace.open(lat, lng)`. Un marqueur MapLibre dédié matérialise le point.

- [ ] **Step 1: Ajouter le bouton dans `popup.ts`**

Dans `initPopupDiv`, après le bloc `soundingBtn` :

```ts
const meteogramBtn = document.createElement('button');
meteogramBtn.className = 'popup-meteogram-btn';
meteogramBtn.innerText = 'Meteogram';
meteogramBtn.addEventListener('click', () => {
	if (lastCoords) pointWorkspace.open(lastCoords.lat, lastCoords.lng);
});
wrapperDiv.append(meteogramBtn);
```

Déclarer `let meteogramBtn: HTMLButtonElement | undefined;` en tête (avec les autres refs) et importer `import { pointWorkspace } from '$lib/stores/point-workspace';` + `import { hasMeteogram } from '$lib/meteogram/model-map';`.

- [ ] **Step 2: Gérer la visibilité dans `updatePopupContent`**

Après le bloc de visibilité de `soundingBtn` (l.95-98) :

```ts
if (meteogramBtn) {
	meteogramBtn.style.display = hasMeteogram(get(selectedDomain).value) ? '' : 'none';
}
```

- [ ] **Step 3: Style du bouton**

Ajouter dans `src/styles.css` une règle `.popup-meteogram-btn` calquée sur `.popup-sounding-btn` (chercher `popup-sounding-btn` et dupliquer le bloc en renommant).

Run: `rg -n "popup-sounding-btn" src/styles.css`

- [ ] **Step 4: Monter le tiroir dans `+page.svelte`**

Importer et rendre `<PointDrawer />` près des autres composants de chrome :
```svelte
import PointDrawer from '$lib/components/point-workspace/point-drawer.svelte';
```
puis dans le markup (au niveau des overlays) : `<PointDrawer />`.

- [ ] **Step 5: Pin carte** (marqueur MapLibre)

Dans `point-drawer.svelte` (ou un petit module `pin.ts`), poser un `maplibregl.Marker` aux coordonnées de `$pointWorkspace` à l'ouverture, le retirer à la fermeture. Réutiliser `map` depuis `$lib/stores/map`. Un `$effect` sur `$pointWorkspace` gère create/move/remove.

- [ ] **Step 6: Valider + typecheck**

Run: `npm run check`
Expected: 0 erreur. Valider les `.svelte` touchés via `svelte-autofixer`.

- [ ] **Step 7: Vérif fonctionnelle (dev)**

Run: `npm run dev`. Cliquer un point sur AROME/ECMWF → bouton « Meteogram » présent → clic ouvre le tiroir, le graphe charge. Scruber la timeline → le playhead bouge. Cliquer sur le graphe → la carte change d'échéance. Sur le domaine `arome_france` (bucket) → bouton absent.

- [ ] **Step 8: Commit**

```bash
git add src/lib/popup.ts src/styles.css src/routes/+page.svelte src/lib/components/point-workspace/point-drawer.svelte
git commit -m "feat(meteogram): déclencheur popup + montage tiroir + pin carte"
```

---

## Task 12: Export PNG

**Files:**
- Create: `src/lib/components/point-workspace/meteogram/png-export.ts`
- Modify: `point-drawer.svelte` (câbler le bouton export)

**Interfaces:**
- Produces: `exportMeteogramPng(svg: SVGSVGElement, filename: string): Promise<void>`.

**Contexte :** sérialiser le SVG composite (les panneaux dans un conteneur ; le plus simple : envelopper tous les `<svg>` panneaux dans **un** `<svg>` racine, ou capturer un `<svg>` d'export dédié). Styles **inline** + `font-family` système explicite pour fidélité hors-DOM. Sérialiser → `Image` (data URL) → `<canvas>` (×2 pour la netteté) → `toBlob('image/png')` → download.

- [ ] **Step 1: Écrire le module**

```ts
// src/lib/components/point-workspace/meteogram/png-export.ts
export const exportMeteogramPng = async (
	svg: SVGSVGElement,
	filename: string
): Promise<void> => {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	clone.style.background = '#0b1220'; // verre bleu-nuit opaque pour l'image
	clone.style.fontFamily =
		'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
	const xml = new XMLSerializer().serializeToString(clone);
	const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

	const w = Number(svg.getAttribute('width')) || svg.clientWidth;
	const h = Number(svg.getAttribute('height')) || svg.clientHeight;
	const scale = 2;

	await new Promise<void>((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = w * scale;
			canvas.height = h * scale;
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('no 2d context'));
			ctx.scale(scale, scale);
			ctx.drawImage(img, 0, 0);
			canvas.toBlob((blob) => {
				if (!blob) return reject(new Error('toBlob null'));
				const a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = filename;
				a.click();
				URL.revokeObjectURL(a.href);
				resolve();
			}, 'image/png');
		};
		img.onerror = () => reject(new Error('svg image load failed'));
		img.src = svgUrl;
	});
};
```

- [ ] **Step 2: Câbler le bouton dans `point-drawer.svelte`**

Envelopper le contenu meteogram dans un conteneur avec `bind:this` sur le `<svg>` racine exporté (ou exposer une méthode depuis `meteogram.svelte`). Ajouter le bouton :
```svelte
<button
	class="rounded px-2 py-1 hover:bg-white/10"
	onclick={() => exportEl && exportMeteogramPng(exportEl, `meteogram_${$pointWorkspace.lat?.toFixed(3)}_${$pointWorkspace.lng?.toFixed(3)}.png`)}
>
	Exporter PNG
</button>
```
Le plus simple : `meteogram.svelte` rend tous les panneaux dans **un** `<svg>` racine (empilement vertical via `y` offsets) et l'expose via `bind:this` remontée par prop `bind`. Sinon, capturer un SVG d'export dédié construit à la volée. Choisir l'empilement dans un seul `<svg>` (facilite aussi le crosshair partagé).

- [ ] **Step 3: Valider + typecheck** (`svelte-autofixer`, `npm run check`).
Expected: 0 erreur.

- [ ] **Step 4: Vérif fonctionnelle**

Run: `npm run dev` → ouvrir un meteogram → « Exporter PNG » → un fichier PNG lisible se télécharge (panneaux + en-tête).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/point-workspace/meteogram/png-export.ts src/lib/components/point-workspace/point-drawer.svelte src/lib/components/point-workspace/meteogram/meteogram.svelte
git commit -m "feat(meteogram): export PNG"
```

---

## Task 13: Documentation

**Files:**
- Modify: `.claude/rules/architecture.md`, `.claude/rules/components.md`, `.claude/rules/stores.md`

- [ ] **Step 1: `architecture.md`** — ajouter une section « Meteogram / Espace point » : source API JSON Open-Meteo (1 requête/point, `DOMAIN_TO_API_MODEL`, exclusion `arome_france`), rendu SVG maison, **couplage temporel bidirectionnel** via `goToValidTime` partagé + snapping `nearestValidTime`, limite « dernier run ».

- [ ] **Step 2: `components.md`** — décrire `point-workspace/` (tiroir bas extensible, seam de modules, `panel.svelte`/`wind-direction.svelte`/`meteogram.svelte`), et le nouveau bouton « Meteogram » du popup.

- [ ] **Step 3: `stores.md`** — décrire `point-workspace.ts` (non persisté, MVP).

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/architecture.md .claude/rules/components.md .claude/rules/stores.md
git commit -m "docs: règles meteogram / espace point"
```

---

## Task 14: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous les tests passent (dont les 6 nouveaux fichiers meteogram).

- [ ] **Step 2: Lint (via rtk proxy — obligatoire)**

Run: `rtk proxy npm run lint`
Expected: prettier + eslint OK (ne pas se fier à un `npm run lint` caché par rtk).

- [ ] **Step 3: Typecheck + build**

Run: `npm run check && npm run build`
Expected: 0 erreur, build statique OK.

- [ ] **Step 4: Vérif headless du couplage (follow-up recommandé)**

Suivre la méthode `headless-map-verification` (playwright-core + chrome système + swiftshader) : seed localStorage, ouvrir un meteogram, vérifier que le playhead se positionne à `$time` et qu'un clic sur le graphe change l'échéance carte. Documenter le script sous `scripts/`/tests e2e si retenu.

---

## Self-Review (rempli à l'écriture)

- **Couverture spec** : §1 données→T3 ; §2 mapping→T2 ; §3 rendu SVG→T5/T6/T7/T8 ; §4 tiroir→T4/T10 ; §5 couplage→T1/T6/T9/T11 ; §6 export→T12 ; §7 déclencheur→T11 ; §8 erreurs→T9 ; §9 dernier run→T10 (en-tête) + T9 (playhead clamp via `playheadTime` dérivé de `$time`) ; §10 tests→T2-T6,T14.
- **Placeholders** : aucun « TBD » ; code fourni pour toutes les unités pures ; composants `.svelte` fournis en squelette exécutable (justifié : édition déléguée à `svelte-file-editor` + validation `svelte-autofixer`, conforme CLAUDE.md).
- **Cohérence des types** : `MeteogramData`/`MeteogramKey` (T3) réutilisés en T9 ; `resolveApiModel`/`hasMeteogram` (T2) en T9/T11 ; `goToValidTime` (T1) en T9/T11 ; `nearestValidTime` (T6) en T9 ; `linePath`/`barRects` (T6) + `timeToX`/`linScale`/`niceExtent`/`dayTicks` (T5) en T7.
- **Points à confirmer à l'exécution** (marqués dans les tâches) : format exact de `hourly.time` (T3 Step 5), chemin réel du store `metaJson` (T9 Step 2), identifiants domaines/modèles (T2 vérif préalable), classes `bg-glass`/`glass-blur` présentes (elles le sont — chrome verre).
