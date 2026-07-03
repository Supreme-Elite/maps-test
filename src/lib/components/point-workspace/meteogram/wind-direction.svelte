<script lang="ts">
	let {
		times,
		directions,
		width,
		x,
		step = 3
	}: {
		times: Date[];
		directions: (number | null)[];
		width: number;
		x: (t: Date) => number;
		step?: number;
	} = $props();

	const H = 22;
	const arrows = $derived(
		times
			.map((t, i) => ({ t, i, dir: directions[i] }))
			.filter(({ i, dir }) => i % step === 0 && dir !== null && Number.isFinite(dir))
	);
</script>

<svg {width} height={H} role="img" aria-label="Direction du vent">
	{#each arrows as a (a.i)}
		<g transform={`translate(${x(a.t)}, ${H / 2}) rotate(${(a.dir ?? 0) + 180})`}>
			<line x1="0" y1="-6" x2="0" y2="6" stroke="currentColor" stroke-width="1.5" />
			<path d="M0,6 L-3,2 M0,6 L3,2" stroke="currentColor" stroke-width="1.5" fill="none" />
		</g>
	{/each}
</svg>
