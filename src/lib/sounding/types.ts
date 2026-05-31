// src/lib/sounding/types.ts

/** Une mesure à un niveau de pression (ou la surface). */
export interface LevelDatum {
	pressure: number; // hPa
	temperature: number; // °C
	dewpoint: number; // °C
	height: number; // m (géopotentiel ; surface = altitude terrain)
	u: number; // m/s
	v: number; // m/s
}

/** Colonne reconstruite au point cliqué pour un timestep donné. */
export interface ColumnProfile {
	lat: number;
	lng: number;
	validTime: string;
	surface: LevelDatum;
	/** Triés du sol (forte pression) vers le sommet (faible pression), NaN exclus. */
	levels: LevelDatum[];
}

/** Résultat d'une ascension de particule. */
export interface ParcelResult {
	/** Profil de la particule aux mêmes pressions que l'environnement (°C). */
	temperature: number[];
	lcl: { pressure: number; height: number } | null;
	lfc: { pressure: number; height: number } | null;
	el: { pressure: number; height: number } | null;
}

/** Indices dérivés d'une particule. */
export interface ParcelIndices {
	cape: number; // J/kg
	cin: number; // J/kg (≤ 0)
	li: number; // °C
}

export interface ShearLayer {
	label: '0-1 km' | '0-3 km' | '0-6 km';
	u: number; // m/s
	v: number; // m/s
	magnitude: number; // m/s
}

export interface SoundingIndices {
	sb: ParcelIndices;
	mu: ParcelIndices;
	/** Limite pluie/neige : altitude (m) de l'iso-0 °C et de l'iso-Tw≈1.5 °C. */
	lpn: { iso0: number | null; isoTw: number | null; isothermal: boolean };
	shear: ShearLayer[];
}
