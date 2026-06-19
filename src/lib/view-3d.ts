import { get } from 'svelte/store';

import { map as mapStore } from '$lib/stores/map';
import { defaultPreferences, preferences } from '$lib/stores/preferences';

import { VIEW_3D_EXAGGERATION, VIEW_3D_PITCH } from '$lib/constants';

import { updateUrl } from './url';

const TERRAIN_SOURCE = 'terrainSource2';

/**
 * Préset de vue 3D : oriente la caméra en perspective + relève le relief, ou
 * rétablit la vue à plat. Réutilise l'état partagé `preferences.terrain` + l'URL
 * (mêmes clés que `terrainHandler`), donc pas de désynchro avec le TerrainControl
 * natif. Le bearing n'est jamais modifié.
 */
export function applyView3D(on: boolean): void {
	const m = get(mapStore);
	if (!m) return;
	if (on) {
		m.easeTo({ pitch: VIEW_3D_PITCH });
		m.setTerrain({ source: TERRAIN_SOURCE, exaggeration: VIEW_3D_EXAGGERATION });
	} else {
		m.easeTo({ pitch: 0 });
		m.setTerrain(null);
	}
	preferences.update((p) => ({ ...p, terrain: on }));
	updateUrl('terrain', String(on), String(defaultPreferences.terrain));
}
