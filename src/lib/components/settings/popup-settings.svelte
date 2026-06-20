<script lang="ts">
	import { get } from 'svelte/store';

	import MessageIcon from '@lucide/svelte/icons/message-circle';
	import { toast } from 'svelte-sonner';

	import { map, popup, popupMode } from '$lib/stores/map';
	import { desktop } from '$lib/stores/preferences';

	import { Switch } from '$lib/components/ui/switch';

	import { renderPopup } from '$lib/popup';

	let popupOn = $state(!!$popupMode);
	let popupModeDrag = $state(!!$popupMode && $popupMode === 'drag');
</script>

<div>
	<label
		class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2.5"
		for="popup_on"
	>
		<span
			class="flex items-center gap-3 text-sm transition-colors {popupOn
				? 'text-sky-300'
				: 'text-white'}"
		>
			<MessageIcon class="size-[18px]" aria-hidden="true" />
			Infobulle au survol
		</span>
		<Switch
			id="popup_on"
			class="cursor-pointer"
			bind:checked={popupOn}
			onCheckedChange={() => {
				const p = get(popup);
				let lastLngLat;
				if (p) {
					lastLngLat = p.getLngLat();
				}

				if (get(popupMode) === null) {
					if (desktop.current) {
						popupMode.set('follow');
					} else {
						popupMode.set('drag');
					}
				} else if (get(popupMode) === 'drag' || get(popupMode) === 'follow') {
					popupMode.set(null);
				}

				popupModeDrag = !!$popupMode && $popupMode === 'drag';
				toast.info('Infobulle : ' + (popupOn ? 'activée' : 'désactivée'));

				renderPopup(lastLngLat ?? $map.getCenter());
			}}
		/>
	</label>
	{#if popupOn && desktop.current}
		<label
			class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 pb-2.5 pl-[2.625rem]"
			for="popup_mode"
		>
			<span class="text-xs text-white/70">Infobulle déplaçable<br />(sinon suit la souris)</span>
			<Switch
				id="popup_mode"
				class="cursor-pointer"
				bind:checked={popupModeDrag}
				onCheckedChange={() => {
					if ($popupMode === 'drag') {
						popupMode.set('follow');
					} else if ($popupMode === 'follow') {
						popupMode.set('drag');
					}
					popupModeDrag = !!$popupMode && $popupMode === 'drag';
					toast.info(
						'Mode infobulle : ' +
							($popupMode
								? $popupMode === 'follow'
									? 'Suit la souris'
									: 'Déplaçable'
								: 'Désactivé')
					);
				}}
			/>
		</label>
	{/if}
</div>
