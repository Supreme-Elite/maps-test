<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { metaJson, modelRun, time } from '$lib/stores/time';
	import { domain as domainStore } from '$lib/stores/variables';

	import { createPlaybackEngine } from '$lib/playback-engine';
	import { slotEvents } from '$lib/slot-events';

	// L'avancée d'échéance est déléguée à time-selector pour réutiliser son
	// chemin de mise à jour (store time + URL + rechargement + centrage).
	let { advance }: { advance: (date: Date) => void } = $props();

	let playing = $state(false);

	const engine = createPlaybackEngine({
		events: slotEvents,
		getSteps: () => $metaJson?.valid_times.map((validTime: string) => new Date(validTime)),
		getCurrent: () => $time,
		advance: (date) => advance(date),
		onAutoStop: () => {
			playing = false;
		}
	});

	const togglePlayback = () => {
		if (engine.running) {
			engine.stop();
			playing = false;
			return;
		}
		if (!engine.start()) {
			toast.warning('Aucune échéance disponible pour lancer la lecture');
			return;
		}
		playing = true;
	};

	// Les échéances changent avec le domaine ou le run : on arrête la lecture.
	$effect(() => {
		void $domainStore;
		void $modelRun;
		if (engine.running) {
			engine.stop();
			playing = false;
		}
	});

	$effect(() => {
		return () => engine.stop();
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
	title={playing ? "Arrêter l'animation" : 'Animer les échéances jusqu’à la fin du run (en boucle)'}
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
