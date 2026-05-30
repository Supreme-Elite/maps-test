// src/lib/sounding/skewt-coords.ts
// Coordonnées normalisées [0,1]×[0,1], origine en haut à gauche (comme SVG).
export interface SkewTConfig {
	pTop: number; // hPa (haut du diagramme, ex. 100)
	pBottom: number; // hPa (bas, ex. 1050)
	tMin: number; // °C bord gauche au sol
	tMax: number; // °C bord droit au sol
	skew: number; // inclinaison : décalage x (en fraction) par unité de y
}

/** y normalisé : 0 au sommet (faible p), 1 au sol (forte p), échelle log-P. */
export function pressureToY(pHPa: number, cfg: SkewTConfig): number {
	return (Math.log(pHPa) - Math.log(cfg.pTop)) / (Math.log(cfg.pBottom) - Math.log(cfg.pTop));
}

/** x normalisé d'une température (°C) à une pression donnée, avec skew. */
export function tempToX(tC: number, pHPa: number, cfg: SkewTConfig): number {
	const base = (tC - cfg.tMin) / (cfg.tMax - cfg.tMin);
	// Skew : les isothermes s'inclinent vers la droite en altitude. Le terme
	// s'annule au sol (yNorm = 1) — sinon l'air chaud de basses couches (base
	// proche de 1) serait poussé hors du cadre — et vaut `skew` au sommet (yNorm = 0).
	return base + cfg.skew * (1 - pressureToY(pHPa, cfg));
}

/** Inverse : température (°C) depuis (x, y) normalisés. */
export function xyToTemp(x: number, y: number, cfg: SkewTConfig): number {
	const base = x - cfg.skew * (1 - y);
	return base * (cfg.tMax - cfg.tMin) + cfg.tMin;
}

/** Pression (hPa) depuis y normalisé (inverse de pressureToY). */
export function yToPressure(yNorm: number, cfg: SkewTConfig): number {
	const lnTop = Math.log(cfg.pTop);
	const lnBottom = Math.log(cfg.pBottom);
	return Math.exp(lnTop + yNorm * (lnBottom - lnTop));
}

/**
 * Interpole linéairement `values` à la pression `p`, sur des `pressures` triées
 * en DÉCROISSANT (sol → sommet). Renvoie les bornes au-delà de la plage (clamp),
 * NaN si vide. Utilisé pour la lecture au survol (T, Td, particule, altitude).
 */
export function interpByPressure(pressures: number[], values: number[], p: number): number {
	const n = pressures.length;
	if (n === 0) return NaN;
	if (p >= pressures[0]) return values[0];
	if (p <= pressures[n - 1]) return values[n - 1];
	for (let i = 1; i < n; i++) {
		if (p >= pressures[i]) {
			const f = (p - pressures[i - 1]) / (pressures[i] - pressures[i - 1]);
			return values[i - 1] + f * (values[i] - values[i - 1]);
		}
	}
	return values[n - 1];
}
