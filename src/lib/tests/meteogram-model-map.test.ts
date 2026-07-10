import { describe, expect, it } from 'vitest';

import { hasMeteogram, resolveApiModel } from '$lib/meteogram/model-map';

describe('resolveApiModel', () => {
	it('mappe un domaine servi par l’API', () => {
		expect(resolveApiModel('meteofrance_arpege_europe')).toBe('meteofrance_arpege_europe');
		expect(resolveApiModel('arome_france_hd')).toBe('meteofrance_arome_france_hd');
		expect(resolveApiModel('ecmwf_ifs025')).toBe('ecmwf_ifs025');
	});

	it('mappe les pseudo-domaines maison AROME France (servis par l’API maison)', () => {
		expect(resolveApiModel('arome_france')).toBe('meteofrance_arome_france');
		expect(resolveApiModel('arome_france_convection')).toBe('meteofrance_arome_france');
	});

	it('exclut les domaines non servis', () => {
		expect(resolveApiModel('anomaly_europe')).toBeNull();
		expect(resolveApiModel('domaine_inconnu')).toBeNull();
	});

	it('hasMeteogram reflète la présence dans la table', () => {
		expect(hasMeteogram('ecmwf_ifs025')).toBe(true);
		expect(hasMeteogram('arome_france')).toBe(true);
		expect(hasMeteogram('anomaly_europe')).toBe(false);
	});
});
