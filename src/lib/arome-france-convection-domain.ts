import { type Domain, domainGroups, domainOptions } from '@openmeteo/weather-map-layer';

import { AROME_FRANCE_CONVECTION_DOMAIN } from '$lib/constants';
import { getModelsBucketUrl } from '$lib/runtime-env';

/** Groupe (fournisseur) dédié sous lequel le sélecteur range le domaine convection.
 *  Le sélecteur affiche un domaine sous un groupe si `domain.value` commence par
 *  `group.value`. On prend la valeur de domaine entière comme valeur de groupe pour
 *  ne capturer aucun autre domaine `arome_france*` du package. */
const AROME_FRANCE_CONVECTION_GROUP = AROME_FRANCE_CONVECTION_DOMAIN;

/** Domaine AROME France métropole orienté convection / chasse à l'orage.
 *  Grille 1121×717 à 0.025°, métropole (lon −12→16, lat 37.5→55.4).
 *  Runs toutes les 3 h, horizon 51 h. Voir spec
 *  `2026-06-01-arome-france-convection-design.md`. */
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
	if (!domainGroups.some((g) => g.value === AROME_FRANCE_CONVECTION_GROUP)) {
		domainGroups.push({ value: AROME_FRANCE_CONVECTION_GROUP, label: 'AROME Convection' });
	}
	if (domainOptions.some((d) => d.value === AROME_FRANCE_CONVECTION_DOMAIN)) return;
	domainOptions.push(aromeFranceConvectionDomain);
}
