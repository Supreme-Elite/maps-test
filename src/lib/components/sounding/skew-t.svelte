<script lang="ts">
	import { mode } from 'mode-watcher';

	import {
		type SkewTConfig,
		interpByPressure,
		pressureToY,
		tempToX,
		yToPressure
	} from '$lib/sounding/skewt-coords';
	import { type ColumnProfile, type ParcelResult } from '$lib/sounding/types';

	let { profile, parcel }: { profile: ColumnProfile; parcel: ParcelResult } = $props();

	const W = 320;
	const H = 420;
	const cfg: SkewTConfig = { pTop: 100, pBottom: 1050, tMin: -40, tMax: 40, skew: 0.55 };

	const isobars = [1000, 850, 700, 500, 400, 300, 200, 150, 100];
	const isotherms = [-60, -40, -20, 0, 20, 40];

	const px = (t: number, p: number) => tempToX(t, p, cfg) * W;
	const py = (p: number) => pressureToY(p, cfg) * H;

	const isDark = $derived(mode.current === 'dark');
	const grid = $derived(isDark ? '#334155' : '#cbd5e1');
	const axis = $derived(isDark ? '#64748b' : '#94a3b8');
	const legendText = $derived(isDark ? '#cbd5e1' : '#334155');
	const legendBg = $derived(isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.82)');

	const tempPath = $derived(
		profile.levels
			.map((l, i) => `${i ? 'L' : 'M'}${px(l.temperature, l.pressure)},${py(l.pressure)}`)
			.join(' ')
	);
	const dewPath = $derived(
		profile.levels
			.map((l, i) => `${i ? 'L' : 'M'}${px(l.dewpoint, l.pressure)},${py(l.pressure)}`)
			.join(' ')
	);
	const parcelPath = $derived(
		profile.levels
			.map((l, i) => `${i ? 'L' : 'M'}${px(parcel.temperature[i], l.pressure)},${py(l.pressure)}`)
			.join(' ')
	);

	// --- Survol : lecture T / Td / particule / altitude le long des tracés -------
	const pres = $derived(profile.levels.map((l) => l.pressure));
	const temps = $derived(profile.levels.map((l) => l.temperature));
	const dews = $derived(profile.levels.map((l) => l.dewpoint));
	const heights = $derived(profile.levels.map((l) => l.height));

	interface Hover {
		y: number;
		pressure: number;
		height: number;
		t: number;
		td: number;
		parcel: number;
	}
	let hover = $state<Hover | null>(null);

	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const yNorm = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
		const pMax = pres[0];
		const pMin = pres[pres.length - 1];
		const p = Math.min(pMax, Math.max(pMin, yToPressure(yNorm, cfg)));
		hover = {
			y: py(p),
			pressure: p,
			height: interpByPressure(pres, heights, p),
			t: interpByPressure(pres, temps, p),
			td: interpByPressure(pres, dews, p),
			parcel: interpByPressure(pres, parcel.temperature, p)
		};
	}
	function onLeave() {
		hover = null;
	}
</script>

<div class="relative h-full w-full">
	{#if hover}
		<div
			class="pointer-events-none absolute left-1 top-1 z-10 rounded border bg-background/90 px-2 py-1 font-mono text-xs leading-snug shadow-sm"
		>
			<div class="font-semibold">
				{Math.round(hover.pressure)} hPa · {Math.round(hover.height)} m
			</div>
			<div>
				<span style="color:#ef4444">T {hover.t.toFixed(1)}°</span>
				<span style="color:#22c55e">Td {hover.td.toFixed(1)}°</span>
				<span style="color:#f59e0b">P {hover.parcel.toFixed(1)}°</span>
			</div>
		</div>
	{/if}
	<svg
		viewBox="0 0 {W} {H}"
		class="h-full w-full"
		role="img"
		aria-label="Diagramme Skew-T"
		onpointermove={onMove}
		onpointerleave={onLeave}
	>
		{#each isobars as p (p)}
			<line x1="0" y1={py(p)} x2={W} y2={py(p)} stroke={grid} stroke-width="0.5" />
			<text x="2" y={py(p) - 2} fill={axis} font-size="9">{p}</text>
		{/each}
		{#each isotherms as t (t)}
			<line
				x1={px(t, cfg.pBottom)}
				y1={H}
				x2={px(t, cfg.pTop)}
				y2="0"
				stroke={grid}
				stroke-width="0.4"
			/>
		{/each}
		<path d={dewPath} fill="none" stroke="#22c55e" stroke-width="2" />
		<path d={tempPath} fill="none" stroke="#ef4444" stroke-width="2" />
		<path d={parcelPath} fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3" />

		{#if hover}
			<line
				x1="0"
				y1={hover.y}
				x2={W}
				y2={hover.y}
				stroke={axis}
				stroke-width="0.7"
				stroke-dasharray="2 2"
			/>
			<circle cx={px(hover.td, hover.pressure)} cy={hover.y} r="3" fill="#22c55e" />
			<circle cx={px(hover.t, hover.pressure)} cy={hover.y} r="3" fill="#ef4444" />
			<circle cx={px(hover.parcel, hover.pressure)} cy={hover.y} r="3" fill="#f59e0b" />
		{/if}

		<!-- Légende -->
		<g font-size="10" font-family="ui-monospace, monospace">
			<rect
				x="4"
				y="342"
				width="118"
				height="68"
				rx="3"
				fill={legendBg}
				stroke={grid}
				stroke-width="0.5"
			/>
			<line x1="10" y1="356" x2="26" y2="356" stroke="#ef4444" stroke-width="2" />
			<text x="31" y="359" fill={legendText}>Température</text>
			<line x1="10" y1="372" x2="26" y2="372" stroke="#22c55e" stroke-width="2" />
			<text x="31" y="375" fill={legendText}>Point de rosée</text>
			<line
				x1="10"
				y1="388"
				x2="26"
				y2="388"
				stroke="#f59e0b"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
			<text x="31" y="391" fill={legendText}>Particule</text>
			<text x="10" y="405" fill={axis}>Pression en hPa · T inclinée</text>
		</g>
		<text
			x={W - 4}
			y="13"
			text-anchor="end"
			font-size="9"
			font-family="ui-monospace, monospace"
			fill={axis}>infoclimat.fr</text
		>
	</svg>
</div>
