import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Cumul de précipitation depuis le début du run (variable `precipitation_sum`
// du domaine arome_om_reunion). H0 = 0 partout, croissant à chaque échéance ;
// sur 48 h le max peut dépasser plusieurs centaines de mm.
//
// L'échelle par défaut du package pour la famille `precipitation` sature à
// 30 mm (pensée pour un pas horaire) : inexploitable pour un cumul de run.
// On étend donc la plage jusqu'à 300 mm tout en gardant la même logique de
// rampe (bleus clairs → bleus → verts → jaunes → rouges → magenta/violet).
//
// Sous le premier breakpoint (< 1 mm, donc H0 = 0 partout) le pixel est rendu
// transparent par le moteur ; idem pour les NaN propagés (pixel manquant).
export const precipitationSumScale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'mm',
	breakpoints: [1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300],
	colors: [
		[200, 225, 250, 0.5], // 1 mm — bleu très clair, semi-transparent
		[134, 205, 250, 0.7], // 2
		[64, 161, 251, 0.8], // 5
		[0, 96, 233, 0.85], // 10
		[0, 177, 236, 0.88], // 20
		[0, 241, 141, 0.9], // 30
		[66, 248, 0, 0.92], // 50
		[255, 221, 0, 0.94], // 75
		[255, 150, 0, 0.96], // 100
		[255, 0, 0, 0.98], // 150
		[175, 0, 153, 1], // 200
		[110, 0, 110, 1] // 300 — violet foncé, saturé au-delà
	]
};
