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
	return base + cfg.skew * pressureToY(pHPa, cfg);
}

/** Inverse : température (°C) depuis (x, y) normalisés. */
export function xyToTemp(x: number, y: number, cfg: SkewTConfig): number {
	const base = x - cfg.skew * y;
	return base * (cfg.tMax - cfg.tMin) + cfg.tMin;
}
