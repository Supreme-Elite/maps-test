import { type Writable, writable } from 'svelte/store';

export type PlaybackStatus = 'idle' | 'prefetching' | 'playing' | 'paused';

export const playbackStatus: Writable<PlaybackStatus> = writable('idle');

export const playbackStart: Writable<Date | undefined> = writable(undefined);
export const playbackEnd: Writable<Date | undefined> = writable(undefined);

export const playbackPrefetchProgress: Writable<{ current: number; total: number } | null> =
	writable(null);
