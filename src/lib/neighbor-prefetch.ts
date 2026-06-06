export interface NeighborWindow {
	startDate: Date;
	endDate: Date;
}

/**
 * Calcule la plage contiguë d'échéances voisines à précharger autour de `currentTime`.
 *
 * Le sens et la contiguïté sont déduits des index de `currentTime`/`previousTime` dans
 * `validTimes` (pas sur les millisecondes — le pas temporel varie selon le domaine) :
 * - avancée d'un pas (delta = +1)  → [−backward, +forward]
 * - recul d'un pas   (delta = −1)  → [−forward, +backward]
 * - saut (|delta| > 1), premier chargement (previousTime null), ou previousTime absent
 *   de validTimes (ex. changement de run) → ±1 symétrique
 *
 * La plage est clampée aux bornes du run et inclut l'échéance courante (déjà en cache
 * → re-prefetch quasi gratuit). Retourne null si la grille est vide ou l'échéance absente.
 */
export const computeNeighborWindow = (
	currentTime: Date,
	previousTime: Date | null,
	validTimes: Date[],
	cfg: { forward: number; backward: number }
): NeighborWindow | null => {
	if (validTimes.length === 0) return null;

	const currentIdx = validTimes.findIndex((t) => t.getTime() === currentTime.getTime());
	if (currentIdx === -1) return null;

	const prevIdx =
		previousTime === null
			? -1
			: validTimes.findIndex((t) => t.getTime() === previousTime.getTime());
	const delta = prevIdx === -1 ? 0 : currentIdx - prevIdx;

	let before: number;
	let after: number;
	if (delta === 1) {
		before = cfg.backward;
		after = cfg.forward;
	} else if (delta === -1) {
		before = cfg.forward;
		after = cfg.backward;
	} else {
		before = 1;
		after = 1;
	}

	const startIdx = Math.max(0, currentIdx - before);
	const endIdx = Math.min(validTimes.length - 1, currentIdx + after);

	return {
		startDate: validTimes[startIdx],
		endDate: validTimes[endIdx]
	};
};
