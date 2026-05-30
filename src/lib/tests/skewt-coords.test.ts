// src/lib/tests/skewt-coords.test.ts
import { describe, expect, it } from 'vitest';

import { type SkewTConfig, pressureToY, tempToX, xyToTemp } from '$lib/sounding/skewt-coords';

const cfg: SkewTConfig = { pTop: 100, pBottom: 1050, tMin: -90, tMax: 40, skew: 1 };

describe('skewt-coords', () => {
	it('pressureToY : 0 au sommet, 1 au sol', () => {
		expect(pressureToY(100, cfg)).toBeCloseTo(0, 5);
		expect(pressureToY(1050, cfg)).toBeCloseTo(1, 5);
		expect(pressureToY(500, cfg)).toBeGreaterThan(0);
		expect(pressureToY(500, cfg)).toBeLessThan(1);
	});

	it('tempToX / xyToTemp : round-trip', () => {
		const p = 700;
		const t = -5;
		const x = tempToX(t, p, cfg);
		const y = pressureToY(p, cfg);
		expect(xyToTemp(x, y, cfg)).toBeCloseTo(t, 5);
	});

	it('skew : à pression donnée, T plus chaud → x plus à droite', () => {
		expect(tempToX(10, 700, cfg)).toBeGreaterThan(tempToX(-10, 700, cfg));
	});

	it('régression : un profil chaud-au-sol / froid-en-altitude reste dans le cadre [0,1]', () => {
		// Config de production (cf. skew-t.svelte). Régression du bug « émagramme chelou » :
		// le skew poussait l'air chaud de basses couches hors du cadre (x > 1).
		const prod: SkewTConfig = { pTop: 100, pBottom: 1050, tMin: -40, tMax: 40, skew: 0.55 };
		const points: Array<[number, number]> = [
			[29, 1000], // surface chaude
			[0, 700],
			[-13, 500],
			[-58, 100], // sommet froid
			[-74, 150] // point de rosée très froid en altitude
		];
		for (const [t, p] of points) {
			const x = tempToX(t, p, prod);
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(1);
		}
	});
});
