export type MeteogramKey =
	| 'temperature_2m'
	| 'dew_point_2m'
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
}
