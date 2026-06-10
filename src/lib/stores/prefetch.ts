import { persisted } from 'svelte-persisted-store';

import type { PrefetchMode } from '$lib/prefetch';

/**
 * Plage d'échéances partagée entre le bouton de préchargement et la lecture
 * (bouton play) : Aujourd'hui / 24 h suivantes / 24 h précédentes / Run complet.
 */
export const prefetchMode = persisted<PrefetchMode>('prefetch_mode', 'completeModelRun');
