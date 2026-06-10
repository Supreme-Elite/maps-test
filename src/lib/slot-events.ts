/**
 * Shared event bus for SlotManager lifecycle events.
 *
 * `commit` fires after a slot's source is loaded and the cross-fade has been
 * triggered. `error` fires on source load failure. Both managers (raster +
 * vector) dispatch into the same bus.
 *
 * Note : le moteur de lecture en direct (`playback-engine.ts`) consomme ce bus
 * pour avancer d'une échéance seulement quand la frame courante est rendue.
 *
 * Multiple subscribers are safe; events are not coalesced.
 */
export const slotEvents = new EventTarget();

export const SLOT_EVENT_COMMIT = 'commit';
export const SLOT_EVENT_ERROR = 'error';
