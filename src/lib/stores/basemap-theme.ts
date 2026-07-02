import { persisted } from 'svelte-persisted-store';

// Thème du FOND DE CARTE (basemap MapLibre), indépendant du chrome.
// Le chrome (barre, panneaux, dropdowns) reste un overlay verre dépoli SOMBRE en
// permanence (dark mode forcé via mode-watcher) ; seul le fond de carte bascule
// clair/sombre. getStyle() (map-controls.ts) lit ce store ; le toggle « Mode sombre »
// (advanced-panel.svelte) le pilote ; un $effect dans +page.svelte ré-applique le
// style à chaque changement.
export type BasemapTheme = 'light' | 'dark';

// Par défaut : fond de carte CLAIR pour tout le monde. Le mode sombre est opt-in
// — on ne suit plus prefers-color-scheme de l'OS — et se pilote via le toggle
// « Fond de carte sombre » (Affichage). Le choix fait via le toggle est ensuite
// persisté et prioritaire aux chargements suivants.
export const DEFAULT_BASEMAP_THEME: BasemapTheme = 'light';

export const basemapTheme = persisted<BasemapTheme>('basemap_theme', DEFAULT_BASEMAP_THEME);
