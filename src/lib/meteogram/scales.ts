export const linScale =
	(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) =>
	(v: number): number => {
		if (domainMax === domainMin) return rangeMin;
		return rangeMin + ((v - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
	};

export const timeToX = (
	times: Date[],
	width: number,
	padLeft: number,
	padRight: number
): ((t: Date) => number) => {
	const t0 = times[0]?.getTime() ?? 0;
	const t1 = times[times.length - 1]?.getTime() ?? 1;
	const s = linScale(t0, t1, padLeft, width - padRight);
	return (t: Date) => s(t.getTime());
};

export const niceExtent = (values: (number | null)[], pad = 0.08): [number, number] => {
	const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
	if (nums.length === 0) return [0, 1];
	let lo = Math.min(...nums);
	let hi = Math.max(...nums);
	if (lo === hi) {
		lo -= 1;
		hi += 1;
	}
	const margin = (hi - lo) * pad;
	return [lo - margin, hi + margin];
};

export const dayTicks = (times: Date[]): { index: number; date: Date }[] =>
	times.map((date, index) => ({ index, date })).filter(({ date }) => date.getUTCHours() === 0);
