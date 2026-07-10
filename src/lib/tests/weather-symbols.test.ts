import { describe, expect, it } from 'vitest';

import { symbolForWmo } from '$lib/meteogram/weather-symbols';

describe('symbolForWmo', () => {
	it('mappe les codes de base avec variante jour/nuit', () => {
		expect(symbolForWmo(0, true)).toEqual({ icon: '01d', label: 'Ciel clair' });
		expect(symbolForWmo(0, false)).toEqual({ icon: '01n', label: 'Ciel clair' });
		expect(symbolForWmo(2, true).icon).toBe('03d');
	});

	it('les codes sans variante ignorent isDay', () => {
		expect(symbolForWmo(3, true).icon).toBe('04');
		expect(symbolForWmo(3, false).icon).toBe('04');
		expect(symbolForWmo(45, false)).toEqual({ icon: '15', label: 'Brouillard' });
	});

	it('couvre pluie, neige, averses et orage', () => {
		expect(symbolForWmo(61, true).icon).toBe('46');
		expect(symbolForWmo(65, true).icon).toBe('10');
		expect(symbolForWmo(75, true).icon).toBe('50');
		expect(symbolForWmo(80, false).icon).toBe('40n');
		expect(symbolForWmo(95, true)).toEqual({ icon: '22', label: 'Orage' });
	});

	it('code inconnu → fallback couvert', () => {
		expect(symbolForWmo(42, true)).toEqual({ icon: '04', label: 'Couvert' });
	});
});
