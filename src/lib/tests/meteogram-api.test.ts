import { describe, expect, it } from 'vitest';

import {
	BORROWED_VARIABLES,
	BORROW_SOURCE_MODELS,
	buildForecastUrl,
	mergeBorrowedSeries,
	parseForecast,
	trimTrailingNulls
} from '$lib/meteogram/api';

describe('buildForecastUrl', () => {
	it('inclut lat/lng, models, timezone auto (heure locale du point), wind en m/s et toutes les variables', () => {
		const url = buildForecastUrl(48.85, 2.35, 'meteofrance_arome_france_hd');
		expect(url).toContain('/v1/forecast');
		expect(url).toContain('latitude=48.85');
		expect(url).toContain('longitude=2.35');
		expect(url).toContain('models=meteofrance_arome_france_hd');
		expect(url).toContain('timezone=auto');
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
	it('reconstruit des instants absolus depuis l’heure locale + utc_offset_seconds, expose le fuseau', () => {
		// timezone=auto : les timestamps sont en heure LOCALE du point (minuit local),
		// on les repositionne en instants UTC absolus via l'offset (couplage carte).
		const json = {
			timezone: 'Europe/Paris',
			utc_offset_seconds: 7200,
			hourly: {
				time: ['2026-07-14T00:00', '2026-07-14T01:00'],
				temperature_2m: [12.3, null],
				precipitation: [0, 1.2]
			}
		};
		const data = parseForecast(json, 'ecmwf_ifs025');
		expect(data.model).toBe('ecmwf_ifs025');
		expect(data.timezone).toBe('Europe/Paris');
		expect(data.utcOffsetSeconds).toBe(7200);
		// minuit local Paris (+02:00) = 22:00 UTC la veille
		expect(data.times.map((d) => d.toISOString())).toEqual([
			'2026-07-13T22:00:00.000Z',
			'2026-07-13T23:00:00.000Z'
		]);
		expect(data.series.temperature_2m).toEqual([12.3, null]);
		expect(data.series.precipitation).toEqual([0, 1.2]);
	});

	it('sans offset ni fuseau (réponse legacy) : parse en UTC, fuseau UTC', () => {
		const data = parseForecast(
			{ hourly: { time: ['2026-07-03T00:00', '2026-07-03T01:00'], temperature_2m: [1, 2] } },
			'm'
		);
		expect(data.timezone).toBe('UTC');
		expect(data.utcOffsetSeconds).toBe(0);
		expect(data.times.map((d) => d.toISOString())).toEqual([
			'2026-07-03T00:00:00.000Z',
			'2026-07-03T01:00:00.000Z'
		]);
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

describe('BORROW_SOURCE_MODELS', () => {
	it('AROME France HD emprunte ses variables manquantes au 2,5 km (HD ne les diffuse pas)', () => {
		// L'API renvoie weather_code ET pressure_msl 100 % null pour
		// meteofrance_arome_france_hd : on va les chercher sur le 2,5 km, même
		// modèle physique / même emprise / même run horaire.
		expect(BORROW_SOURCE_MODELS.meteofrance_arome_france_hd).toBe('meteofrance_arome_france');
	});

	it('emprunte weather_code et pressure_msl', () => {
		expect(BORROWED_VARIABLES).toContain('weather_code');
		expect(BORROWED_VARIABLES).toContain('pressure_msl');
	});
});

describe('mergeBorrowedSeries', () => {
	const base = parseForecast(
		{
			hourly: {
				time: ['2026-07-03T00:00', '2026-07-03T01:00', '2026-07-03T02:00'],
				temperature_2m: [12, 13, 14],
				weather_code: [null, null, null],
				pressure_msl: [null, null, null],
				is_day: [0, 1, 1]
			}
		},
		'meteofrance_arome_france_hd'
	);

	const source = {
		time: [
			new Date('2026-07-03T00:00Z'),
			new Date('2026-07-03T01:00Z'),
			new Date('2026-07-03T02:00Z')
		],
		weather_code: [3, 2, 61],
		pressure_msl: [1015, 1014.5, 1013]
	};

	it('remplit weather_code ET pressure_msl depuis la source, alignés par timestamp', () => {
		const merged = mergeBorrowedSeries(base, source);
		expect(merged.series.weather_code).toEqual([3, 2, 61]);
		expect(merged.series.pressure_msl).toEqual([1015, 1014.5, 1013]);
		// n'altère pas les autres séries ni is_day (déjà renseigné côté HD)
		expect(merged.series.temperature_2m).toEqual([12, 13, 14]);
		expect(merged.series.is_day).toEqual([0, 1, 1]);
	});

	it('aligne par timestamp même si la source est décalée/incomplète', () => {
		const merged = mergeBorrowedSeries(base, {
			// source qui commence une heure plus tard et couvre partiellement
			time: [new Date('2026-07-03T01:00Z'), new Date('2026-07-03T02:00Z')],
			weather_code: [45, 3],
			pressure_msl: [1012, 1011]
		});
		// pas de valeur source à 00:00 → null ; les autres alignées
		expect(merged.series.weather_code).toEqual([null, 45, 3]);
		expect(merged.series.pressure_msl).toEqual([null, 1012, 1011]);
	});

	it('ne réécrit pas une valeur déjà présente côté base (base prioritaire)', () => {
		const partial = parseForecast(
			{
				hourly: {
					time: ['2026-07-03T00:00', '2026-07-03T01:00'],
					weather_code: [null, null],
					pressure_msl: [1000, null]
				}
			},
			'meteofrance_arome_france_hd'
		);
		const merged = mergeBorrowedSeries(partial, {
			time: [new Date('2026-07-03T00:00Z'), new Date('2026-07-03T01:00Z')],
			weather_code: [3, 2],
			pressure_msl: [1015, 1014]
		});
		// 1000 (base) conservé, 2ᵉ pas emprunté à la source
		expect(merged.series.pressure_msl).toEqual([1000, 1014]);
	});
});
