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
	'relative_humidity_2m',
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
		timezone: 'auto',
		wind_speed_unit: 'ms',
		hourly: HOURLY_VARIABLES.join(',')
	});
	return `${getForecastApiUrl()}/v1/forecast?${params.toString()}`;
};

/**
 * Modèles dont l'API ne diffuse pas certaines variables (renvoyées 100 % `null`)
 * → modèle « source » sur la même grille/horizon dont on les emprunte.
 * Aujourd'hui : AROME France HD (0,01°) n'a ni `weather_code` (rangée de symboles
 * météo) ni `pressure_msl` (axe de pression) amont — on les prend sur AROME
 * France 2,5 km (même modèle physique, même emprise, même run horaire → axes
 * temps identiques). Le merge se fait par timestamp (`mergeBorrowedSeries`),
 * robuste à un décalage éventuel.
 */
export const BORROW_SOURCE_MODELS: Readonly<Record<string, string>> = {
	meteofrance_arome_france_hd: 'meteofrance_arome_france'
};

/** Variables empruntées au modèle source quand le modèle affiché ne les diffuse pas. */
export const BORROWED_VARIABLES: readonly MeteogramKey[] = ['weather_code', 'pressure_msl'];

/** URL forecast minimale (variables empruntées seules) pour le modèle source. */
const buildBorrowUrl = (lat: number, lng: number, model: string): string => {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lng),
		models: model,
		timezone: 'auto',
		hourly: BORROWED_VARIABLES.join(',')
	});
	return `${getForecastApiUrl()}/v1/forecast?${params.toString()}`;
};

/** Source d'emprunt : axe temps + séries des variables empruntées. */
export type BorrowSource = { time: Date[] } & Partial<Record<MeteogramKey, (number | null)[]>>;

/**
 * Complète les `BORROWED_VARIABLES` de `base` avec celles du modèle `source`,
 * alignées **par timestamp** (pas par index) : pour chaque pas de `base`, une
 * valeur déjà présente côté base est **conservée** (base prioritaire), sinon on
 * prend celle de la source au même horodatage (`null` si absente). Les séries
 * hors `BORROWED_VARIABLES` (dont `is_day`, renseigné côté HD) sont intactes.
 */
export const mergeBorrowedSeries = (base: MeteogramData, source: BorrowSource): MeteogramData => {
	const series = { ...base.series };
	for (const key of BORROWED_VARIABLES) {
		const sourceValues = source[key];
		if (!sourceValues) continue;
		const byTime = new Map<number, number | null>();
		source.time.forEach((t, i) => byTime.set(t.getTime(), sourceValues[i] ?? null));
		const baseValues = base.series[key] ?? [];
		series[key] = base.times.map((t, i) => baseValues[i] ?? byTime.get(t.getTime()) ?? null);
	}
	return { ...base, series };
};

/** Récupère les variables empruntées (+ axe temps) d'un modèle source. */
const fetchBorrowSource = async (
	lat: number,
	lng: number,
	model: string,
	signal?: AbortSignal
): Promise<BorrowSource> => {
	const res = await fetch(buildBorrowUrl(lat, lng, model), { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as ForecastResponse;
	const hourly = json.hourly;
	if (!hourly || !Array.isArray(hourly.time)) throw new Error("source d'emprunt invalide");
	// Même point → même offset que l'appel principal ; on repositionne en instants
	// absolus pour que `mergeBorrowedSeries` aligne par timestamp (getTime).
	const times = parseLocalTimes(hourly.time, json.utc_offset_seconds ?? 0);
	const out: BorrowSource = { time: times };
	for (const key of BORROWED_VARIABLES) out[key] = hourly[key] ?? [];
	return out;
};

interface ForecastResponse {
	timezone?: string;
	utc_offset_seconds?: number;
	/** Altitude du point selon le modèle (m) — renvoyée par l'API forecast. */
	elevation?: number;
	hourly?: { time?: string[] } & Partial<Record<MeteogramKey, (number | null)[]>>;
}

/** Décalage `utc_offset_seconds` → suffixe ISO « ±HH:MM ». */
const offsetIso = (seconds: number): string => {
	const sign = seconds < 0 ? '-' : '+';
	const abs = Math.abs(seconds);
	const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
	const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
	return `${sign}${hh}:${mm}`;
};

/**
 * Convertit les timestamps « heure locale du point » (timezone=auto) en instants
 * UTC absolus, via l'offset renvoyé par l'API. Les Date restent donc des instants
 * absolus — indispensable au couplage avec la carte (`valid_times` en UTC) — tandis
 * que l'affichage local est géré par le fuseau IANA passé à Highcharts.
 */
const parseLocalTimes = (times: string[], utcOffsetSeconds: number): Date[] => {
	const off = offsetIso(utcOffsetSeconds);
	return times.map((t) => new Date(`${t}${off}`));
};

export const parseForecast = (json: unknown, model: string): MeteogramData => {
	const res = json as ForecastResponse;
	const hourly = res.hourly;
	if (!hourly || !Array.isArray(hourly.time)) {
		throw new Error('Réponse Open-Meteo invalide (hourly.time manquant)');
	}
	const utcOffsetSeconds = res.utc_offset_seconds ?? 0;
	const timezone = res.timezone ?? 'UTC';
	const times = parseLocalTimes(hourly.time, utcOffsetSeconds);
	const series = {} as Record<MeteogramKey, (number | null)[]>;
	for (const key of HOURLY_VARIABLES) {
		series[key] = hourly[key] ?? [];
	}
	const elevation =
		typeof res.elevation === 'number' && isFinite(res.elevation) ? res.elevation : null;
	return { times, series, model, timezone, utcOffsetSeconds, elevation };
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

	// Modèle sans certaines variables amont (AROME France HD : ni weather_code ni
	// pressure_msl) : on les emprunte à un modèle source sur la même grille. Échec
	// silencieux — on préfère un meteogram incomplet à pas de meteogram du tout ;
	// seul l'abort est propagé (le composant l'attend pour ignorer la réponse).
	const borrowSource = BORROW_SOURCE_MODELS[model];
	if (borrowSource) {
		try {
			const borrowed = await fetchBorrowSource(lat, lng, borrowSource, signal);
			data = mergeBorrowedSeries(data, borrowed);
		} catch (e) {
			if ((e as Error).name === 'AbortError') throw e;
		}
	}
	return trimTrailingNulls(data);
};
