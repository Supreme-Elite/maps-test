<script lang="ts">
	import ModelSelector from './model-selector.svelte';
	import VariableTabs from './variable-tabs.svelte';

	import type { Snippet } from 'svelte';

	interface Props {
		capture?: Snippet;
		advanced?: Snippet;
	}
	let { capture, advanced }: Props = $props();

	const SITE_URL = 'https://www.infoclimat.fr';
	const LOGO_URL = 'https://static.infoclimat.net/images/v5.1/logo_IC_5.1.png';
</script>

<div
	class="bg-glass/45 fixed inset-x-2.5 top-2.5 z-60 flex h-12 items-center gap-2.5 rounded-xl border border-white/15 px-3 shadow-lg backdrop-blur-md"
>
	<a href={SITE_URL} title="Infoclimat" rel="noopener" class="shrink-0">
		<img src={LOGO_URL} alt="Infoclimat" class="h-6 w-auto" crossorigin="anonymous" />
	</a>
	<ModelSelector />
	<div class="h-5 w-px bg-white/20"></div>
	<VariableTabs />
	<div class="ml-auto flex items-center gap-2">
		{@render capture?.()}
		{@render advanced?.()}
	</div>
</div>
