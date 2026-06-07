import { persisted } from 'svelte-persisted-store';

// Thème du FOND DE CARTE (basemap MapLibre), indépendant du chrome.
// Le chrome (barre, panneaux, dropdowns) reste un overlay verre dépoli SOMBRE en
// permanence (dark mode forcé via mode-watcher) ; seul le fond de carte bascule
// clair/sombre. getStyle() (map-controls.ts) lit ce store ; le toggle « Mode sombre »
// (advanced-panel.svelte) le pilote ; un $effect dans +page.svelte ré-applique le
// style à chaque changement.
export type BasemapTheme = 'light' | 'dark';

// Par défaut on suit la préférence système au tout premier chargement ; le choix
// fait via le toggle est ensuite persisté et prioritaire.
const osPrefersLight =
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-color-scheme: light)').matches;

export const DEFAULT_BASEMAP_THEME: BasemapTheme = osPrefersLight ? 'light' : 'dark';

export const basemapTheme = persisted<BasemapTheme>('basemap_theme', DEFAULT_BASEMAP_THEME);
