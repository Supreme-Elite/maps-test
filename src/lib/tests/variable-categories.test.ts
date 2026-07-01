import { describe, expect, it } from 'vitest';

import { CATEGORIES, categorize } from '$lib/variable-categories';

describe('categorize', () => {
	it('classe la température', () => {
		expect(categorize('temperature_2m')).toBe('temperature');
		expect(categorize('temperature_850hPa')).toBe('temperature');
	});

	it('classe les précipitations (pluie + neige)', () => {
		expect(categorize('precipitation')).toBe('precipitation');
		expect(categorize('rain')).toBe('precipitation');
		expect(categorize('snowfall')).toBe('precipitation');
		expect(categorize('precipitation_sum_3h')).toBe('precipitation');
	});

	it('classe le vent', () => {
		expect(categorize('wind_speed_10m')).toBe('wind');
		expect(categorize('wind_gusts_10m')).toBe('wind');
	});

	it('classe les nuages', () => {
		expect(categorize('cloud_cover')).toBe('clouds');
		expect(categorize('cloud_cover_low')).toBe('clouds');
	});

	it('classe la pression / altitude', () => {
		expect(categorize('pressure_msl')).toBe('pressure');
		expect(categorize('geopotential_height_500hPa')).toBe('pressure');
	});

	it('retombe sur "other" pour l\'inconnu', () => {
		expect(categorize('soil_moisture_0_to_1cm')).toBe('other');
	});

	it("expose les catégories dans l'ordre d'affichage", () => {
		expect(CATEGORIES.map((c) => c.key)).toEqual([
			'temperature',
			'precipitation',
			'wind',
			'clouds',
			'pressure',
			'other'
		]);
	});

	describe('anti-collision : limites de mots', () => {
		it('terrain ne matche pas precipitation (rain substring)', () => {
			expect(categorize('terrain')).toBe('other');
		});

		it('august_temperature matche temperature via _temperature', () => {
			expect(categorize('august_temperature')).toBe('temperature');
		});

		it('wind_u_component_10m est classé wind', () => {
			expect(categorize('wind_u_component_10m')).toBe('wind');
		});

		it('wind_v_component_10m est classé wind', () => {
			expect(categorize('wind_v_component_10m')).toBe('wind');
		});

		it('wind_chill_2m est classé temperature (indice de ressenti, pas du vent)', () => {
			expect(categorize('wind_chill_2m')).toBe('temperature');
		});
	});
});
