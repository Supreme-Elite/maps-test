import { describe, expect, it } from 'vitest';

import { linePath } from '$lib/meteogram/paths';

describe('linePath', () => {
	it('génère un tracé continu', () => {
		expect(
			linePath([
				{ x: 0, y: 10 },
				{ x: 5, y: 20 }
			])
		).toBe('M0,10 L5,20');
	});
	it('interrompt le trait sur null (nouveau sous-tracé)', () => {
		expect(
			linePath([
				{ x: 0, y: 10 },
				{ x: 5, y: null },
				{ x: 10, y: 30 }
			])
		).toBe('M0,10 M10,30');
	});
});
