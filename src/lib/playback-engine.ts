import { nextPlaybackFrame } from '$lib/playback';
import { SLOT_EVENT_COMMIT, SLOT_EVENT_ERROR } from '$lib/slot-events';

/** Plancher de durée d'affichage d'une échéance pendant la lecture. */
export const PLAYBACK_MIN_FRAME_MS = 700;
/** Garde : sans commit du slot manager sous ce délai, on avance quand même. */
export const PLAYBACK_MAX_WAIT_MS = 10000;

export interface PlaybackEngineOptions {
	/** Bus d'événements émettant `commit`/`error` (en prod : `slotEvents`). */
	events: EventTarget;
	getSteps: () => Date[] | undefined;
	getCurrent: () => Date;
	/** Applique l'échéance suivante (store `time` + URL + rechargement des couches). */
	advance: (date: Date) => void;
	/** Appelé quand le moteur s'arrête de lui-même (erreur de slot, pas de frame suivante). */
	onAutoStop?: () => void;
	minFrameMs?: number;
	maxWaitMs?: number;
}

export interface PlaybackEngine {
	start(): boolean;
	stop(): void;
	readonly running: boolean;
}

/**
 * Moteur de lecture en direct : avance le temps d'une échéance, attend que la
 * frame soit réellement rendue (événement `commit` du slot manager) puis
 * programme l'avancée suivante en respectant un plancher par frame. Boucle de
 * l'échéance de départ à la fin du run via `nextPlaybackFrame`.
 */
export const createPlaybackEngine = (options: PlaybackEngineOptions): PlaybackEngine => {
	const { events, getSteps, getCurrent, advance, onAutoStop } = options;
	const minFrameMs = options.minFrameMs ?? PLAYBACK_MIN_FRAME_MS;
	const maxWaitMs = options.maxWaitMs ?? PLAYBACK_MAX_WAIT_MS;

	let running = false;
	let loopStart = new Date(0);
	let lastAdvanceAt = 0;
	let waitingForCommit = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const clearTimer = () => {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	const teardown = () => {
		running = false;
		waitingForCommit = false;
		clearTimer();
		events.removeEventListener(SLOT_EVENT_COMMIT, onCommit);
		events.removeEventListener(SLOT_EVENT_ERROR, onError);
	};

	const autoStop = () => {
		if (!running) return;
		teardown();
		onAutoStop?.();
	};

	const advanceNext = () => {
		if (!running) return;
		clearTimer();
		const steps = getSteps();
		const end = steps?.[steps.length - 1];
		const next = steps && end ? nextPlaybackFrame(getCurrent(), loopStart, end, steps) : undefined;
		if (!next) {
			autoStop();
			return;
		}
		lastAdvanceAt = Date.now();
		waitingForCommit = true;
		advance(next);
		timer = setTimeout(advanceNext, maxWaitMs);
	};

	const onCommit = () => {
		if (!running || !waitingForCommit) return;
		waitingForCommit = false;
		clearTimer();
		const delay = Math.max(0, minFrameMs - (Date.now() - lastAdvanceAt));
		timer = setTimeout(advanceNext, delay);
	};

	const onError = () => autoStop();

	return {
		start() {
			if (running) return true;
			const steps = getSteps();
			if (!steps || steps.length === 0) return false;
			loopStart = getCurrent();
			running = true;
			events.addEventListener(SLOT_EVENT_COMMIT, onCommit);
			events.addEventListener(SLOT_EVENT_ERROR, onError);
			advanceNext();
			return running;
		},
		stop() {
			if (running) teardown();
		},
		get running() {
			return running;
		}
	};
};
