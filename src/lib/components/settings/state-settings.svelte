<script lang="ts">
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { toast } from 'svelte-sonner';

	import { resetStates, url } from '$lib/stores/preferences';
	import { domain } from '$lib/stores/variables';

	import Button from '$lib/components/ui/button/button.svelte';

	import { changeOMfileURL } from '$lib/layers';
	import { reloadStyles } from '$lib/map-controls';
	import { updateUrl } from '$lib/url';

	const reset = async () => {
		await resetStates();
		for (let [key] of $url.searchParams) {
			$url.searchParams.delete(key);
		}
		reloadStyles();
		$domain = $domain; // reload domainData
		await changeOMfileURL();
		updateUrl();
		toast.info('Tous les réglages réinitialisés');
	};
</script>

<div class="px-3 py-2">
	<div class="flex items-center gap-3 text-sm">
		<RotateCcwIcon class="size-[18px] text-white/55" aria-hidden="true" />
		Réinitialisation
	</div>
	<div class="mt-2">
		<Button class="cursor-pointer" onclick={reset}>Réinitialiser tous les réglages</Button>
	</div>
</div>
