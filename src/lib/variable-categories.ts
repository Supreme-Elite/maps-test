export type CategoryKey =
	| 'temperature'
	| 'precipitation'
	| 'wind'
	| 'clouds'
	| 'pressure'
	| 'other';

export interface Category {
	key: CategoryKey;
	label: string;
	/** Nom d'icône Lucide (rendu via @lucide/svelte côté composant). */
	icon: string;
}

// Ordre = ordre d'affichage des onglets dans la barre haute / le dock.
export const CATEGORIES: Category[] = [
	{ key: 'temperature', label: 'Température', icon: 'thermometer' },
	{ key: 'precipitation', label: 'Précipitations', icon: 'cloud-rain' },
	{ key: 'wind', label: 'Vent', icon: 'wind' },
	{ key: 'clouds', label: 'Nuages', icon: 'cloud' },
	{ key: 'pressure', label: 'Pression / altitude', icon: 'gauge' },
	{ key: 'other', label: 'Autres', icon: 'layers' }
];

// Règles ordonnées : première correspondance gagne. Chaque alternative est
// ancrée à une limite de mot (début de chaîne ou underscore) pour éviter les
// faux positifs (ex. « rain » dans « terrain », « gust » dans « august »).
const RULES: { key: CategoryKey; test: RegExp }[] = [
	{ key: 'temperature', test: /(^|_)(temperature|apparent_temperature|dew_?point|wet_bulb)/ },
	{ key: 'precipitation', test: /(^|_)(precipitation|rain|snow|showers|sleet)/ },
	{ key: 'wind', test: /(^|_)(wind|gust)/ },
	{ key: 'clouds', test: /(^|_)(cloud|visibility|fog)/ },
	{ key: 'pressure', test: /(^|_)(pressure|geopotential|msl|surface_pressure)/ }
];

export function categorize(variable: string): CategoryKey {
	for (const rule of RULES) {
		if (rule.test.test(variable)) return rule.key;
	}
	return 'other';
}
