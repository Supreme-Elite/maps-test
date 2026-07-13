import { getForecastApiUrl } from '$lib/runtime-env';

import type { MeteogramData, MeteogramKey } from './types';

// Variables du graphe unique façon yr.no : T° + point de rosée (axe 0), précip
// (axe 1), pression (axe 2), windbarbs (vitesse+direction, m/s), et
// weather_code/is_day pour la rangée de symboles météo. Nébulosité, CAPE et
// probabilité de précip sont sortis du v1 graphe-unique (réintroduisibles en
// panneaux secondaires — voir spec 2026-07-10).
export const HOURLY_VARIABLES: readonly MeteogramKey[] = [
	'temperature_2m',
	'dew_point_2m',
	'precipitation',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'pressure_msl',
	'weather_code',
	'is_day'
];

export const buildForecastUrl = (lat: number, lng: number, model: string): string => {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lng),
		models: model,
		timezone: 'UTC',
		wind_speed_unit: 'ms',
		hourly: HOURLY_VARIABLES.join(',')
	});
	return `${getForecastApiUrl()}/v1/forecast?${params.toString()}`;
};

/**
 * Modèles dont l'API ne diffuse pas `weather_code` (rangée de symboles météo du
 * meteogram renvoyée 100 % `null`) → modèle « source » sur la même grille/horizon
 * dont on emprunte les symboles. Aujourd'hui : AROME France HD (0,01°) n'a pas
 * de `weather_code` amont, on le prend sur AROME France 2,5 km (même modèle
 * physique, même emprise, même run horaire → axes temps identiques). Le merge se
 * fait par timestamp (`mergeWeatherCode`), robuste à un décalage éventuel.
 */
export const SYMBOL_SOURCE_MODELS: Readonly<Record<string, string>> = {
	meteofrance_arome_france_hd: 'meteofrance_arome_france'
};

/** URL forecast minimale (weather_code seul) pour emprunter les symboles météo. */
const buildSymbolUrl = (lat: number, lng: number, model: string): string => {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lng),
		models: model,
		timezone: 'UTC',
		hourly: 'weather_code'
	});
	return `${getForecastApiUrl()}/v1/forecast?${params.toString()}`;
};

/**
 * Remplace la série `weather_code` de `base` par celle empruntée à un modèle
 * source, alignée **par timestamp** (pas par index) : chaque pas de `base` prend
 * le `weather_code` source de même horodatage, `null` si absent. Les autres
 * séries (dont `is_day`, renseigné côté HD) sont conservées telles quelles.
 */
export const mergeWeatherCode = (
	base: MeteogramData,
	source: { time: Date[]; weather_code: (number | null)[] }
): MeteogramData => {
	const byTime = new Map<number, number | null>();
	source.time.forEach((t, i) => byTime.set(t.getTime(), source.weather_code[i] ?? null));
	const weather_code = base.times.map((t) => byTime.get(t.getTime()) ?? null);
	return { ...base, series: { ...base.series, weather_code } };
};

/** Récupère `weather_code` (+ axe temps) d'un modèle source pour les symboles. */
const fetchSymbolSource = async (
	lat: number,
	lng: number,
	model: string,
	signal?: AbortSignal
): Promise<{ time: Date[]; weather_code: (number | null)[] }> => {
	const res = await fetch(buildSymbolUrl(lat, lng, model), { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const hourly = ((await res.json()) as ForecastResponse).hourly;
	if (!hourly || !Array.isArray(hourly.time)) throw new Error('source de symboles invalide');
	return {
		time: hourly.time.map((t) => new Date(`${t}Z`)),
		weather_code: hourly.weather_code ?? []
	};
};

interface ForecastResponse {
	hourly?: { time?: string[] } & Partial<Record<MeteogramKey, (number | null)[]>>;
}

export const parseForecast = (json: unknown, model: string): MeteogramData => {
	const hourly = (json as ForecastResponse).hourly;
	if (!hourly || !Array.isArray(hourly.time)) {
		throw new Error('Réponse Open-Meteo invalide (hourly.time manquant)');
	}
	// L'API renvoie les timestamps en heure locale du timezone demandé ; avec
	// timezone=UTC, la chaîne 'YYYY-MM-DDTHH:MM' est déjà en UTC — on ajoute
	// simplement le suffixe Z pour un parse Date déterministe.
	const times = hourly.time.map((t) => new Date(`${t}Z`));
	const series = {} as Record<MeteogramKey, (number | null)[]>;
	for (const key of HOURLY_VARIABLES) {
		series[key] = hourly[key] ?? [];
	}
	return { times, series, model };
};

/**
 * Rogne les heures de fin où *toutes* les séries sont nulles. L'API renvoie un
 * axe de 7 jours par défaut ; un modèle à horizon court (AROME HD ~51 h) laisse
 * le reste en `null`, ce qui étalerait l'axe temps du meteogram bien au-delà des
 * données (courbes tassées à gauche, grille vide à droite). On borne l'axe au
 * dernier pas réellement renseigné. Si aucune valeur finie n'existe, renvoie une
 * série vide (le composant affiche alors « aucune donnée »).
 *
 * `is_day` (astronomique) et `weather_code` sont exclus du scan : ce sont des
 * métadonnées d'habillage (rangée de symboles), pas des données du modèle —
 * l'API peut les renseigner au-delà de l'horizon réel du modèle, ce qui
 * défaisait le rognage (axe étiré de plusieurs jours de grille vide). Le
 * rognage s'appuie sur les 7 variables météo réelles.
 */
const TRIM_EXCLUDED: readonly MeteogramKey[] = ['is_day', 'weather_code'];

export const trimTrailingNulls = (data: MeteogramData): MeteogramData => {
	const seriesArrays = HOURLY_VARIABLES.filter((k) => !TRIM_EXCLUDED.includes(k)).map(
		(k) => data.series[k]
	);
	let last = -1;
	for (let i = data.times.length - 1; i >= 0; i--) {
		if (seriesArrays.some((arr) => arr[i] !== null && Number.isFinite(arr[i]))) {
			last = i;
			break;
		}
	}
	const end = last + 1;
	if (end === data.times.length) return data;
	const series = {} as Record<MeteogramKey, (number | null)[]>;
	for (const key of HOURLY_VARIABLES) {
		series[key] = data.series[key].slice(0, end);
	}
	return { ...data, times: data.times.slice(0, end), series };
};

export const fetchMeteogram = async (
	lat: number,
	lng: number,
	model: string,
	signal?: AbortSignal
): Promise<MeteogramData> => {
	const res = await fetch(buildForecastUrl(lat, lng, model), { signal });
	if (res.status === 429) throw new Error('rate-limit');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	let data = parseForecast(await res.json(), model);

	// Modèle sans weather_code amont (AROME France HD) : on emprunte la rangée de
	// symboles météo à un modèle source sur la même grille. Échec silencieux —
	// on préfère un meteogram sans symboles à pas de meteogram du tout ; seul
	// l'abort est propagé (le composant l'attend pour ignorer la réponse).
	const symbolSource = SYMBOL_SOURCE_MODELS[model];
	if (symbolSource) {
		try {
			const symbols = await fetchSymbolSource(lat, lng, symbolSource, signal);
			data = mergeWeatherCode(data, symbols);
		} catch (e) {
			if ((e as Error).name === 'AbortError') throw e;
		}
	}
	return trimTrailingNulls(data);
};
