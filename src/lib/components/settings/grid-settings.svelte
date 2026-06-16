<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { gridValues, vectorOptions } from '$lib/stores/vector';

	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';

	import { changeOMfileURL, reloadVectorStyle } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	let grid = $derived($vectorOptions.grid);
	let values = $derived($gridValues);
</script>

<div>
	<h2 class="text-lg font-bold">Grille</h2>
	<div class="mt-3 flex gap-3">
		<Switch
			id="grid"
			class="cursor-pointer"
			bind:checked={$vectorOptions.grid}
			onCheckedChange={() => {
				updateUrl('grid', String(grid));

				changeOMfileURL();
				toast.info('Points de grille ' + (grid ? 'activés' : 'désactivés'));
			}}
		/>
		<Label for="grid" class="cursor-pointer"
			>Points de grille {grid ? 'activés' : 'désactivés'}</Label
		>
	</div>
	<div class="mt-3 flex gap-3">
		<Switch
			id="grid-values"
			class="cursor-pointer"
			bind:checked={$gridValues}
			onCheckedChange={() => {
				updateUrl('grid_values', String(values));

				// Activer les valeurs force `&grid=true` dans l'URL : si les points
				// orange étaient off, l'URL change → changeOMfileURL refait la source.
				// Si les points étaient déjà on, l'URL est inchangée → on reconstruit
				// la couche vecteur en place pour ajouter/retirer le symbol layer.
				changeOMfileURL();
				reloadVectorStyle();
				toast.info('Valeurs aux points ' + (values ? 'activées' : 'désactivées'));
			}}
		/>
		<Label for="grid-values" class="cursor-pointer"
			>Valeurs aux points {values ? 'activées' : 'désactivées'}</Label
		>
	</div>
</div>
