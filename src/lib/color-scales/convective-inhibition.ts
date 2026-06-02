import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Inhibition convective (CIN, négative). Plus c'est négatif, plus le « couvercle »
// est marqué (violet foncé) ; proche de 0 = pas d'inhibition = transparent.
// Breakpoints croissants (contrainte moteur) : du plus négatif vers 0.
export const convectiveInhibitionScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'J/kg',
	breakpoints: [-1000, -500, -200, -100, -50, -25, 0],
	colors: [
		[40, 0, 60, 0.95], // -1000 couvercle le plus fort
		[80, 0, 90, 0.9], // -500
		[120, 30, 110, 0.82], // -200
		[150, 70, 120, 0.7], // -100
		[170, 120, 140, 0.5], // -50
		[190, 170, 175, 0.3], // -25
		[200, 200, 200, 0] // 0 transparent (pas d'inhibition)
	]
};
