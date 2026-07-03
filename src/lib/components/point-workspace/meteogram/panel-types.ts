export interface PanelSeries {
	key: string;
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
