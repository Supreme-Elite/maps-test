<script lang="ts">
	import { desktop } from '$lib/stores/preferences';

	import CaptureFlow from '$lib/components/capture/capture-flow.svelte';

	import AdvancedPanel from './advanced-panel.svelte';
	import DisplaySection from './display-section.svelte';
	import Header from './header.svelte';
	import MobileDock from './mobile-dock.svelte';
	import Sidebar from './sidebar.svelte';
	import StyleSection from './style-section.svelte';
</script>

<Header>
	{#snippet capture()}
		<!-- Desktop : capture/partage promue dans le header. Sur mobile, c'est le FAB
		     de mobile-dock qui prend le relais (meilleure accessibilité au pouce). -->
		{#if desktop.current}<CaptureFlow />{/if}
	{/snippet}
</Header>

{#if desktop.current}
	<Sidebar>
		{#snippet display()}<DisplaySection />{/snippet}
		{#snippet style()}<StyleSection />{/snippet}
	</Sidebar>
	<AdvancedPanel />
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
		{#snippet display()}<DisplaySection />{/snippet}
		{#snippet style()}<StyleSection />{/snippet}
	</MobileDock>
	<AdvancedPanel />
{/if}
