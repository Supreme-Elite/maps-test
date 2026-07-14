<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';

	import { desktop } from '$lib/stores/preferences';
	import { metaJson, time } from '$lib/stores/time';
	import { convertValue, getDisplayUnit, unitPreferences } from '$lib/stores/units';
	import { selectedDomain } from '$lib/stores/variables';

	import { fetchMeteogram } from '$lib/meteogram/api';
	import { type ExportableChart, renderMeteogramExport } from '$lib/meteogram/export-image';
	import { INFOCLIMAT_LOGO_DATA_URI } from '$lib/meteogram/infoclimat-logo';
	import { buildChartOptions } from '$lib/meteogram/meteogram-chart';
	import { resolveApiModel } from '$lib/meteogram/model-map';
	import { nearestValidTime } from '$lib/meteogram/snap';
	import { symbolForWmo } from '$lib/meteogram/weather-symbols';
	import { goToValidTime } from '$lib/time-navigation';

	import type { MeteogramData, MeteogramKey } from '$lib/meteogram/types';
	import type Highcharts from 'highcharts';
	import type { Chart } from 'highcharts';

	// `elevation` (bindable) : altitude du point selon le modèle, publiée vers le
	// tiroir (affichée dans l'en-tête). L'API terrain de la carte n'étant pas
	// fiable sans DEM chargé, on prend l'altitude fournie par l'API forecast.
	let {
		lat,
		lng,
		elevation = $bindable(null)
	}: { lat: number; lng: number; elevation?: number | null } = $props();

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

	// Publie l'altitude (modèle) vers le tiroir dès que les données arrivent.
	$effect(() => {
		elevation = data?.elevation ?? null;
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
	// Écart brief : les typings v12.6.0 ne déclarent pas de `default` sur le
	// namespace de `typeof import('highcharts')` (bug de packaging des .d.ts,
	// le runtime UMD expose bien `.default`) — on nomme donc la forme réelle via
	// un import de type par défaut (`import type Highcharts from 'highcharts'`,
	// ligne 17) et on caste l'objet renvoyé par `import()` en conséquence.
	let hcPromise: Promise<typeof Highcharts> | undefined;
	function loadHighcharts() {
		hcPromise ??= (async () => {
			const mod = (await import('highcharts')) as unknown as { default: typeof Highcharts };
			const hc = mod.default;
			// `windbarb` référence en interne `Highcharts.dataGrouping.approximations`
			// (série héritée d'arearange) : le module `datagrouping` doit être
			// chargé AVANT `windbarb`, sinon `G.dataGrouping` reste `undefined` et
			// l'accès à `.approximations` explose au premier rendu du chart.
			await import('highcharts/modules/datagrouping');
			await import('highcharts/modules/windbarb');
			await import('highcharts/modules/exporting');
			await import('highcharts/modules/offline-exporting');
			// `locale: 'fr'` couvre dates/nombres (Intl) mais pas les libellés d'UI
			// (bouton « Reset zoom » du zoom X) — traduits explicitement.
			hc.setOptions({
				lang: {
					locale: 'fr',
					resetZoom: 'Réinitialiser le zoom',
					resetZoomTitle: 'Revenir à l’échelle initiale'
				}
			});
			return hc;
		})();
		return hcPromise;
	}

	/** Icônes météo au-dessus de la courbe de T°, redessinées à chaque render
	 *  (zoom, resize, scroll) — le groupe précédent est détruit d'abord.
	 *  Stride adaptatif : 1 sur 2 sur horizon court, plafonné à ~28 icônes sur
	 *  horizon long (l'API renvoie jusqu'à 7 jours — sinon elles se chevauchent). */
	function drawSymbols(c: Chart, d: MeteogramData) {
		type ChartWithSymbols = Chart & { __symbolsGroup?: { destroy(): void } };
		const cc = c as ChartWithSymbols;
		cc.__symbolsGroup?.destroy();
		const group = c.renderer.g('weather-symbols').attr({ zIndex: 5 }).add();
		const codes = d.series.weather_code ?? [];
		const days = d.series.is_day ?? [];
		const stride = Math.max(2, Math.ceil(d.times.length / 28));
		c.series[0].data.forEach((point, i) => {
			if (i % stride !== 0) return;
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

	// (Re)création du chart quand les données — ou les unités — changent.
	$effect(() => {
		const d = data;
		const el = chartEl;
		if (!d || !el) {
			// Détruit tout chart encore vivant hors DOM (ex. rechargement :
			// `data` repasse à null et le conteneur quitte le markup).
			chart?.destroy();
			chart = undefined;
			return;
		}
		// L'entrée du chart (séries converties + unités) est construite de façon
		// SYNCHRONE, avant tout `await` : `$unitPreferences` (lu par
		// convertSeries/getDisplayUnit) reste ainsi dans la fenêtre de tracking
		// de l'effet — un changement d'unité (°C→°F…) re-crée bien le chart.
		const input = {
			times: d.times,
			temperature: convertSeries('temperature_2m', '°C'),
			dewPoint: convertSeries('dew_point_2m', '°C'),
			precipitation: convertSeries('precipitation', 'mm'),
			pressure: convertSeries('pressure_msl', 'hPa'),
			humidity: seriesValues('relative_humidity_2m'),
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
			windDisplay: {
				// Conversions vitesse purement multiplicatives (m/s→km/h ×3,6, →mph, →kn) :
				// le facteur = conversion de 1 m/s dans l'unité choisie.
				factor: convertValue(1, 'm/s', $unitPreferences),
				unit: getDisplayUnit('m/s', $unitPreferences)
			},
			timezone: d.timezone,
			compact: !desktop.current,
			onTimeClick: seek
		};
		let cancelled = false;
		(async () => {
			const hc = await loadHighcharts();
			if (cancelled) return;
			chart?.destroy();
			const options = buildChartOptions(input);
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

	// Le chart Highcharts ne se recale que sur `resize` de la fenêtre — pas quand
	// le tiroir est redimensionné (drag de la poignée) ni au montage flex. On
	// observe donc le conteneur et on `reflow()` pour que le graphe occupe toute
	// la hauteur disponible et grandisse avec le tiroir.
	$effect(() => {
		const el = chartEl;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => chart?.reflow());
		ro.observe(el);
		return () => ro.disconnect();
	});

	$effect(() => () => {
		chart?.destroy();
		chart = undefined;
	});

	/** Export PNG « carte de visite » — appelé par le tiroir via bind:this.
	 *  Composition canvas (graphe + pied logo/contexte) dans `export-image.ts`. */
	export const exportPng = async (filename: string) => {
		if (!chart) return;
		await renderMeteogramExport({
			chart: chart as unknown as ExportableChart,
			model: get(selectedDomain).label ?? get(selectedDomain).value,
			lat,
			lng,
			date: new Date(),
			logoDataUri: INFOCLIMAT_LOGO_DATA_URI,
			filename
		});
	};

	const SKELETON_ROWS = Array.from({ length: 3 });
</script>

<div class="flex h-full flex-col py-2">
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
		<div bind:this={chartEl} class="min-h-[300px] w-full flex-1"></div>
	{/if}
</div>
