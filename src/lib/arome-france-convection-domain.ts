import { type Domain, domainOptions } from '@openmeteo/weather-map-layer';

import { ensureAromeFranceGroup } from '$lib/arome-france-domain';
import { AROME_FRANCE_CONVECTION_DOMAIN } from '$lib/constants';
import { getModelsBucketUrl } from '$lib/runtime-env';

/** Domaine AROME France métropole orienté convection / chasse à l'orage.
 *  Grille 1121×717 à 0.025°, métropole (lon −12→16, lat 37.5→55.4).
 *  Runs toutes les 3 h, horizon 51 h. Voir spec
 *  `2026-06-01-arome-france-convection-design.md`. Regroupé dans le sélecteur
 *  sous le groupe partagé « AROME France (Infoclimat) » (voir `arome-france-domain.ts`). */
const aromeFranceConvectionDomain: Domain = {
	value: AROME_FRANCE_CONVECTION_DOMAIN,
	label: 'AROME Convection France',
	grid: {
		type: 'regular',
		nx: 1121,
		ny: 717,
		latMin: 37.5,
		lonMin: -12,
		dx: 0.025,
		dy: 0.025,
		// Même résolution native que AROME France 0.025° → même zoom de référence.
		zoom: 5.2
	},
	time_interval: 'hourly',
	model_interval: '3_hourly'
};

/**
 * Pousse le pseudo-domaine `arome_france_convection` dans `domainOptions` (mutable).
 * Idempotent. Ne fait rien si `VITE_MODELS_BUCKET_URL` n'est pas configuré — le
 * domaine reste alors absent du sélecteur (gating analogue à anomaly / arome-om).
 */
export function registerAromeFranceConvectionDomain(): void {
	if (!getModelsBucketUrl()) return;
	ensureAromeFranceGroup();
	if (domainOptions.some((d) => d.value === AROME_FRANCE_CONVECTION_DOMAIN)) return;
	domainOptions.push(aromeFranceConvectionDomain);
}
