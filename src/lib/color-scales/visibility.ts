import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Visibilité minimale 60 min (m). Faible visibilité = alarmant (rouge) ;
// au-delà de ~10 km, transparent (bonne visibilité, rien à signaler).
export const visibilityScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'm',
	breakpoints: [0, 200, 500, 1000, 2000, 5000, 10000],
	colors: [
		[180, 0, 0, 0.95], // 0 brouillard dense
		[230, 0, 0, 0.9], // 200
		[255, 90, 0, 0.85], // 500
		[255, 170, 0, 0.78], // 1000
		[255, 230, 0, 0.6], // 2000
		[255, 255, 160, 0.35], // 5000
		[255, 255, 255, 0] // 10000 → transparent
	]
};
