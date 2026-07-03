import { describe, expect, it } from 'vitest';

import { dayTicks, linScale, niceExtent, timeToX } from '$lib/meteogram/scales';

describe('linScale', () => {
	it('mappe linéairement domaine→range', () => {
		const s = linScale(0, 10, 0, 100);
		expect(s(0)).toBe(0);
		expect(s(5)).toBe(50);
		expect(s(10)).toBe(100);
	});
});

describe('timeToX', () => {
	it('mappe le 1er temps sur padLeft et le dernier sur width-padRight', () => {
		const times = [new Date('2026-07-03T00:00Z'), new Date('2026-07-03T12:00Z')];
		const x = timeToX(times, 200, 10, 10);
		expect(x(times[0])).toBeCloseTo(10);
		expect(x(times[1])).toBeCloseTo(190);
	});
});

describe('niceExtent', () => {
	it('ignore les null et ajoute une marge', () => {
		expect(niceExtent([0, null, 10], 0)).toEqual([0, 10]);
		const [lo, hi] = niceExtent([0, 10], 0.1);
		expect(lo).toBeLessThan(0);
		expect(hi).toBeGreaterThan(10);
	});
	it('renvoie une plage non nulle si toutes valeurs égales', () => {
		const [lo, hi] = niceExtent([5, 5, 5]);
		expect(hi).toBeGreaterThan(lo);
	});
});

describe('dayTicks', () => {
	it('repère les minuits UTC', () => {
		const times = [
			new Date('2026-07-03T22:00Z'),
			new Date('2026-07-03T23:00Z'),
			new Date('2026-07-04T00:00Z'),
			new Date('2026-07-04T01:00Z')
		];
		expect(dayTicks(times).map((t) => t.index)).toEqual([2]);
	});
});
