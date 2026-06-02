import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Température de brillance IR vapeur d'eau 6.2 µm.
// BT froide = haute humidité (blanc/bleu) ; BT chaude = air sec (brun).
export const brightnessTemperatureWvScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '°C',
	breakpoints: [-70, -60, -50, -40, -30, -20, -10],
	colors: [
		[255, 255, 255, 1], // -70 le plus humide, blanc
		[150, 200, 255, 1], // -60 bleu clair
		[40, 120, 220, 1], // -50 bleu
		[20, 70, 140, 1], // -40 bleu profond (humide)
		[110, 90, 50, 1], // -30 transition brun
		[150, 110, 50, 1], // -20 brun
		[110, 80, 40, 1] // -10 sec, brun foncé
	]
};
