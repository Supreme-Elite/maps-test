// Padding partagé du plot SVG des panneaux : panel.svelte l'utilise pour son
// propre tracé, meteogram.svelte pour aligner la bande de direction du vent
// (qui ne dessine pas dans le SVG du panneau) sur la même échelle x.
export const PANEL_PAD = { left: 44, right: 12, top: 18, bottom: 16 } as const;

export interface PanelSeries {
	key: string;
	label: string;
	values: (number | null)[];
	color: string;
	dash?: string;
	kind?: 'line' | 'bar';
}

export interface PanelProps {
	title: string;
	times: Date[];
	width: number;
	height: number;
	series: PanelSeries[];
	unitLabel: string;
	playheadTime: Date | null; // $time projeté
	hoverIndex: number | null; // index survolé (partagé entre panneaux)
	onHover: (index: number | null) => void;
	onSeek: (t: Date) => void; // clic → piloter la carte
}
