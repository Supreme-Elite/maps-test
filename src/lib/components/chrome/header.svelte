<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings-2';

	import { advancedOpen } from '$lib/stores/preferences';

	const SITE_URL = 'https://www.infoclimat.fr';
	const LOGO_URL = 'https://static.infoclimat.net/images/v5.1/logo_IC_5.1.png';
</script>

<!-- Header fin pleine largeur (44 px), calqué sur app.precip.ai/map :
     marque à gauche, onglets pilule (un seul en v1 — réserve l'emplacement
     des futures pages), « Réglages » à droite (ouvre le panneau Avancé). -->
<header
	class="bg-glass/45 fixed inset-x-0 top-0 z-60 flex h-11 items-center gap-3 border-b border-white/15 px-2.5 shadow-lg glass-blur"
>
	<a href={SITE_URL} title="Infoclimat" rel="noopener" class="flex h-11 shrink-0 items-center">
		<img src={LOGO_URL} alt="Infoclimat" class="h-6 w-auto" crossorigin="anonymous" />
	</a>

	<nav aria-label="Navigation principale" class="flex items-center">
		<span
			aria-current="page"
			class="rounded-full bg-white/12 px-3 py-1 text-sm font-medium text-white"
		>
			Carte
		</span>
	</nav>

	<button
		type="button"
		onclick={() => advancedOpen.update((v) => !v)}
		aria-label="Réglages avancés"
		class="bg-glass/50 hover:bg-glass/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ml-auto flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white shadow-md md:h-8"
	>
		<SettingsIcon class="size-4" aria-hidden="true" />
		<span class="hidden sm:inline">Réglages</span>
	</button>
</header>
