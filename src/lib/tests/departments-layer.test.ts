import { beforeEach, describe, expect, it } from 'vitest';

import type maplibregl from 'maplibre-gl';

import { showDepartments } from '$lib/stores/departments';
import { map } from '$lib/stores/map';

import {
	DEPARTMENTS_LAYER_ID,
	buildDepartmentsLineLayer,
	ensureDepartmentsLayer,
	refreshDepartments
} from '$lib/departments-layer';

describe('buildDepartmentsLineLayer', () => {
	it('cible la couche boundary admin_level 6 du fond', () => {
		const layer = buildDepartmentsLineLayer(true, true);
		expect(layer.id).toBe(DEPARTMENTS_LAYER_ID);
		expect(layer.type).toBe('line');
		expect(layer.source).toBe('openmaptiles');
		expect(layer['source-layer']).toBe('boundary');
		expect(layer.filter).toEqual(['==', ['get', 'admin_level'], 6]);
	});

	it('ligne blanche sur fond sombre, noire sur fond clair', () => {
		expect(buildDepartmentsLineLayer(true, true).paint!['line-color']).toBe(
			'rgba(255,255,255,0.55)'
		);
		expect(buildDepartmentsLineLayer(false, true).paint!['line-color']).toBe('rgba(0,0,0,0.55)');
	});

	it('encode la visibilité initiale', () => {
		expect(buildDepartmentsLineLayer(true, true).layout!.visibility).toBe('visible');
		expect(buildDepartmentsLineLayer(true, false).layout!.visibility).toBe('none');
	});
});
