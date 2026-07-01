<script lang="ts">
	import { desktop } from '$lib/stores/preferences';

	import CaptureFlow from '$lib/components/capture/capture-flow.svelte';

	import AdvancedPanel from './advanced-panel.svelte';
	import Header from './header.svelte';
	import MobileDock from './mobile-dock.svelte';
	import Sidebar from './sidebar.svelte';
</script>

<Header />

{#if desktop.current}
	<Sidebar />
	<AdvancedPanel>
		{#snippet capture()}<CaptureFlow />{/snippet}
	</AdvancedPanel>
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
	</MobileDock>
	<AdvancedPanel />
{/if}
