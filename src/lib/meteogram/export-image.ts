// Export PNG « carte de visite » du météogramme : le graphe Highcharts + un pied
// de page (logo Infoclimat à gauche, contexte modèle/point/date à droite), pour un
// partage social/forum propre.
//
// Pourquoi une composition canvas 2D et non le pied dessiné dans Highcharts : à
// l'export, Highcharts 12.6 recrée un chart temporaire dont les `chart.events`
// (load/render) ne se redéclenchent pas de façon fiable — un pied ajouté via ces
// events n'apparaît pas. On reprend donc la main : on récupère le SVG du chart,
// on rasterise, puis on peint le pied au pixel près.

const EXPORT_BG = '#0c1420'; // fond opaque sombre (accordé au tiroir)
const FOOTER_HEIGHT = 46; // bande du pied, en px logiques
const LOGO_H = 30;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Ligne de contexte gravée à droite du pied : « Modèle · lat,lon · généré le … UTC ». */
export function buildExportContextLine(
	model: string,
	lat: number,
	lng: number,
	date: Date
): string {
	const d = `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
	const t = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
	return `${model} · ${lat.toFixed(3)},${lng.toFixed(3)} · généré le ${d} à ${t} UTC`;
}

/**
 * Remplace, dans un SVG sérialisé, les `href`/`xlink:href` pointant vers des
 * ressources **externes** (les pictos météo `/weather-symbols/*.svg`) par des data
 * URIs. Indispensable avant de rasteriser le SVG via un `<img>` : un SVG chargé
 * ainsi ne charge PAS ses sous-ressources externes — sans inline, les pictos
 * disparaîtraient de l'image. Les `href` déjà en `data:` et les fragments (`#id`,
 * clips/gradients internes) sont laissés intacts. `toDataUri` renvoie `null` en cas
 * d'échec (ressource absente) → le href est laissé tel quel (dégradé gracieux).
 */
export async function inlineSvgImageHrefs(
	svg: string,
	toDataUri: (url: string) => Promise<string | null>
): Promise<string> {
	const urls = new Set<string>();
	const re = /(?:xlink:href|href)="([^"]+)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(svg))) {
		const u = m[1];
		if (!u.startsWith('data:') && !u.startsWith('#')) urls.add(u);
	}
	let out = svg;
	for (const u of urls) {
		const dataUri = await toDataUri(u);
		if (dataUri) out = out.split(`"${u}"`).join(`"${dataUri}"`);
	}
	return out;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`image load failed: ${src.slice(0, 40)}`));
		img.src = src;
	});

const fetchAsDataUri = async (url: string): Promise<string | null> => {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise((resolve) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result as string);
			r.onerror = () => resolve(null);
			r.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
};

const downloadBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

/** Chart Highcharts, réduit à ce dont l'export a besoin. */
export interface ExportableChart {
	exporting?: {
		getSVGForExport(exportingOptions?: unknown, chartOptions?: unknown): Promise<string>;
	};
}

export interface RenderExportArgs {
	chart: ExportableChart;
	model: string;
	lat: number;
	lng: number;
	date: Date;
	logoDataUri: string;
	filename: string;
	scale?: number;
}

/**
 * Rend le PNG final : SVG du chart (fond sombre) → pictos inlinés → rasterisation
 * → composition du pied (logo + contexte) → téléchargement. `scale` (défaut 2)
 * pour une image nette au partage.
 */
export async function renderMeteogramExport(args: RenderExportArgs): Promise<void> {
	const scale = args.scale ?? 2;
	const rawSvg = await args.chart.exporting!.getSVGForExport(
		{},
		{ chart: { backgroundColor: EXPORT_BG } }
	);
	const svg = await inlineSvgImageHrefs(rawSvg, fetchAsDataUri);
	const chartImg = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
	const w = chartImg.width;
	const h = chartImg.height;

	const canvas = document.createElement('canvas');
	canvas.width = w * scale;
	canvas.height = (h + FOOTER_HEIGHT) * scale;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.scale(scale, scale);
	ctx.fillStyle = EXPORT_BG;
	ctx.fillRect(0, 0, w, h + FOOTER_HEIGHT);
	ctx.drawImage(chartImg, 0, 0, w, h);

	// Pied : logo à gauche (ratio préservé), contexte aligné à droite.
	try {
		const logo = await loadImage(args.logoDataUri);
		const logoW = Math.round((logo.width / logo.height) * LOGO_H);
		ctx.drawImage(logo, 10, h + (FOOTER_HEIGHT - LOGO_H) / 2, logoW, LOGO_H);
	} catch {
		// logo indisponible → pied sans logo, le contexte reste
	}
	ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	ctx.font = '600 12px system-ui, -apple-system, sans-serif';
	ctx.fillText(
		buildExportContextLine(args.model, args.lat, args.lng, args.date),
		w - 12,
		h + FOOTER_HEIGHT / 2
	);

	await new Promise<void>((resolve) => {
		canvas.toBlob((blob) => {
			if (blob) downloadBlob(blob, args.filename);
			resolve();
		}, 'image/png');
	});
}
