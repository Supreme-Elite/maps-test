import { DOMAIN_TO_API_MODEL } from '$lib/constants';

export const resolveApiModel = (domain: string): string | null =>
	DOMAIN_TO_API_MODEL[domain] ?? null;

export const hasMeteogram = (domain: string): boolean =>
	Object.prototype.hasOwnProperty.call(DOMAIN_TO_API_MODEL, domain);
