import type { MeteogramData, MeteogramKey } from './types';

// `freezing_level_height` a été volontairement retiré (fetché mais jamais
// rendu par aucun panneau) : le panneau « Avancés » est déjà surchargé en
// échelles, et un axe secondaire dédié est une refonte différée. Décision
// réversible — réintroduire ici si un panneau avec axe secondaire arrive.
export const HOURLY_VARIABLES: readonly MeteogramKey[] = [
	'temperature_2m',
	'dew_point_2m',
	'precipitation',
	'precipitation_probability',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'pressure_msl',
	'cloud_cover_low',
	'cloud_cover_mid',
	'cloud_cover_high',
	'cape'
];

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export const buildForecastUrl = (lat: number, lng: number, model: string): string => {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lng),
		models: model,
		timezone: 'UTC',
		wind_speed_unit: 'ms',
		hourly: HOURLY_VARIABLES.join(',')
	});
	return `${FORECAST_ENDPOINT}?${params.toString()}`;
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
 */
export const trimTrailingNulls = (data: MeteogramData): MeteogramData => {
	const seriesArrays = Object.values(data.series);
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
	return trimTrailingNulls(parseForecast(await res.json(), model));
};
