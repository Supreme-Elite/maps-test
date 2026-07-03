<script lang="ts">
	import { barRects, linePath } from '$lib/meteogram/paths';
	import { dayTicks, linScale, niceExtent, timeToX } from '$lib/meteogram/scales';
	import { formatUTCDate } from '$lib/time-format';

	import { PANEL_PAD } from './panel-types';

	let {
		title,
		times,
		width,
		height,
		series,
		unitLabel,
		playheadTime,
		hoverIndex,
		onHover,
		onSeek
	}: import('./panel-types').PanelProps = $props();

	const PAD = PANEL_PAD;

	const x = $derived(timeToX(times, width, PAD.left, PAD.right));
	const allValues = $derived(series.flatMap((s) => s.values));
	const [lo, hi] = $derived(niceExtent(allValues));
	const y = $derived(linScale(lo, hi, height - PAD.bottom, PAD.top));
	const baselineY = $derived(height - PAD.bottom);
	const plotTop = PAD.top;

	// 4 graduations réparties entre lo et hi (bornes incluses).
	const yTicks = $derived(
		Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3).map((v) => ({
			value: v,
			y: y(v)
		}))
	);

	const dayGrid = $derived(dayTicks(times));

	// Largeur de barre calculée depuis l'espacement moyen entre points.
	const barWidth = $derived(
		Math.max(1, (width - PAD.left - PAD.right) / Math.max(times.length, 1) - 1)
	);

	const linePoints = (values: (number | null)[]) =>
		times.map((t, i) => ({ x: x(t), y: values[i] == null ? null : y(values[i] as number) }));

	const barPoints = (values: (number | null)[]) =>
		times.map((t, i) => ({ x: x(t), value: values[i] }));

	const formatTick = (v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString());
	const formatValue = (v: number | null | undefined) =>
		v == null || !Number.isFinite(v) ? '—' : formatTick(v);

	// Valeurs de chaque série à l'échéance survolée (pour la légende + les points).
	const hoverValues = $derived(
		hoverIndex !== null && hoverIndex < times.length
			? series.map((s) => ({ key: s.key, color: s.color, value: s.values[hoverIndex] }))
			: null
	);

	function handleMove(e: MouseEvent) {
		if (times.length === 0) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < times.length; i++) {
			const d = Math.abs(x(times[i]) - px);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		onHover(best);
	}
</script>

<figure class="m-0">
	<figcaption class="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
		<span>{title}</span>
		{#if hoverValues}
			<span class="flex items-center gap-1.5 tabular-nums">
				{#each hoverValues as v (v.key)}
					<span style="color: {v.color}">{formatValue(v.value)}</span>
				{/each}
				<span>{unitLabel}</span>
			</span>
		{:else}
			<span class="tabular-nums">{unitLabel}</span>
		{/if}
	</figcaption>
	<svg {width} {height} role="img" aria-label={title}>
		<!-- grille jour : ligne verticale faible + libellé date à minuit UTC -->
		{#each dayGrid as tick (tick.index)}
			<line
				x1={x(tick.date)}
				y1={plotTop}
				x2={x(tick.date)}
				y2={baselineY}
				class="stroke-white/10"
			/>
			<text x={x(tick.date) + 2} y={plotTop + 9} class="fill-white/40 text-[9px]">
				{formatUTCDate(tick.date)}
			</text>
		{/each}

		<!-- axe Y : graduations + gridlines horizontales -->
		{#each yTicks as tick (tick.value)}
			<line x1={PAD.left} y1={tick.y} x2={width - PAD.right} y2={tick.y} class="stroke-white/10" />
			<text
				x={PAD.left - 4}
				y={tick.y + 3}
				text-anchor="end"
				class="fill-white/50 text-[9px] tabular-nums"
			>
				{formatTick(tick.value)}
			</text>
		{/each}

		<!-- séries -->
		{#each series as s (s.key)}
			{#if s.kind === 'bar'}
				{#each barRects(barPoints(s.values), barWidth, baselineY, y) as bar, i (i)}
					<rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={s.color} />
				{/each}
			{:else}
				<path
					d={linePath(linePoints(s.values))}
					stroke={s.color}
					stroke-dasharray={s.dash}
					fill="none"
					stroke-width="1.5"
				/>
			{/if}
		{/each}

		<!-- playhead : échéance projetée depuis la carte -->
		{#if playheadTime}
			<line
				x1={x(playheadTime)}
				y1={plotTop}
				x2={x(playheadTime)}
				y2={baselineY}
				class="stroke-sky-400"
				stroke-width="1.5"
			/>
		{/if}

		<!-- crosshair : index survolé, partagé entre panneaux + point sur chaque série -->
		{#if hoverIndex !== null && hoverIndex < times.length}
			<line
				x1={x(times[hoverIndex])}
				y1={plotTop}
				x2={x(times[hoverIndex])}
				y2={baselineY}
				class="stroke-white/30"
			/>
			{#each series as s (s.key)}
				{@const v = s.values[hoverIndex]}
				{#if v != null && Number.isFinite(v)}
					<circle cx={x(times[hoverIndex])} cy={y(v as number)} r="2.5" fill={s.color} />
				{/if}
			{/each}
		{/if}

		<!--
			Rect d'interaction : survol pointeur uniquement (scrubbing façon
			meteogram). Le clic reproduit une action déjà accessible au clavier
			via la timeline principale (time-selector.svelte) ; le scrubbing
			clavier dédié à ce panneau (flèches gauche/droite) est un follow-up
			assumé (cf. spec meteogram — espace point), donc on ignore ici
			ponctuellement la règle qui exige un clavier équivalent au clic.
		-->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<rect
			x={PAD.left}
			y={plotTop}
			width={Math.max(0, width - PAD.left - PAD.right)}
			height={Math.max(0, baselineY - plotTop)}
			fill="transparent"
			style="cursor: crosshair;"
			onmousemove={handleMove}
			onmouseleave={() => onHover(null)}
			onclick={() => hoverIndex !== null && onSeek(times[hoverIndex])}
		/>
	</svg>
</figure>
