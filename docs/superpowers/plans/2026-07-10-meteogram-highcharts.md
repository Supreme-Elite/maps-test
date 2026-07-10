# Meteogram Highcharts (façon yr.no) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le rendu SVG maison du meteogram « espace point » par un graphe Highcharts unique façon yr.no (T° + point de rosée, précip, pression, windbarbs, symboles météo, tooltip partagé), sans toucher au tiroir, au client API ni au couplage temporel.

**Architecture:** La couche rendu seule change : un **builder pur** `MeteogramChartInput → Highcharts.Options` (testable en node, n'importe que des types), un `meteogram.svelte` réécrit qui conserve l'orchestration existante (fetch mémoïsé, AbortController, états, conversion d'unités, playhead, seek) et monte le chart via **import dynamique** de Highcharts. Symboles météo : mapping pur WMO→icônes yr bundlées.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, Highcharts 12 (+ modules `windbarb`, `exporting`, `offline-exporting`), Vitest.

## Global Constraints

- **Svelte 5 runes** uniquement ; Prettier tabs/single-quotes/100col — `npm run format`, jamais d'ordre d'imports manuel.
- Commits sémantiques `feat:`/`fix:`/`docs:`/`chore:`.
- Tests Vitest sous `src/lib/tests/**`, environnement **node** (pas de DOM) — seul le builder pur et le mapping sont testés unitairement.
- Lint fiable : `rtk proxy npm run lint` (rtk masque la sortie).
- **Jamais l'export-server Highsoft** : PNG local via `offline-exporting` (`exportChartLocal`).
- Icônes météo **bundlées** dans `static/weather-symbols/` (pas de CDN).
- Temps affichés en **UTC** ; libellés français.
- Branche : `feat/meteogram-point`.
- Conversion d'unités : T°/précip/pression converties via `convertValue`/`getDisplayUnit` (`$lib/stores/units`) comme aujourd'hui ; le **vent reste en m/s** (convention des barbes).

---

## File Structure

**Créés**
- `src/lib/meteogram/weather-symbols.ts` — mapping pur WMO→icône yr + libellé FR.
- `src/lib/meteogram/meteogram-chart.ts` — builder pur d'options Highcharts.
- `static/weather-symbols/*.svg` (30 icônes) + `static/weather-symbols/LICENSE`.
- Tests : `src/lib/tests/weather-symbols.test.ts`, `src/lib/tests/meteogram-chart.test.ts`.

**Modifiés**
- `src/lib/meteogram/types.ts`, `src/lib/meteogram/api.ts` (+ leur test), `src/lib/tests/meteogram-api.test.ts`.
- `src/lib/components/point-workspace/meteogram/meteogram.svelte` (réécrit).
- `src/lib/components/point-workspace/point-drawer.svelte` (export PNG rebranché).
- `package.json` (dep `highcharts`), `README.md` (note licence), `.claude/rules/components.md`, `.claude/rules/architecture.md`, spec (statut).

**Supprimés**
- `src/lib/components/point-workspace/meteogram/panel.svelte`, `panel-types.ts`, `wind-direction.svelte`, `png-export.ts`.
- `src/lib/meteogram/paths.ts`, `src/lib/meteogram/scales.ts`.
- `src/lib/tests/meteogram-paths.test.ts`, `src/lib/tests/meteogram-scales.test.ts`.

---

### Task 1: Données — variables `weather_code`/`is_day`, retrait nébulosité/CAPE/probabilité

**Files:**
- Modify: `src/lib/meteogram/types.ts`
- Modify: `src/lib/meteogram/api.ts` (bloc `HOURLY_VARIABLES`)
- Test: `src/lib/tests/meteogram-api.test.ts`

**Interfaces:**
- Produces : `MeteogramKey` =
  `'temperature_2m' | 'dew_point_2m' | 'precipitation' | 'wind_speed_10m' | 'wind_gusts_10m' | 'wind_direction_10m' | 'pressure_msl' | 'weather_code' | 'is_day'`.
  `MeteogramData` inchangé de forme (`times`, `series`, `model`).
- Consumes : rien de nouveau.

- [ ] **Step 1: Mettre à jour le test d'URL (échoue d'abord)**

Dans `src/lib/tests/meteogram-api.test.ts`, remplacer les deux assertions de variables du test `buildForecastUrl` :

```ts
		expect(url).toContain('temperature_2m');
		expect(url).toContain('weather_code');
		expect(url).toContain('is_day');
		expect(url).not.toContain('cloud_cover_low');
		expect(url).not.toContain('cape');
		expect(url).not.toContain('precipitation_probability');
```

(supprimer les anciennes lignes `expect(url).toContain('precipitation_probability');` et `expect(url).toContain('cape');`).

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts`
Expected: FAIL (`not.toContain('cape')` échoue — cape encore présent).

- [ ] **Step 3: Mettre à jour `types.ts`**

```ts
export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
	| 'precipitation'
	| 'wind_speed_10m'
	| 'wind_gusts_10m'
	| 'wind_direction_10m'
	| 'pressure_msl'
	| 'weather_code'
	| 'is_day';

export interface MeteogramData {
	times: Date[];
	series: Record<MeteogramKey, (number | null)[]>;
	model: string;
}
```

- [ ] **Step 4: Mettre à jour `HOURLY_VARIABLES` dans `api.ts`**

Remplacer le tableau (et son commentaire d'en-tête) par :

```ts
// Variables du graphe unique façon yr.no : T° + point de rosée (axe 0), précip
// (axe 1), pression (axe 2), windbarbs (vitesse+direction, m/s), et
// weather_code/is_day pour la rangée de symboles météo. Nébulosité, CAPE et
// probabilité de précip sont sortis du v1 graphe-unique (réintroduisibles en
// panneaux secondaires — voir spec 2026-07-10).
export const HOURLY_VARIABLES: readonly MeteogramKey[] = [
	'temperature_2m',
	'dew_point_2m',
	'precipitation',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'pressure_msl',
	'weather_code',
	'is_day'
];
```

- [ ] **Step 5: Vérifier le passage**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts && npm run check`
Expected: PASS. `check` échouera si `meteogram.svelte` référence encore `cape`/`cloud_cover_*` — c'est attendu tant que Task 5 n'est pas faite ; dans ce cas lancer seulement vitest ici et vérifier `check` en Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meteogram/types.ts src/lib/meteogram/api.ts src/lib/tests/meteogram-api.test.ts
git commit -m "feat(meteogram): variables du graphe unique (weather_code/is_day, retrait nébulosité/CAPE/proba)"
```

> Note : entre Task 1 et Task 5 le typecheck global est cassé (l'ancien rendu référence des clés retirées). Les Tasks 1→5 forment un lot à exécuter d'affilée sur la branche.

---

### Task 2: Mapping symboles météo WMO → icônes yr + icônes bundlées

**Files:**
- Create: `src/lib/meteogram/weather-symbols.ts`
- Create: `static/weather-symbols/*.svg` + `static/weather-symbols/LICENSE`
- Test: `src/lib/tests/weather-symbols.test.ts`

**Interfaces:**
- Produces : `symbolForWmo(code: number, isDay: boolean): { icon: string; label: string }` —
  `icon` = nom de fichier sans extension (ex. `'01d'`), servi depuis `/weather-symbols/<icon>.svg`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tests/weather-symbols.test.ts
import { describe, expect, it } from 'vitest';

import { symbolForWmo } from '$lib/meteogram/weather-symbols';

describe('symbolForWmo', () => {
	it('mappe les codes de base avec variante jour/nuit', () => {
		expect(symbolForWmo(0, true)).toEqual({ icon: '01d', label: 'Ciel clair' });
		expect(symbolForWmo(0, false)).toEqual({ icon: '01n', label: 'Ciel clair' });
		expect(symbolForWmo(2, true).icon).toBe('03d');
	});

	it('les codes sans variante ignorent isDay', () => {
		expect(symbolForWmo(3, true).icon).toBe('04');
		expect(symbolForWmo(3, false).icon).toBe('04');
		expect(symbolForWmo(45, false)).toEqual({ icon: '15', label: 'Brouillard' });
	});

	it('couvre pluie, neige, averses et orage', () => {
		expect(symbolForWmo(61, true).icon).toBe('46');
		expect(symbolForWmo(65, true).icon).toBe('10');
		expect(symbolForWmo(75, true).icon).toBe('50');
		expect(symbolForWmo(80, false).icon).toBe('40n');
		expect(symbolForWmo(95, true)).toEqual({ icon: '22', label: 'Orage' });
	});

	it('code inconnu → fallback couvert', () => {
		expect(symbolForWmo(42, true)).toEqual({ icon: '04', label: 'Couvert' });
	});
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tests/weather-symbols.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write `weather-symbols.ts`**

```ts
// src/lib/meteogram/weather-symbols.ts

/**
 * Mapping WMO 4677 (codes `weather_code` de l'API forecast) → icônes du set
 * NRK/yr « yr-weather-symbols » (MIT, bundlé dans static/weather-symbols/) et
 * libellé français pour le tooltip. `day`/`night` distincts uniquement pour
 * les états dépendant du soleil ; `both` sinon.
 */
interface SymbolEntry {
	day: string;
	night: string;
	label: string;
}

const sym = (both: string, label: string): SymbolEntry => ({ day: both, night: both, label });
const dn = (day: string, night: string, label: string): SymbolEntry => ({ day, night, label });

const WMO_SYMBOLS: Record<number, SymbolEntry> = {
	0: dn('01d', '01n', 'Ciel clair'),
	1: dn('02d', '02n', 'Peu nuageux'),
	2: dn('03d', '03n', 'Partiellement nuageux'),
	3: sym('04', 'Couvert'),
	45: sym('15', 'Brouillard'),
	48: sym('15', 'Brouillard givrant'),
	51: sym('46', 'Bruine faible'),
	53: sym('46', 'Bruine'),
	55: sym('09', 'Bruine forte'),
	56: sym('47', 'Bruine verglaçante faible'),
	57: sym('48', 'Bruine verglaçante'),
	61: sym('46', 'Pluie faible'),
	63: sym('09', 'Pluie modérée'),
	65: sym('10', 'Pluie forte'),
	66: sym('47', 'Pluie verglaçante faible'),
	67: sym('48', 'Pluie verglaçante'),
	71: sym('49', 'Neige faible'),
	73: sym('13', 'Neige modérée'),
	75: sym('50', 'Neige forte'),
	77: sym('49', 'Grains de neige'),
	80: dn('40d', '40n', 'Averses faibles'),
	81: dn('05d', '05n', 'Averses'),
	82: dn('41d', '41n', 'Fortes averses'),
	85: dn('44d', '44n', 'Averses de neige faibles'),
	86: dn('45d', '45n', 'Fortes averses de neige'),
	95: sym('22', 'Orage'),
	96: sym('23', 'Orage avec grêle'),
	99: sym('32', 'Orage avec forte grêle')
};

const FALLBACK: SymbolEntry = sym('04', 'Couvert');

export function symbolForWmo(code: number, isDay: boolean): { icon: string; label: string } {
	const entry = WMO_SYMBOLS[code] ?? FALLBACK;
	return { icon: isDay ? entry.day : entry.night, label: entry.label };
}
```

- [ ] **Step 4: Vérifier le passage**

Run: `npx vitest run src/lib/tests/weather-symbols.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Télécharger les 30 icônes + licence**

```bash
mkdir -p static/weather-symbols
for icon in 01d 01n 02d 02n 03d 03n 04 05d 05n 09 10 13 15 22 23 31 32 40d 40n 41d 41n 44d 44n 45d 45n 46 47 48 49 50; do
	curl -sSf "https://cdn.jsdelivr.net/gh/nrkno/yr-weather-symbols@8.0.1/dist/svg/${icon}.svg" \
		-o "static/weather-symbols/${icon}.svg"
done
curl -sSf "https://cdn.jsdelivr.net/gh/nrkno/yr-weather-symbols@8.0.1/LICENSE" \
	-o static/weather-symbols/LICENSE
ls static/weather-symbols/ | wc -l   # attendu : 31
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/meteogram/weather-symbols.ts src/lib/tests/weather-symbols.test.ts static/weather-symbols/
git commit -m "feat(meteogram): mapping WMO → symboles météo yr (icônes MIT bundlées)"
```

---

### Task 3: Dépendance Highcharts + note licence README

**Files:**
- Modify: `package.json` / `package-lock.json` (via npm)
- Modify: `README.md`

**Interfaces:**
- Produces : paquet `highcharts@^12` installé ; modules importables :
  `highcharts/modules/windbarb`, `highcharts/modules/exporting`, `highcharts/modules/offline-exporting` (side-effect, s'appliquent au default export en v12).

- [ ] **Step 1: Installer**

```bash
npm install highcharts
node -e "console.log(require('highcharts/package.json').version)"   # attendu : 12.x
```

- [ ] **Step 2: Note licence dans `README.md`**

Ajouter une sous-section à l'endroit où le README documente les dépendances (sinon en fin de section installation) :

```markdown
### Licence Highcharts

Le meteogram utilise [Highcharts](https://www.highcharts.com/), gratuit pour un usage
non commercial (licence [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/)) —
ce qui couvre Infoclimat (association à but non lucratif, produit non monétisé). **Tout
déploiement commercial d'un fork de ce dépôt nécessite une licence Highcharts propre.**
Les icônes météo (`static/weather-symbols/`) proviennent de
[nrkno/yr-weather-symbols](https://github.com/nrkno/yr-weather-symbols) (MIT).
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json README.md
git commit -m "chore(meteogram): dépendance highcharts + note licence CC BY-NC"
```

---

### Task 4: Builder pur `meteogram-chart.ts`

**Files:**
- Create: `src/lib/meteogram/meteogram-chart.ts`
- Test: `src/lib/tests/meteogram-chart.test.ts`

**Interfaces:**
- Consumes : types seulement (`import type { Options } from 'highcharts'` — effacé à la compilation, le test node n'importe pas le runtime Highcharts).
- Produces :

```ts
export interface MeteogramChartInput {
	times: Date[];
	temperature: (number | null)[]; // convertie unité d'affichage
	dewPoint: (number | null)[]; // convertie
	precipitation: (number | null)[]; // convertie
	pressure: (number | null)[]; // convertie
	windSpeed: (number | null)[]; // m/s BRUT (convention des barbes)
	windDirection: (number | null)[];
	symbolLabels: (string | null)[]; // libellé météo par heure (tooltip header)
	units: { temperature: string; precipitation: string; pressure: string };
	onTimeClick: (date: Date) => void;
}
export function buildChartOptions(input: MeteogramChartInput): Options;
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tests/meteogram-chart.test.ts
import { describe, expect, it } from 'vitest';

import { type MeteogramChartInput, buildChartOptions } from '$lib/meteogram/meteogram-chart';

function input(overrides: Partial<MeteogramChartInput> = {}): MeteogramChartInput {
	const times = [0, 1, 2, 3].map((h) => new Date(Date.UTC(2026, 6, 10, h)));
	const four = (v: number) => [v, v, v, v];
	return {
		times,
		temperature: four(20),
		dewPoint: four(12),
		precipitation: [0, 0.5, 1.2, 0],
		pressure: four(1015),
		windSpeed: four(5),
		windDirection: four(230),
		symbolLabels: ['Ciel clair', 'Ciel clair', 'Pluie faible', null],
		units: { temperature: '°C', precipitation: 'mm', pressure: 'hPa' },
		onTimeClick: () => {},
		...overrides
	};
}

describe('buildChartOptions', () => {
	it('déclare 3 axes Y (T°, précip, pression) et 2 axes X liés', () => {
		const o = buildChartOptions(input());
		expect(o.yAxis).toHaveLength(3);
		expect(o.xAxis).toHaveLength(2);
		expect((o.xAxis as { linkedTo?: number }[])[1].linkedTo).toBe(0);
	});

	it('série 5 : température, rosée, précip, pression, windbarb — sur le bon axe', () => {
		const o = buildChartOptions(input());
		const s = o.series as { type?: string; yAxis?: number; name?: string }[];
		expect(s.map((x) => x.type)).toEqual(['spline', 'spline', 'column', 'spline', 'windbarb']);
		expect(s[2].yAxis).toBe(1);
		expect(s[3].yAxis).toBe(2);
	});

	it('température porte x (ms epoch) et symbolName pour le tooltip', () => {
		const o = buildChartOptions(input());
		const temp = (o.series as { data?: { x: number; symbolName?: string | null }[] }[])[0];
		expect(temp.data).toHaveLength(4);
		expect(temp.data![0].x).toBe(Date.UTC(2026, 6, 10, 0));
		expect(temp.data![2].symbolName).toBe('Pluie faible');
	});

	it('windbarbs : 1 point sur 2, {x, value, direction}, null écartés', () => {
		const o = buildChartOptions(input({ windSpeed: [5, 6, null, 8] }));
		const barbs = (o.series as { type?: string; data?: unknown[] }[]).find(
			(s) => s.type === 'windbarb'
		)!;
		// indices pairs 0 et 2 ; 2 est null → écarté ⇒ 1 point
		expect(barbs.data).toHaveLength(1);
		expect(barbs.data![0]).toMatchObject({ value: 5, direction: 230 });
	});

	it('unités injectées dans tooltips/axes', () => {
		const o = buildChartOptions(input({ units: { temperature: '°F', precipitation: 'inch', pressure: 'hPa' } }));
		const json = JSON.stringify(o);
		expect(json).toContain('°F');
		expect(json).toContain('inch');
	});
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write `meteogram-chart.ts`**

```ts
// src/lib/meteogram/meteogram-chart.ts
import type { Options, XAxisOptions } from 'highcharts';

export interface MeteogramChartInput {
	times: Date[];
	temperature: (number | null)[];
	dewPoint: (number | null)[];
	precipitation: (number | null)[];
	pressure: (number | null)[];
	/** m/s brut : les barbes suivent la convention nœuds, Highcharts convertit. */
	windSpeed: (number | null)[];
	windDirection: (number | null)[];
	symbolLabels: (string | null)[];
	units: { temperature: string; precipitation: string; pressure: string };
	onTimeClick: (date: Date) => void;
}

const GRID = 'rgba(255, 255, 255, 0.08)';
const TEXT = 'rgba(255, 255, 255, 0.7)';
const TEXT_STRONG = 'rgba(255, 255, 255, 0.9)';

/**
 * Construit les options du graphe unique façon yr.no (démo officielle
 * Highcharts « meteogram »), thème sombre accordé au tiroir. Builder pur :
 * données → objet options, aucun accès DOM ni au runtime Highcharts.
 */
export function buildChartOptions(input: MeteogramChartInput): Options {
	const xs = input.times.map((t) => t.getTime());
	const at = <T>(arr: (T | null)[], i: number): T | null => arr[i] ?? null;

	const temperatureData = xs.map((x, i) => ({
		x,
		y: at(input.temperature, i),
		symbolName: at(input.symbolLabels, i)
	}));
	const dewPointData = xs.map((x, i) => [x, at(input.dewPoint, i)]);
	const precipitationData = xs.map((x, i) => [x, at(input.precipitation, i)]);
	const pressureData = xs.map((x, i) => [x, at(input.pressure, i)]);

	// 1 barbe sur 2 (lisibilité, comme le démo) ; points sans vitesse/direction écartés.
	const windData = xs
		.map((x, i) => ({ x, value: at(input.windSpeed, i), direction: at(input.windDirection, i), i }))
		.filter((p) => p.i % 2 === 0 && p.value !== null && p.direction !== null)
		.map(({ x, value, direction }) => ({ x, value: value as number, direction: direction as number }));

	const onTimeClick = input.onTimeClick;

	return {
		chart: {
			backgroundColor: 'transparent',
			marginBottom: 70,
			marginRight: 44,
			marginTop: 44,
			plotBorderWidth: 1,
			plotBorderColor: 'rgba(255, 255, 255, 0.2)',
			alignTicks: false,
			zooming: { type: 'x' },
			scrollablePlotArea: { minWidth: 720 },
			events: {
				click: function (e) {
					// Typage large : l'événement porte xAxis[0].value (ms epoch).
					const ev = e as unknown as { xAxis?: { value: number }[] };
					const v = ev.xAxis?.[0]?.value;
					if (v !== undefined) onTimeClick(new Date(v));
				}
			}
		},
		time: { timezone: 'UTC' },
		title: { text: undefined },
		credits: { enabled: false },
		accessibility: { enabled: false },
		tooltip: {
			shared: true,
			useHTML: false,
			backgroundColor: 'rgba(12, 20, 32, 0.95)',
			style: { color: TEXT_STRONG },
			headerFormat:
				'<small>{point.x:%A %e %b, %H:%M} TU</small><br><b>{point.point.symbolName}</b><br>'
		},
		xAxis: [
			{
				type: 'datetime',
				tickInterval: 2 * 36e5,
				minorTickInterval: 36e5,
				tickLength: 0,
				gridLineWidth: 1,
				gridLineColor: GRID,
				startOnTick: false,
				endOnTick: false,
				minPadding: 0,
				maxPadding: 0,
				offset: 30,
				showLastLabel: true,
				labels: { format: '{value:%H}', style: { color: TEXT } },
				crosshair: true
			},
			{
				linkedTo: 0,
				type: 'datetime',
				tickInterval: 24 * 36e5,
				labels: {
					format:
						'{value:<span style="font-size: 12px; font-weight: bold">%a</span> %e %b}',
					align: 'left',
					x: 3,
					y: 8,
					style: { color: TEXT_STRONG }
				},
				opposite: true,
				tickLength: 20,
				gridLineWidth: 1,
				gridLineColor: GRID
			}
		] as XAxisOptions[],
		yAxis: [
			{
				// Température (+ point de rosée)
				title: { text: null },
				labels: {
					format: `{value}°`,
					style: { fontSize: '10px', color: TEXT },
					x: -3
				},
				plotLines: [{ value: 0, color: 'rgba(255,255,255,0.3)', width: 1, zIndex: 2 }],
				maxPadding: 0.3,
				minRange: 8,
				tickInterval: 1,
				gridLineColor: GRID
			},
			{
				// Précipitations
				title: { text: null },
				labels: { enabled: false },
				gridLineWidth: 0,
				tickLength: 0,
				minRange: 10,
				min: 0
			},
			{
				// Pression
				allowDecimals: false,
				title: {
					text: input.units.pressure,
					offset: 0,
					align: 'high',
					rotation: 0,
					style: { fontSize: '10px', color: '#fbbf24' },
					textAlign: 'left',
					x: 3
				},
				labels: { style: { fontSize: '8px', color: '#fbbf24' }, y: 2, x: 3 },
				gridLineWidth: 0,
				opposite: true,
				showLastLabel: false
			}
		],
		legend: { enabled: false },
		plotOptions: {
			series: {
				pointPlacement: 'between',
				point: {
					events: {
						click: function () {
							onTimeClick(new Date(this.x as number));
						}
					}
				}
			}
		},
		series: [
			{
				name: 'Température',
				data: temperatureData,
				type: 'spline',
				marker: { enabled: false, states: { hover: { enabled: true } } },
				tooltip: { valueSuffix: ` ${input.units.temperature}` },
				zIndex: 2,
				color: '#FF3333',
				negativeColor: '#48AFE8'
			},
			{
				name: 'Point de rosée',
				data: dewPointData,
				type: 'spline',
				marker: { enabled: false },
				dashStyle: 'ShortDash',
				tooltip: { valueSuffix: ` ${input.units.temperature}` },
				zIndex: 1,
				color: '#2F9E5F'
			},
			{
				name: 'Précipitations',
				data: precipitationData,
				type: 'column',
				color: '#68CFE8',
				yAxis: 1,
				groupPadding: 0,
				pointPadding: 0,
				grouping: false,
				dataLabels: {
					enabled: true,
					filter: { operator: '>', property: 'y', value: 0 },
					style: { fontSize: '8px', color: TEXT, textOutline: 'none' }
				},
				tooltip: { valueSuffix: ` ${input.units.precipitation}` }
			},
			{
				name: 'Pression',
				data: pressureData,
				type: 'spline',
				marker: { enabled: false },
				color: '#fbbf24',
				dashStyle: 'ShortDot',
				yAxis: 2,
				tooltip: { valueSuffix: ` ${input.units.pressure}` }
			},
			{
				name: 'Vent',
				type: 'windbarb',
				id: 'windbarbs',
				data: windData,
				color: '#7dd3fc',
				lineWidth: 1.5,
				vectorLength: 18,
				yOffset: -15,
				tooltip: { valueSuffix: ' m/s' }
			}
		]
	} as Options;
}
```

- [ ] **Step 4: Vérifier le passage**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meteogram/meteogram-chart.ts src/lib/tests/meteogram-chart.test.ts
git commit -m "feat(meteogram): builder pur d'options Highcharts (graphe unique yr.no, thème sombre)"
```

---

### Task 5: `meteogram.svelte` réécrit + export PNG rebranché + suppression de l'ancien rendu

**Files:**
- Modify (réécriture): `src/lib/components/point-workspace/meteogram/meteogram.svelte`
- Modify: `src/lib/components/point-workspace/point-drawer.svelte`
- Delete: `src/lib/components/point-workspace/meteogram/panel.svelte`, `panel-types.ts`, `wind-direction.svelte`, `png-export.ts`
- Delete: `src/lib/meteogram/paths.ts`, `src/lib/meteogram/scales.ts`, `src/lib/tests/meteogram-paths.test.ts`, `src/lib/tests/meteogram-scales.test.ts`

**Interfaces:**
- Consumes : `buildChartOptions`/`MeteogramChartInput` (Task 4), `symbolForWmo` (Task 2), `MeteogramKey`/`MeteogramData` (Task 1), et l'existant : `fetchMeteogram`, `resolveApiModel`, `nearestValidTime`, `goToValidTime`, `convertValue`/`getDisplayUnit`/`unitPreferences`.
- Produces : `meteogram.svelte` exporte `exportPng(filename: string): void` (appelée par le tiroir via `bind:this`).

- [ ] **Step 1: Réécrire `meteogram.svelte`**

Conserver **intégralement** la logique de chargement actuelle (cache `SvelteMap`, `AbortController`, jeton `controller`, états `loading`/`rate-limit`/`network`/`empty`, refetch sur `(lat, lng, model)` uniquement). Remplacer tout le rendu (Panels/WindDirection/hover) par le chart :

```svelte
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';

	import { metaJson, time } from '$lib/stores/time';
	import { convertValue, getDisplayUnit, unitPreferences } from '$lib/stores/units';
	import { selectedDomain } from '$lib/stores/variables';

	import { fetchMeteogram } from '$lib/meteogram/api';
	import { buildChartOptions } from '$lib/meteogram/meteogram-chart';
	import { resolveApiModel } from '$lib/meteogram/model-map';
	import { nearestValidTime } from '$lib/meteogram/snap';
	import { symbolForWmo } from '$lib/meteogram/weather-symbols';
	import { goToValidTime } from '$lib/time-navigation';

	import type { MeteogramData, MeteogramKey } from '$lib/meteogram/types';
	import type { Chart } from 'highcharts';

	let { lat, lng }: { lat: number; lng: number } = $props();

	let data = $state<MeteogramData | null>(null);
	let loading = $state(false);
	let error = $state<'rate-limit' | 'network' | 'empty' | null>(null);
	let chartEl = $state<HTMLDivElement>();
	let chart: Chart | undefined;

	// ——— chargement : identique à l'implémentation précédente ———
	const cache = new SvelteMap<string, MeteogramData>();
	let controller: AbortController | undefined;
	const model = $derived(resolveApiModel($selectedDomain.value));

	async function load() {
		const currentModel = model;
		controller?.abort();
		controller = undefined;
		if (!currentModel) {
			data = null;
			error = null;
			loading = false;
			return;
		}
		const key = `${lat.toFixed(3)},${lng.toFixed(3)},${currentModel}`;
		const cached = cache.get(key);
		if (cached) {
			data = cached;
			error = null;
			loading = false;
			return;
		}
		const ac = new AbortController();
		controller = ac;
		loading = true;
		error = null;
		data = null;
		try {
			const d = await fetchMeteogram(lat, lng, currentModel, ac.signal);
			if (controller !== ac) return;
			if (d.times.length === 0) {
				error = 'empty';
			} else {
				cache.set(key, d);
				data = d;
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			if (controller !== ac) return;
			error = (e as Error).message === 'rate-limit' ? 'rate-limit' : 'network';
		} finally {
			if (controller === ac) loading = false;
		}
	}

	$effect(() => {
		void lat;
		void lng;
		void model;
		load();
	});

	// ——— séries converties dans l'unité d'affichage ———
	function seriesValues(key: MeteogramKey): (number | null)[] {
		const raw = data?.series[key] ?? [];
		return (data?.times ?? []).map((_, i) => raw[i] ?? null);
	}
	function convertSeries(key: MeteogramKey, baseUnit: string): (number | null)[] {
		return seriesValues(key).map((v) =>
			v === null || !Number.isFinite(v) ? null : convertValue(v, baseUnit, $unitPreferences, key)
		);
	}

	function seek(t: Date) {
		const validTimes = get(metaJson)?.valid_times?.map((v) => new Date(v)) ?? [];
		goToValidTime(nearestValidTime(t, validTimes) ?? t);
	}

	// ——— Highcharts : chargé paresseusement au premier rendu de données ———
	// Modules v12 en side-effect : ils s'appliquent au default export du paquet.
	type HighchartsModule = typeof import('highcharts');
	let hcPromise: Promise<HighchartsModule['default']> | undefined;
	function loadHighcharts() {
		hcPromise ??= (async () => {
			const hc = (await import('highcharts')).default;
			await import('highcharts/modules/windbarb');
			await import('highcharts/modules/exporting');
			await import('highcharts/modules/offline-exporting');
			hc.setOptions({ lang: { locale: 'fr' } });
			return hc;
		})();
		return hcPromise;
	}

	/** Icônes météo (~1 sur 2) au-dessus de la courbe de T°, redessinées à chaque
	 *  render (zoom, resize, scroll) — le groupe précédent est détruit d'abord. */
	function drawSymbols(c: Chart, d: MeteogramData) {
		type ChartWithSymbols = Chart & { __symbolsGroup?: { destroy(): void } };
		const cc = c as ChartWithSymbols;
		cc.__symbolsGroup?.destroy();
		const group = c.renderer.g('weather-symbols').attr({ zIndex: 5 }).add();
		const codes = d.series.weather_code ?? [];
		const days = d.series.is_day ?? [];
		c.series[0].data.forEach((point, i) => {
			if (i % 2 !== 0) return;
			const code = codes[i];
			if (code === null || code === undefined) return;
			if (point.plotX === undefined || point.plotY === undefined) return;
			const { icon } = symbolForWmo(code, (days[i] ?? 1) === 1);
			c.renderer
				.image(
					`/weather-symbols/${icon}.svg`,
					point.plotX + c.plotLeft - 8,
					point.plotY + c.plotTop - 30,
					30,
					30
				)
				.add(group);
		});
		cc.__symbolsGroup = group;
	}

	// (Re)création du chart quand les données changent.
	$effect(() => {
		const d = data;
		const el = chartEl;
		if (!d || !el) return;
		let cancelled = false;
		(async () => {
			const hc = await loadHighcharts();
			if (cancelled) return;
			chart?.destroy();
			const options = buildChartOptions({
				times: d.times,
				temperature: convertSeries('temperature_2m', '°C'),
				dewPoint: convertSeries('dew_point_2m', '°C'),
				precipitation: convertSeries('precipitation', 'mm'),
				pressure: convertSeries('pressure_msl', 'hPa'),
				windSpeed: seriesValues('wind_speed_10m'),
				windDirection: seriesValues('wind_direction_10m'),
				symbolLabels: (d.series.weather_code ?? []).map((code, i) =>
					code === null || code === undefined
						? null
						: symbolForWmo(code, (d.series.is_day?.[i] ?? 1) === 1).label
				),
				units: {
					temperature: getDisplayUnit('°C', $unitPreferences, 'temperature_2m'),
					precipitation: getDisplayUnit('mm', $unitPreferences, 'precipitation'),
					pressure: getDisplayUnit('hPa', $unitPreferences, 'pressure_msl')
				},
				onTimeClick: seek
			});
			options.chart = {
				...options.chart,
				renderTo: el,
				events: {
					...options.chart?.events,
					render: function () {
						drawSymbols(this as Chart, d);
					}
				}
			};
			chart = new hc.Chart(options);
			syncPlayhead();
		})();
		return () => {
			cancelled = true;
		};
	});

	// Playhead : plotLine repositionnée au scrub, sans re-render du chart.
	function syncPlayhead() {
		const c = chart;
		const t = get(time);
		if (!c) return;
		c.xAxis[0].removePlotLine('playhead');
		if (t) {
			c.xAxis[0].addPlotLine({
				id: 'playhead',
				value: new Date(t).getTime(),
				color: '#38bdf8',
				width: 2,
				zIndex: 4
			});
		}
	}
	$effect(() => {
		void $time;
		syncPlayhead();
	});

	$effect(() => () => {
		chart?.destroy();
		chart = undefined;
	});

	/** Export PNG local (offline-exporting) — appelé par le tiroir via bind:this. */
	export function exportPng(filename: string) {
		chart?.exportChartLocal({ type: 'image/png', filename: filename.replace(/\.png$/, '') }, {});
	}

	const SKELETON_ROWS = Array.from({ length: 3 });
</script>

<div class="flex flex-col py-2">
	{#if loading}
		<div class="flex flex-col gap-3" aria-hidden="true">
			{#each SKELETON_ROWS as _, i (i)}
				<div class="h-[110px] w-full animate-pulse rounded bg-white/5"></div>
			{/each}
		</div>
	{:else if error === 'rate-limit'}
		<p class="p-4 text-sm text-rose-300">
			Limite de requêtes atteinte. Réessayez dans un instant.
			<button class="ml-2 underline hover:text-white" onclick={load}>Réessayer</button>
		</p>
	{:else if error === 'network'}
		<p class="p-4 text-sm text-rose-300">
			Échec du chargement du meteogram.
			<button class="ml-2 underline hover:text-white" onclick={load}>Réessayer</button>
		</p>
	{:else if error === 'empty'}
		<p class="p-4 text-sm text-white/60">Aucune donnée à ce point pour ce modèle.</p>
	{:else if data && data.times.length}
		<div bind:this={chartEl} class="min-h-[280px] w-full"></div>
	{/if}
</div>
```

- [ ] **Step 2: Rebrancher l'export PNG dans `point-drawer.svelte`**

Remplacer l'import et le handler d'export :

```ts
// SUPPRIMER : import { exportMeteogramPng } from './meteogram/png-export';
// SUPPRIMER : let meteogramEl = $state<HTMLDivElement>(); et exporting/handleExport actuels

let meteogramComp = $state<ReturnType<typeof Meteogram>>();

function handleExport() {
	const lat = $pointWorkspace.lat;
	const lng = $pointWorkspace.lng;
	if (lat === null || lng === null) return;
	meteogramComp?.exportPng(`meteogram_${lat.toFixed(3)}_${lng.toFixed(3)}.png`);
}
```

Dans le markup : retirer `bind:this={meteogramEl}` du `<div class="flex-1 …">`, retirer l'état `exporting` du bouton (l'export local est quasi instantané) :

```svelte
<button class="rounded px-2 py-1 hover:bg-white/10" onclick={handleExport}>Exporter PNG</button>
…
<Meteogram bind:this={meteogramComp} lat={$pointWorkspace.lat} lng={$pointWorkspace.lng} />
```

- [ ] **Step 3: Supprimer l'ancien rendu et ses tests**

```bash
git rm src/lib/components/point-workspace/meteogram/panel.svelte \
	src/lib/components/point-workspace/meteogram/panel-types.ts \
	src/lib/components/point-workspace/meteogram/wind-direction.svelte \
	src/lib/components/point-workspace/meteogram/png-export.ts \
	src/lib/meteogram/paths.ts src/lib/meteogram/scales.ts \
	src/lib/tests/meteogram-paths.test.ts src/lib/tests/meteogram-scales.test.ts
```

- [ ] **Step 4: Typecheck + tests + format**

Run: `npm run format && npm run check && npx vitest run`
Expected: 0 erreur (`check` repasse au vert maintenant que plus rien ne référence `cape`/`cloud_cover_*`/`scales`/`paths`) ; tous les tests passent.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(meteogram): rendu Highcharts façon yr.no (chart unique, symboles, windbarbs, export local)"
```

---

### Task 6: Docs — règles path-scopées + statut spec

**Files:**
- Modify: `.claude/rules/components.md` (section `point-workspace/`)
- Modify: `.claude/rules/architecture.md` (si la section meteogram décrit paths/scales)
- Modify: `docs/superpowers/specs/2026-07-10-meteogram-highcharts-design.md` (statut)

- [ ] **Step 1: Mettre à jour `components.md`**

Dans la section `point-workspace/`, remplacer les puces `meteogram/meteogram.svelte`, `meteogram/panel.svelte`, `meteogram/wind-direction.svelte`, `meteogram/png-export.ts` par :

```markdown
- `meteogram/meteogram.svelte` — orchestration (fetch mémoïsé `SvelteMap`, refetch sur point/modèle
  jamais sur le scrub, états chargement/429/réseau/vide, conversion d'unités) + rendu **Highcharts**
  (graphe unique façon yr.no) : import dynamique de `highcharts` + modules `windbarb`/`exporting`/
  `offline-exporting` au premier affichage, builder pur `src/lib/meteogram/meteogram-chart.ts`
  (3 axes Y : T°+point de rosée / précip / pression ; windbarbs 1/2 ; tooltip partagé ; zoom X +
  `scrollablePlotArea`), icônes météo (`weather_code`+`is_day` → `src/lib/meteogram/weather-symbols.ts`
  → SVG bundlés `static/weather-symbols/`, MIT) redessinées à chaque `render`. Playhead = `plotLine`
  X repositionnée au scrub (pas de re-render) ; clic chart/point → `nearestValidTime` + `goToValidTime`.
  Expose `exportPng(filename)` (PNG **local** via `exportChartLocal`, jamais l'export-server Highsoft),
  appelée par `point-drawer.svelte` via `bind:this`. Licence Highcharts : CC BY-NC (non-profit), note
  au README.
```

- [ ] **Step 2: Mettre à jour `architecture.md`**

Si une section décrit `src/lib/meteogram/` (scales/paths), remplacer la liste des modules purs par : `api.ts` (client, `getForecastApiUrl()`), `model-map.ts`, `snap.ts`, `types.ts`, `weather-symbols.ts`, `meteogram-chart.ts` — `paths.ts`/`scales.ts` supprimés (rendu Highcharts).

- [ ] **Step 3: Statut de la spec**

Dans `2026-07-10-meteogram-highcharts-design.md` : `**Statut** : implémenté`.

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/ docs/superpowers/specs/2026-07-10-meteogram-highcharts-design.md
git commit -m "docs: règles point-workspace + statut spec meteogram Highcharts"
```

---

### Task 7: Vérification bout-en-bout (headless)

**Files:** aucun nouveau (corrections inline si observations).

- [ ] **Step 1: Serveur dev**

`npm run dev` (ou réutiliser celui en cours). Ouvrir `http://localhost:5173/?domain=arome_france&variable=temperature_2m`.

- [ ] **Step 2: Vérif headless** (adapter `.superpowers/sdd/verify-meteogram-arome.mjs`)

Contrôler, tiroir ouvert sur un point France :
- le chart Highcharts rend (sélecteur `.highcharts-container` présent) ;
- windbarbs (`.highcharts-windbarb-series`) et icônes météo (`g.highcharts-weather-symbols image`, ≥ 5) présents ;
- la requête part vers `modeles-api.cmer.fr/v1/forecast` avec `weather_code`/`is_day` et **sans** `cape` (status 200) ;
- clic sur le chart → l'échéance de la carte change (header « Validité » mis à jour) ;
- plotLine playhead présente (`.highcharts-plot-line`) et se déplace quand on scrubbe la timeline ;
- « Exporter PNG » déclenche un téléchargement **sans** requête vers `export.highcharts.com` (vérifier les requêtes réseau).
- Capture d'écran du tiroir pour revue visuelle.

- [ ] **Step 3: Qualité**

Run: `npm run check && npx vitest run && rtk proxy npm run lint`
Expected: 0 erreur, tous tests verts, lint clean.

- [ ] **Step 4: Commit final (correctifs éventuels) + push**

```bash
git add -A && git commit -m "fix(meteogram): finitions vérif bout-en-bout" # si correctifs
git push
```

(La PR #114 existante couvre la branche ; ce travail s'y empile.)

---

## Self-Review

**1. Spec coverage** — dépendance+licence (T3), données weather_code/is_day + retraits (T1), mapping WMO + icônes bundlées (T2), builder pur 3 axes/windbarbs/tooltip/zoom/scrollable/thème sombre (T4), composant réécrit + symboles au render + playhead plotLine + clic→seek + export local + suppressions (T5), docs règles (T6, exigé par CLAUDE.md), vérif headless (T7). Couplage temporel préservé : T4 (`onTimeClick`) + T5 (`seek`, `syncPlayhead`). Conversion d'unités : T5 (`convertSeries`, `getDisplayUnit`) + T4 (`units`). ✅
**2. Placeholder scan** — aucun TBD/TODO ; chaque étape code porte le code complet. ✅
**3. Type consistency** — `symbolForWmo(code, isDay)` (T2) utilisé tel quel en T5 ; `MeteogramChartInput`/`buildChartOptions` (T4) consommés en T5 avec les mêmes champs ; `exportPng(filename)` (T5) appelé par le tiroir ; `MeteogramKey` réduit (T1) cohérent avec les accès `d.series.weather_code`/`is_day` (T5). ✅

**Points de vigilance implémenteur** : (a) Tasks 1→5 = lot indissociable (typecheck global cassé entre T1 et T5) ; (b) les imports side-effect Highcharts v12 (`highcharts/modules/*`) s'appliquent au default export — ne pas utiliser l'ancien pattern `factory(Highcharts)` ; (c) si `svelte-check` refuse `export function` dans un composant runes, passer par `export const exportPng = …` — même signature.
