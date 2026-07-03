<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings-2';

	import { advancedOpen } from '$lib/stores/preferences';
	import { inProgress, latest, modelRun, time } from '$lib/stores/time';
	import { selectedDomain } from '$lib/stores/variables';

	import { formatUTCDateTime, formatUTCTime } from '$lib/time-format';

	import type { Snippet } from 'svelte';

	interface Props {
		/** Action de capture/partage (desktop) — rendue dans les actions de droite. */
		capture?: Snippet;
	}
	let { capture }: Props = $props();

	const SITE_URL = 'https://www.infoclimat.fr';
	const LOGO_URL = 'https://static.infoclimat.net/images/v5.1/logo_IC_5.1.png';

	// Fil contextuel « qu'est-ce que je regarde ? » : modèle (en avant) + run +
	// validité. La variable est affichée dans la bande de contexte
	// (context-strip.svelte) pour éviter la duplication. Reste l'unique rappel
	// modèle/run quand la sidebar est repliée en rail. Masqué sur mobile (info
	// dans le bottom-sheet, header trop serré).
	const domainLabel = $derived($selectedDomain?.label ?? '');

	const runLabel = $derived($modelRun ? formatUTCTime($modelRun) : '');
	const validLabel = $derived($time ? formatUTCDateTime($time) : '');

	// Run en cours de génération : même dérivation que time-selector.svelte
	// (inProgressReferenceTime) — un `inProgress` dont le reference_time égale
	// celui de `latest` n'est plus « en cours », il est devenu le dernier run.
	const inProgressReferenceTime = $derived(
		$inProgress?.reference_time &&
			$latest?.reference_time &&
			$inProgress?.reference_time !== $latest?.reference_time
			? new Date($inProgress.reference_time)
			: undefined
	);
	const runIsInProgress = $derived(
		!!$modelRun &&
			!!inProgressReferenceTime &&
			inProgressReferenceTime.getTime() === $modelRun.getTime()
	);
</script>

<!-- Header fin pleine largeur (44 px) : marque à gauche, onglets pilule (un seul
     en v1 — réserve l'emplacement des futures pages), fil contextuel au centre,
     et à droite les actions : capture/partage (desktop) puis « Avancé ». Sur
     mobile, la capture est un FAB géré par mobile-dock. -->
<header
	class="bg-glass/85 fixed inset-x-0 top-0 z-60 flex h-11 items-center gap-3 border-b border-white/15 px-2.5 glass-blur"
>
	<a
		href={SITE_URL}
		title="Infoclimat"
		rel="noopener"
		target="_blank"
		class="flex h-11 shrink-0 items-center"
	>
		<img src={LOGO_URL} alt="Infoclimat" class="h-7 w-auto" crossorigin="anonymous" />
	</a>

	<nav aria-label="Navigation principale" class="flex items-center">
		<span
			aria-current="page"
			class="rounded-full bg-white/12 px-3 py-1 text-sm font-medium text-white"
		>
			Carte
		</span>
	</nav>

	{#if domainLabel}
		<p
			class="hidden min-w-0 flex-1 truncate px-2 text-center text-sm text-white/50 md:block"
			title={`${domainLabel}${runLabel ? ` · Run ${runLabel}Z` : ''}${validLabel ? ` · ${validLabel}Z` : ''}`}
		>
			<span class="font-medium text-white">{domainLabel}</span>
			{#if runLabel}<span class="tabular-nums"> · Run {runLabel}Z</span>{/if}
			{#if validLabel}<span class="tabular-nums"> · {validLabel}Z</span>{/if}
			{#if runIsInProgress}
				<span
					class="ml-2 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-300 uppercase"
				>
					Run en cours
				</span>
			{/if}
		</p>
	{/if}

	<div class="ml-auto flex items-center gap-2">
		{@render capture?.()}
		<button
			type="button"
			onclick={() => advancedOpen.update((v) => !v)}
			aria-label="Réglages avancés"
			aria-expanded={$advancedOpen}
			class="bg-glass/85 hover:bg-glass/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white shadow-md md:h-8"
		>
			<SettingsIcon class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">Avancé</span>
		</button>
	</div>
</header>
