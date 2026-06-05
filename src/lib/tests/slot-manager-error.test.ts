import { describe, expect, it } from 'vitest';

import { SlotManager } from '$lib/slot-manager';

/**
 * Minimal fake of the MapLibre API surface used by SlotManager. Tracks sources
 * and layers in plain Maps and lets the test drive `loaded()` and fire
 * `sourcedata` / `error` events manually.
 */
class FakeMap {
	nextLoaded = true;
	sources = new Map<string, { _loaded: boolean; loaded(): boolean }>();
	layers = new Map<string, { source: string }>();
	private listeners: Record<string, Set<(e: unknown) => void>> = {};

	style = {
		getSource: (id: string) => this.sources.get(id)
	};

	getStyle() {
		return {
			layers: [...this.layers.entries()].map(([id, v]) => ({ id, source: v.source }))
		};
	}

	getSource(id: string) {
		return this.sources.get(id);
	}

	addSource(id: string) {
		const loaded = this.nextLoaded;
		this.sources.set(id, {
			_loaded: loaded,
			loaded() {
				return this._loaded;
			}
		});
	}

	removeSource(id: string) {
		this.sources.delete(id);
	}

	addLayer(spec: { id: string; source: string }) {
		this.layers.set(spec.id, { source: spec.source });
	}

	getLayer(id: string) {
		return this.layers.get(id);
	}

	removeLayer(id: string) {
		this.layers.delete(id);
	}

	setPaintProperty() {
		/* noop */
	}

	on(type: string, fn: (e: unknown) => void) {
		(this.listeners[type] ??= new Set()).add(fn);
	}

	off(type: string, fn: (e: unknown) => void) {
		this.listeners[type]?.delete(fn);
	}

	fire(type: string, e: unknown) {
		for (const fn of this.listeners[type] ?? []) fn(e);
	}

	hasLayer(id: string) {
		return this.layers.has(id);
	}
}

function makeManager(map: FakeMap, clearOnError: boolean) {
	return new SlotManager(map as never, {
		sourceIdPrefix: 'vec',
		beforeLayer: 'before',
		removeDelayMs: 0,
		clearOnError,
		sourceSpec: (url: string) => ({ type: 'vector', tiles: [url] }) as never,
		layerFactory: () => [
			{
				id: 'arrow',
				opacityProp: 'line-opacity',
				commitOpacity: 1,
				add: (m, sourceId, layerId) =>
					(m as unknown as FakeMap).addLayer({ id: layerId, source: sourceId })
			}
		]
	});
}

describe('SlotManager clearOnError', () => {
	it('clears stale arrows when the new source errors (no frozen previous slot)', () => {
		const map = new FakeMap();
		const mgr = makeManager(map, true);

		// First update loads synchronously and commits → slot A is active/visible.
		map.nextLoaded = true;
		mgr.update('om://urlA');
		expect(map.hasLayer('arrow_A')).toBe(true);

		// Second update: source does not load; pending slot B added, A still visible.
		map.nextLoaded = false;
		mgr.update('om://urlB');
		expect(map.hasLayer('arrow_B')).toBe(true);
		expect(map.hasLayer('arrow_A')).toBe(true);

		// The new source errors (e.g. wind variable 404 on a domain without wind).
		map.fire('error', { sourceId: 'vec_B' });

		// Both the failed pending slot AND the stale previous slot must be gone.
		expect(map.hasLayer('arrow_B')).toBe(false);
		expect(map.hasLayer('arrow_A')).toBe(false);
	});

	it('without clearOnError, the previous slot is kept on error (raster behavior)', () => {
		const map = new FakeMap();
		const mgr = makeManager(map, false);

		map.nextLoaded = true;
		mgr.update('om://urlA');
		map.nextLoaded = false;
		mgr.update('om://urlB');
		map.fire('error', { sourceId: 'vec_B' });

		// Previous slot stays visible (last-good image) — unchanged legacy behavior.
		expect(map.hasLayer('arrow_A')).toBe(true);
	});
});
