// src/lib/tests/parcel.test.ts
import { describe, expect, it } from 'vitest';

import { type LevelDatum } from '$lib/sounding/types';
import { liftParcel, mostUnstableLevel } from '$lib/sounding/parcel';

// Profil idéalisé instable : surface chaude/humide, décroissance ~7°C/km.
const env: LevelDatum[] = [
	{ pressure: 1000, temperature: 25, dewpoint: 20, height: 100, u: 0, v: 0 },
	{ pressure: 850, temperature: 14, dewpoint: 12, height: 1500, u: 0, v: 0 },
	{ pressure: 700, temperature: 5, dewpoint: 0, height: 3100, u: 0, v: 0 },
	{ pressure: 500, temperature: -12, dewpoint: -20, height: 5800, u: 0, v: 0 },
	{ pressure: 300, temperature: -40, dewpoint: -55, height: 9500, u: 0, v: 0 }
];
const surface = env[0];

describe('parcel', () => {
	it('liftParcel renvoie une T particule par niveau et un LCL', () => {
		const p = liftParcel(surface, env);
		expect(p.temperature).toHaveLength(env.length);
		expect(p.lcl).not.toBeNull();
		expect(p.lcl!.pressure).toBeLessThan(1000);
		expect(p.lcl!.pressure).toBeGreaterThan(700);
	});

	it("profil instable : la particule est plus chaude que l'environnement en altitude", () => {
		const p = liftParcel(surface, env);
		const idx500 = env.findIndex((l) => l.pressure === 500);
		expect(p.temperature[idx500]).toBeGreaterThan(env[idx500].temperature);
		expect(p.lfc).not.toBeNull();
		expect(p.el).not.toBeNull();
	});

	it('mostUnstableLevel renvoie le niveau de θe max (ici la surface)', () => {
		expect(mostUnstableLevel(surface, env).pressure).toBe(1000);
	});
});
