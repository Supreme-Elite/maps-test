// src/lib/tests/thermo.test.ts
import { describe, expect, it } from 'vitest';

import {
	dewpointFromRH,
	dryAdiabatTemp,
	mixingRatio,
	moistLapseTemp,
	potentialTemperature,
	saturationMixingRatio,
	saturationVaporPressure,
	wetBulb
} from '$lib/sounding/thermo';

describe('thermo', () => {
	it('saturation vapor pressure (Bolton) ~23.4 hPa à 20°C', () => {
		expect(saturationVaporPressure(20)).toBeCloseTo(23.4, 1);
		expect(saturationVaporPressure(0)).toBeCloseTo(6.11, 1);
	});

	it('dewpoint depuis RH : 20°C / 50% ≈ 9.3°C', () => {
		expect(dewpointFromRH(20, 50)).toBeCloseTo(9.3, 0);
		expect(dewpointFromRH(20, 100)).toBeCloseTo(20, 1);
	});

	it('mixing ratio croît avec la pression de vapeur', () => {
		expect(saturationMixingRatio(20, 1000)).toBeGreaterThan(saturationMixingRatio(10, 1000));
		expect(mixingRatio(23.4, 1000)).toBeCloseTo(14.9, 0); // g/kg
	});

	it('température potentielle = T à 1000 hPa, croît en altitude', () => {
		expect(potentialTemperature(293.15, 1000)).toBeCloseTo(293.15, 1);
		expect(potentialTemperature(273.15, 500)).toBeGreaterThan(273.15);
	});

	it('adiabatique sèche : conserve theta (round-trip)', () => {
		const theta = potentialTemperature(293.15, 1000);
		expect(dryAdiabatTemp(theta, 1000)).toBeCloseTo(293.15, 1);
		expect(dryAdiabatTemp(theta, 700)).toBeLessThan(293.15);
	});

	it('adiabatique saturée : refroidit moins vite que la sèche', () => {
		const dry = dryAdiabatTemp(potentialTemperature(293.15, 1000), 700) - 273.15;
		const moist = moistLapseTemp(20, 1000, 700);
		expect(moist).toBeGreaterThan(dry); // pseudo-adiabatique plus chaude en altitude
	});

	it('wet-bulb entre dewpoint et température', () => {
		const tw = wetBulb(20, 10, 1000);
		expect(tw).toBeLessThan(20);
		expect(tw).toBeGreaterThan(10);
	});
});
