// Runtime config — populated by /runtime-config.js (generated at container
// start by docker-entrypoint.d/40-runtime-env.sh). We can't rely on
// import.meta.env at runtime because:
//   1. Vite inlines VITE_* values into the bundle at *build* time;
//   2. We'd want to change them across deployments without rebuilding.
//
// Vite's static analysis also performs dead-code elimination on conditionals
// involving build-time-constant strings, which makes "build-time placeholder
// + runtime sed-substitution" patterns unreliable for boolean-like checks.
// Reading from `window` (which doesn't exist at build time) sidesteps both.

declare global {
	interface Window {
		__OM_CONFIG?: {
			OM_WORKER_URL?: string;
			MODELS_BUCKET_URL?: string;
			FORECAST_API_URL?: string;
		};
	}
}

export function getOmWorkerUrl(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = window.__OM_CONFIG?.OM_WORKER_URL;
		if (fromWindow && fromWindow.length > 0) return fromWindow;
	}
	return (import.meta.env.VITE_OM_WORKER_URL as string | undefined) ?? '';
}

export function getModelsBucketUrl(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = window.__OM_CONFIG?.MODELS_BUCKET_URL;
		if (fromWindow && fromWindow.length > 0) return fromWindow;
	}
	return (import.meta.env.VITE_MODELS_BUCKET_URL as string | undefined) ?? '';
}

/**
 * Base de l'API forecast JSON (compatible Open-Meteo) alimentant le meteogram.
 * Défaut : l'API maison Infoclimat/cmer (`modeles-api.cmer.fr`), qui sert AUSSI
 * les pseudo-domaines France (`meteofrance_arome_france`/`_hd`) absents de
 * l'API publique. Pas d'authentification pour l'instant (aucune clé requise).
 * Surchargeable au runtime (`window.__OM_CONFIG`) ou au build (`VITE_*`).
 * La barre oblique finale est retirée (l'appelant ajoute `/v1/forecast`).
 */
export function getForecastApiUrl(): string {
	const fallback = 'https://modeles-api.cmer.fr';
	let url = fallback;
	if (typeof window !== 'undefined' && window.__OM_CONFIG?.FORECAST_API_URL) {
		url = window.__OM_CONFIG.FORECAST_API_URL;
	} else {
		const fromEnv = import.meta.env.VITE_FORECAST_API_URL as string | undefined;
		if (fromEnv && fromEnv.length > 0) url = fromEnv;
	}
	return url.replace(/\/$/, '');
}
