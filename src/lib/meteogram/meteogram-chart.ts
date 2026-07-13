import type { Options, XAxisOptions } from 'highcharts';

export interface MeteogramChartInput {
	times: Date[];
	temperature: (number | null)[];
	dewPoint: (number | null)[];
	precipitation: (number | null)[];
	pressure: (number | null)[];
	/** m/s brut : les barbes suivent la convention nœuds, Highcharts convertit. */
	windSpeed: (number | null)[];
	windDirection: (number | null)[];
	symbolLabels: (string | null)[];
	units: { temperature: string; precipitation: string; pressure: string };
	onTimeClick: (date: Date) => void;
	/** Mobile : marges resserrées pour rendre la zone de tracé au graphe. */
	compact?: boolean;
}

// Thème sombre : TOUT élément d'axe/grille doit être stylé explicitement.
// Les défauts Highcharts (grille mineure #f2f2f2, axes #ccd6eb, crosshair
// #cccccc) sont pensés pour fond clair et ressortent en barres blanches sur
// le tiroir sombre — régression corrigée, verrouillée par test.
/**
 * Échelle de Beaufort en français (indices 0-12). Le tooltip par défaut du
 * module windbarb affiche la description anglaise (« Light air »…) via
 * `point.beaufort` — on la remplace par `BEAUFORT_FR[point.beaufortLevel]`.
 */
export const BEAUFORT_FR: readonly string[] = [
	'Calme',
	'Très légère brise',
	'Légère brise',
	'Petite brise',
	'Jolie brise',
	'Bonne brise',
	'Vent frais',
	'Grand frais',
	'Coup de vent',
	'Fort coup de vent',
	'Tempête',
	'Violente tempête',
	'Ouragan'
];

const GRID = 'rgba(255, 255, 255, 0.06)';
const GRID_DAY = 'rgba(255, 255, 255, 0.16)';
const AXIS = 'rgba(255, 255, 255, 0.18)';
const TEXT = 'rgba(255, 255, 255, 0.7)';
const TEXT_STRONG = 'rgba(255, 255, 255, 0.9)';

/**
 * Construit les options du graphe unique façon yr.no (démo officielle
 * Highcharts « meteogram »), thème sombre accordé au tiroir. Builder pur :
 * données → objet options, aucun accès DOM ni au runtime Highcharts.
 */
export function buildChartOptions(input: MeteogramChartInput): Options {
	const xs = input.times.map((t) => t.getTime());
	const at = <T>(arr: (T | null)[], i: number): T | null => arr[i] ?? null;

	const temperatureData = xs.map((x, i) => ({
		x,
		y: at(input.temperature, i),
		symbolName: at(input.symbolLabels, i)
	}));
	const dewPointData = xs.map((x, i) => [x, at(input.dewPoint, i)]);
	const precipitationData = xs.map((x, i) => [x, at(input.precipitation, i)]);
	const pressureData = xs.map((x, i) => [x, at(input.pressure, i)]);

	// 1 barbe sur 2 (lisibilité, comme le démo) ; points sans vitesse/direction écartés.
	const windData = xs
		.map((x, i) => ({ x, value: at(input.windSpeed, i), direction: at(input.windDirection, i), i }))
		.filter((p) => p.i % 2 === 0 && p.value !== null && p.direction !== null)
		.map(({ x, value, direction }) => ({
			x,
			value: value as number,
			direction: direction as number
		}));

	const onTimeClick = input.onTimeClick;

	// Densité de grille adaptative : au-delà de 72 h, une gridline toutes les
	// 2 h sature le tracé (l'API renvoie jusqu'à 7 jours) — on passe à 6 h.
	// Pas de grille mineure : sur fond sombre elle ne fait que du bruit.
	const longRange = input.times.length > 72;
	const tickInterval = (longRange ? 6 : 2) * 36e5;

	return {
		chart: {
			backgroundColor: 'transparent',
			style: { fontFamily: 'inherit' },
			// Marges resserrées sur mobile (haut/droite) pour gagner de la zone de
			// tracé. marginBottom NON réduit : l'axe des heures (offset 30 + labels)
			// a besoin de ~70px, en-deçà (essai à 56) les chiffres se font rogner par
			// le bord du SVG sur le rendu Safari iOS. On garde donc 72px en bas.
			marginBottom: input.compact ? 72 : 70,
			marginRight: input.compact ? 40 : 44,
			marginTop: input.compact ? 36 : 44,
			plotBorderWidth: 1,
			plotBorderColor: 'rgba(255, 255, 255, 0.14)',
			alignTicks: false,
			zooming: { type: 'x' },
			scrollablePlotArea: { minWidth: 720 },
			events: {
				click: function (e) {
					// Typage large : l'événement porte xAxis[0].value (ms epoch).
					const ev = e as unknown as { xAxis?: { value: number }[] };
					const v = ev.xAxis?.[0]?.value;
					if (v !== undefined) onTimeClick(new Date(v));
				}
			}
		},
		time: { timezone: 'UTC' },
		title: { text: undefined },
		credits: { enabled: false },
		accessibility: { enabled: false },
		// Pas de menu contextuel Highcharts (libellés anglais, redondant avec le
		// bouton « Exporter PNG » du tiroir) ; le module exporting reste chargé
		// pour `exportChartLocal`.
		exporting: { buttons: { contextButton: { enabled: false } } },
		tooltip: {
			shared: true,
			useHTML: false,
			backgroundColor: 'rgba(12, 20, 32, 0.95)',
			style: { color: TEXT_STRONG },
			headerFormat:
				'<small>{point.x:%A %e %b, %H:%M} UTC</small><br><b>{point.point.symbolName}</b><br>'
		},
		xAxis: [
			{
				type: 'datetime',
				tickInterval,
				minorGridLineWidth: 0,
				tickLength: 0,
				lineColor: AXIS,
				tickColor: AXIS,
				gridLineWidth: 1,
				gridLineColor: GRID,
				startOnTick: false,
				endOnTick: false,
				minPadding: 0,
				maxPadding: 0,
				offset: 30,
				showLastLabel: true,
				labels: { format: '{value:%H}', style: { color: TEXT } },
				crosshair: { width: 1, color: 'rgba(255, 255, 255, 0.25)' }
			},
			{
				linkedTo: 0,
				type: 'datetime',
				tickInterval: 24 * 36e5,
				labels: {
					format: '{value:<span style="font-size: 12px; font-weight: bold">%a</span> %e %b}',
					align: 'left',
					x: 3,
					y: 8,
					style: { color: TEXT_STRONG }
				},
				opposite: true,
				tickLength: 20,
				lineColor: AXIS,
				tickColor: AXIS,
				gridLineWidth: 1,
				gridLineColor: GRID_DAY
			}
		] as XAxisOptions[],
		yAxis: [
			{
				// Température (+ point de rosée)
				title: { text: null },
				labels: {
					format: `{value}°`,
					style: { fontSize: '10px', color: TEXT },
					x: -3
				},
				plotLines: [{ value: 0, color: 'rgba(255,255,255,0.3)', width: 1, zIndex: 2 }],
				maxPadding: 0.3,
				minRange: 8,
				tickInterval: 1,
				gridLineColor: GRID
			},
			{
				// Précipitations
				title: { text: null },
				labels: { enabled: false },
				gridLineWidth: 0,
				tickLength: 0,
				minRange: 10,
				min: 0
			},
			{
				// Pression
				allowDecimals: false,
				title: {
					text: input.units.pressure,
					offset: 0,
					align: 'high',
					rotation: 0,
					style: { fontSize: '10px', color: '#fbbf24' },
					textAlign: 'left',
					x: 3
				},
				labels: { style: { fontSize: '8px', color: '#fbbf24' }, y: 2, x: 3 },
				gridLineWidth: 0,
				opposite: true,
				showLastLabel: false
			}
		],
		legend: { enabled: false },
		plotOptions: {
			series: {
				pointPlacement: 'between',
				point: {
					events: {
						click: function () {
							onTimeClick(new Date(this.x as number));
						}
					}
				}
			}
		},
		series: [
			{
				name: 'Température',
				data: temperatureData,
				type: 'spline',
				marker: { enabled: false, states: { hover: { enabled: true } } },
				tooltip: { valueSuffix: ` ${input.units.temperature}` },
				zIndex: 2,
				lineWidth: 2.5,
				color: '#ff4d4d',
				negativeColor: '#48AFE8'
			},
			{
				name: 'Point de rosée',
				data: dewPointData,
				type: 'spline',
				marker: { enabled: false },
				dashStyle: 'ShortDash',
				tooltip: { valueSuffix: ` ${input.units.temperature}` },
				zIndex: 1,
				lineWidth: 1.5,
				color: '#34d399'
			},
			{
				name: 'Précipitations',
				data: precipitationData,
				type: 'column',
				color: '#68CFE8',
				yAxis: 1,
				groupPadding: 0,
				pointPadding: 0,
				grouping: false,
				dataLabels: {
					enabled: true,
					filter: { operator: '>', property: 'y', value: 0 },
					style: { fontSize: '8px', color: TEXT, textOutline: 'none' }
				},
				tooltip: { valueSuffix: ` ${input.units.precipitation}` }
			},
			{
				// Discrète (repère de tendance) : fine et translucide pour ne pas
				// concurrencer la température — l'axe ambre à droite porte la lecture.
				name: 'Pression',
				data: pressureData,
				type: 'spline',
				marker: { enabled: false },
				lineWidth: 1,
				color: 'rgba(251, 191, 36, 0.55)',
				dashStyle: 'ShortDot',
				yAxis: 2,
				tooltip: { valueSuffix: ` ${input.units.pressure}` }
			},
			{
				name: 'Vent',
				type: 'windbarb',
				id: 'windbarbs',
				data: windData,
				color: '#7dd3fc',
				lineWidth: 1.5,
				vectorLength: 18,
				yOffset: -15,
				tooltip: {
					// Remplace le format par défaut du windbarb, dont la description
					// Beaufort (`point.beaufort`) est en anglais (« Light air »…).
					pointFormatter: function () {
						const p = this as unknown as {
							value: number;
							beaufortLevel?: number;
							color?: string;
							series: { name: string };
						};
						const beaufort =
							p.beaufortLevel !== undefined ? ` (${BEAUFORT_FR[p.beaufortLevel] ?? ''})` : '';
						// La valeur `p.value` reste en m/s (le module windbarb dessine les
						// plumes et calcule le Beaufort sur cette base) ; on ne convertit
						// qu'à l'affichage. Virgule décimale : cohérent avec les autres
						// séries (locale fr).
						const kmh = (p.value * 3.6).toFixed(1).replace('.', ',');
						return (
							`<span style="color:${p.color ?? '#7dd3fc'}">●</span> ` +
							`${p.series.name} : <b>${kmh} km/h</b>${beaufort}<br/>`
						);
					}
				}
			}
		]
	} as Options;
}
