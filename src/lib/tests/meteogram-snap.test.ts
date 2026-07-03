import { describe, expect, it } from 'vitest';

import { nearestValidTime } from '$lib/meteogram/snap';

describe('nearestValidTime', () => {
	const vts = [
		new Date('2026-07-03T00:00Z'),
		new Date('2026-07-03T03:00Z'),
		new Date('2026-07-03T06:00Z')
	];
	it('renvoie la valid_time la plus proche', () => {
		expect(nearestValidTime(new Date('2026-07-03T02:00Z'), vts)?.toISOString()).toBe(
			'2026-07-03T03:00:00.000Z'
		);
	});
	it('renvoie null si liste vide', () => {
		expect(nearestValidTime(new Date(), [])).toBeNull();
	});
});
