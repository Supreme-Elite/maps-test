<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { defaultVectorOptions, vectorOptions } from '$lib/stores/vector';

	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';

	import { changeOMfileURL } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	const contours = $derived($vectorOptions.contours);
	const breakpoints = $derived($vectorOptions.breakpoints);

	const handleContourIntervalChange = () => {
		updateUrl(
			'contour_interval',
			String($vectorOptions.contourInterval),
			String(defaultVectorOptions.contourInterval) // different urlParam and key
		);
		if (contours) {
			changeOMfileURL();
		}
	};
</script>

<div>
	<label
		class="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2 md:min-h-0 md:py-1.5"
		for="contouring"
	>
		<span class="text-sm">Isocontours</span>
		<Switch
			id="contouring"
			class="cursor-pointer"
			bind:checked={$vectorOptions.contours}
			onCheckedChange={() => {
				updateUrl('contours', String(contours));
				changeOMfileURL();
				toast.info('Isocontours ' + (contours ? 'activés' : 'désactivés'));
			}}
		/>
	</label>

	{#if contours}
		<div class="mt-1 flex flex-col gap-2 pl-1">
			<label class="flex cursor-pointer items-center justify-between gap-3" for="breakpoints">
				<span class="text-xs text-white/70"
					>Intervalle sur paliers {breakpoints ? 'activé' : 'désactivé'}</span
				>
				<Switch
					id="breakpoints"
					class="cursor-pointer"
					bind:checked={$vectorOptions.breakpoints}
					onCheckedChange={() => {
						updateUrl(
							'interval_on_breakpoints',
							String(breakpoints),
							String(defaultVectorOptions.breakpoints) // key is different
						);
						changeOMfileURL();
						toast.info(
							"Intervalle sur paliers d'échelle " + (breakpoints ? 'activé' : 'désactivé')
						);
					}}
				/>
			</label>

			{#if !breakpoints}
				<div class="flex flex-col gap-2 duration-300">
					<Label class="text-xs text-white/70" for="interval">Intervalle des isolignes :</Label>
					<div class="flex items-center gap-3">
						<input
							id="interval_slider"
							class="min-w-0 flex-1 delay-75 duration-200"
							type="range"
							min="0"
							max="50"
							bind:value={$vectorOptions.contourInterval}
							onchange={handleContourIntervalChange}
						/>
						<Input
							id="interval"
							class="w-16 shrink-0 bg-background/60"
							step="0.5"
							bind:value={$vectorOptions.contourInterval}
							onchange={handleContourIntervalChange}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
