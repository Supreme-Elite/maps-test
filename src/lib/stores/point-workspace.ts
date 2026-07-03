import { writable } from 'svelte/store';

export interface PointWorkspaceState {
	open: boolean;
	lat: number | null;
	lng: number | null;
}

const initial: PointWorkspaceState = { open: false, lat: null, lng: null };

function createPointWorkspace() {
	const { subscribe, set } = writable<PointWorkspaceState>(initial);
	return {
		subscribe,
		open: (lat: number, lng: number) => set({ open: true, lat, lng }),
		close: () => set(initial)
	};
}

export const pointWorkspace = createPointWorkspace();
