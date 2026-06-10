<script lang="ts">
	import { untrack } from 'svelte';

	import { toast } from 'svelte-sonner';

	import { prefetchMode } from '$lib/stores/prefetch';
	import { metaJson, modelRun, time } from '$lib/stores/time';
	import { domain as domainStore, variable as variableStore } from '$lib/stores/variables';

	import { createPlaybackEngine } from '$lib/playback-engine';
	import { PREFETCH_MODE_LABELS, getDateRangeForMode, prefetchData } from '$lib/prefetch';
	import { slotEvents } from '$lib/slot-events';

	// L'avancée d'échéance est déléguée à time-selector pour réutiliser son
	// chemin de mise à jour (store time + URL + rechargement + centrage).
	let { advance }: { advance: (date: Date) => void } = $props();

	let playing = $state(false);
	let prefetchAbort: AbortController | null = null;

	// Plage de lecture : celle du sélecteur partagé avec le préchargement
	// (Aujourd'hui / 24 h suivantes / 24 h précédentes / Run complet).
	const playbackRange = () => {
		if (!$metaJson) return undefined;
		const { startDate, endDate } = getDateRangeForMode($prefetchMode, $time, $metaJson);
		return { start: startDate, end: endDate };
	};

	// Au lancement de la lecture, on précharge en arrière-plan la plage à jouer
	// pour lisser l'animation sur réseau lent. Fire-and-forget : la lecture
	// n'attend pas, le cache rattrape en route.
	const startBackgroundPrefetch = () => {
		const range = playbackRange();
		if (!range || !$metaJson || !$modelRun) return;
		prefetchAbort = new AbortController();
		void prefetchData({
			startDate: range.start,
			endDate: range.end,
			metaJson: $metaJson,
			modelRun: $modelRun,
			domain: $domainStore,
			variable: $variableStore,
			signal: prefetchAbort.signal
		});
	};

	const stopBackgroundPrefetch = () => {
		prefetchAbort?.abort();
		prefetchAbort = null;
	};

	const engine = createPlaybackEngine({
		events: slotEvents,
		getSteps: () => $metaJson?.valid_times.map((validTime: string) => new Date(validTime)),
		getCurrent: () => $time,
		getBounds: () => playbackRange(),
		advance: (date) => advance(date),
		onAutoStop: () => {
			stopBackgroundPrefetch();
			playing = false;
		}
	});

	const stopPlayback = () => {
		engine.stop();
		stopBackgroundPrefetch();
		playing = false;
	};

	const togglePlayback = () => {
		if (engine.running) {
			stopPlayback();
			return;
		}
		if (!engine.start()) {
			toast.warning('Aucune échéance disponible dans la plage sélectionnée');
			return;
		}
		startBackgroundPrefetch();
		playing = true;
	};

	// Changement de plage en cours de lecture : on redémarre sur les nouvelles
	// bornes (et on précharge la nouvelle plage).
	$effect(() => {
		void $prefetchMode;
		// untrack : start() lit $time/$metaJson via getBounds/getSteps, on ne
		// veut redéclencher l'effet que sur changement de plage.
		untrack(() => {
			if (!engine.running) return;
			engine.stop();
			stopBackgroundPrefetch();
			if (engine.start()) {
				startBackgroundPrefetch();
			} else {
				playing = false;
			}
		});
	});

	// Les échéances changent avec le domaine ou le run : on arrête la lecture.
	$effect(() => {
		void $domainStore;
		void $modelRun;
		if (engine.running) {
			stopPlayback();
		}
	});

	$effect(() => {
		return () => stopPlayback();
	});
</script>

<!-- Playback Button -->
<button
	class="cursor-pointer w-4 h-4.5 flex items-center justify-center"
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		togglePlayback();
	}}
	aria-label={playing ? "Arrêter l'animation" : "Lancer l'animation"}
	title={playing
		? "Arrêter l'animation"
		: `Animer « ${PREFETCH_MODE_LABELS.get($prefetchMode) ?? 'Run complet'} » (en boucle)`}
>
	{#if playing}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-blue-500 lucide lucide-pause-icon"
		>
			<rect x="14" y="4" width="4" height="16" rx="1" />
			<rect x="6" y="4" width="4" height="16" rx="1" />
		</svg>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-foreground/70 hover:text-foreground lucide lucide-play-icon"
		>
			<polygon points="6 3 20 12 6 21 6 3" />
		</svg>
	{/if}
</button>
