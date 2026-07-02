<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings-2';

	import { advancedOpen } from '$lib/stores/preferences';
	import { selectedDomain, selectedVariable } from '$lib/stores/variables';

	import { translateVariableLabel } from '$lib/i18n/variables-fr';

	import type { Snippet } from 'svelte';

	interface Props {
		/** Action de capture/partage (desktop) — rendue dans les actions de droite. */
		capture?: Snippet;
	}
	let { capture }: Props = $props();

	const SITE_URL = 'https://www.infoclimat.fr';
	const LOGO_URL = 'https://static.infoclimat.net/images/v5.1/logo_IC_5.1.png';

	// Fil contextuel « qu'est-ce que je regarde ? » : variable (en avant) + modèle
	// (atténué). Reste l'unique rappel modèle/variable quand la sidebar est repliée
	// en rail. Masqué sur mobile (info dans le bottom-sheet, header trop serré).
	const variableLabel = $derived(
		$selectedVariable ? translateVariableLabel($selectedVariable.label) : ''
	);
	const domainLabel = $derived($selectedDomain?.label ?? '');
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

	{#if variableLabel}
		<p
			class="hidden min-w-0 flex-1 truncate px-2 text-center text-sm text-white/50 md:block"
			title={domainLabel ? `${variableLabel} · ${domainLabel}` : variableLabel}
		>
			<span class="font-medium text-white">{variableLabel}</span>
			{#if domainLabel}<span> · {domainLabel}</span>{/if}
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
