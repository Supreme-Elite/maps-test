export const nearestValidTime = (target: Date, validTimes: Date[]): Date | null => {
	if (validTimes.length === 0) return null;
	const tt = target.getTime();
	return validTimes.reduce((best, cur) =>
		Math.abs(cur.getTime() - tt) < Math.abs(best.getTime() - tt) ? cur : best
	);
};
