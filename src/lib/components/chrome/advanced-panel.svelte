<script lang="ts">
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { fly, slide } from 'svelte/transition';

	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import HelpIcon from '@lucide/svelte/icons/circle-question-mark';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import Grid3x3Icon from '@lucide/svelte/icons/grid-3x3';
	import ScissorsIcon from '@lucide/svelte/icons/scissors';
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';

	import { clippingPanelOpen } from '$lib/stores/clipping';
	import { advancedOpen, desktop, helpOpen } from '$lib/stores/preferences';
	import { vectorOptions } from '$lib/stores/vector';

	import SecondaryLayerPanel from '$lib/components/secondary-layer/secondary-layer-panel.svelte';
	import CacheSettings from '$lib/components/settings/cache-settings.svelte';
	import SoundingSettings from '$lib/components/settings/sounding-settings.svelte';
	import StateSettings from '$lib/components/settings/state-settings.svelte';
	import TileSizeSettings from '$lib/components/settings/tile-size-settings.svelte';
	import UnitSettings from '$lib/components/settings/unit-settings.svelte';
	import * as Sheet from '$lib/components/ui/sheet';

	import { changeOMfileURL } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	import LayerToggle from './layer-toggle.svelte';

	import type { Snippet } from 'svelte';

	interface Props {
		capture?: Snippet;
	}
	let { capture }: Props = $props();

	// Reactive snapshots driving the toggle UI.
	const gridDotsOn = $derived($vectorOptions.grid);

	// Points de grille (cercles) : changer le flag `grid` modifie l'URL des tuiles
	// vecteur → `changeOMfileURL()` recharge la source.
	function toggleGridDots(next: boolean) {
		vectorOptions.update((o) => ({ ...o, grid: next }));
		updateUrl('grid', String(next));
		changeOMfileURL();
	}

	// Respecte prefers-reduced-motion : neutralise la transition JS du rail desktop.
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	// Section « Avancé » : deux dépliants repliés par défaut (« Performance » = tuiles + cache,
	// « Réglages avancés » = points de grille, sondage, réinitialisation). Repliés pour dégonfler
	// la complexité perçue alors que la plupart des utilisateurs n'y touchent jamais. Local
	// (non persisté) → repartent fermés à chaque session. L'aide renvoie au dépliant Performance.
	let performanceOpen = $state(false);
	let advancedSettingsOpen = $state(false);

	// Porte le rail sur <body> : un backdrop-filter imbriqué dans celui de la barre
	// haute est neutralisé par le navigateur, donc le flou ne s'appliquerait pas.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.parentNode?.removeChild(node);
			}
		};
	}
</script>

{#snippet sectionLabel(text: string)}
	<h3 class="mb-1.5 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">{text}</h3>
{/snippet}

{#snippet body()}
	<!-- Niveau 1 — calque secondaire (le calque principal, ses toggles et son opacité
	     vivent désormais dans la sidebar, sections Affichage/Style). -->
	<section>
		{@render sectionLabel('Calque secondaire')}
		<div
			class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
		>
			<SecondaryLayerPanel />
		</div>
	</section>

	<!-- Niveau 2 — unités. -->
	<section>
		{@render sectionLabel('Unités')}
		<div
			class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
		>
			<UnitSettings />
		</div>
	</section>

	<!-- Niveau 3 — section « Avancé » : deux dépliants repliés par défaut pour dégonfler le
	     panneau. « Performance » (tuiles + cache) est référencé par l'aide ; « Réglages avancés »
	     regroupe les réglages occasionnels/système. -->
	<section>
		{@render sectionLabel('Avancé')}

		<!-- Dépliant Performance : leviers de fluidité (l'aide y renvoie pour les machines lentes). -->
		<div class="overflow-hidden rounded-xl bg-white/[0.04]">
			<button
				type="button"
				class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
				aria-expanded={performanceOpen}
				onclick={() => (performanceOpen = !performanceOpen)}
			>
				<span class="flex items-center gap-3">
					<GaugeIcon class="size-[18px] text-white/55" aria-hidden="true" />
					Performance
				</span>
				<ChevronDownIcon
					class={[
						'size-4 text-white/45 transition-transform duration-200 motion-reduce:transition-none',
						performanceOpen && 'rotate-180'
					]
						.filter(Boolean)
						.join(' ')}
					aria-hidden="true"
				/>
			</button>
			{#if performanceOpen}
				<div
					class="border-t border-white/[0.06] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
					transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}
				>
					<TileSizeSettings />
					<CacheSettings />
				</div>
			{/if}
		</div>

		<!-- Dépliant Réglages avancés : réglages occasionnels/système. -->
		<div class="mt-2.5 overflow-hidden rounded-xl bg-white/[0.04]">
			<button
				type="button"
				class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
				aria-expanded={advancedSettingsOpen}
				onclick={() => (advancedSettingsOpen = !advancedSettingsOpen)}
			>
				<span class="flex items-center gap-3">
					<SlidersIcon class="size-[18px] text-white/55" aria-hidden="true" />
					Réglages avancés
				</span>
				<ChevronDownIcon
					class={[
						'size-4 text-white/45 transition-transform duration-200 motion-reduce:transition-none',
						advancedSettingsOpen && 'rotate-180'
					]
						.filter(Boolean)
						.join(' ')}
					aria-hidden="true"
				/>
			</button>
			{#if advancedSettingsOpen}
				<div
					class="border-t border-white/[0.06] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
					transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}
				>
					<LayerToggle
						label="Points de grille"
						checked={gridDotsOn}
						onCheckedChange={toggleGridDots}
					>
						{#snippet icon()}<Grid3x3Icon class="size-[18px]" aria-hidden="true" />{/snippet}
					</LayerToggle>
					<SoundingSettings />
					<StateSettings />
				</div>
			{/if}
		</div>
	</section>

	<!-- Outils — actions ponctuelles, distinctes des réglages. -->
	<section>
		{@render sectionLabel('Outils')}
		<div
			class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
		>
			{#if capture}
				<div class="flex min-h-11 items-center px-3 py-2.5">
					{@render capture()}
				</div>
			{/if}
			<button
				type="button"
				class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm"
				onclick={() => clippingPanelOpen.set(!get(clippingPanelOpen))}
			>
				<ScissorsIcon class="size-[18px] text-white/55" aria-hidden="true" />
				<span class="flex-1">Découpage</span>
				<ChevronDownIcon class="size-4 -rotate-90 text-white/35" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm"
				onclick={() => helpOpen.set(true)}
			>
				<HelpIcon class="size-[18px] text-white/55" aria-hidden="true" />
				<span class="flex-1">Aide</span>
				<ChevronDownIcon class="size-4 -rotate-90 text-white/35" aria-hidden="true" />
			</button>
		</div>
	</section>
{/snippet}

{#if desktop.current}
	{#if $advancedOpen}
		<!-- use:portal → rendu sur <body> pour que le backdrop-blur s'applique vraiment
		     (même voile que la barre haute). -->
		<!-- Drawer collé au bord droit : glisse entièrement depuis l'extérieur (x = largeur
		     du rail, w-80 = 320px) et se referme vers la droite. La hauteur reste calée sur
		     le contenu (max-height) pour ne jamais couvrir la timeline ni la légende en bas. -->
		<!-- Conteneur flex colonne, SANS scroll : seul le corps défile, l'en-tête (titre + ✕)
		     reste figé → fermeture toujours accessible sans scroller, quelle que soit la hauteur. -->
		<div
			use:portal
			class="bg-glass/65 fixed right-0 z-60 flex w-80 flex-col overflow-hidden rounded-l-xl border border-r-0 border-white/15 text-white shadow-lg backdrop-blur-md"
			style="top: 52px; max-height: calc(100dvh - 68px);"
			in:fly={{ x: 320, duration: reduceMotion.current ? 0 : 260, easing: cubicOut }}
			out:fly={{ x: 320, duration: reduceMotion.current ? 0 : 200, easing: cubicIn }}
		>
			<div class="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
				<h2 class="text-sm font-semibold">Calques &amp; réglages</h2>
				<button
					type="button"
					onclick={() => advancedOpen.set(false)}
					aria-label="Fermer"
					title="Fermer"
					class="hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 -mr-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-white/70 hover:text-white"
				>
					<XIcon class="size-4" aria-hidden="true" />
				</button>
			</div>
			<div class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-3">
				{@render body()}
			</div>
		</div>
	{/if}
{:else}
	<Sheet.Root bind:open={$advancedOpen}>
		<Sheet.Content
			side="bottom"
			class="bg-glass/90 z-100 flex max-h-[85vh] flex-col gap-0 border-none text-white backdrop-blur-xl"
		>
			<!-- En-tête figé (titre + ✕ intégrée de Sheet, en absolu top-droite) : seul le
			     corps défile, fermeture toujours visible — même comportement que le rail desktop. -->
			<div class="flex shrink-0 items-center px-6 pt-4 pb-3">
				<h2 class="text-sm font-semibold">Calques &amp; réglages</h2>
			</div>
			<div class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8">
				{@render body()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
