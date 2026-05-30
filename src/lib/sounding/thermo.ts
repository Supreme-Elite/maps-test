// src/lib/sounding/thermo.ts
// Constantes thermodynamiques (SI sauf indication).
const RD = 287.05; // J/(kg·K)
const CP = 1005; // J/(kg·K)
const LV = 2.501e6; // J/kg
const EPS = 0.622;
const KAPPA = RD / CP; // ≈ 0.2854
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04;

/** Pression de vapeur saturante (Bolton 1980), hPa, T en °C. */
export function saturationVaporPressure(tC: number): number {
	return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
}

/** Point de rosée (°C) depuis T (°C) et humidité relative (%). */
export function dewpointFromRH(tC: number, rh: number): number {
	const r = Math.min(Math.max(rh, 0.01), 100) / 100;
	const alpha = Math.log(r) + (MAGNUS_A * tC) / (MAGNUS_B + tC);
	return (MAGNUS_B * alpha) / (MAGNUS_A - alpha);
}

/** Rapport de mélange (g/kg) depuis pression de vapeur e (hPa) et pression p (hPa). */
export function mixingRatio(eHPa: number, pHPa: number): number {
	return (1000 * EPS * eHPa) / (pHPa - eHPa);
}

/** Rapport de mélange saturant (g/kg). */
export function saturationMixingRatio(tC: number, pHPa: number): number {
	return mixingRatio(saturationVaporPressure(tC), pHPa);
}

/** Température potentielle (K) depuis T (K) et p (hPa). */
export function potentialTemperature(tK: number, pHPa: number): number {
	return tK * Math.pow(1000 / pHPa, KAPPA);
}

/** Température (K) sur une adiabatique sèche de température potentielle theta (K) à p (hPa). */
export function dryAdiabatTemp(thetaK: number, pHPa: number): number {
	return thetaK * Math.pow(pHPa / 1000, KAPPA);
}

/**
 * Intègre l'adiabatique pseudo-saturée d'une particule saturée de (startTC, startP)
 * jusqu'à endP. Renvoie la température (°C) à endP.
 */
export function moistLapseTemp(startTC: number, startP: number, endP: number): number {
	let tK = startTC + 273.15;
	const steps = Math.max(1, Math.ceil(Math.abs(Math.log(startP / endP)) / 0.01));
	const dlnp = Math.log(endP / startP) / steps; // négatif si on monte
	let lnp = Math.log(startP);
	for (let i = 0; i < steps; i++) {
		const p = Math.exp(lnp);
		const ws = saturationMixingRatio(tK - 273.15, p) / 1000; // kg/kg
		const num = RD * tK + LV * ws;
		const den = CP + (LV * LV * ws * EPS) / (RD * tK * tK);
		tK += (num / den) * dlnp;
		lnp += dlnp;
	}
	return tK - 273.15;
}

/** Température du thermomètre mouillé (°C) par recherche dichotomique (Normand). */
export function wetBulb(tC: number, tdC: number, pHPa: number): number {
	let lo = tdC;
	let hi = tC;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		const e = saturationVaporPressure(mid) - 6.6e-4 * (1 + 0.00115 * mid) * pHPa * (tC - mid);
		const eActual = saturationVaporPressure(tdC);
		if (e > eActual) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}
