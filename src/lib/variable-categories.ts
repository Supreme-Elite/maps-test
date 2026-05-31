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

// Règles ordonnées : première correspondance gagne. Volontairement permissif
// (les variables Open-Meteo suivent des préfixes stables).
const RULES: { key: CategoryKey; test: RegExp }[] = [
	{ key: 'temperature', test: /^(temperature|apparent_temperature|dew_?point|wet_bulb)/ },
	{ key: 'precipitation', test: /(precipitation|rain|snow|showers|sleet)/ },
	{ key: 'wind', test: /(wind|gust)/ },
	{ key: 'clouds', test: /(cloud|visibility|fog)/ },
	{ key: 'pressure', test: /(pressure|geopotential|msl|surface_pressure)/ }
];

export function categorize(variable: string): CategoryKey {
	for (const rule of RULES) {
		if (rule.test.test(variable)) return rule.key;
	}
	return 'other';
}
