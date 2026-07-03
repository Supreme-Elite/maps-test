import { describe, expect, it } from 'vitest';

import { hasMeteogram, resolveApiModel } from '$lib/meteogram/model-map';

describe('resolveApiModel', () => {
	it('mappe un domaine servi par l’API', () => {
		expect(resolveApiModel('meteofrance_arpege_europe')).toBe('meteofrance_arpege_europe');
		expect(resolveApiModel('arome_france_hd')).toBe('meteofrance_arome_france_hd');
		expect(resolveApiModel('ecmwf_ifs025')).toBe('ecmwf_ifs025');
	});

	it('exclut le domaine maison bucket et les domaines non servis', () => {
		expect(resolveApiModel('arome_france')).toBeNull();
		expect(resolveApiModel('anomaly_europe')).toBeNull();
		expect(resolveApiModel('domaine_inconnu')).toBeNull();
	});

	it('hasMeteogram reflète la présence dans la table', () => {
		expect(hasMeteogram('ecmwf_ifs025')).toBe(true);
		expect(hasMeteogram('arome_france')).toBe(false);
	});
});
