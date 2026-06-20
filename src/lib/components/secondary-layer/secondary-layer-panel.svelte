<script lang="ts">
	import LayersIcon from '@lucide/svelte/icons/layers';

	import { currentOmUrl, currentOmUrl2 } from '$lib/stores/om-url';
	import { opacity2 } from '$lib/stores/preferences';
	import { metaJson } from '$lib/stores/time';
	import { layer2Enabled, variable2 } from '$lib/stores/variables';

	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';

	import { changeOMfileURL } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	const variableOptions: { value: string; label: string }[] = [
		{ value: 'precipitation', label: 'Précipitations' },
		{ value: 'cloud_cover_low', label: 'Nébulosité basse' },
		{ value: 'cloud_cover_mid', label: 'Nébulosité moyenne' },
		{ value: 'cloud_cover_high', label: 'Nébulosité haute' },
		{ value: 'temperature_2m', label: 'Température 2 m' },
		{ value: 'pressure_msl', label: 'Pression MSL' }
	];

	function labelFor(value: string): string {
		return variableOptions.find((o) => o.value === value)?.label ?? value;
	}

	// Ne proposer que les variables réellement publiées par le modèle courant.
	const modelVars = $derived(new Set($metaJson?.variables ?? []));
	const availableVars = $derived(variableOptions.filter((o) => modelVars.has(o.value)));
	const hasAny = $derived(availableVars.length > 0);

	// Si la variable persistée n'existe pas pour ce modèle (mais d'autres oui),
	// on bascule sur la première disponible — évite une couche 404 figée.
	$effect(() => {
		if ($layer2Enabled && hasAny && !availableVars.some((o) => o.value === $variable2)) {
			const first = availableVars[0].value;
			variable2.set(first);
			updateUrl('variable2', first);
			changeOMfileURL();
		}
	});

	function onToggle(checked: boolean) {
		layer2Enabled.set(checked);
		updateUrl('layer2', String(checked));
		changeOMfileURL();
	}

	function onVariable(value: string) {
		variable2.set(value);
		updateUrl('variable2', value);
		changeOMfileURL();
	}

	function onOpacity(value: number) {
		opacity2.set(value);
		updateUrl('opacity2', String(value));
		// commitOpacity est capturé à la construction du SlotManager : on force
		// un rafraîchissement pour que la nouvelle valeur soit prise à la rotation.
		currentOmUrl.set('');
		currentOmUrl2.set('');
		changeOMfileURL();
	}
</script>

<div>
	<label
		class="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 {hasAny
			? 'cursor-pointer'
			: 'cursor-not-allowed opacity-50'}"
		for="layer2"
		title={hasAny ? undefined : 'Ce modèle ne fournit aucune variable de couche superposée'}
	>
		<span
			class="flex items-center gap-3 text-sm transition-colors {$layer2Enabled && hasAny
				? 'text-sky-300'
				: 'text-white'}"
		>
			<LayersIcon class="size-[18px]" aria-hidden="true" />
			Couche superposée
		</span>
		<Switch
			id="layer2"
			class={hasAny ? 'cursor-pointer' : 'cursor-not-allowed'}
			checked={$layer2Enabled && hasAny}
			disabled={!hasAny}
			onCheckedChange={onToggle}
		/>
	</label>
	{#if !hasAny}
		<p class="px-3 text-xs text-white/50">Aucune variable superposable pour ce modèle.</p>
	{:else if $layer2Enabled}
		<div class="mt-1 flex flex-col gap-2 px-3 pb-1">
			<div class="flex items-center gap-3">
				<Label class="w-14 shrink-0 text-xs text-white/70">Variable</Label>
				<Select.Root type="single" value={$variable2} onValueChange={(v) => v && onVariable(v)}>
					<Select.Trigger
						class="h-8 flex-1 cursor-pointer bg-background/60 text-sm"
						aria-label="Variable de la couche superposée"
					>
						{labelFor($variable2)}
					</Select.Trigger>
					<Select.Content class="z-110 border-none bg-glass/65 backdrop-blur-sm">
						{#each availableVars as { value, label } (value)}
							<Select.Item {value} {label} class="cursor-pointer text-sm" />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex items-center gap-3">
				<Label class="w-14 shrink-0 text-xs text-white/70" for="opacity2">Opacité</Label>
				<input
					id="opacity2"
					class="min-w-0 flex-1"
					type="range"
					min="0"
					max="100"
					value={$opacity2}
					oninput={(e) => onOpacity(Number(e.currentTarget.value))}
				/>
				<span class="w-9 shrink-0 text-right text-sm tabular-nums">{$opacity2}%</span>
			</div>
		</div>
	{/if}
</div>
