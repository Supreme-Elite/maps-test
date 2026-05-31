<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';

	import { exportFrameVisible } from '$lib/stores/preferences';

	interface Props {
		variant?: 'bar' | 'fab';
	}
	let { variant = 'bar' }: Props = $props();
</script>

{#if variant === 'fab'}
	<button
		type="button"
		onclick={() => exportFrameVisible.set(true)}
		aria-label="Capturer la carte"
		class="bg-primary flex size-11 cursor-pointer items-center justify-center rounded-full text-white shadow-lg ring-1 ring-white/20"
	>
		<CameraIcon class="size-5" />
	</button>
{:else}
	<button
		type="button"
		onclick={() => exportFrameVisible.set(true)}
		aria-label="Capturer la carte"
		class="bg-primary flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white shadow-md ring-1 ring-white/20"
	>
		<CameraIcon class="size-4" /> Capturer
	</button>
{/if}
