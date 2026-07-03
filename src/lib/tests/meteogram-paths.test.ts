import { describe, expect, it } from 'vitest';

import { barRects, linePath } from '$lib/meteogram/paths';

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

describe('barRects', () => {
	it('filtre les valeurs null et <= 0', () => {
		const points = [
			{ x: 10, value: null },
			{ x: 20, value: 0 },
			{ x: 30, value: -5 },
			{ x: 40, value: 2 }
		];
		const valueToY = (v: number) => 100 - v * 10;
		const result = barRects(points, 6, 100, valueToY);
		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(37); // 40 - 6/2 = 37
	});

	it('centre la barre sur x (x - barWidth/2)', () => {
		const points = [{ x: 30, value: 5 }];
		const valueToY = (v: number) => 100 - v * 10;
		const result = barRects(points, 6, 100, valueToY);
		expect(result[0].x).toBe(27); // 30 - 6/2 = 27
		expect(result[0].w).toBe(6);
	});

	it('calcule la hauteur correctement (h = baselineY - y)', () => {
		const baselineY = 100;
		const valueToY = (v: number) => 100 - v * 10;
		const points = [{ x: 30, value: 2 }];
		const result = barRects(points, 6, baselineY, valueToY);
		// value: 2 → y: 100 - 2*10 = 80
		// h: 100 - 80 = 20
		expect(result[0].y).toBe(80);
		expect(result[0].h).toBe(20);
	});
});
