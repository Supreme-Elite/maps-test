import { type Domain, domainOptions } from '@openmeteo/weather-map-layer';

import { ensureAromeFranceGroup } from '$lib/arome-france-domain';
import { AROME_FRANCE_HD_DOMAIN } from '$lib/constants';
import { getModelsBucketUrl } from '$lib/runtime-env';

/** Domaine AROME France HD métropole **haute résolution**, servi depuis le bucket
 *  maison Infoclimat. Grille 2801×1791 à 0.01° (~1,3 km, métropole, lon −12→16,
 *  lat 37.5→55.4) — identique à l'AROME France HD d'Open-Meteo
 *  (`meteofrance_arome_france_hd`), mais produit/hébergé en propre. Horizon ~53 h
 *  horaire, runs toutes les 3 h. Regroupé dans le sélecteur sous le groupe partagé
 *  « AROME France (Infoclimat) » (voir `arome-france-domain.ts`). */
const aromeFranceHdDomain: Domain = {
	value: AROME_FRANCE_HD_DOMAIN,
	label: 'AROME France HD',
	grid: {
		type: 'regular',
		nx: 2801,
		ny: 1791,
		latMin: 37.5,
		lonMin: -12,
		dx: 0.01,
		dy: 0.01,
		zoom: 5.2
	},
	time_interval: 'hourly',
	model_interval: '3_hourly'
};

/**
 * Pousse le pseudo-domaine `arome_france_hd` dans `domainOptions` (mutable).
 * Idempotent. Ne fait rien si `VITE_MODELS_BUCKET_URL` n'est pas configuré — le
 * domaine reste alors absent du sélecteur (gating analogue à anomaly / arome-om /
 * arome_france).
 */
export function registerAromeFranceHdDomain(): void {
	if (!getModelsBucketUrl()) return;
	ensureAromeFranceGroup();
	if (domainOptions.some((d) => d.value === AROME_FRANCE_HD_DOMAIN)) return;
	domainOptions.push(aromeFranceHdDomain);
}
