import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Température de brillance IR fenêtre (sommet de nuage), enhanced IR.
// Tops froids (<−40 °C) en couleurs saturées ; ciel clair / nuages chauds en
// niveaux de gris (du clair vers le foncé quand la surface se réchauffe).
export const brightnessTemperatureScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: '°C',
	breakpoints: [-80, -70, -60, -50, -40, -30, -20, -10, 0, 20, 40],
	colors: [
		[255, 255, 255, 1], // -80 tops les plus froids, blanc
		[255, 0, 255, 1], // -70 magenta
		[180, 0, 220, 1], // -60 violet
		[255, 0, 0, 1], // -50 rouge
		[255, 150, 0, 1], // -40 orange
		[255, 255, 0, 1], // -30 jaune
		[200, 200, 200, 1], // -20 gris clair
		[170, 170, 170, 1], // -10
		[140, 140, 140, 1], // 0
		[90, 90, 90, 1], // 20
		[40, 40, 40, 1] // 40 surface chaude, gris foncé
	]
};
