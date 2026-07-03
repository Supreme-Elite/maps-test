<script lang="ts">
	import { pointWorkspace } from '$lib/stores/point-workspace';
	import { selectedDomain } from '$lib/stores/variables';

	import Meteogram from './meteogram/meteogram.svelte';

	const DEFAULT_HEIGHT = 320;
	const MIN_HEIGHT = 220;
	const RESIZE_STEP = 24;

	let height = $state(DEFAULT_HEIGHT);
	let maxHeight = $state(DEFAULT_HEIGHT);

	function computeMaxHeight() {
		return Math.round(window.innerHeight * 0.7);
	}

	function clampHeight(value: number) {
		return Math.max(MIN_HEIGHT, Math.min(maxHeight, value));
	}

	// `window` n'existe pas au rendu serveur : la valeur par défaut ci-dessus
	// sert de repli sûr, ajustée à la taille réelle du viewport une fois montée
	// (build statique sans SSR, mais on reste défensif).
	//
	// Le calcul de la hauteur initiale évite `clampHeight` (qui lit l'état
	// réactif `maxHeight`) : sinon l'effet dépendrait d'un état qu'il écrit
	// lui-même, et toute écriture ultérieure de `maxHeight` par `onResize`
	// (déclenchée par un simple événement DOM, hors du run de l'effet) le
	// re-déclencherait — réinitialisant `height` à sa valeur par défaut et
	// écrasant la hauteur choisie par l'utilisateur à chaque redimensionnement
	// de fenêtre.
	$effect(() => {
		if (typeof window === 'undefined') return;
		const initialMaxHeight = computeMaxHeight();
		maxHeight = initialMaxHeight;
		height = Math.max(MIN_HEIGHT, Math.min(initialMaxHeight, Math.round(window.innerHeight * 0.4)));

		function onResize() {
			maxHeight = computeMaxHeight();
			height = clampHeight(height);
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	function startResize(e: PointerEvent) {
		const startY = e.clientY;
		const startH = height;
		const move = (ev: PointerEvent) => {
			height = clampHeight(startH + (startY - ev.clientY));
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	function handleResizeKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			height = clampHeight(height + RESIZE_STEP);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			height = clampHeight(height - RESIZE_STEP);
		}
	}
</script>

{#if $pointWorkspace.open && $pointWorkspace.lat !== null && $pointWorkspace.lng !== null}
	<section
		class="bg-glass glass-blur fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-sky-500/30 text-white"
		style={`height:${height}px`}
		aria-label="Espace point — meteogram"
	>
		<!--
			Poignée de redimensionnement : un « separator » focusable qui pilote une
			valeur (hauteur du tiroir) implémente en réalité le pattern clavier d'un
			slider (ARIA l'autorise explicitement — cf. aria-valuenow/min/max ci-
			dessous et le handler ArrowUp/ArrowDown). `aria-query`/Svelte classent
			toutefois `separator` comme un rôle structurel non interactif et
			signalent le tabindex + les listeners comme suspects ; on ignore ces
			deux règles ponctuellement plutôt que de renoncer au clavier.
		-->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="h-1.5 shrink-0 cursor-ns-resize"
			role="separator"
			aria-orientation="horizontal"
			aria-label="Redimensionner le tiroir"
			aria-valuenow={height}
			aria-valuemin={MIN_HEIGHT}
			aria-valuemax={maxHeight}
			tabindex="0"
			onpointerdown={startResize}
			onkeydown={handleResizeKeydown}
		></div>
		<header class="flex shrink-0 items-center justify-between gap-2 px-3 py-1 text-sm">
			<span class="tabular-nums">
				Meteogram — {$pointWorkspace.lat.toFixed(3)}, {$pointWorkspace.lng.toFixed(3)}
			</span>
			<span class="text-xs text-sky-300">{$selectedDomain.label} · dernier run</span>
			<div class="flex items-center gap-2">
				<!-- bouton export câblé en Task 12 -->
				<button
					class="rounded px-2 py-1 hover:bg-white/10"
					aria-label="Fermer"
					onclick={() => pointWorkspace.close()}
				>
					✕
				</button>
			</div>
		</header>
		<div class="flex-1 overflow-y-auto px-2 pb-2">
			<Meteogram lat={$pointWorkspace.lat} lng={$pointWorkspace.lng} />
		</div>
	</section>
{/if}
