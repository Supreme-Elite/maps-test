import { get } from 'svelte/store';

import * as maplibregl from 'maplibre-gl';
import { mode } from 'mode-watcher';
import { toast } from 'svelte-sonner';

import { map as m } from '$lib/stores/map';
import { loading, opacity, opacity2, preferences as p } from '$lib/stores/preferences';
import { metaJson as mJ, time } from '$lib/stores/time';
import { domain as d, layer2Enabled, variable2 } from '$lib/stores/variables';
import { vectorOptions as vO } from '$lib/stores/vector';

import {
	ANOMALY_DOMAIN,
	BEFORE_LAYER_RASTER,
	BEFORE_LAYER_RASTER_SECONDARY,
	BEFORE_LAYER_VECTOR,
	BEFORE_LAYER_VECTOR_WATER_CLIP,
	HILLSHADE_LAYER
} from '$lib/constants';
import { SLOT_EVENT_COMMIT, SLOT_EVENT_ERROR, slotEvents } from '$lib/slot-events';
import { type SlotLayer, SlotManager } from '$lib/slot-manager';
import {
	type ArrowStyle,
	type ContourStyle,
	buildArrowColorExpr,
	buildArrowWidthExpr,
	buildContourColorExpr,
	buildContourWidthExpr,
	defaultArrowStyle,
	defaultContourStyle
} from '$lib/vector-styles';

import { refreshPopup } from './popup';
import { currentOmUrl, currentOmUrl2 } from './stores/om-url';
import { anomalyPhase, getOMUrl, getOMUrlFor, getWindOverlayUrl, provisionalDateSet } from './url';

// =============================================================================
// Expression helpers
// =============================================================================

const isDark = (): boolean => mode.current === 'dark';
const lightOrDark = (light: string, dark: string): string => (isDark() ? dark : light);

/** Facteur d'opacité appliqué aux jours d'anomalie provisoires (estimation
 *  ARPEGE en attendant ERA5) : rendu plus pâle pour les distinguer du définitif. */
const PROVISIONAL_OPACITY_FACTOR = 0.45;

const getRasterOpacity = (): number => {
	const opacityValue = get(opacity) / 100;
	const base = isDark() ? Math.max(0, (opacityValue * 100 - 10) / 100) : opacityValue;
	if (get(d) === ANOMALY_DOMAIN) {
		const phase = anomalyPhase(get(time), new Date(), provisionalDateSet(get(mJ)));
		if (phase === 'provisional') return base * PROVISIONAL_OPACITY_FACTOR;
	}
	return base;
};

// Accesseurs de style (Task 5 les fera lire depuis les stores persistés).
const getArrowStyle = (): ArrowStyle => defaultArrowStyle;
const getContourStyle = (): ContourStyle => defaultContourStyle;

// =============================================================================
// Layer definitions
// =============================================================================

const rasterLayer = (): SlotLayer => ({
	id: 'omRasterLayer',
	opacityProp: 'raster-opacity',
	commitOpacity: getRasterOpacity(),
	add: (map, sourceId, layerId, beforeLayer) => {
		map.addLayer(
			{
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': 0.0,
					'raster-opacity-transition': { duration: 2, delay: 0 }
				}
			},
			beforeLayer
		);
	}
});

const getRasterOpacity2 = (): number => {
	const opacityValue = get(opacity2) / 100;
	return isDark() ? Math.max(0, (opacityValue * 100 - 10) / 100) : opacityValue;
};

const rasterLayer2 = (): SlotLayer => ({
	id: 'omRasterLayer2',
	opacityProp: 'raster-opacity',
	commitOpacity: getRasterOpacity2(),
	add: (map, sourceId, layerId, beforeLayer) => {
		map.addLayer(
			{
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': 0.0,
					'raster-opacity-transition': { duration: 2, delay: 0 }
				}
			},
			beforeLayer
		);
	}
});

const vectorArrowLayer = (): SlotLayer => ({
	id: 'omVectorArrowLayer',
	opacityProp: 'line-opacity',
	commitOpacity: 1,
	add: (map, sourceId, layerId, beforeLayer) => {
		const vectorOptions = get(vO);
		if (!vectorOptions.arrows) return;
		map.addLayer(
			{
				id: layerId,
				type: 'line',
				source: sourceId,
				'source-layer': 'wind-arrows',
				paint: {
					'line-opacity': 0,
					'line-opacity-transition': { duration: 200, delay: 0 },
					'line-color': buildArrowColorExpr(getArrowStyle(), isDark()),
					'line-width': buildArrowWidthExpr(getArrowStyle())
				},
				layout: { 'line-cap': 'round' }
			},
			beforeLayer
		);
	}
});

const vectorGridLayer = (): SlotLayer => ({
	id: 'omVectorGridLayer',
	opacityProp: 'circle-opacity',
	commitOpacity: 1,
	add: (map, sourceId, layerId, beforeLayer) => {
		const vectorOptions = get(vO);
		if (!vectorOptions.grid) return;
		map.addLayer(
			{
				id: layerId,
				type: 'circle',
				source: sourceId,
				'source-layer': 'grid',
				paint: {
					'circle-opacity': 0,
					'circle-opacity-transition': { duration: 200, delay: 0 },
					'circle-radius': ['interpolate', ['exponential', 1.5], ['zoom'], 0, 0.1, 12, 10],
					'circle-color': 'orange'
				}
			},
			beforeLayer
		);
	}
});

const vectorContourLayer = (): SlotLayer => ({
	id: 'omVectorContourLayer',
	opacityProp: 'line-opacity',
	commitOpacity: 1,
	add: (map, sourceId, layerId, beforeLayer) => {
		const vectorOptions = get(vO);
		if (!vectorOptions.contours) return;
		map.addLayer(
			{
				id: layerId,
				type: 'line',
				source: sourceId,
				'source-layer': 'contours',
				paint: {
					'line-opacity': 0,
					'line-opacity-transition': { duration: 200, delay: 0 },
					'line-color': buildContourColorExpr(getContourStyle(), isDark()),
					'line-width': buildContourWidthExpr(getContourStyle())
				}
			},
			beforeLayer
		);
	}
});

const vectorContourLabelsLayer = (): SlotLayer => ({
	id: 'omVectorContourLayerLabels',
	opacityProp: 'text-opacity',
	commitOpacity: 1,
	add: (map, sourceId, layerId, beforeLayer) => {
		const vectorOptions = get(vO);
		if (!vectorOptions.contours) return;
		map.addLayer(
			{
				id: layerId,
				type: 'symbol',
				source: sourceId,
				'source-layer': 'contours',
				layout: {
					'symbol-placement': 'line-center',
					'symbol-spacing': 1,
					'text-font': ['Noto Sans Regular'],
					'text-field': ['to-string', ['get', 'value']],
					'text-padding': 1,
					'text-offset': [0, -0.6]
				},
				paint: {
					'text-opacity': 0,
					'text-opacity-transition': { duration: 200, delay: 0 },
					'text-color': lightOrDark('rgba(0,0,0, 0.7)', 'rgba(255,255,255, 0.8)')
				}
			},
			beforeLayer
		);
	}
});

// =============================================================================
// Manager instances
// =============================================================================

export let rasterManager: SlotManager | undefined;
export let rasterManager2: SlotManager | undefined;
export let vectorManager: SlotManager | undefined;

const buildRasterManager2 = (map: maplibregl.Map): SlotManager =>
	new SlotManager(map, {
		sourceIdPrefix: 'omRasterSource2',
		beforeLayer: BEFORE_LAYER_RASTER_SECONDARY,
		layerFactory: () => [rasterLayer2()],
		sourceSpec: (sourceUrl) => ({ url: sourceUrl, type: 'raster', maxzoom: 14 }),
		removeDelayMs: 300,
		// Overlay optionnel : si la variable choisie n'existe pas pour le domaine
		// (ex. arome_france_convection → 404), on efface la couche au lieu de
		// laisser celle du modèle précédent figée. Cf. vectorManager.
		clearOnError: true,
		onCommit: () => refreshPopup(),
		onError: () => {},
		slowLoadWarningMs: 10000,
		onSlowLoad: () => {}
	});

// `clipWater` ("masquer les océans") insère les couches OMfile avant la couche
// `water-clip` du basemap. Le style OpenFreeMap embarqué ne fournit pas cette
// couche : on retombe alors sur BEFORE_LAYER_VECTOR pour éviter un addLayer sur
// un beforeId inexistant (qui ferait planter MapLibre). Fonctionnalité dormante
// tant qu'aucun basemap n'expose `water-clip`.
const resolveVectorBeforeLayer = (map: maplibregl.Map, clipWater: boolean): string =>
	clipWater && map.getLayer(BEFORE_LAYER_VECTOR_WATER_CLIP)
		? BEFORE_LAYER_VECTOR_WATER_CLIP
		: BEFORE_LAYER_VECTOR;

export const createManagers = (): void => {
	const map = get(m);
	if (!map) return;

	const preferences = get(p);

	rasterManager = new SlotManager(map, {
		sourceIdPrefix: 'omRasterSource',
		beforeLayer: preferences.hillshade ? HILLSHADE_LAYER : BEFORE_LAYER_RASTER,
		layerFactory: () => [rasterLayer()],
		sourceSpec: (sourceUrl) => ({
			url: sourceUrl,
			type: 'raster',
			maxzoom: 14
		}),
		removeDelayMs: 300,
		// Both raster and vector fire commit on slotEvents (bus conservé, sans consommateur actuel).
		onCommit: () => {
			loading.set(false);
			refreshPopup();
			slotEvents.dispatchEvent(new Event(SLOT_EVENT_COMMIT));
		},
		onError: () => {
			loading.set(false);
			slotEvents.dispatchEvent(new Event(SLOT_EVENT_ERROR));
		},
		slowLoadWarningMs: 10000,
		onSlowLoad: () =>
			toast.warning(
				'Le chargement des données raster peut être limité par votre bande passante ou la vitesse du serveur amont.'
			)
	});

	rasterManager2 = buildRasterManager2(map);

	vectorManager = new SlotManager(map, {
		sourceIdPrefix: 'omVectorSource',
		beforeLayer: resolveVectorBeforeLayer(map, preferences.clipWater),
		layerFactory: () => [
			vectorArrowLayer(),
			vectorGridLayer(),
			vectorContourLayer(),
			vectorContourLabelsLayer()
		],
		sourceSpec: (sourceUrl) => ({ url: sourceUrl, type: 'vector' }),
		removeDelayMs: 250,
		// Si la source vectorielle échoue (ex. domaine sans `wind_u_component_*`,
		// comme arome_france_convection → 404), on efface les flèches au lieu de
		// laisser celles du modèle précédent figées à l'écran.
		clearOnError: true,
		onCommit: () => slotEvents.dispatchEvent(new Event(SLOT_EVENT_COMMIT)),
		onError: () => slotEvents.dispatchEvent(new Event(SLOT_EVENT_ERROR))
	});
};

// =============================================================================
// Public layer API
// =============================================================================

export const addOmFileLayers = (): void => {
	const map = get(m);
	if (!map) return;
	const omUrl = getOMUrl();
	createManagers();
	if (omUrl) rasterManager?.update('om://' + omUrl);
	if (omUrl) {
		const windUrl = getWindOverlayUrl();
		vectorManager?.update('om://' + (windUrl ?? omUrl));
	}
	if (get(layer2Enabled)) {
		const omUrl2 = getOMUrlFor(get(variable2));
		if (omUrl2) {
			currentOmUrl2.set(omUrl2);
			rasterManager2?.update('om://' + omUrl2);
		}
	}
};

export const changeOMfileURL = (vectorOnly = false, rasterOnly = false): void => {
	const map = get(m);
	if (!map) return;

	const omUrl = getOMUrl();
	if (get(currentOmUrl) == omUrl || !omUrl) return;
	currentOmUrl.set(omUrl);

	loading.set(true);

	const preferences = get(p);
	vectorManager?.setBeforeLayer(resolveVectorBeforeLayer(map, preferences.clipWater));
	rasterManager?.setBeforeLayer(preferences.hillshade ? HILLSHADE_LAYER : BEFORE_LAYER_RASTER);

	if (!vectorOnly) rasterManager?.update('om://' + omUrl);
	if (!rasterOnly) {
		const windUrl = getWindOverlayUrl();
		if (windUrl) {
			vectorManager?.update('om://' + windUrl);
		} else {
			// Legacy behavior: vector is rendered if the primary variable is itself a wind variable.
			vectorManager?.update('om://' + omUrl);
		}
	}

	if (!vectorOnly) {
		if (get(layer2Enabled)) {
			const map = get(m);
			if (map && !rasterManager2) {
				rasterManager2 = buildRasterManager2(map);
			}
			const omUrl2 = getOMUrlFor(get(variable2));
			if (omUrl2 && get(currentOmUrl2) !== omUrl2) {
				currentOmUrl2.set(omUrl2);
				rasterManager2?.update('om://' + omUrl2);
			}
		} else {
			rasterManager2?.destroy();
			rasterManager2 = undefined;
			currentOmUrl2.set('');
		}
	}
};
