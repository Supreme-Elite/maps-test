<script lang="ts">
	import GaugeIcon from '@lucide/svelte/icons/gauge';

	import { soundingButtonEnabled } from '$lib/stores/sounding';

	import { Switch } from '$lib/components/ui/switch';
</script>

<div class="px-3 py-2">
	<label class="flex min-h-11 cursor-pointer items-center justify-between gap-3" for="sounding">
		<span
			class="flex items-center gap-3 text-sm transition-colors {$soundingButtonEnabled
				? 'text-sky-300'
				: 'text-white'}"
		>
			<GaugeIcon class="size-[18px]" aria-hidden="true" />
			Bouton sondage vertical
		</span>
		<Switch id="sounding" class="cursor-pointer" bind:checked={$soundingButtonEnabled} />
	</label>
	<p class="text-xs text-muted-foreground">
		Disponible uniquement sur AROME 0,025° (seul modèle à diffuser les niveaux de pression requis).
	</p>
</div>
