import { describe, expect, it } from 'vitest';

import { formatUtcStamp, sanitizeFilenamePart } from '$lib/png-export';

describe('formatUtcStamp', () => {
	it('formats a UTC instant as YYYYMMDD_HHMMZ', () => {
		expect(formatUtcStamp(new Date('2026-05-22T03:00:00Z'))).toBe('20260522_0300Z');
	});

	it('zero-pads month, day, hours and minutes', () => {
		expect(formatUtcStamp(new Date('2026-01-02T04:05:00Z'))).toBe('20260102_0405Z');
	});

	it('reads UTC fields regardless of local timezone offset', () => {
		// 23:30Z must stay the same calendar day in the stamp
		expect(formatUtcStamp(new Date('2026-12-31T23:30:00Z'))).toBe('20261231_2330Z');
	});
});

describe('sanitizeFilenamePart', () => {
	it('strips diacritics and lowercases', () => {
		expect(sanitizeFilenamePart('Précipitation')).toBe('precipitation');
	});

	it('collapses non-alphanumerics into single hyphens', () => {
		expect(sanitizeFilenamePart('temp 2m (°C)')).toBe('temp-2m-c');
	});

	it('trims leading and trailing hyphens', () => {
		expect(sanitizeFilenamePart('  --foo--  ')).toBe('foo');
	});

	it('falls back to "carte" when nothing usable remains', () => {
		expect(sanitizeFilenamePart('***')).toBe('carte');
		expect(sanitizeFilenamePart('')).toBe('carte');
	});

	it('caps the length at 80 characters', () => {
		expect(sanitizeFilenamePart('a'.repeat(200))).toHaveLength(80);
	});
});
