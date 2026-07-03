import { SvelteDate } from 'svelte/reactivity';

import { time } from '$lib/stores/time';

import { changeOMfileURL } from '$lib/layers';
import { formatISOWithoutTimezone } from '$lib/time-format';
import { updateUrl } from '$lib/url';

/**
 * Positionne l'échéance affichée par la carte sur `date` : store `time` + URL +
 * rechargement du champ spatial. Partagé par la timeline (playback) et le
 * meteogram (couplage temporel). Ne recale pas le run (l'échéance sort du run
 * courant côté playback) et ne centre pas la barre de dates (spécifique UI timeline).
 */
export const goToValidTime = (date: Date): void => {
	time.set(new SvelteDate(date));
	updateUrl('time', formatISOWithoutTimezone(new Date(date)));
	changeOMfileURL();
};
