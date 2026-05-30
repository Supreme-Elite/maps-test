<script lang="ts">
	import { get } from 'svelte/store';

	import * as maplibregl from 'maplibre-gl';

	import { map as mapStore } from '$lib/stores/map';
	import { sounding } from '$lib/stores/sounding';
	import { time } from '$lib/stores/time';

	import { fetchColumn } from '$lib/sounding/column';
	import { computeIndices } from '$lib/sounding/indices';
	import { liftParcel } from '$lib/sounding/parcel';

	import Hodograph from './hodograph.svelte';
	import IndicesTable from './indices-table.svelte';
	import SkewT from './skew-t.svelte';

	import type { ColumnProfile, ParcelResult, SoundingIndices } from '$lib/sounding/types';

	let profile = $state<ColumnProfile | null>(null);
	let parcel = $state<ParcelResult | null>(null);
	let indices = $state<SoundingIndices | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let generation = 0;

	async function load(lat: number, lng: number) {
		const myGen = ++generation;
		loading = true;
		error = null;
		try {
			const map = get(mapStore);
			const rawElev = map?.queryTerrainElevation(new maplibregl.LngLat(lng, lat));
			const elev = typeof rawElev === 'number' && isFinite(rawElev) ? rawElev : 0;
			const col = await fetchColumn(lat, lng, elev);
			if (myGen !== generation) return;
			if (col.levels.length < 3) {
				error = 'Pas assez de données à ce point.';
				profile = null;
				return;
			}
			profile = col;
			parcel = liftParcel(col.surface, col.levels);
			indices = computeIndices(col);
		} catch {
			if (myGen === generation) error = 'Échec du chargement du sondage.';
		} finally {
			if (myGen === generation) loading = false;
		}
	}

	let debounce: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const s = $sounding;
		void $time; // dépendance : recalcul live au scrub du curseur temps
		if (!s.open || s.lat === null || s.lng === null) return;
		clearTimeout(debounce);
		const { lat, lng } = s;
		debounce = setTimeout(() => load(lat, lng), 300);
	});
</script>

{#if $sounding.open}
	<div
		class="sounding-panel fixed bottom-4 right-4 z-40 w-[340px] rounded-lg border bg-background shadow-lg"
	>
		<div class="flex items-center justify-between border-b p-2">
			<div class="flex gap-1">
				<button
					class="rounded px-2 py-1 text-sm hover:bg-accent"
					class:font-bold={$sounding.activeTab === 'skewt'}
					onclick={() => sounding.setTab('skewt')}
				>
					Skew-T
				</button>
				<button
					class="rounded px-2 py-1 text-sm hover:bg-accent"
					class:font-bold={$sounding.activeTab === 'hodograph'}
					onclick={() => sounding.setTab('hodograph')}
				>
					Hodographe
				</button>
				<button
					class="rounded px-2 py-1 text-sm hover:bg-accent"
					class:font-bold={$sounding.activeTab === 'indices'}
					onclick={() => sounding.setTab('indices')}
				>
					Indices
				</button>
			</div>
			<button
				class="rounded px-2 py-1 text-sm hover:bg-accent"
				aria-label="Fermer"
				onclick={() => sounding.close()}
			>
				✕
			</button>
		</div>
		<div class="h-[420px] p-2">
			{#if loading}
				<p class="p-4 text-sm text-muted-foreground">Chargement du sondage…</p>
			{:else if error}
				<p class="p-4 text-sm text-destructive">
					{error}
					<button
						class="underline"
						onclick={() => $sounding.lat !== null && load($sounding.lat, $sounding.lng!)}
					>
						Recharger
					</button>
				</p>
			{:else if profile && parcel && indices}
				{#if $sounding.activeTab === 'skewt'}<SkewT {profile} {parcel} />{/if}
				{#if $sounding.activeTab === 'hodograph'}<Hodograph {profile} />{/if}
				{#if $sounding.activeTab === 'indices'}<IndicesTable {indices} />{/if}
			{/if}
		</div>
	</div>
{/if}
