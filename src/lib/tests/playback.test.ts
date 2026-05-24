import { describe, expect, it } from 'vitest';

import { arePlaybackBoundsValid, nextPlaybackFrame, timeStepsBetween } from '$lib/playback';

const steps = [
	new Date('2026-05-24T00:00:00Z'),
	new Date('2026-05-24T01:00:00Z'),
	new Date('2026-05-24T02:00:00Z'),
	new Date('2026-05-24T03:00:00Z'),
	new Date('2026-05-24T04:00:00Z')
];

describe('nextPlaybackFrame', () => {
	it('returns the next step when not at end', () => {
		const next = nextPlaybackFrame(
			new Date('2026-05-24T01:00:00Z'),
			new Date('2026-05-24T00:00:00Z'),
			new Date('2026-05-24T03:00:00Z'),
			steps
		);
		expect(next?.getTime()).toBe(new Date('2026-05-24T02:00:00Z').getTime());
	});

	it('loops to start when next step exceeds end', () => {
		const next = nextPlaybackFrame(
			new Date('2026-05-24T03:00:00Z'),
			new Date('2026-05-24T01:00:00Z'),
			new Date('2026-05-24T03:00:00Z'),
			steps
		);
		expect(next?.getTime()).toBe(new Date('2026-05-24T01:00:00Z').getTime());
	});

	it('loops to start when current step is the last step in array', () => {
		const next = nextPlaybackFrame(
			new Date('2026-05-24T04:00:00Z'),
			new Date('2026-05-24T00:00:00Z'),
			new Date('2026-05-24T04:00:00Z'),
			steps
		);
		expect(next?.getTime()).toBe(new Date('2026-05-24T00:00:00Z').getTime());
	});

	it('returns first step >= start when current is outside range', () => {
		const next = nextPlaybackFrame(
			new Date('2026-05-23T23:00:00Z'),
			new Date('2026-05-24T01:00:00Z'),
			new Date('2026-05-24T03:00:00Z'),
			steps
		);
		expect(next?.getTime()).toBe(new Date('2026-05-24T01:00:00Z').getTime());
	});

	it('returns undefined when steps array is empty', () => {
		const next = nextPlaybackFrame(new Date(), new Date(), new Date(), []);
		expect(next).toBeUndefined();
	});
});

describe('arePlaybackBoundsValid', () => {
	it('returns true when both bounds are in steps and start < end', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T01:00:00Z'),
				new Date('2026-05-24T03:00:00Z'),
				steps
			)
		).toBe(true);
	});

	it('returns false when start is undefined', () => {
		expect(arePlaybackBoundsValid(undefined, new Date('2026-05-24T03:00:00Z'), steps)).toBe(false);
	});

	it('returns false when end is undefined', () => {
		expect(arePlaybackBoundsValid(new Date('2026-05-24T01:00:00Z'), undefined, steps)).toBe(false);
	});

	it('returns false when steps is undefined', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T01:00:00Z'),
				new Date('2026-05-24T03:00:00Z'),
				undefined
			)
		).toBe(false);
	});

	it('returns false when start >= end', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T03:00:00Z'),
				new Date('2026-05-24T01:00:00Z'),
				steps
			)
		).toBe(false);
	});

	it('returns false when start is not in steps', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T01:30:00Z'),
				new Date('2026-05-24T03:00:00Z'),
				steps
			)
		).toBe(false);
	});

	it('returns false when end is not in steps', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T01:00:00Z'),
				new Date('2026-05-24T03:30:00Z'),
				steps
			)
		).toBe(false);
	});

	it('returns false when steps is empty', () => {
		expect(
			arePlaybackBoundsValid(
				new Date('2026-05-24T01:00:00Z'),
				new Date('2026-05-24T03:00:00Z'),
				[]
			)
		).toBe(false);
	});
});

describe('timeStepsBetween', () => {
	it('returns inclusive count of steps between start and end', () => {
		expect(
			timeStepsBetween(
				new Date('2026-05-24T01:00:00Z'),
				new Date('2026-05-24T03:00:00Z'),
				steps
			)
		).toBe(3);
	});

	it('returns 0 when bounds are invalid', () => {
		expect(timeStepsBetween(undefined, undefined, steps)).toBe(0);
		expect(timeStepsBetween(new Date(), new Date(), undefined)).toBe(0);
	});
});
