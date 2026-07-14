# Météogramme — améliorations « retour lecteur » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Répondre au retour d'un lecteur sur le météogramme : ouverture au clic droit (bulle enrichie), légende explicite, courbe d'humidité, vent en chiffres, axe temps fusionné (heures+dates), et réglages fins (police précip, échelle T° auto).

**Architecture:** L'essentiel de la logique vit dans un **builder pur** (`meteogram-chart.ts`, données → options Highcharts) et un **client API pur** (`api.ts`) — testés en Vitest (env node, pas de DOM). Le câblage Svelte (`meteogram.svelte`) et l'interaction carte (`popup.ts` + `styles.css`) n'ont pas de test unitaire (env node sans DOM) → **vérifiés en headless** (Playwright, cf. `.claude/rules` mémoire `headless-map-verification`).

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Highcharts 12 (windbarb/datagrouping/exporting), MapLibre GL, Tailwind v4, Vitest.

## Global Constraints

- **Svelte 5 runes** (`$state`/`$derived`/`$effect`/`$props`) — jamais la réactivité Svelte 4.
- **Builder pur** : `meteogram-chart.ts` ne touche ni le DOM ni le runtime Highcharts (données → objet options). `Intl` est autorisé (pas de `Date.now()`/`Math.random()`).
- **Thème sombre verrouillé** : tout élément d'axe/grille/légende posé **explicitement** (les défauts clairs Highcharts ressortent en barres blanches sur fond sombre). Couleurs existantes : `GRID`, `GRID_DAY`, `AXIS`, `TEXT`, `TEXT_STRONG`.
- **Interface FR** : libellés et virgule décimale (locale fr).
- **Prettier** : tabs, single quotes, pas de trailing comma, 100 col. `npm run format` avant commit — ne pas ordonner les imports à la main.
- **Vérif lint avant push** : `rtk proxy npm run lint` (rtk masque parfois l'échec — cf. mémoire `rtk-caches-lint-output`).
- **Tests collectés depuis `src/lib/tests/**` uniquement**, env node.
- **Humidité = bonus abandonnable** : si le 4ᵉ axe dégrade la lisibilité globale (encombrement axes droite, casse mobile), la retirer — priorité à la lisibilité (décision utilisateur, cf. spec bloc 2b).

---

## File Structure

- `src/lib/meteogram/types.ts` — ajout clé `relative_humidity_2m` à `MeteogramKey`.
- `src/lib/meteogram/api.ts` — ajout `relative_humidity_2m` à `HOURLY_VARIABLES`.
- `src/lib/meteogram/meteogram-chart.ts` — cœur des changements chart : `windDisplay`, dataLabels vent, légende, axe+série humidité, axe temps fusionné + helper `dayBoundaryPlotLines`, police précip, échelle T° auto.
- `src/lib/components/point-workspace/meteogram/meteogram.svelte` — passe `humidity` + `windDisplay` dans l'input du builder.
- `src/lib/popup.ts` — handler `contextmenu` (clic droit → épinglage direct) + bulle enrichie à l'état épinglé (coords + altitude lisible).
- `src/styles.css` — styles `.popup--pinned`, `.popup-point-info`, `.popup-coords`, `.popup-alt`.
- Tests : `src/lib/tests/meteogram-api.test.ts`, `src/lib/tests/meteogram-chart.test.ts`.

**Interface finale `MeteogramChartInput`** (référence pour toutes les tâches — champs ajoutés optionnels avec défauts dans le builder, pour ne pas casser le helper `input()` des tests) :

```ts
export interface MeteogramChartInput {
	times: Date[];
	temperature: (number | null)[];
	dewPoint: (number | null)[];
	precipitation: (number | null)[];
	pressure: (number | null)[];
	humidity?: (number | null)[]; // NEW (Task 4) — % ; absent → axe/série masqués
	windSpeed: (number | null)[];
	windDirection: (number | null)[];
	symbolLabels: (string | null)[];
	units: { temperature: string; precipitation: string; pressure: string };
	windDisplay?: { factor: number; unit: string }; // NEW (Task 2) — défaut { 3.6, 'km/h' }
	timezone: string;
	onTimeClick: (date: Date) => void;
	compact?: boolean;
}
```

---

## Task 1 : Humidité dans l'API (types + client)

**Files:**
- Modify: `src/lib/meteogram/types.ts` (union `MeteogramKey`)
- Modify: `src/lib/meteogram/api.ts` (`HOURLY_VARIABLES`)
- Test: `src/lib/tests/meteogram-api.test.ts`

**Interfaces:**
- Produces: `'relative_humidity_2m'` devient une `MeteogramKey` valide ; `buildForecastUrl()` demande cette variable ; `parseForecast()` renvoie `series.relative_humidity_2m`.

- [ ] **Step 1 : Test rouge — l'URL demande l'humidité**

Dans `src/lib/tests/meteogram-api.test.ts`, dans le `describe('buildForecastUrl')`, ajouter au test existant (après la ligne `expect(url).toContain('is_day');`) :

```ts
		expect(url).toContain('relative_humidity_2m');
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts -t "inclut lat/lng"`
Expected: FAIL (l'URL ne contient pas encore `relative_humidity_2m`).

- [ ] **Step 3 : Ajouter la clé au type**

Dans `src/lib/meteogram/types.ts`, ajouter la clé dans l'union (après `'dew_point_2m'`) :

```ts
export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
	| 'relative_humidity_2m'
	| 'precipitation'
	| 'wind_speed_10m'
	| 'wind_gusts_10m'
	| 'wind_direction_10m'
	| 'pressure_msl'
	| 'weather_code'
	| 'is_day';
```

- [ ] **Step 4 : Ajouter la variable à la requête**

Dans `src/lib/meteogram/api.ts`, `HOURLY_VARIABLES` (après `'dew_point_2m'`) :

```ts
export const HOURLY_VARIABLES: readonly MeteogramKey[] = [
	'temperature_2m',
	'dew_point_2m',
	'relative_humidity_2m',
	'precipitation',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'pressure_msl',
	'weather_code',
	'is_day'
];
```

- [ ] **Step 5 : Lancer les tests API, vérifier le vert**

Run: `npx vitest run src/lib/tests/meteogram-api.test.ts`
Expected: PASS (tous). `parseForecast` indexe déjà défensivement chaque `HOURLY_VARIABLES` → `series.relative_humidity_2m` existe.

- [ ] **Step 6 : Commit**

```bash
npm run format
git add src/lib/meteogram/types.ts src/lib/meteogram/api.ts src/lib/tests/meteogram-api.test.ts
git commit -m "feat(meteogram): demande relative_humidity_2m à l'API forecast"
```

---

## Task 2 : Vent en chiffres + unité respectée (`windDisplay`)

**Files:**
- Modify: `src/lib/meteogram/meteogram-chart.ts` (interface `MeteogramChartInput`, série windbarb : `tooltip.pointFormatter` + `dataLabels`)
- Test: `src/lib/tests/meteogram-chart.test.ts`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `MeteogramChartInput.windDisplay?: { factor: number; unit: string }` (défaut `{ factor: 3.6, unit: 'km/h' }`). La série windbarb affiche des `dataLabels` (vitesse entière convertie) et son tooltip utilise `windDisplay`.

- [ ] **Step 1 : Tests rouges — dataLabels vent + unité configurable**

Dans `src/lib/tests/meteogram-chart.test.ts`, ajouter deux tests dans le `describe('buildChartOptions')` :

```ts
	it('vent : dataLabels activés, vitesse entière convertie (défaut km/h)', () => {
		const o = buildChartOptions(input());
		const barbs = (
			o.series as {
				type?: string;
				dataLabels?: { enabled?: boolean; formatter?: (this: unknown) => string };
			}[]
		).find((s) => s.type === 'windbarb')!;
		expect(barbs.dataLabels?.enabled).toBe(true);
		// point.value en m/s (brut) → 5 × 3,6 = 18
		const label = barbs.dataLabels!.formatter!.call({ point: { value: 5 } });
		expect(label).toBe('18');
	});

	it('vent : windDisplay change unité et facteur (tooltip + dataLabel)', () => {
		const o = buildChartOptions(input({ windDisplay: { factor: 1, unit: 'm/s' } }));
		const barbs = (
			o.series as {
				type?: string;
				dataLabels?: { formatter?: (this: unknown) => string };
				tooltip?: { pointFormatter?: (this: unknown) => string };
			}[]
		).find((s) => s.type === 'windbarb')!;
		expect(barbs.dataLabels!.formatter!.call({ point: { value: 5 } })).toBe('5');
		const rendered = barbs.tooltip!.pointFormatter!.call({
			value: 4.2,
			beaufortLevel: 3,
			color: '#7dd3fc',
			series: { name: 'Vent' }
		});
		expect(rendered).toContain('4,2 m/s');
	});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts -t "vent :"`
Expected: FAIL (`dataLabels` absent ; tooltip figé km/h).

- [ ] **Step 3 : Ajouter `windDisplay` à l'interface**

Dans `src/lib/meteogram/meteogram-chart.ts`, interface `MeteogramChartInput`, ajouter après `units` :

```ts
	/** Unité d'affichage du vent (préférence utilisateur). Défaut km/h.
	 *  La valeur du windbarb reste en m/s (tracé des plumes / Beaufort). */
	windDisplay?: { factor: number; unit: string };
```

- [ ] **Step 4 : Résoudre le défaut dans le builder**

Dans `buildChartOptions`, juste après `const onTimeClick = input.onTimeClick;` :

```ts
	const windDisplay = input.windDisplay ?? { factor: 3.6, unit: 'km/h' };
```

- [ ] **Step 5 : dataLabels sur la série windbarb + tooltip via `windDisplay`**

Dans la série `{ name: 'Vent', type: 'windbarb', … }`, ajouter le bloc `dataLabels` (après `yOffset: -15,`) et réécrire le `pointFormatter` :

```ts
			dataLabels: {
				enabled: true,
				allowOverlap: false,
				// point.value en m/s → converti à l'affichage, entier.
				formatter: function () {
					const p = this as unknown as { point: { value: number } };
					return String(Math.round(p.point.value * windDisplay.factor));
				},
				style: { fontSize: '9px', color: '#7dd3fc', textOutline: 'none', fontWeight: 'normal' },
				y: 16
			},
			tooltip: {
				pointFormatter: function () {
					const p = this as unknown as {
						value: number;
						beaufortLevel?: number;
						color?: string;
						series: { name: string };
					};
					const beaufort =
						p.beaufortLevel !== undefined ? ` (${BEAUFORT_FR[p.beaufortLevel] ?? ''})` : '';
					// p.value reste en m/s ; conversion à l'affichage via windDisplay.
					const speed = (p.value * windDisplay.factor).toFixed(1).replace('.', ',');
					return (
						`<span style="color:${p.color ?? '#7dd3fc'}">●</span> ` +
						`${p.series.name} : <b>${speed} ${windDisplay.unit}</b>${beaufort}<br/>`
					);
				}
			}
```

- [ ] **Step 6 : Lancer les tests chart, vérifier le vert**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: PASS. Le test existant « tooltip 100 % français » reste vert (défaut `3.6`/`km/h` → `15,1 km/h`).

- [ ] **Step 7 : Commit**

```bash
npm run format
git add src/lib/meteogram/meteogram-chart.ts src/lib/tests/meteogram-chart.test.ts
git commit -m "feat(meteogram): vitesse du vent en chiffres près des barbules + tooltip à l'unité de préférence"
```

---

## Task 3 : Légende + police précip + échelle T° auto

**Files:**
- Modify: `src/lib/meteogram/meteogram-chart.ts` (`legend`, `marginTop`, série précip `dataLabels.style`, `yAxis[0]`)
- Test: `src/lib/tests/meteogram-chart.test.ts`

**Interfaces:**
- Produces: `options.legend.enabled === true` ; étiquettes précip en `10px` ; `yAxis[0].tickInterval` non défini (auto).

- [ ] **Step 1 : Tests rouges**

Ajouter dans `describe('buildChartOptions')` :

```ts
	it('légende activée (identifie les courbes)', () => {
		const o = buildChartOptions(input());
		expect((o.legend as { enabled?: boolean }).enabled).toBe(true);
	});

	it('étiquettes de précipitations à 10px (lisibilité)', () => {
		const o = buildChartOptions(input());
		const precip = (
			o.series as { name?: string; dataLabels?: { style?: { fontSize?: string } } }[]
		).find((s) => s.name === 'Précipitations')!;
		expect(precip.dataLabels?.style?.fontSize).toBe('10px');
	});

	it('axe T° auto-adaptable : pas de tickInterval forcé, minRange conservé', () => {
		const o = buildChartOptions(input());
		const tempAxis = (o.yAxis as { tickInterval?: number; minRange?: number }[])[0];
		expect(tempAxis.tickInterval).toBeUndefined();
		expect(tempAxis.minRange).toBe(8);
	});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts -t "légende activée"`
Expected: FAIL.

- [ ] **Step 3 : Activer la légende (thème sombre explicite)**

Dans `buildChartOptions`, remplacer `legend: { enabled: false },` par :

```ts
			legend: {
				enabled: true,
				align: 'center',
				verticalAlign: 'top',
				padding: 4,
				itemMarginTop: 0,
				itemMarginBottom: 0,
				symbolHeight: 8,
				itemStyle: { color: TEXT_STRONG, fontSize: '11px', fontWeight: 'normal' },
				itemHoverStyle: { color: '#ffffff' },
				itemHiddenStyle: { color: 'rgba(255, 255, 255, 0.3)' }
			},
```

- [ ] **Step 4 : Laisser de la place à la légende (marge haute)**

La légende s'affiche dans la marge haute, où sont aussi dessinés les pictos météo. Augmenter `marginTop` dans `chart:` :

```ts
				marginTop: input.compact ? 52 : 60,
```

(Valeur à affiner en headless — Task 8.)

- [ ] **Step 5 : Police des précipitations à 10px**

Dans la série `{ name: 'Précipitations', … }`, `dataLabels.style` :

```ts
					style: { fontSize: '10px', color: TEXT, textOutline: 'none' }
```

- [ ] **Step 6 : Échelle T° auto-adaptable**

Dans `yAxis[0]` (température), **supprimer** la ligne `tickInterval: 1,`. Conserver `maxPadding: 0.3` et `minRange: 8`.

- [ ] **Step 7 : Lancer les tests, vérifier le vert**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: PASS (tous, y compris les tests existants inchangés).

- [ ] **Step 8 : Commit**

```bash
npm run format
git add src/lib/meteogram/meteogram-chart.ts src/lib/tests/meteogram-chart.test.ts
git commit -m "feat(meteogram): légende explicite, police des précip à 10px, échelle T° auto-adaptable"
```

---

## Task 4 : Axe + série d'humidité (Hr)

**Files:**
- Modify: `src/lib/meteogram/meteogram-chart.ts` (interface, `yAxis` → 4 axes, série « Humidité »)
- Test: `src/lib/tests/meteogram-chart.test.ts`

**Interfaces:**
- Consumes: `MeteogramChartInput.humidity?: (number | null)[]`.
- Produces: 4ᵉ `yAxis` (index 3, 0-100 %, `opposite`, `visible: hasHumidity`) ; série spline « Humidité » (`yAxis: 3`, couleur `#c084fc`, `visible`/`showInLegend` selon `hasHumidity`). Ordre des séries : `[Température, Point de rosée, Précipitations, Pression, Humidité, Vent]`.

- [ ] **Step 1 : Mettre à jour les tests structurels + tests humidité**

Dans `src/lib/tests/meteogram-chart.test.ts` :

Remplacer le test `it('déclare 3 axes Y (T°, précip, pression) et 2 axes X liés', …)` par :

```ts
	it('déclare 4 axes Y (T°, précip, pression, humidité)', () => {
		const o = buildChartOptions(input());
		expect(o.yAxis).toHaveLength(4);
	});
```

Remplacer le test `it('série 5 : température, rosée, précip, pression, windbarb — sur le bon axe', …)` par :

```ts
	it('6 séries : température, rosée, précip, pression, humidité, windbarb — sur le bon axe', () => {
		const o = buildChartOptions(input());
		const s = o.series as { type?: string; yAxis?: number; name?: string }[];
		expect(s.map((x) => x.type)).toEqual([
			'spline',
			'spline',
			'column',
			'spline',
			'spline',
			'windbarb'
		]);
		expect(s[2].yAxis).toBe(1); // précip
		expect(s[3].yAxis).toBe(2); // pression
		expect(s[4].yAxis).toBe(3); // humidité
	});
```

Ajouter les tests humidité :

```ts
	it('humidité fournie : axe (0-100) et série visibles', () => {
		const o = buildChartOptions(input({ humidity: [40, 55, 60, 45] }));
		const humAxis = (o.yAxis as { min?: number; max?: number; visible?: boolean }[])[3];
		expect(humAxis.min).toBe(0);
		expect(humAxis.max).toBe(100);
		expect(humAxis.visible).not.toBe(false);
		const hum = (o.series as { name?: string; visible?: boolean }[]).find(
			(x) => x.name === 'Humidité'
		)!;
		expect(hum.visible).not.toBe(false);
	});

	it('humidité absente/nulle : axe et série masqués (bonus abandonnable)', () => {
		const o = buildChartOptions(input()); // pas de humidity
		expect((o.yAxis as { visible?: boolean }[])[3].visible).toBe(false);
		const hum = (o.series as { name?: string; visible?: boolean }[]).find(
			(x) => x.name === 'Humidité'
		)!;
		expect(hum.visible).toBe(false);
	});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts -t "humidité"`
Expected: FAIL (série/axe humidité inexistants ; longueurs 3/5).

- [ ] **Step 3 : Résoudre humidité + `hasHumidity` dans le builder**

Après `const hasPressure = …`, ajouter :

```ts
	const humidity = input.humidity ?? [];
	const humidityData = xs.map((x, i) => [x, at(humidity, i)]);
	const hasHumidity = humidity.some((v) => v !== null && Number.isFinite(v));
```

- [ ] **Step 4 : Ajouter le 4ᵉ axe Y (humidité)**

Dans `yAxis: [ … ]`, après l'axe pression (index 2), ajouter l'axe humidité (index 3) :

```ts
				{
					// Humidité relative (0-100 %)
					visible: hasHumidity,
					min: 0,
					max: 100,
					tickInterval: 50, // 0 / 50 / 100 seulement (limiter l'encombrement à droite)
					title: {
						text: hasHumidity ? '%' : undefined,
						offset: 0,
						align: 'high',
						rotation: 0,
						style: { fontSize: '10px', color: '#c084fc' },
						textAlign: 'right',
						x: -3
					},
					labels: { style: { fontSize: '8px', color: '#c084fc' }, x: -3 },
					gridLineWidth: 0,
					opposite: true,
					showLastLabel: false
				}
```

- [ ] **Step 5 : Ajouter la série humidité (entre pression et vent)**

Dans `series: [ … ]`, **entre** la série `Pression` et la série `Vent` :

```ts
				{
					name: 'Humidité',
					visible: hasHumidity,
					showInLegend: hasHumidity,
					data: humidityData,
					type: 'spline',
					marker: { enabled: false },
					lineWidth: 1,
					color: '#c084fc',
					yAxis: 3,
					tooltip: { valueSuffix: ' %' }
				},
```

- [ ] **Step 6 : Lancer les tests chart, vérifier le vert**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: PASS (tous).

- [ ] **Step 7 : Commit**

```bash
npm run format
git add src/lib/meteogram/meteogram-chart.ts src/lib/tests/meteogram-chart.test.ts
git commit -m "feat(meteogram): courbe d'humidité relative sur un 4e axe (visible par défaut, masquée si absente)"
```

---

## Task 5 : Axe temps fusionné (heures + dates)

**Files:**
- Modify: `src/lib/meteogram/meteogram-chart.ts` (export helper `dayBoundaryPlotLines`, `xAxis` unique)
- Test: `src/lib/tests/meteogram-chart.test.ts`

**Interfaces:**
- Produces: `dayBoundaryPlotLines(times: Date[], timezone: string)` — export nommé ; `options.xAxis` a **1 seul** axe portant `plotLines` (séparateurs de jour aux minuits locaux) et un `labels.formatter` (date en gras à minuit, heure sinon).

- [ ] **Step 1 : Tests rouges — 1 axe X + helper de séparateurs**

Importer le helper en tête du fichier de test :

```ts
import {
	type MeteogramChartInput,
	buildChartOptions,
	dayBoundaryPlotLines
} from '$lib/meteogram/meteogram-chart';
```

Remplacer le test existant `it('grille horaire : 2 h sur horizon court…')` **uniquement sur sa 1ʳᵉ assertion d'axe** n'est pas nécessaire — il lit `xAxis[0]`, toujours valide. Ajouter les nouveaux tests :

```ts
	it('un seul axe X, avec séparateurs de jour (plotLines)', () => {
		const o = buildChartOptions(input());
		expect(o.xAxis).toHaveLength(1);
		const axis = (o.xAxis as { plotLines?: unknown[] }[])[0];
		expect(Array.isArray(axis.plotLines)).toBe(true);
	});

	it('dayBoundaryPlotLines : un trait à chaque minuit local (premier point exclu)', () => {
		// 50 h horaires depuis minuit UTC, fuseau UTC → minuits à h=24 et h=48.
		const times = Array.from({ length: 50 }, (_, h) => new Date(Date.UTC(2026, 6, 10) + h * 36e5));
		const lines = dayBoundaryPlotLines(times, 'UTC');
		expect(lines.map((l) => l.value)).toEqual([Date.UTC(2026, 6, 11), Date.UTC(2026, 6, 12)]);
	});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts -t "axe X"`
Expected: FAIL (import `dayBoundaryPlotLines` introuvable ; `xAxis` longueur 2).

- [ ] **Step 3 : Écrire le helper pur `dayBoundaryPlotLines`**

Dans `src/lib/meteogram/meteogram-chart.ts`, **avant** `buildChartOptions` (après les constantes couleur) :

```ts
/**
 * Séparateurs de jour : un trait vertical à chaque **minuit local**. On repère
 * les pas dont l'heure locale (fuseau du point) vaut « 00 » — le premier point
 * est exclu (pas de trait au bord gauche). Offsets entiers (France/Europe) : le
 * pas horaire tombe pile sur minuit local. Edge case fuseaux non-entiers (Inde
 * +5:30) : léger désalignement, accepté (cohérent avec la limite DST connue).
 */
export function dayBoundaryPlotLines(
	times: Date[],
	timezone: string
): { value: number; color: string; width: number; zIndex: number }[] {
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: timezone,
		hour: '2-digit',
		hour12: false
	});
	const lines: { value: number; color: string; width: number; zIndex: number }[] = [];
	times.forEach((t, i) => {
		if (i === 0) return;
		const hh = fmt.format(t); // '00'..'23' (certaines impl : '24' à minuit)
		if (hh === '00' || hh === '24') {
			lines.push({ value: t.getTime(), color: GRID_DAY, width: 1, zIndex: 1 });
		}
	});
	return lines;
}
```

- [ ] **Step 4 : Fusionner l'axe X (supprimer l'axe date du haut)**

Remplacer **tout** le bloc `xAxis: [ … ] as XAxisOptions[],` (les deux axes) par un axe unique :

```ts
			xAxis: [
				{
					type: 'datetime',
					tickInterval,
					minorGridLineWidth: 0,
					tickLength: 0,
					lineColor: AXIS,
					tickColor: AXIS,
					gridLineWidth: 1,
					gridLineColor: GRID,
					startOnTick: false,
					endOnTick: false,
					minPadding: 0,
					maxPadding: 0,
					offset: 30,
					showLastLabel: true,
					crosshair: { width: 1, color: 'rgba(255, 255, 255, 0.25)' },
					// Séparateurs de jour (l'ancien 2ᵉ axe « opposite » est supprimé).
					plotLines: dayBoundaryPlotLines(input.times, input.timezone),
					labels: {
						style: { color: TEXT },
						// Heure (%H) par défaut ; à minuit local, la date en gras (cadre allégé).
						formatter: function () {
							const ctx = this as unknown as {
								value: number;
								axis: { chart: { time: { dateFormat(f: string, t: number): string } } };
							};
							const time = ctx.axis.chart.time;
							const hh = time.dateFormat('%H', ctx.value);
							return hh === '00'
								? time.dateFormat('<span style="font-weight: bold">%a %e %b</span>', ctx.value)
								: hh;
						}
					}
				}
			] as XAxisOptions[],
```

- [ ] **Step 5 : Lancer les tests chart, vérifier le vert**

Run: `npx vitest run src/lib/tests/meteogram-chart.test.ts`
Expected: PASS. Le test « grille horaire 2h/6h » lit `xAxis[0]` → toujours valide (tickInterval, minorGridLineWidth, lineColor, tickColor présents).

- [ ] **Step 6 : Commit**

```bash
npm run format
git add src/lib/meteogram/meteogram-chart.ts src/lib/tests/meteogram-chart.test.ts
git commit -m "feat(meteogram): axe temps fusionné — heures + date à minuit, séparateurs de jour en plotLines"
```

---

## Task 6 : Câblage Svelte (humidité + windDisplay dans l'input)

**Files:**
- Modify: `src/lib/components/point-workspace/meteogram/meteogram.svelte` (objet `input` de l'`$effect` de création du chart)

**Interfaces:**
- Consumes: `MeteogramChartInput.humidity` et `.windDisplay` (Tasks 2 & 4). `convertValue`/`getDisplayUnit` déjà importés (`$lib/stores/units`).

Pas de test Vitest (composant Svelte, env node sans DOM) — vérification par typecheck + build, puis headless en Task 8.

- [ ] **Step 1 : Ajouter humidité + windDisplay à l'input**

Dans `src/lib/components/point-workspace/meteogram/meteogram.svelte`, dans l'objet `const input = { … }` de l'`$effect` de (re)création du chart, ajouter `humidity` (après `pressure:`) et `windDisplay` (après le bloc `units: { … },`) :

```ts
			humidity: seriesValues('relative_humidity_2m'),
```

```ts
			windDisplay: {
				// Conversions vitesse purement multiplicatives (m/s→km/h ×3,6, →mph, →kn) :
				// le facteur = conversion de 1 m/s dans l'unité choisie.
				factor: convertValue(1, 'm/s', $unitPreferences),
				unit: getDisplayUnit('m/s', $unitPreferences)
			},
```

- [ ] **Step 2 : Typecheck**

Run: `npm run check`
Expected: PASS (0 erreur). `seriesValues('relative_humidity_2m')` compile (clé désormais dans `MeteogramKey`).

- [ ] **Step 3 : Build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 4 : Commit**

```bash
npm run format
git add src/lib/components/point-workspace/meteogram/meteogram.svelte
git commit -m "feat(meteogram): alimente la courbe d'humidité et l'unité de vent des préférences"
```

---

## Task 7 : Clic droit → bulle enrichie (popup + CSS)

**Files:**
- Modify: `src/lib/popup.ts` (`initPopupDiv` : spans coords/altitude ; `updatePopupContent` : classe `.popup--pinned` + contenu enrichi ; `addPopup` : handler `contextmenu`)
- Modify: `src/styles.css` (styles enrichis)

**Interfaces:**
- Consumes: stores `popupMode`, `p`, `terraDrawActive`, fonctions `renderPopup`, `updatePopup` (existantes).

Pas de test Vitest (DOM/MapLibre) — vérification typecheck + build, puis headless en Task 8.

- [ ] **Step 1 : Déclarer les nouveaux éléments de la bulle**

Dans `src/lib/popup.ts`, ajouter les variables module (près de `let elevationSpan …`) :

```ts
let pointInfoDiv: HTMLDivElement | undefined;
let coordsSpan: HTMLSpanElement | undefined;
let altSpan: HTMLSpanElement | undefined;
```

Dans `initPopupDiv()`, après l'ajout de `contentDiv` au `wrapperDiv` (ligne `wrapperDiv.append(contentDiv);`) et **avant** la création de `soundingBtn`, insérer le bloc d'infos point :

```ts
	pointInfoDiv = document.createElement('div');
	pointInfoDiv.classList.add('popup-point-info');
	coordsSpan = document.createElement('span');
	coordsSpan.classList.add('popup-coords');
	altSpan = document.createElement('span');
	altSpan.classList.add('popup-alt');
	pointInfoDiv.append(coordsSpan);
	pointInfoDiv.append(altSpan);
	wrapperDiv.append(pointInfoDiv);
```

- [ ] **Step 2 : Enrichir la bulle à l'état épinglé**

Dans `updatePopupContent`, juste après le calcul de `const pinned = get(popupMode) === 'drag';`, piloter la classe et le bloc infos :

```ts
	el?.classList.toggle('popup--pinned', pinned);
	if (pointInfoDiv) pointInfoDiv.style.display = pinned ? '' : 'none';
	// En suivi, l'altitude compacte reste dans la ligne viseur ; épinglée, elle
	// passe dans le bloc infos (plus lisible) → on masque la version compacte.
	if (elevationSpan) elevationSpan.style.display = pinned ? 'none' : '';
	if (coordsSpan) {
		coordsSpan.innerText = `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
	}
```

Puis, là où l'altitude est calculée (après `const hasElevation = …`), renseigner `altSpan` (le `elevationSpan` compact reste géré comme aujourd'hui) — ajouter immédiatement après la ligne `const hasElevation = …;` :

```ts
	if (altSpan) altSpan.innerText = hasElevation ? `Alt. ${Math.round(elevation)} m` : 'Alt. —';
```

- [ ] **Step 3 : Handler clic droit dans `addPopup`**

Dans `addPopup()`, après le `map.on('click', …)` existant, ajouter :

```ts
	// Clic droit : épingle directement la bulle enrichie (altitude/coords lisibles
	// + bouton Météogramme visible) en 1 geste, au lieu des 3 clics gauche
	// (follow → pin → bouton). Desktop uniquement (pas d'event contextmenu tactile).
	map.on('contextmenu', async (e: maplibregl.MapLayerMouseEvent) => {
		if (!map || get(terraDrawActive)) return;
		e.preventDefault();
		map.off('mousemove', updatePopup); // épinglé : la bulle ne suit pas le curseur
		const existing = get(p);
		if (existing) {
			existing.remove(); // marker frais → recréé draggable en mode 'drag'
			p.set(undefined);
		}
		popupMode.set('drag');
		await renderPopup(e.lngLat);
	});
```

- [ ] **Step 4 : Styles de la bulle enrichie**

Dans `src/styles.css`, après le bloc `.popup-elevation { … }` (avant `.popup-sounding-btn`), ajouter :

```css
.popup--pinned {
	height: auto;
}

.popup-point-info {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1px;
	padding: 3px 6px 0;
	font-size: 0.72rem;
	font-weight: 600;
	color: black;
	text-align: center;
}

.dark .popup-point-info {
	color: white;
}

.popup-coords {
	font-variant-numeric: tabular-nums;
	opacity: 0.85;
}

.popup-alt {
	opacity: 0.95;
}
```

- [ ] **Step 5 : Typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS + build réussi.

- [ ] **Step 6 : Commit**

```bash
npm run format
git add src/lib/popup.ts src/styles.css
git commit -m "feat(popup): clic droit ouvre une bulle épinglée enrichie (coordonnées + altitude lisible)"
```

---

## Task 8 : Vérification complète (lint/tests/build + headless)

**Files:** aucun (validation ; corrections mineures éventuelles).

- [ ] **Step 1 : Suite complète**

Run: `npx vitest run && npm run check && rtk proxy npm run lint && npm run build`
Expected: tests verts, 0 erreur type, lint OK (via `rtk proxy` — évite le faux « OK » caché, cf. mémoire `rtk-caches-lint-output`), build réussi.

- [ ] **Step 2 : Vérif headless desktop**

Suivre le pattern `headless-map-verification` (playwright-core + Chrome système + swiftshader ; seed localStorage). Ouvrir l'app sur un domaine à météogramme (ex. `meteofrance_arome_france_hd` ou `ecmwf_ifs025`), puis :

- **Clic droit** sur la carte → la bulle s'épingle immédiatement, affiche coordonnées (4 déc.) + « Alt. N m » lisibles + bouton « Météogramme ».
- Cliquer « Météogramme » → le tiroir s'ouvre.
- Dans le chart, vérifier : **légende** présente et lisible (identifie Température/Point de rosée/Précipitations/Pression/Humidité/Vent) ; **vitesse du vent en chiffres** sous les barbules ; **humidité** (courbe violette) lisible et non chevauchée avec l'axe pression ; **axe temps unique** avec date en gras à minuit + séparateurs de jour ; étiquettes de précip lisibles.

Capturer un PNG de contrôle dans le scratchpad.

- [ ] **Step 3 : Vérif headless mobile (375 px)**

Recharger en viewport 375 px (le WM ignore `resize_window` MCP → headless obligatoire, cf. mémoire). Vérifier que la **légende n'écrase pas** la zone de tracé (le chart mobile est déjà à marges resserrées) et que l'axe humidité à droite ne rend pas le graphe illisible.

- [ ] **Step 4 : Décision humidité (bonus abandonnable)**

Si l'humidité (4ᵉ axe) **dégrade la lisibilité globale** (chevauchement des deux axes droite, chart mobile illisible, légende trop chargée) → la **retirer** : passer `visible: false`/`showInLegend: false` inconditionnels sur l'axe et la série humidité (ou revert de la Task 4), tout en gardant le reste. Sinon, la conserver. Documenter la décision dans le message de commit / la PR.

- [ ] **Step 5 : Ajuster `marginTop` si besoin**

Si la légende chevauche les pictos météo ou le haut de la courbe de T° (Task 3 Step 4), ajuster `marginTop` (`meteogram-chart.ts`) et re-vérifier headless. Commit si modifié.

- [ ] **Step 6 : Mettre à jour la doc si l'architecture a bougé**

Le `.claude/rules/architecture.md` décrit « 3 axes Y », le tooltip vent, l'axe temps à deux niveaux. Mettre à jour la section « Meteogram / Espace point » (4 axes Y, axe temps fusionné, vent chiffré à l'unité de préférence, humidité). Commit.

- [ ] **Step 7 : Finaliser la branche**

Invoquer le skill `superpowers:finishing-a-development-branch` (merge / PR / cleanup).

---

## Self-Review (auteur)

**Couverture spec :**
- Bloc 1 (clic droit + bulle enrichie) → Task 7. ✓
- Bloc 2a (légende) → Task 3 ; 2b (humidité) → Tasks 1+4+6 ; 2c (vent chiffré + unité) → Tasks 2+6. ✓
- Bloc 3 (axe temps fusionné) → Task 5. ✓
- Bloc 4 (police précip, T° auto, altitude lisible) → Task 3 + Task 7. ✓
- Humidité abandonnable → Task 8 Step 4. ✓
- Tests (api + chart) → Tasks 1-5 ; headless → Task 8. ✓

**Placeholders :** aucun « TBD/TODO » ; tout step de code porte le code réel.

**Cohérence des types :** `MeteogramChartInput` (humidity?, windDisplay?) définie une fois en tête, consommée identiquement (Tasks 2, 4, 6). `dayBoundaryPlotLines` : même signature à la définition (Task 5 Step 3) et à l'usage (Step 4) et au test (Step 1). Ordre des séries (index yAxis 1/2/3) cohérent entre Task 4 (définition) et les assertions.

**Note d'ordonnancement :** les Tasks 2→5 modifient toutes `meteogram-chart.ts` et son test — séquentielles, chaque tâche laissant la suite verte. Les tests structurels (`déclare N axes Y`, `série N`) sont réécrits dans la tâche qui change la structure (Task 4 pour yAxis/séries, Task 5 pour xAxis).
