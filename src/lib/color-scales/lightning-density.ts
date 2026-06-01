import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Densité de foudre (moyenne 3 h). 0 transparent, puis jaune→orange→rouge→violet.
// Pas d'unité standard affichée. Variable présente seulement H+3→H+51.
export const lightningDensityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '',
	breakpoints: [0, 0.1, 0.5, 1, 2, 3, 5],
	colors: [
		[0, 0, 0, 0], // 0 transparent
		[255, 255, 150, 0.7], // 0.1
		[255, 230, 0, 0.8], // 0.5
		[255, 170, 0, 0.88], // 1
		[255, 90, 0, 0.93], // 2
		[230, 0, 0, 0.97], // 3
		[150, 0, 160, 1] // 5+
	]
};
