import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlaybackEngine } from '$lib/playback-engine';

const steps = [
	new Date('2026-05-24T00:00:00Z'),
	new Date('2026-05-24T01:00:00Z'),
	new Date('2026-05-24T02:00:00Z'),
	new Date('2026-05-24T03:00:00Z')
];

const setup = (overrides: Record<string, unknown> = {}) => {
	const events = new EventTarget();
	let current = steps[1];
	const advanced: Date[] = [];
	const onAutoStop = vi.fn();
	const engine = createPlaybackEngine({
		events,
		getSteps: () => steps,
		getCurrent: () => current,
		advance: (date: Date) => {
			current = date;
			advanced.push(date);
		},
		onAutoStop,
		minFrameMs: 700,
		maxWaitMs: 10000,
		...overrides
	});
	const commit = () => events.dispatchEvent(new Event('commit'));
	const error = () => events.dispatchEvent(new Event('error'));
	return { engine, advanced, onAutoStop, commit, error };
};

describe('createPlaybackEngine', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('advances to the next step immediately on start', () => {
		const { engine, advanced } = setup();
		expect(engine.start()).toBe(true);
		expect(advanced).toHaveLength(1);
		expect(advanced[0].getTime()).toBe(steps[2].getTime());
		engine.stop();
	});

	it('refuses to start without time steps', () => {
		const { engine, advanced } = setup({ getSteps: () => undefined });
		expect(engine.start()).toBe(false);
		expect(engine.running).toBe(false);
		expect(advanced).toHaveLength(0);
	});

	it('waits for commit plus the remaining min-frame delay before the next advance', () => {
		const { engine, advanced, commit } = setup();
		engine.start();
		commit();
		vi.advanceTimersByTime(699);
		expect(advanced).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(advanced).toHaveLength(2);
		engine.stop();
	});

	it('advances without extra delay when commit arrives after the min-frame interval', () => {
		const { engine, advanced, commit } = setup();
		engine.start();
		vi.advanceTimersByTime(900);
		commit();
		vi.advanceTimersByTime(0);
		expect(advanced).toHaveLength(2);
		engine.stop();
	});

	it('ignores duplicate commits for the same frame', () => {
		const { engine, advanced, commit } = setup();
		engine.start();
		commit();
		commit();
		commit();
		vi.advanceTimersByTime(700);
		expect(advanced).toHaveLength(2);
		engine.stop();
	});

	it('loops back to the playback start frame after the last step', () => {
		const { engine, advanced, commit } = setup();
		engine.start();
		// current was steps[1] on start: steps[2] → steps[3] → loop to steps[1]
		commit();
		vi.advanceTimersByTime(700);
		commit();
		vi.advanceTimersByTime(700);
		expect(advanced.map((d) => d.getTime())).toEqual(
			[steps[2], steps[3], steps[1]].map((d) => d.getTime())
		);
		engine.stop();
	});

	it('auto-stops on a slot error event', () => {
		const { engine, advanced, onAutoStop, error, commit } = setup();
		engine.start();
		error();
		expect(engine.running).toBe(false);
		expect(onAutoStop).toHaveBeenCalledOnce();
		commit();
		vi.advanceTimersByTime(5000);
		expect(advanced).toHaveLength(1);
	});

	it('advances anyway when no commit arrives within the guard timeout', () => {
		const { engine, advanced } = setup();
		engine.start();
		vi.advanceTimersByTime(10000);
		expect(advanced).toHaveLength(2);
		engine.stop();
	});

	it('stops cleanly: no further advance after stop', () => {
		const { engine, advanced, onAutoStop, commit } = setup();
		engine.start();
		engine.stop();
		expect(engine.running).toBe(false);
		commit();
		vi.advanceTimersByTime(20000);
		expect(advanced).toHaveLength(1);
		expect(onAutoStop).not.toHaveBeenCalled();
	});

	it('loops within the bounds provided by getBounds', () => {
		const { engine, advanced, commit } = setup({
			getBounds: () => ({ start: steps[1], end: steps[2] })
		});
		// current = steps[1] : steps[2] → boucle sur steps[1]
		engine.start();
		commit();
		vi.advanceTimersByTime(700);
		expect(advanced.map((d) => d.getTime())).toEqual([steps[2], steps[1]].map((d) => d.getTime()));
		engine.stop();
	});

	it('jumps to the range start when the current time is outside the bounds', () => {
		const { engine, advanced } = setup({
			getCurrent: () => steps[0],
			getBounds: () => ({ start: steps[2], end: steps[3] })
		});
		// current = steps[0], sous la plage : on saute directement à steps[2]
		engine.start();
		expect(advanced[0].getTime()).toBe(steps[2].getTime());
		engine.stop();
	});

	it('refuses to start when no step falls within the bounds', () => {
		const { engine, advanced } = setup({
			getBounds: () => ({
				start: new Date('2026-05-25T00:00:00Z'),
				end: new Date('2026-05-25T06:00:00Z')
			})
		});
		expect(engine.start()).toBe(false);
		expect(engine.running).toBe(false);
		expect(advanced).toHaveLength(0);
	});

	it('is idempotent: start while running does not double-advance', () => {
		const { engine, advanced } = setup();
		engine.start();
		expect(engine.start()).toBe(true);
		expect(advanced).toHaveLength(1);
		engine.stop();
	});
});
