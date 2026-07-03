import { describe, expect, it } from 'vitest';

import { buildForecastUrl, parseForecast } from '$lib/meteogram/api';

describe('buildForecastUrl', () => {
	it('inclut lat/lng, models, timezone UTC, wind en m/s et toutes les variables', () => {
		const url = buildForecastUrl(48.85, 2.35, 'meteofrance_arome_france_hd');
		expect(url).toContain('https://api.open-meteo.com/v1/forecast');
		expect(url).toContain('latitude=48.85');
		expect(url).toContain('longitude=2.35');
		expect(url).toContain('models=meteofrance_arome_france_hd');
		expect(url).toContain('timezone=UTC');
		expect(url).toContain('wind_speed_unit=ms');
		expect(url).toContain('temperature_2m');
		expect(url).toContain('precipitation_probability');
		expect(url).toContain('cape');
	});
});

describe('parseForecast', () => {
	it('transpose la réponse en times[] + series, préserve les null', () => {
		const json = {
			hourly: {
				time: ['2026-07-03T00:00', '2026-07-03T01:00'],
				temperature_2m: [12.3, null],
				precipitation: [0, 1.2]
			}
		};
		const data = parseForecast(json, 'ecmwf_ifs025');
		expect(data.model).toBe('ecmwf_ifs025');
		expect(data.times.map((d) => d.toISOString())).toEqual([
			'2026-07-03T00:00:00.000Z',
			'2026-07-03T01:00:00.000Z'
		]);
		expect(data.series.temperature_2m).toEqual([12.3, null]);
		expect(data.series.precipitation).toEqual([0, 1.2]);
	});

	it('lève sur réponse sans hourly.time', () => {
		expect(() => parseForecast({ error: true, reason: 'x' }, 'm')).toThrow();
	});
});
