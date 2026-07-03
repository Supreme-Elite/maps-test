export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
	| 'precipitation'
	| 'precipitation_probability'
	| 'wind_speed_10m'
	| 'wind_gusts_10m'
	| 'wind_direction_10m'
	| 'pressure_msl'
	| 'cloud_cover_low'
	| 'cloud_cover_mid'
	| 'cloud_cover_high'
	| 'cape';

export interface MeteogramData {
	times: Date[];
	series: Record<MeteogramKey, (number | null)[]>;
	model: string;
}
