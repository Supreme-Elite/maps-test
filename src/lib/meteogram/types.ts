export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
	| 'relative_humidity_2m'
	| 'precipitation'
	| 'wind_speed_10m'
	| 'wind_gusts_10m'
	| 'wind_direction_10m'
	| 'pressure_msl'
	| 'weather_code'
	| 'is_day';

export interface MeteogramData {
	times: Date[];
	series: Record<MeteogramKey, (number | null)[]>;
	model: string;
	/** Fuseau IANA du point (ex. « Europe/Paris »), pour l'affichage local du chart. */
	timezone: string;
	/** Décalage UTC du point en secondes (ex. 7200), au moment de la requête. */
	utcOffsetSeconds: number;
	/** Altitude du point selon le modèle (m), depuis `elevation` de l'API. `null` si absente. */
	elevation: number | null;
}
