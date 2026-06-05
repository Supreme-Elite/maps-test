<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { metaJson } from '$lib/stores/time';
	import { vectorOptions, windOverlayEnabled, windOverlayLevel } from '$lib/stores/vector';

	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';

	import { VISIBLE_PRESSURE_LEVELS_HPA } from '$lib/constants';
	import { changeOMfileURL } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	// Niveau du vent dessiné par les flèches :
	//  - DISPLAYED → suit la variable affichée (overlay off, comportement historique)
	//  - autre     → niveau de vent dédié (overlay on), indépendant de la variable affichée
	const DISPLAYED = 'displayed';
	const HEIGHT_LEVELS = ['10m', '100m'];
	const LEVEL_LABELS: Record<string, string> = {
		'10m': '10 m (surface)',
		'100m': '100 m',
		'300hPa': '300 hPa (jet)'
	};
	function levelLabel(level: string): string {
		if (level === DISPLAYED) return 'Selon la variable affichée';
		return LEVEL_LABELS[level] ?? level.replace('hPa', ' hPa');
	}

	// Niveaux réellement proposés = ceux que le modèle publie (metaJson), parmi la
	// sélection « visible » du projet (mêmes niveaux de pression que le sélecteur principal).
	const modelVars = $derived(new Set($metaJson?.variables ?? []));
	const hasAnyWind = $derived([...modelVars].some((v) => v.startsWith('wind_u_component_')));
	const availableLevels = $derived(
		[...HEIGHT_LEVELS, ...VISIBLE_PRESSURE_LEVELS_HPA.map((n) => `${n}hPa`)].filter((l) =>
			modelVars.has(`wind_u_component_${l}`)
		)
	);
	const levelOptions = $derived([DISPLAYED, ...availableLevels]);

	const arrows = $derived($vectorOptions.arrows);
	const selectedLevel = $derived($windOverlayEnabled ? $windOverlayLevel : DISPLAYED);

	// Si le niveau d'overlay persisté n'existe pas pour le modèle courant, on retombe
	// sur « Selon la variable affichée » (toujours valide) — évite une requête 404.
	$effect(() => {
		if ($windOverlayEnabled && !availableLevels.includes($windOverlayLevel)) {
			windOverlayEnabled.set(false);
			updateUrl('wind_overlay', 'false');
			changeOMfileURL();
		}
	});

	function onToggle(checked: boolean) {
		vectorOptions.update((v) => ({ ...v, arrows: checked }));
		updateUrl('arrows', String(checked));
		if (!checked && $windOverlayEnabled) {
			windOverlayEnabled.set(false);
			updateUrl('wind_overlay', 'false');
		}
		changeOMfileURL();
		toast.info('Flèches de vent ' + (checked ? 'activées' : 'désactivées'));
	}

	function onLevel(value: string) {
		if (value === DISPLAYED) {
			windOverlayEnabled.set(false);
			updateUrl('wind_overlay', 'false');
		} else {
			windOverlayEnabled.set(true);
			windOverlayLevel.set(value);
			updateUrl('wind_overlay', 'true');
			updateUrl('wind_overlay_level', value);
		}
		changeOMfileURL();
	}
</script>

<div>
	<label
		class="flex min-h-11 items-center justify-between gap-3 py-2 md:min-h-0 md:py-1.5 {hasAnyWind
			? 'cursor-pointer'
			: 'cursor-not-allowed opacity-50'}"
		for="arrows"
		title={hasAnyWind ? undefined : 'Ce modèle ne fournit pas de données de vent'}
	>
		<span class="text-sm">Flèches de vent</span>
		<Switch
			id="arrows"
			class={hasAnyWind ? 'cursor-pointer' : 'cursor-not-allowed'}
			checked={arrows && hasAnyWind}
			disabled={!hasAnyWind}
			onCheckedChange={onToggle}
		/>
	</label>
	{#if !hasAnyWind}
		<p class="pl-1 text-xs text-white/50">Ce modèle ne fournit pas de vent.</p>
	{:else if arrows}
		<div class="mt-1 flex items-center gap-3 pl-1">
			<Label class="w-14 shrink-0 text-xs text-white/70" for="wind-level">Niveau</Label>
			<Select.Root type="single" value={selectedLevel} onValueChange={(v) => v && onLevel(v)}>
				<Select.Trigger
					id="wind-level"
					class="h-8 flex-1 cursor-pointer bg-background/60 text-sm"
					aria-label="Niveau du vent"
				>
					{levelLabel(selectedLevel)}
				</Select.Trigger>
				<Select.Content class="z-110 border-none bg-glass/65 backdrop-blur-sm">
					{#each levelOptions as value (value)}
						<Select.Item {value} label={levelLabel(value)} class="cursor-pointer text-sm" />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}
</div>
