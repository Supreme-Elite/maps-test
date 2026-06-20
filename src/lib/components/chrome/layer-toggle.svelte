<script lang="ts">
	import { Switch } from '$lib/components/ui/switch';

	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		checked: boolean;
		onCheckedChange: (v: boolean) => void;
		icon?: Snippet;
	}
	let { label, checked, onCheckedChange, icon }: Props = $props();
</script>

<label
	class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2.5 md:min-h-11 md:py-2.5"
>
	<!-- L'icône Lucide hérite de `currentColor` : teinter le span suffit à allumer
	     icône + libellé ensemble quand le calque est actif (scan d'un coup d'œil). -->
	<span
		class="flex items-center gap-3 text-sm transition-colors {checked
			? 'text-sky-300'
			: 'text-white'}"
	>
		{@render icon?.()}
		{label}
	</span>
	<Switch {checked} {onCheckedChange} aria-label={label} />
</label>
