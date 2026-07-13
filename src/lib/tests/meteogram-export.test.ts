import { describe, expect, it } from 'vitest';

import { buildExportContextLine, inlineSvgImageHrefs } from '$lib/meteogram/export-image';

describe('buildExportContextLine', () => {
	it('formate « Modèle · lat,lon · généré le JJ/MM/AAAA à HH:MM UTC »', () => {
		const line = buildExportContextLine(
			'AROME France HD',
			48.85,
			2.35,
			new Date(Date.UTC(2026, 6, 13, 14, 30))
		);
		expect(line).toBe('AROME France HD · 48.850,2.350 · généré le 13/07/2026 à 14:30 UTC');
	});

	it('zéro-pad la date et l’heure en UTC', () => {
		const line = buildExportContextLine('X', 1, 2, new Date(Date.UTC(2026, 0, 5, 3, 9)));
		expect(line).toContain('généré le 05/01/2026 à 03:09 UTC');
	});
});

describe('inlineSvgImageHrefs', () => {
	it('remplace les href externes par data URI, laisse data: et #fragments intacts', async () => {
		const svg =
			'<image href="/weather-symbols/01d.svg"/>' +
			'<use href="#clip1"/>' +
			'<image xlink:href="/weather-symbols/09.svg"/>' +
			'<image href="data:image/png;base64,KEEP"/>';
		const map: Record<string, string> = {
			'/weather-symbols/01d.svg': 'data:image/svg+xml;base64,AAA',
			'/weather-symbols/09.svg': 'data:image/svg+xml;base64,BBB'
		};
		const out = await inlineSvgImageHrefs(svg, async (u) => map[u] ?? null);
		expect(out).toContain('href="data:image/svg+xml;base64,AAA"');
		expect(out).toContain('xlink:href="data:image/svg+xml;base64,BBB"');
		expect(out).toContain('href="#clip1"'); // fragment interne intact
		expect(out).toContain('href="data:image/png;base64,KEEP"'); // déjà data URI, intact
		expect(out).not.toContain('/weather-symbols/'); // plus aucune URL externe
	});

	it('laisse le href tel quel si la ressource est indisponible (null)', async () => {
		const svg = '<image href="/weather-symbols/missing.svg"/>';
		const out = await inlineSvgImageHrefs(svg, async () => null);
		expect(out).toBe(svg);
	});
});
