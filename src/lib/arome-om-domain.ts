import { type Domain, domainGroups, domainOptions } from '@openmeteo/weather-map-layer';

import {
	AROME_OM_ANTILLES_DOMAIN,
	AROME_OM_GUYANE_DOMAIN,
	AROME_OM_NCALEDONIE_DOMAIN,
	AROME_OM_POLYNESIE_DOMAIN,
	AROME_OM_REUNION_DOMAIN
} from '$lib/constants';
import { getModelsBucketUrl } from '$lib/runtime-env';

/** Groupe (fournisseur) sous lequel le sélecteur range les domaines AROME-OM.
 *  Le sélecteur affiche un domaine sous un groupe si `domain.value` commence
 *  par `group.value` — `arome_om_reunion`.startsWith('arome_om') === true.
 *  Le préfixe `arome_om` regroupe Réunion/Antilles/Guyane/NCalédonie/Polynésie. */
const AROME_OM_GROUP = 'arome_om';

/** Les cinq territoires AROME-OM (modèle Météo-France 0,025° ~2,5 km) partagent
 *  la même résolution native, le même pas horaire et 4 runs/jour ; ils ne diffèrent
 *  que par leur emprise géographique. Dimensions et bornes extraites de la grille du
 *  pipeline `infoclimat-pipelines` (`crates/core/src/grid.rs`), source de vérité des
 *  fichiers `.om` produits. Longitudes normalisées en −180..180 côté pipeline → on
 *  reprend ces bornes telles quelles (cohérent avec MapLibre).
 *  `time_interval: 'hourly'` (un fichier par leadtime horaire),
 *  `model_interval: '6_hourly'` (runs 00/06/12/18 UTC),
 *  `grid.zoom: 5.2` (même résolution native que l'AROME France 0,025°). */
const AROME_OM_TERRITORIES: ReadonlyArray<{
	value: string;
	label: string;
	nx: number;
	ny: number;
	latMin: number;
	lonMin: number;
}> = [
	// Réunion / Océan Indien (Réunion, Mayotte, Madagascar, côte est-africaine, sud de l'Inde).
	{
		value: AROME_OM_REUNION_DOMAIN,
		label: 'AROME-OM Réunion-Mayotte',
		nx: 1395,
		ny: 899,
		latMin: -25.9,
		lonMin: 32.75
	},
	{
		value: AROME_OM_ANTILLES_DOMAIN,
		label: 'AROME-OM Antilles',
		nx: 945,
		ny: 529,
		latMin: 9.7,
		lonMin: -75.3
	},
	{
		value: AROME_OM_GUYANE_DOMAIN,
		label: 'AROME-OM Guyane',
		nx: 419,
		ny: 317,
		latMin: 1.05,
		lonMin: -56.75
	},
	{
		value: AROME_OM_NCALEDONIE_DOMAIN,
		label: 'AROME-OM Nouvelle-Calédonie',
		nx: 521,
		ny: 491,
		latMin: -26.0,
		lonMin: 158.5
	},
	{
		value: AROME_OM_POLYNESIE_DOMAIN,
		label: 'AROME-OM Polynésie',
		nx: 521,
		ny: 507,
		latMin: -25.25,
		lonMin: -157.5
	}
];

const aromeOmDomains: ReadonlyArray<Domain> = AROME_OM_TERRITORIES.map((t) => ({
	value: t.value,
	label: t.label,
	grid: {
		type: 'regular',
		nx: t.nx,
		ny: t.ny,
		latMin: t.latMin,
		lonMin: t.lonMin,
		dx: 0.025,
		dy: 0.025,
		zoom: 5.2
	},
	time_interval: 'hourly',
	model_interval: '6_hourly'
}));

/**
 * Pousse les pseudo-domaines `arome_om_*` dans `domainOptions` (mutable).
 * Idempotent. Ne fait rien si `VITE_MODELS_BUCKET_URL` n'est pas configuré —
 * les domaines restent alors absents du sélecteur (gating analogue à anomaly).
 */
export function registerAromeOmDomain(): void {
	if (!getModelsBucketUrl()) return;
	if (!domainGroups.some((g) => g.value === AROME_OM_GROUP)) {
		domainGroups.push({ value: AROME_OM_GROUP, label: 'AROME Outre-Mer' });
	}
	for (const domain of aromeOmDomains) {
		if (domainOptions.some((d) => d.value === domain.value)) continue;
		domainOptions.push(domain);
	}
}
