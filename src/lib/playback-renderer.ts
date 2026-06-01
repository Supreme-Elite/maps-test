import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Wait for the map to become idle (no in-flight tile loads, all paints done),
 * or reject on timeout or abort signal. Acts as a safety net in case the
 * SlotManager `commit` event fires before all auxiliary layers (hillshade,
 * labels) are painted.
 */
export const waitForIdle = (
	map: MaplibreMap,
	timeoutMs: number,
	signal?: AbortSignal
): Promise<void> =>
	new Promise<void>((resolve, reject) => {
		let settled = false;
		const cleanup = () => {
			clearTimeout(timeoutId);
			map.off('idle', onIdle);
			signal?.removeEventListener('abort', onAbort);
		};
		const settle = (fn: () => void) => {
			if (settled) return;
			settled = true;
			cleanup();
			fn();
		};
		const onIdle = () => settle(() => resolve());
		const onAbort = () => settle(() => reject(new Error('waitForIdle aborted')));
		const timeoutId = setTimeout(
			() => settle(() => reject(new Error(`waitForIdle timeout after ${timeoutMs}ms`))),
			timeoutMs
		);
		if (signal?.aborted) {
			settle(() => reject(new Error('waitForIdle aborted')));
			return;
		}
		signal?.addEventListener('abort', onAbort);
		map.once('idle', onIdle);
	});
