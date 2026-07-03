<script lang="ts">
	import OpacitySetting from '$lib/components/settings/opacity-setting.svelte';
</script>

<!-- Le choix/édition de l'échelle de couleur reste dans la légende (scale.svelte) :
     cette section porte les réglages de style du calque affiché. -->
<div class="overflow-hidden rounded-xl bg-white/[0.04]">
	<OpacitySetting />
</div>
