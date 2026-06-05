import { domainGroups, domainOptions } from '@openmeteo/weather-map-layer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Les cinq territoires AROME-OM et leurs dimensions de grille (source de vérité :
// `infoclimat-pipelines/crates/core/src/grid.rs`).
const AROME_OM_DOMAINS = [
	{ value: 'arome_om_reunion', nx: 1395, ny: 899, lonMin: 32.75, latMin: -25.9 },
	{ value: 'arome_om_antilles', nx: 945, ny: 529, lonMin: -75.3, latMin: 9.7 },
	{ value: 'arome_om_guyane', nx: 419, ny: 317, lonMin: -56.75, latMin: 1.05 },
	{ value: 'arome_om_ncaledonie', nx: 521, ny: 491, lonMin: 158.5, latMin: -26.0 },
	{ value: 'arome_om_polynesie', nx: 521, ny: 507, lonMin: -157.5, latMin: -25.25 }
] as const;

describe('registerAromeOmDomain', () => {
	beforeEach(() => {
		for (const { value } of AROME_OM_DOMAINS) {
			const idx = domainOptions.findIndex((d) => d.value === value);
			if (idx >= 0) domainOptions.splice(idx, 1);
		}
		const gidx = domainGroups.findIndex((g) => g.value === 'arome_om');
		if (gidx >= 0) domainGroups.splice(gidx, 1);
		vi.resetModules();
	});

	it('registers the "arome_om" domain group so the selector can show it', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeOmDomain } = await import('$lib/arome-om-domain');
		registerAromeOmDomain();
		expect(domainGroups.filter((g) => g.value === 'arome_om').length).toBe(1);
		// Chaque domaine doit commencer par le préfixe du groupe (lien groupe↔domaine).
		for (const { value } of AROME_OM_DOMAINS) {
			expect(value.startsWith('arome_om')).toBe(true);
		}
	});

	it('pushes all five territories with real grid dimensions when bucket URL is set', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeOmDomain } = await import('$lib/arome-om-domain');
		registerAromeOmDomain();
		for (const expected of AROME_OM_DOMAINS) {
			const d = domainOptions.find((x) => x.value === expected.value);
			expect(d, `domaine ${expected.value} manquant`).toBeDefined();
			expect(d?.grid.nx).toBe(expected.nx);
			expect(d?.grid.ny).toBe(expected.ny);
			// dx/dy/lonMin/latMin ne sont définis que sur la variante `regular` de
			// GridData ; type-narrowing explicite pour rendre l'accès safe au compilo.
			if (d?.grid.type === 'regular') {
				expect(d.grid.dx).toBeCloseTo(0.025, 6);
				expect(d.grid.dy).toBeCloseTo(0.025, 6);
				expect(d.grid.lonMin).toBeCloseTo(expected.lonMin, 6);
				expect(d.grid.latMin).toBeCloseTo(expected.latMin, 6);
			} else {
				throw new Error(`${expected.value} grid must be of type "regular"`);
			}
			expect(d?.time_interval).toBe('hourly');
			expect(d?.model_interval).toBe('6_hourly');
		}
	});

	it('is idempotent (no duplicate push)', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeOmDomain } = await import('$lib/arome-om-domain');
		registerAromeOmDomain();
		registerAromeOmDomain();
		for (const { value } of AROME_OM_DOMAINS) {
			const count = domainOptions.filter((x) => x.value === value).length;
			expect(count, `${value} dupliqué`).toBe(1);
		}
	});

	it('does not push when bucket URL is empty', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', '');
		const { registerAromeOmDomain } = await import('$lib/arome-om-domain');
		registerAromeOmDomain();
		for (const { value } of AROME_OM_DOMAINS) {
			expect(domainOptions.find((x) => x.value === value)).toBeUndefined();
		}
	});
});
