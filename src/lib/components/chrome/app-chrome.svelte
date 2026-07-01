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

<Header />

{#if desktop.current}
	<Sidebar>
		{#snippet display()}<DisplaySection />{/snippet}
		{#snippet style()}<StyleSection />{/snippet}
	</Sidebar>
	<AdvancedPanel>
		{#snippet capture()}<CaptureFlow />{/snippet}
	</AdvancedPanel>
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
	</MobileDock>
	<AdvancedPanel />
{/if}
