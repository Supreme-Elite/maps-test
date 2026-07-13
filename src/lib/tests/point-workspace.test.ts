import { get } from 'svelte/store';

import { describe, expect, it } from 'vitest';

import { pointWorkspace } from '$lib/stores/point-workspace';

describe('pointWorkspace', () => {
	it('open positionne le point et ouvre ; close réinitialise', () => {
		pointWorkspace.open(48.85, 2.35);
		expect(get(pointWorkspace)).toEqual({ open: true, lat: 48.85, lng: 2.35 });
		pointWorkspace.close();
		expect(get(pointWorkspace)).toEqual({ open: false, lat: null, lng: null });
	});
});
