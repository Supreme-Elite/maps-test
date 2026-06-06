import { describe, expect, it } from 'vitest';

import { DOMAIN_ALLOWLIST, MODEL_SELECTOR_GROUPS } from '$lib/constants';

const EXPECTED_ORDER = [
	'meteofrance_arome_france_hd',
	'arome_france',
	'arome_france_convection',
	'arome_om_reunion',
	'arome_om_antilles',
	'arome_om_guyane',
	'arome_om_polynesie',
	'arome_om_ncaledonie',
	'meteofrance_arpege_europe',
	'meteofrance_arpege_world025',
	'dwd_icon_eu',
	'dwd_icon_d2',
	'ecmwf_ifs025',
	'ecmwf_ifs',
	'ecmwf_aifs025_single',
	'ncep_gfs025',
	'anomaly_europe'
];

describe('MODEL_SELECTOR_GROUPS', () => {
	it("met les groupes français en tête, dans l'ordre attendu", () => {
		expect(MODEL_SELECTOR_GROUPS.map((g) => g.label)).toEqual([
			'Météo-France Arome',
			'Météo-France Arpège',
			'DWD Germany',
			'ECMWF',
			'NOAA US',
			'Anomalie'
		]);
	});

	it("aplatit dans l'ordre cible exact", () => {
		const flat = MODEL_SELECTOR_GROUPS.flatMap((g) => g.domains.map((d) => d.value));
		expect(flat).toEqual(EXPECTED_ORDER);
	});

	it('DOMAIN_ALLOWLIST est dérivé de la table, sans doublon', () => {
		expect([...DOMAIN_ALLOWLIST]).toEqual(EXPECTED_ORDER);
		expect(new Set(DOMAIN_ALLOWLIST).size).toBe(DOMAIN_ALLOWLIST.length);
	});
});
