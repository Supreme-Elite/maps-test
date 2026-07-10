import { describe, expect, it } from 'vitest';

import { buildForecastUrl, parseForecast, trimTrailingNulls } from '$lib/meteogram/api';

describe('buildForecastUrl', () => {
	it('inclut lat/lng, models, timezone UTC, wind en m/s et toutes les variables', () => {
		const url = buildForecastUrl(48.85, 2.35, 'meteofrance_arome_france_hd');
		expect(url).toContain('/v1/forecast');
		expect(url).toContain('latitude=48.85');
		expect(url).toContain('longitude=2.35');
		expect(url).toContain('models=meteofrance_arome_france_hd');
		expect(url).toContain('timezone=UTC');
		expect(url).toContain('wind_speed_unit=ms');
		expect(url).toContain('temperature_2m');
		expect(url).toContain('weather_code');
		expect(url).toContain('is_day');
		expect(url).not.toContain('cloud_cover_low');
		expect(url).not.toContain('cape');
		expect(url).not.toContain('precipitation_probability');
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

describe('trimTrailingNulls', () => {
	const build = (temps: (number | null)[]) => {
		const time = temps.map((_, i) => `2026-07-03T${String(i).padStart(2, '0')}:00`);
		return parseForecast(
			{ hourly: { time, temperature_2m: temps } },
			'meteofrance_arome_france_hd'
		);
	};

	it('rogne les heures de fin toutes nulles (horizon court sur axe 7 j)', () => {
		const trimmed = trimTrailingNulls(build([12, 13, 14, null, null]));
		expect(trimmed.times).toHaveLength(3);
		expect(trimmed.series.temperature_2m).toEqual([12, 13, 14]);
	});

	it('ne touche à rien si la dernière heure est renseignée', () => {
		const data = build([12, 13, 14]);
		expect(trimTrailingNulls(data)).toBe(data);
	});

	it('conserve les trous internes (null au milieu)', () => {
		const trimmed = trimTrailingNulls(build([12, null, 14, null]));
		expect(trimmed.times).toHaveLength(3);
		expect(trimmed.series.temperature_2m).toEqual([12, null, 14]);
	});

	it('renvoie une série vide si tout est nul', () => {
		expect(trimTrailingNulls(build([null, null])).times).toHaveLength(0);
	});

	it('ignore is_day/weather_code (habillage renseigné au-delà de l’horizon du modèle)', () => {
		const data = parseForecast(
			{
				hourly: {
					time: ['2026-07-03T00:00', '2026-07-03T01:00', '2026-07-03T02:00', '2026-07-03T03:00'],
					temperature_2m: [12, 13, null, null],
					is_day: [1, 1, 0, 1]
				}
			},
			'meteofrance_arome_france_hd'
		);
		const trimmed = trimTrailingNulls(data);
		expect(trimmed.times).toHaveLength(2);
		expect(trimmed.series.temperature_2m).toEqual([12, 13]);
		expect(trimmed.series.is_day).toEqual([1, 1]);
	});
});
