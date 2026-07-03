import { downloadBlob } from '$lib/png-export';

// Export PNG du meteogram — Task 12.
//
// Contrairement à l'hypothèse initiale du brief (« un seul <svg> racine »),
// meteogram.svelte rend chaque panneau dans son propre <svg> (Panel +
// WindDirection). On capture donc tous les <svg> du conteneur, dans l'ordre
// du document, et on les empile sur un unique <canvas>.
//
// Fidélité des couleurs : les séries (stroke/fill de courbes et barres) sont
// déjà des attributs SVG explicites et survivent telle quelle à la
// sérialisation. Les traits de grille/axes/texte de panel.svelte, eux,
// viennent de classes Tailwind (`stroke-white/10`, `fill-white/40`…) qui
// n'existent qu'en tant que règles CSS externes — invisibles une fois le SVG
// sérialisé et chargé hors du DOM vivant comme image autonome. Pour éviter
// une grille "sans grille", on fige les styles calculés (`getComputedStyle`)
// de chaque nœud source en attributs de présentation sur le clone avant
// sérialisation.

const HEADER_HEIGHT = 28;
const PANEL_GAP = 4;
const SCALE = 2;
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Miroir de `--glass` en thème sombre (src/styles.css, `.dark`) : rgb(11 39 45).
const BACKGROUND_COLOR = '#0b272d';
const HEADER_TEXT_COLOR = '#e2e8f0';

// Propriétés CSS calculées à figer en attributs de présentation SVG. Couvre
// à la fois les couleurs posées via classes Tailwind (grille, axes, texte)
// et celles déjà posées en attributs explicites (séries) — `getComputedStyle`
// résout les deux de façon uniforme.
const STYLE_PROPS = [
	'fill',
	'stroke',
	'stroke-width',
	'stroke-dasharray',
	'stroke-linecap',
	'stroke-linejoin',
	'opacity',
	'fill-opacity',
	'stroke-opacity',
	'font-size',
	'font-family',
	'text-anchor',
	'color'
] as const;

/**
 * Copie récursivement les styles calculés de `source` vers `target` en
 * attributs de présentation SVG. Les deux arbres proviennent d'un
 * `cloneNode(true)` : mêmes enfants, dans le même ordre — la récursion par
 * index reste donc valide.
 */
function inlineComputedStyles(source: Element, target: Element): void {
	const computed = getComputedStyle(source);
	for (const prop of STYLE_PROPS) {
		const value = computed.getPropertyValue(prop);
		if (value) target.setAttribute(prop, value);
	}
	for (let i = 0; i < source.children.length; i++) {
		const targetChild = target.children[i];
		if (targetChild) inlineComputedStyles(source.children[i], targetChild);
	}
}

function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	clone.style.fontFamily = FONT_STACK;
	inlineComputedStyles(svg, clone);

	const xml = new XMLSerializer().serializeToString(clone);
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('svg image load failed'));
		img.src = url;
	});
}

function svgPixelSize(svg: SVGSVGElement): { width: number; height: number } {
	return {
		width: Number(svg.getAttribute('width')) || svg.clientWidth,
		height: Number(svg.getAttribute('height')) || svg.clientHeight
	};
}

/**
 * Exporte tous les `<svg>` trouvés dans `container` (panneaux du meteogram,
 * dans l'ordre du document) en un unique PNG empilé verticalement, précédé
 * d'un bandeau d'en-tête (`header`) et téléchargé sous `filename`.
 *
 * No-op silencieux si `container` ne contient aucun `<svg>` (ex. meteogram
 * encore en chargement ou en erreur) — rien à exporter, pas d'échec bruyant.
 */
export async function exportMeteogramPng(
	container: HTMLElement,
	filename: string,
	header: string
): Promise<void> {
	const svgs = Array.from(container.querySelectorAll('svg'));
	if (svgs.length === 0) return;

	const sizes = svgs.map(svgPixelSize);
	const width = Math.max(...sizes.map((s) => s.width));
	const totalHeight = HEADER_HEIGHT + sizes.reduce((sum, s) => sum + s.height + PANEL_GAP, 0);

	const canvas = document.createElement('canvas');
	canvas.width = width * SCALE;
	canvas.height = totalHeight * SCALE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('no 2d context');
	ctx.scale(SCALE, SCALE);

	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, width, totalHeight);

	ctx.fillStyle = HEADER_TEXT_COLOR;
	ctx.font = `600 13px ${FONT_STACK}`;
	ctx.textBaseline = 'middle';
	ctx.fillText(header, 8, HEADER_HEIGHT / 2);

	// Séquentiel (pas Promise.all) : l'ordre de dessin doit suivre l'ordre des
	// panneaux pour que `yOffset` corresponde à la bonne image à chaque tour.
	let yOffset = HEADER_HEIGHT;
	for (let i = 0; i < svgs.length; i++) {
		const img = await svgToImage(svgs[i]);
		ctx.drawImage(img, 0, yOffset);
		yOffset += sizes[i].height + PANEL_GAP;
	}

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (!blob) throw new Error('toBlob null');

	downloadBlob(blob, filename);
}
