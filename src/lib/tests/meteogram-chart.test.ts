import { describe, expect, it } from 'vitest';

import { type MeteogramChartInput, buildChartOptions } from '$lib/meteogram/meteogram-chart';

function input(overrides: Partial<MeteogramChartInput> = {}): MeteogramChartInput {
	const times = [0, 1, 2, 3].map((h) => new Date(Date.UTC(2026, 6, 10, h)));
	const four = (v: number) => [v, v, v, v];
	return {
		times,
		temperature: four(20),
		dewPoint: four(12),
		precipitation: [0, 0.5, 1.2, 0],
		pressure: four(1015),
		windSpeed: four(5),
		windDirection: four(230),
		symbolLabels: ['Ciel clair', 'Ciel clair', 'Pluie faible', null],
		units: { temperature: '°C', precipitation: 'mm', pressure: 'hPa' },
		onTimeClick: () => {},
		...overrides
	};
}

describe('buildChartOptions', () => {
	it('déclare 3 axes Y (T°, précip, pression) et 2 axes X liés', () => {
		const o = buildChartOptions(input());
		expect(o.yAxis).toHaveLength(3);
		expect(o.xAxis).toHaveLength(2);
		expect((o.xAxis as { linkedTo?: number }[])[1].linkedTo).toBe(0);
	});

	it('série 5 : température, rosée, précip, pression, windbarb — sur le bon axe', () => {
		const o = buildChartOptions(input());
		const s = o.series as { type?: string; yAxis?: number; name?: string }[];
		expect(s.map((x) => x.type)).toEqual(['spline', 'spline', 'column', 'spline', 'windbarb']);
		expect(s[2].yAxis).toBe(1);
		expect(s[3].yAxis).toBe(2);
	});

	it('température porte x (ms epoch) et symbolName pour le tooltip', () => {
		const o = buildChartOptions(input());
		const temp = (o.series as { data?: { x: number; symbolName?: string | null }[] }[])[0];
		expect(temp.data).toHaveLength(4);
		expect(temp.data![0].x).toBe(Date.UTC(2026, 6, 10, 0));
		expect(temp.data![2].symbolName).toBe('Pluie faible');
	});

	it('windbarbs : 1 point sur 2, {x, value, direction}, null écartés', () => {
		const o = buildChartOptions(input({ windSpeed: [5, 6, null, 8] }));
		const barbs = (o.series as { type?: string; data?: unknown[] }[]).find(
			(s) => s.type === 'windbarb'
		)!;
		// indices pairs 0 et 2 ; 2 est null → écarté ⇒ 1 point
		expect(barbs.data).toHaveLength(1);
		expect(barbs.data![0]).toMatchObject({ value: 5, direction: 230 });
	});

	it('grille horaire : 2 h sur horizon court, 6 h au-delà de 72 points, sans grille mineure', () => {
		const short = buildChartOptions(input());
		expect((short.xAxis as { tickInterval?: number }[])[0].tickInterval).toBe(2 * 36e5);
		// Garde anti-régression « barres blanches » : pas de grille mineure (le
		// défaut Highcharts #f2f2f2 ressort en barres blanches sur fond sombre),
		// et tout élément d'axe posé explicitement (jamais les défauts clairs).
		const shortAxis = (
			short.xAxis as {
				minorTickInterval?: number;
				minorGridLineWidth?: number;
				lineColor?: string;
				tickColor?: string;
			}[]
		)[0];
		expect(shortAxis.minorTickInterval).toBeUndefined();
		expect(shortAxis.minorGridLineWidth).toBe(0);
		expect(shortAxis.lineColor).toBeDefined();
		expect(shortAxis.tickColor).toBeDefined();

		const n = 96;
		const times = Array.from({ length: n }, (_, h) => new Date(Date.UTC(2026, 6, 10) + h * 36e5));
		const flat = (v: number) => Array.from({ length: n }, () => v);
		const long = buildChartOptions(
			input({
				times,
				temperature: flat(20),
				dewPoint: flat(12),
				precipitation: flat(0),
				pressure: flat(1015),
				windSpeed: flat(5),
				windDirection: flat(230),
				symbolLabels: Array.from({ length: n }, () => null)
			})
		);
		expect((long.xAxis as { tickInterval?: number }[])[0].tickInterval).toBe(6 * 36e5);
		expect((long.xAxis as { minorTickInterval?: number }[])[0].minorTickInterval).toBeUndefined();
	});

	it('unités injectées dans tooltips/axes', () => {
		const o = buildChartOptions(
			input({ units: { temperature: '°F', precipitation: 'inch', pressure: 'hPa' } })
		);
		const json = JSON.stringify(o);
		expect(json).toContain('°F');
		expect(json).toContain('inch');
	});
});
