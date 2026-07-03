export interface PathPoint {
	x: number;
	y: number | null;
}

export const linePath = (points: PathPoint[]): string => {
	let d = '';
	let penDown = false;
	for (const p of points) {
		if (p.y === null || !Number.isFinite(p.y)) {
			penDown = false;
			continue;
		}
		d += `${d ? ' ' : ''}${penDown ? 'L' : 'M'}${p.x},${p.y}`;
		penDown = true;
	}
	return d;
};

export interface Bar {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const barRects = (
	points: { x: number; value: number | null }[],
	barWidth: number,
	baselineY: number,
	valueToY: (v: number) => number
): Bar[] =>
	points
		.filter((p): p is { x: number; value: number } => p.value !== null && p.value > 0)
		.map((p) => {
			const y = valueToY(p.value);
			return { x: p.x - barWidth / 2, y, w: barWidth, h: baselineY - y };
		});
