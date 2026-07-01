<script lang="ts">
	import { desktop } from '$lib/stores/preferences';

	import CaptureFlow from '$lib/components/capture/capture-flow.svelte';

	import AdvancedPanel from './advanced-panel.svelte';
	import Header from './header.svelte';
	import MobileDock from './mobile-dock.svelte';
	import TopBar from './top-bar.svelte';
</script>

<Header />

{#if desktop.current}
	<TopBar>
		{#snippet capture()}<CaptureFlow />{/snippet}
		{#snippet advanced()}<AdvancedPanel />{/snippet}
	</TopBar>
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
		{#snippet advanced()}<AdvancedPanel />{/snippet}
	</MobileDock>
{/if}
