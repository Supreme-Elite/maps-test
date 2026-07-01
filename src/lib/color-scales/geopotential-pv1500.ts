import type { BreakpointColorScale } from '@openmeteo/weather-map-layer';

// Altitude de la tropopause dynamique (PV = 1.5 PVU, `geopotential_height_pv1500`,
// domaine arome_france), en **mètres**. Plage observée ~3700-13800 m (run
// 2026-06-30T15Z) — tropopause basse (polaire, intrusion d'air froid en
// altitude, souvent associée à de la cyclogenèse) à haute (subtropicale,
// anticyclonique).
//
// `geopotential_height_pv1500` contient la sous-chaîne `geopotential_height`,
// donc le package tente de la résoudre comme un niveau iso-pression
// (`LEVEL_REGEX = /_(\d+)(hPa)?$/i`) — sans match (`pv1500` n'est pas un
// nombre pur), il retombe sur l'échelle `geopotential_height` non recalibrée
// (bornes 4600-6000 m, calées sur le 500 hPa) : bien trop étroite pour une
// hauteur de tropopause. Palette ascendante froid (bleu, tropopause basse) →
// chaud (rouge, tropopause haute), mêmes teintes que `geopotential_height`.
export const geopotentialPv1500Scale: BreakpointColorScale = {
	type: 'breakpoint',
	unit: 'm',
	breakpoints: [4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000],
	colors: [
		[46, 139, 122, 0.7], // 4000 — tropopause très basse
		[57, 63, 138, 0.7], // 5000
		[28, 28, 130, 0.7], // 6000
		[8, 42, 115, 0.7], // 7000
		[0, 73, 102, 0.7], // 8000
		[0, 101, 76, 0.7], // 9000
		[0, 100, 21, 0.7], // 10000
		[28, 117, 0, 0.7], // 11000
		[93, 146, 0, 0.7], // 12000
		[154, 97, 0, 0.7], // 13000
		[85, 0, 0, 0.7] // 14000 — tropopause très haute, saturé au-delà
	]
};
