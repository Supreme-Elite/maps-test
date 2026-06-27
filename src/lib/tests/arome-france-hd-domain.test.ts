import { domainGroups, domainOptions } from '@openmeteo/weather-map-layer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('registerAromeFranceHdDomain', () => {
	beforeEach(() => {
		const idx = domainOptions.findIndex((d) => d.value === 'arome_france_hd');
		if (idx >= 0) domainOptions.splice(idx, 1);
		const gidx = domainGroups.findIndex((g) => g.value === 'arome_france');
		if (gidx >= 0) domainGroups.splice(gidx, 1);
		vi.resetModules();
		vi.unstubAllEnvs();
	});

	it('réutilise le groupe partagé « arome_france »', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceHdDomain } = await import('$lib/arome-france-hd-domain');
		registerAromeFranceHdDomain();
		expect(domainGroups.filter((g) => g.value === 'arome_france').length).toBe(1);
		expect(domainGroups.find((g) => g.value === 'arome_france')?.label).toBe(
			'AROME France (Infoclimat)'
		);
	});

	it('pousse arome_france_hd avec la grille HD 0,01° (2801×1791)', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceHdDomain } = await import('$lib/arome-france-hd-domain');
		registerAromeFranceHdDomain();
		const d = domainOptions.find((x) => x.value === 'arome_france_hd');
		expect(d).toBeDefined();
		expect(d?.grid.nx).toBe(2801);
		expect(d?.grid.ny).toBe(1791);
		if (d?.grid.type === 'regular') {
			expect(d.grid.dx).toBeCloseTo(0.01, 6);
			expect(d.grid.dy).toBeCloseTo(0.01, 6);
			expect(d.grid.lonMin).toBeCloseTo(-12, 6);
			expect(d.grid.latMin).toBeCloseTo(37.5, 6);
		} else {
			throw new Error('arome_france_hd grid must be of type "regular"');
		}
		expect(d?.time_interval).toBe('hourly');
		expect(d?.model_interval).toBe('3_hourly');
	});

	it('est idempotent (pas de double push)', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', 'https://bucket.test');
		const { registerAromeFranceHdDomain } = await import('$lib/arome-france-hd-domain');
		registerAromeFranceHdDomain();
		registerAromeFranceHdDomain();
		expect(domainOptions.filter((x) => x.value === 'arome_france_hd').length).toBe(1);
	});

	it('ne pousse rien quand le bucket est vide', async () => {
		vi.stubEnv('VITE_MODELS_BUCKET_URL', '');
		const { registerAromeFranceHdDomain } = await import('$lib/arome-france-hd-domain');
		registerAromeFranceHdDomain();
		expect(domainOptions.find((x) => x.value === 'arome_france_hd')).toBeUndefined();
	});
});
