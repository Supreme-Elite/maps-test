<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';

	import { metaJson, time } from '$lib/stores/time';
	import { convertValue, getDisplayUnit, unitPreferences } from '$lib/stores/units';
	import { selectedDomain } from '$lib/stores/variables';

	import { fetchMeteogram } from '$lib/meteogram/api';
	import { resolveApiModel } from '$lib/meteogram/model-map';
	import { timeToX } from '$lib/meteogram/scales';
	import { nearestValidTime } from '$lib/meteogram/snap';
	import { formatUTCDateTime } from '$lib/time-format';
	import { goToValidTime } from '$lib/time-navigation';

	import { PANEL_PAD } from './panel-types';
	import Panel from './panel.svelte';
	import WindDirection from './wind-direction.svelte';

	import type { MeteogramData, MeteogramKey } from '$lib/meteogram/types';
	import type { PanelSeries } from './panel-types';

	let { lat, lng }: { lat: number; lng: number } = $props();

	let data = $state<MeteogramData | null>(null);
	let loading = $state(false);
	let error = $state<'rate-limit' | 'network' | 'empty' | null>(null);
	let hoverIndex = $state<number | null>(null);
	let containerWidth = $state(0);

	// Mémoïsation de session : une seule requête par (point, modèle), y compris
	// en ré-épinglant plusieurs fois le même point. Perdue au rechargement (MVP).
	const cache = new SvelteMap<string, MeteogramData>();
	let controller: AbortController | undefined;

	// Réactif au domaine sélectionné : un changement de modèle doit déclencher
	// un refetch même si le point reste le même (spec §1 « Point clé quotas »).
	const model = $derived(resolveApiModel($selectedDomain.value));

	async function load() {
		// Capturée en tête de fonction, avant tout `await`, pour qu'un chargement
		// en vol reste cohérent avec le modèle qui l'a déclenché — un changement
		// de modèle pendant l'attente relance `load()` via l'effet et abandonne
		// celui-ci plutôt que de le faire dériver vers la nouvelle valeur.
		const currentModel = model;

		// Annule systématiquement toute requête en vol — y compris quand cet
		// appel se résout depuis le cache — sinon une ancienne requête encore en
		// vol pour un autre point pourrait écraser `data` après coup.
		controller?.abort();
		controller = undefined;

		if (!currentModel) {
			// Le bouton déclencheur (popup) ne devrait pas apparaître sur un
			// domaine non mappé — garde défensive si le composant est monté
			// quand même.
			data = null;
			error = null;
			loading = false;
			return;
		}

		const key = `${lat.toFixed(3)},${lng.toFixed(3)},${currentModel}`;
		const cached = cache.get(key);
		if (cached) {
			data = cached;
			hoverIndex = null; // évite un crosshair déréférençant un index d'une série précédente plus longue
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
			if (controller !== ac) return; // supplantée entre-temps
			if (d.times.length === 0) {
				error = 'empty';
			} else {
				cache.set(key, d);
				data = d;
				hoverIndex = null; // idem : nouvelle série, ancien hoverIndex potentiellement hors bornes
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			if (controller !== ac) return;
			error = (e as Error).message === 'rate-limit' ? 'rate-limit' : 'network';
		} finally {
			if (controller === ac) loading = false;
		}
	}

	// Recharge au changement de point ou de modèle — jamais sur le scrub du temps
	// ($time n'est volontairement pas lu ici, toute la série est déjà chargée).
	$effect(() => {
		void lat;
		void lng;
		void model;
		load();
	});

	// Playhead = échéance carte projetée, réactif au scrub sans le moindre refetch.
	const playheadTime = $derived($time ? new Date($time) : null);

	function seek(t: Date) {
		const validTimes = get(metaJson)?.valid_times?.map((v) => new Date(v)) ?? [];
		goToValidTime(nearestValidTime(t, validTimes) ?? t);
	}

	// Indexation défensive sur `times` : `parseForecast` peut renvoyer un
	// tableau plus court (voire vide, `[]`) pour une variable absente de la
	// réponse API — jamais `undefined` en sortie, toujours `null`.
	function seriesValues(key: MeteogramKey): (number | null)[] {
		const raw = data?.series[key] ?? [];
		return (data?.times ?? []).map((_, i) => raw[i] ?? null);
	}

	function convertSeries(key: MeteogramKey, baseUnit: string): (number | null)[] {
		return seriesValues(key).map((v) =>
			v === null || !Number.isFinite(v) ? null : convertValue(v, baseUnit, $unitPreferences, key)
		);
	}

	// Largeur effective des panneaux SVG, mesurée sur le conteneur ; plancher
	// pour éviter une échelle dégénérée avant la première mesure du ResizeObserver.
	const panelWidth = $derived(Math.max(containerWidth, 240));
	const PANEL_HEIGHT = 110;

	// Partage `PANEL_PAD` avec panel.svelte : la bande de direction du vent
	// partage l'axe temps du panneau vent, mais panel.svelte n'expose pas son
	// échelle x en dehors de son propre SVG.
	const windX = $derived(timeToX(data?.times ?? [], panelWidth, PANEL_PAD.left, PANEL_PAD.right));

	const tempUnit = $derived(getDisplayUnit('°C', $unitPreferences, 'temperature_2m'));
	const windUnit = $derived(getDisplayUnit('m/s', $unitPreferences, 'wind_speed_10m'));
	const precipUnit = $derived(getDisplayUnit('mm', $unitPreferences, 'precipitation'));
	const pressureUnit = $derived(getDisplayUnit('hPa', $unitPreferences, 'pressure_msl'));
	const capeUnit = $derived(getDisplayUnit('J/kg', $unitPreferences, 'cape'));

	const handleHover = (i: number | null) => (hoverIndex = i);

	// Heure survolée (UTC), affichée une fois en haut du meteogram.
	const hoverTime = $derived(
		hoverIndex !== null && data && hoverIndex < data.times.length ? data.times[hoverIndex] : null
	);

	const SKELETON_ROWS = Array.from({ length: 4 });
</script>

<div bind:clientWidth={containerWidth} class="flex flex-col gap-3 py-2">
	{#if loading}
		<div class="flex flex-col gap-3" aria-hidden="true">
			{#each SKELETON_ROWS as _, i (i)}
				<div class="h-[110px] w-full animate-pulse rounded bg-white/5"></div>
			{/each}
		</div>
	{:else if error === 'rate-limit'}
		<p class="p-4 text-sm text-rose-300">
			Limite de requêtes atteinte auprès d'Open-Meteo. Réessayez dans un instant.
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
		{@const meteo = data}
		<div
			class="bg-glass/80 glass-blur sticky top-0 z-10 -mx-2 mb-1 px-3 py-1 text-[11px] tabular-nums text-white/80"
		>
			{#if hoverTime}
				{formatUTCDateTime(hoverTime)}Z
			{:else}
				<span class="text-white/40">Survolez un panneau pour lire les valeurs</span>
			{/if}
		</div>
		<Panel
			title="Température"
			times={meteo.times}
			width={panelWidth}
			height={PANEL_HEIGHT}
			series={[
				{
					key: 'apparent_temperature',
					values: convertSeries('apparent_temperature', '°C'),
					color: 'rgba(255,255,255,0.35)'
				},
				{
					key: 'dew_point_2m',
					values: convertSeries('dew_point_2m', '°C'),
					color: '#38bdf8',
					dash: '4 3'
				},
				{ key: 'temperature_2m', values: convertSeries('temperature_2m', '°C'), color: '#fbbf24' }
			] as PanelSeries[]}
			unitLabel={tempUnit}
			{playheadTime}
			{hoverIndex}
			onHover={handleHover}
			onSeek={seek}
		/>

		<Panel
			title="Précipitations"
			times={meteo.times}
			width={panelWidth}
			height={PANEL_HEIGHT}
			series={[
				{
					key: 'precipitation',
					values: convertSeries('precipitation', 'mm'),
					color: '#38bdf8',
					kind: 'bar'
				},
				{
					key: 'precipitation_probability',
					values: seriesValues('precipitation_probability'),
					color: '#34d399'
				}
			] as PanelSeries[]}
			unitLabel={`${precipUnit} · %`}
			{playheadTime}
			{hoverIndex}
			onHover={handleHover}
			onSeek={seek}
		/>

		<Panel
			title="Vent"
			times={meteo.times}
			width={panelWidth}
			height={PANEL_HEIGHT}
			series={[
				{
					key: 'wind_gusts_10m',
					values: convertSeries('wind_gusts_10m', 'm/s'),
					color: '#fb7185',
					dash: '4 3'
				},
				{ key: 'wind_speed_10m', values: convertSeries('wind_speed_10m', 'm/s'), color: '#38bdf8' }
			] as PanelSeries[]}
			unitLabel={windUnit}
			{playheadTime}
			{hoverIndex}
			onHover={handleHover}
			onSeek={seek}
		/>
		<div class="text-white/60">
			<WindDirection
				times={meteo.times}
				directions={seriesValues('wind_direction_10m')}
				width={panelWidth}
				x={windX}
			/>
		</div>

		<Panel
			title="Avancés"
			times={meteo.times}
			width={panelWidth}
			height={PANEL_HEIGHT}
			series={[
				{
					key: 'cloud_cover_low',
					values: seriesValues('cloud_cover_low'),
					color: 'rgba(56,189,248,0.35)'
				},
				{
					key: 'cloud_cover_mid',
					values: seriesValues('cloud_cover_mid'),
					color: 'rgba(56,189,248,0.65)',
					dash: '2 2'
				},
				{
					key: 'cloud_cover_high',
					values: seriesValues('cloud_cover_high'),
					color: 'rgba(56,189,248,0.9)',
					dash: '6 3'
				},
				{ key: 'cape', values: convertSeries('cape', 'J/kg'), color: '#fb7185' },
				{ key: 'pressure_msl', values: convertSeries('pressure_msl', 'hPa'), color: '#fbbf24' }
			] as PanelSeries[]}
			unitLabel={`${pressureUnit} · % · ${capeUnit}`}
			{playheadTime}
			{hoverIndex}
			onHover={handleHover}
			onSeek={seek}
		/>
	{/if}
</div>
