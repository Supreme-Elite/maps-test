<script lang="ts">
	import { onDestroy } from 'svelte';

	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import XIcon from '@lucide/svelte/icons/x';
	import * as maplibregl from 'maplibre-gl';

	import { map } from '$lib/stores/map';
	import { pointWorkspace } from '$lib/stores/point-workspace';
	import { desktop, pointDrawerHeight, sidebarWidth } from '$lib/stores/preferences';
	import { selectedDomain } from '$lib/stores/variables';

	import Meteogram from './meteogram/meteogram.svelte';

	const DEFAULT_HEIGHT = 320;
	const MIN_HEIGHT = 220;
	const RESIZE_STEP = 24;

	let height = $state(DEFAULT_HEIGHT);
	let maxHeight = $state(DEFAULT_HEIGHT);
	let meteogramComp = $state<ReturnType<typeof Meteogram>>();
	// Altitude du point (modèle), publiée par le meteogram et affichée dans l'en-tête.
	let elevation = $state<number | null>(null);
	let sectionEl = $state<HTMLElement>();

	// Fermeture au clic hors du tiroir (« dismiss »). On écoute `click` (pas
	// `pointerdown`) pour ne PAS fermer pendant un panoramique de la carte (un pan
	// ne produit pas de `click`). L'effet ne tourne que tant que le tiroir est monté
	// (composant sous `{#if open}`) → le clic d'ouverture (bouton du popup) a déjà
	// fini de se propager quand l'écouteur est ajouté, il ne se referme pas seul.
	$effect(() => {
		if (typeof window === 'undefined') return;
		function onClick(e: MouseEvent) {
			if (!sectionEl) return;
			// `composedPath()` = chemin de propagation figé au dispatch → robuste si la
			// cible est détachée pendant le handler (ex. le ✕ de l'encart qui se retire
			// du DOM en se masquant : `contains(e.target)` renverrait alors faux à tort
			// et fermerait tout le tiroir). On teste l'appartenance sur ce chemin.
			const path = e.composedPath();
			if (path.includes(sectionEl)) return; // clic dans le tiroir
			if (path.some((n) => n instanceof Element && n.classList.contains('popup'))) return; // bulle-viseur
			pointWorkspace.close();
		}
		window.addEventListener('click', onClick);
		return () => window.removeEventListener('click', onClick);
	});

	// Fermeture au tap sur la CARTE : on écoute l'événement `click` de MapLibre
	// (fiable au tactile, contrairement au `click` DOM que MapLibre supprime souvent
	// au tap — d'où un clic hors cadre qui ne fermait pas sur mobile/tablette).
	// L'ouverture se fait via le bouton du popup (pas un clic carte) → pas d'auto-
	// fermeture à l'ouverture.
	$effect(() => {
		const currentMap = $map;
		if (!currentMap) return;
		const close = (e: maplibregl.MapMouseEvent) => {
			// Le bouton « Météogramme » vit dans le marker MapLibre (conteneur canvas) :
			// le tap qui OUVRE le tiroir déclenche aussi ce `click`. On ignore donc les
			// clics dont la cible est dans la bulle `.popup` — sinon le tiroir se
			// refermerait aussitôt ouvert.
			const t = e.originalEvent?.target;
			if (t instanceof Element && t.closest('.popup')) return;
			pointWorkspace.close();
		};
		currentMap.on('click', close);
		return () => currentMap.off('click', close);
	});

	// Réserve basse dégageant l'axe des heures de la barre d'adresse Safari iOS
	// (~50pt) : sur iPhone, cette barre recouvre le bas du viewport web et n'est
	// exposée par AUCUNE API (ni `env(safe-area-inset-bottom)`, qui vaut 0 quand la
	// barre est visible, ni `visualViewport`, qui rapporte le même viewport —
	// mesuré sur l'appareil : innerH=clientH=vvH). Seule une réserve fixe fonctionne.
	// 0,5rem sur desktop (pas de barre), 3,5rem sur mobile. Le chart étant en
	// flex-1, ce padding remonte d'autant la zone de tracé.
	const bottomPad = $derived(desktop.current ? '0.5rem' : '3.5rem');

	function handleExport() {
		const lat = $pointWorkspace.lat;
		const lng = $pointWorkspace.lng;
		if (lat === null || lng === null) return;
		meteogramComp?.exportPng(`meteogram_${lat.toFixed(3)}_${lng.toFixed(3)}.png`);
	}

	// Marqueur dédié matérialisant le point choisi pour le meteogram, distinct du
	// popup de valeur (couleur ambre) — créé/déplacé/retiré selon l'état du tiroir.
	let pinMarker: maplibregl.Marker | undefined;

	$effect(() => {
		const currentMap = $map;
		const { open, lat, lng } = $pointWorkspace;

		if (!currentMap || !open || lat === null || lng === null) {
			pinMarker?.remove();
			pinMarker = undefined;
			return;
		}

		if (!pinMarker) {
			pinMarker = new maplibregl.Marker({ color: '#f59e0b' })
				.setLngLat([lng, lat])
				.addTo(currentMap);
		} else {
			pinMarker.setLngLat([lng, lat]);
		}
	});

	onDestroy(() => {
		pinMarker?.remove();
		pinMarker = undefined;
		pointDrawerHeight.set(0);
	});

	// Publie la hauteur occupée par le tiroir (0 quand fermé) pour que la légende
	// et les contrôles MapLibre bas-droite se placent au-dessus (cf. preferences.ts).
	$effect(() => {
		pointDrawerHeight.set($pointWorkspace.open ? height : 0);
	});

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
		// Mobile (< md) : le tiroir occupe une bonne moitié basse de l'écran pour
		// que le graphe respire (à 40 % la zone de tracé tombait à ~166 px). Sur
		// desktop, ~42 % suffit (écran large). Lecture NON réactive de innerWidth :
		// garde l'effet à un seul run (cf. avertissement sur le reset de `height`).
		const fraction = window.innerWidth < 768 ? 0.64 : 0.42;
		height = Math.max(
			MIN_HEIGHT,
			Math.min(initialMaxHeight, Math.round(window.innerHeight * fraction))
		);

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
		bind:this={sectionEl}
		class="bg-glass glass-blur fixed right-0 bottom-0 z-40 flex flex-col border-t border-sky-500/30 text-white"
		style={`height:${height}px;left:${$sidebarWidth}px`}
		aria-label="Espace point — météogramme"
	>
		<!-- Onglet de fermeture (au-dessus du bord du tiroir) : moyen SÛR de fermer sur
		     tout appareil — le tap hors cadre est capricieux au tactile (MapLibre traite
		     beaucoup de touchers comme des gestes carte). Grande cible tactile, centrée. -->
		<button
			class="bg-glass glass-blur absolute -top-6 left-1/2 z-10 flex h-6 w-16 -translate-x-1/2 items-center justify-center rounded-t-lg border border-b-0 border-sky-500/30 text-white/80 hover:text-white"
			aria-label="Fermer le météogramme"
			title="Fermer le météogramme"
			onclick={() => pointWorkspace.close()}
		>
			<ChevronDownIcon class="size-5" aria-hidden="true" />
		</button>
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
		<!-- En-tête compact : tout sur une ligne (le label du modèle tronque au
		     besoin), boutons en icônes sur mobile. Évite le retour à la ligne sur
		     3 lignes qui grignotait la hauteur utile du graphe. -->
		<header class="flex shrink-0 items-center gap-2 px-3 py-1.5 text-sm">
			<span class="shrink-0 tabular-nums">
				<span class="hidden sm:inline">Météogramme —&nbsp;</span>{$pointWorkspace.lat.toFixed(3)},
				{$pointWorkspace.lng.toFixed(3)}
			</span>
			<span
				class="min-w-0 flex-1 truncate text-xs text-sky-300"
				title={elevation !== null ? 'Altitude du point (modèle)' : undefined}
			>
				{$selectedDomain.label} · dernier run{elevation !== null
					? ` · ${Math.round(elevation)} m`
					: ''}
			</span>
			<button
				class="flex shrink-0 items-center gap-1 rounded px-2 py-1 hover:bg-white/10"
				onclick={handleExport}
				aria-label="Exporter en PNG"
				title="Exporter en PNG"
			>
				<DownloadIcon class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">Exporter PNG</span>
			</button>
			<button
				class="shrink-0 rounded p-1 hover:bg-white/10"
				aria-label="Fermer"
				onclick={() => pointWorkspace.close()}
			>
				<XIcon class="size-4" aria-hidden="true" />
			</button>
		</header>
		<div class="flex-1 overflow-y-auto px-2" style="padding-bottom: {bottomPad}">
			<Meteogram
				bind:this={meteogramComp}
				bind:elevation
				lat={$pointWorkspace.lat}
				lng={$pointWorkspace.lng}
			/>
		</div>
	</section>
{/if}
