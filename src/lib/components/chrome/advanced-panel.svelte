<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings-2';

	import { sheet } from '$lib/stores/preferences';
</script>

<button
	type="button"
	onclick={() => sheet.set(true)}
	aria-label="Calques et réglages"
	class="bg-glass/40 hover:bg-glass/60 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-2.5 text-sm text-white backdrop-blur-md"
>
	<SettingsIcon class="size-4" />
	<span class="hidden sm:inline">Calques &amp; réglages</span>
</button>
