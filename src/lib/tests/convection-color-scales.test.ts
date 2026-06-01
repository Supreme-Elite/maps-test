import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';
import { describe, expect, it } from 'vitest';

import { brightnessTemperatureScale } from '$lib/color-scales/brightness-temperature';
import { brightnessTemperatureWvScale } from '$lib/color-scales/brightness-temperature-wv';
import { capeScale } from '$lib/color-scales/cape';
import { convectiveInhibitionScale } from '$lib/color-scales/convective-inhibition';
import { lightningDensityScale } from '$lib/color-scales/lightning-density';
import { radarReflectivityScale } from '$lib/color-scales/radar-reflectivity';
import { visibilityScale } from '$lib/color-scales/visibility';

const continuous: [string, BreakpointColorScale][] = [
	['radar', radarReflectivityScale],
	['brightness', brightnessTemperatureScale],
	['brightness_wv', brightnessTemperatureWvScale],
	['cape', capeScale],
	['cin', convectiveInhibitionScale],
	['visibility', visibilityScale],
	['lightning', lightningDensityScale]
];

describe('continuous convection color scales', () => {
	it.each(continuous)('%s has aligned, ascending breakpoints', (_name, scale) => {
		expect(scale.type).toBe('breakpoint');
		const colors = scale.colors as number[][];
		expect(Array.isArray(colors)).toBe(true);
		expect(colors.length).toBe(scale.breakpoints.length);
		for (let i = 1; i < scale.breakpoints.length; i++) {
			expect(scale.breakpoints[i]).toBeGreaterThan(scale.breakpoints[i - 1]);
		}
		for (const c of colors) {
			expect(c.length).toBe(4);
			expect(c[3]).toBeGreaterThanOrEqual(0);
			expect(c[3]).toBeLessThanOrEqual(1);
		}
	});

	it('radar reflectivity is transparent below the first threshold', () => {
		expect(radarReflectivityScale.breakpoints[0]).toBe(0);
		expect((radarReflectivityScale.colors as number[][])[0][3]).toBe(0);
	});

	it('cape and lightning are transparent at zero', () => {
		expect((capeScale.colors as number[][])[0][3]).toBe(0);
		expect((lightningDensityScale.colors as number[][])[0][3]).toBe(0);
	});
});
