import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Réflectivité radar simulée (max colonne), échelle de type NWS.
// Bande de tête transparente (breakpoint 0, alpha 0) : tout px < 5 dBZ est rendu
// transparent (le moteur retombe sur colors[0] pour px < breakpoints[1]).
export const radarReflectivityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'dBZ',
	breakpoints: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
	colors: [
		[0, 0, 0, 0], // <5 transparent
		[4, 233, 231, 0.85], // 5
		[1, 159, 244, 0.88], // 10
		[3, 0, 244, 0.9], // 15
		[2, 253, 2, 0.9], // 20
		[1, 197, 1, 0.92], // 25
		[0, 142, 0, 0.92], // 30
		[253, 248, 2, 0.94], // 35
		[229, 188, 0, 0.94], // 40
		[253, 149, 0, 0.96], // 45
		[253, 0, 0, 0.97], // 50
		[212, 0, 0, 0.98], // 55
		[188, 0, 0, 0.99], // 60
		[248, 0, 253, 1], // 65
		[152, 84, 198, 1] // 70
	]
};
