<script lang="ts">
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Layers from '@lucide/svelte/icons/layers';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Wind from '@lucide/svelte/icons/wind';
	import {
		LEVEL_UNIT_REGEX,
		levelGroupVariables,
		variableOptions
	} from '@openmeteo/weather-map-layer';

	import { metaJson } from '$lib/stores/time';
	import {
		level,
		levelGroupSelected,
		selectedVariable,
		unit,
		variable
	} from '$lib/stores/variables';

	import { localizeVariableOption, translateVariableLabel } from '$lib/i18n/variables-fr';
	import { buildLevelGroups, buildVariableList, groupVariablesByCategory } from '$lib/layer-list';
	import { pickDefaultLevel } from '$lib/level-groups';

	const ICONS = {
		temperature: Thermometer,
		precipitation: CloudRain,
		wind: Wind,
		clouds: Cloud,
		pressure: Gauge,
		other: Layers
	} as const;

	const grouped = $derived(
		$metaJson ? groupVariablesByCategory(buildVariableList($metaJson.variables)) : []
	);
	const levelGroups = $derived($metaJson ? buildLevelGroups($metaJson.variables) : {});

	const activeValue = $derived($levelGroupSelected?.value ?? $selectedVariable?.value);

	// Sélectionne une ligne : groupe de niveaux → niveau par défaut (2 m > 10 m >
	// le plus bas), variable simple → sélection directe. Même logique que
	// l'ancien variable-tabs.
	function selectRow(value: string) {
		const option = variableOptions.find((o) => o.value === value) ?? { value, label: value };
		if (levelGroupVariables.includes(value)) {
			$levelGroupSelected = localizeVariableOption(option);
			const levels = levelGroups[value];
			$variable = (levels && pickDefaultLevel(levels)) ?? value;
		} else {
			$levelGroupSelected = undefined;
			$variable = value;
		}
	}
</script>

{#if $metaJson}
	<div class="flex flex-col gap-3">
		{#each grouped as { cat, items } (cat.key)}
			{@const Icon = ICONS[cat.key]}
			<div>
				<h4 class="mb-1 px-1 text-[11px] font-medium text-white/40">{cat.label}</h4>
				<div
					class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
				>
					{#each items as item (item)}
						{@const option = variableOptions.find(({ value }) => value === item) ?? {
							value: item,
							label: item
						}}
						{@const active = activeValue === item}
						<button
							type="button"
							onclick={() => selectRow(item)}
							aria-pressed={active}
							class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors md:min-h-9 {active
								? 'text-sky-300'
								: 'text-white'}"
						>
							<Icon class="size-[18px] shrink-0" aria-hidden="true" />
							<span class="truncate">{translateVariableLabel(option.label)}</span>
						</button>
						{#if active && levelGroups[item]?.length}
							<!-- Niveaux de la variable active, en radios (sous-échéances de la spec) -->
							<div
								role="radiogroup"
								aria-label="Niveau"
								class="flex flex-col border-t border-white/[0.06] bg-white/[0.02] py-1"
							>
								{#each levelGroups[item] as { value, label } (value)}
									{#if !value.includes('v_component') && !value.includes('_direction')}
										{@const lvl = value.match(LEVEL_UNIT_REGEX)?.groups?.level}
										{@const u = value.match(LEVEL_UNIT_REGEX)?.groups?.unit}
										{@const checked = lvl === $level && u === $unit}
										<label
											class="flex min-h-11 cursor-pointer items-center gap-2.5 pr-3 pl-10 text-sm md:min-h-9 {checked
												? 'text-sky-300'
												: 'text-white/80'}"
										>
											<input
												type="radio"
												name="layer-level-{item}"
												{checked}
												onchange={() => ($variable = value)}
												class="size-3.5 accent-sky-400"
											/>
											{translateVariableLabel(label)}
										</label>
									{/if}
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
