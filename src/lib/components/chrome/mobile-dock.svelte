<script lang="ts">
	import { bottomChromeHeight } from '$lib/stores/preferences';

	import ModelSelector from './model-selector.svelte';
	import VariableTabs from './variable-tabs.svelte';

	import type { Snippet } from 'svelte';

	interface Props {
		capture?: Snippet;
		advanced?: Snippet;
	}
	let { capture, advanced }: Props = $props();
</script>

<!-- Pastille modèle, haut centre -->
<!-- pointer-events-none sur le conteneur pleine largeur : sans ça, sa zone vide
     recouvre le logo (même top/z-index) et capte les taps destinés au logo. -->
<div class="pointer-events-none fixed inset-x-0 top-14 z-60 flex justify-center">
	<div class="pointer-events-auto"><ModelSelector /></div>
</div>

<!-- FAB capture, côté pouce, au-dessus du dock -->
<div class="fixed right-2.5 z-60" style="bottom: calc({$bottomChromeHeight}px + 4.5rem)">
	{@render capture?.()}
</div>

<!-- Dock bas : onglets variables défilants + accès avancé -->
<div
	class="fixed left-1/2 z-60 flex w-max max-w-[calc(100vw-1.25rem)] -translate-x-1/2 items-center gap-2"
	style="bottom: calc({$bottomChromeHeight}px + 0.5rem)"
>
	<VariableTabs />
	<div class="shrink-0">{@render advanced?.()}</div>
</div>
