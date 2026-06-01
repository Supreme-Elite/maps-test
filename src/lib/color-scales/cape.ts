import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Énergie convective disponible (CAPE). 0 transparent, puis
// vert→jaune→orange→rouge→violet selon l'intensité.
export const capeScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'J/kg',
	breakpoints: [0, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000],
	colors: [
		[0, 0, 0, 0], // 0 transparent
		[0, 128, 0, 0.55], // 100
		[60, 170, 0, 0.65], // 250
		[160, 210, 0, 0.72], // 500
		[255, 235, 0, 0.8], // 1000
		[255, 190, 0, 0.85], // 1500
		[255, 140, 0, 0.9], // 2000
		[255, 70, 0, 0.93], // 2500
		[220, 0, 0, 0.96], // 3000
		[150, 0, 160, 1] // 4000+
	]
};
