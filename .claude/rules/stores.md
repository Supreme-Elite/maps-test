---
description: Svelte stores, persisted state, and URL ↔ store sync
paths:
  - 'src/lib/stores/**'
  - 'src/lib/url.ts'
  - 'src/lib/constants.ts'
---

# State (svelte stores)

All app state lives under `src/lib/stores/` as svelte stores. Many are `persisted(...)` from `svelte-persisted-store` (localStorage-backed): `preferences`, `tileSize`, `opacity`, `cacheBlockSizeKb`, `cacheMaxBytesMb`, `customColorScales`, units, etc. `localStorageVersion` is compared against `package.json` version on mount; when it changes, `resetStates()` in `preferences.ts` wipes all persisted state — bump the package version when introducing breaking state shape changes.

`src/lib/stores/sounding.ts` gère l'état du panel de sondage vertical (`open`, `lat`, `lng`, `activeTab`). Ce store n'est ni persisté ni synchronisé dans l'URL (MVP) — l'état est perdu au rechargement de page.

`src/lib/stores/basemap-theme.ts` (`basemapTheme: 'light' | 'dark'`, persisté) pilote **uniquement le fond de carte** MapLibre, découplé du thème du chrome. Le **chrome** (barre, panneaux, dropdowns) reste un overlay verre dépoli **sombre en permanence** : `+layout.svelte` force le dark mode (`setMode('dark')` + `<ModeWatcher defaultMode="dark" track={false} />`), ce qui garde la classe `.dark` et tous les tokens/variantes `dark:` actifs quel que soit le fond de carte. `mode.current` (mode-watcher) ne sert donc plus à choisir le basemap. `getStyle()` (`map-controls.ts`) lit `basemapTheme` ; le toggle « Fond de carte sombre » (`advanced-panel.svelte`) le pilote ; un `$effect` dans `+page.svelte` appelle `reloadStyles()` à chaque changement (re-style basemap + ré-ajout des couches `om://`). Défaut = préférence système au 1er chargement (`prefers-color-scheme`), puis choix persisté. Ne pas remettre le chrome sur un thème adaptatif : de nombreux composants codent `text-white`/`bg-glass`/variantes `dark:` en dur.

URL ↔ store sync is centralized in `src/lib/url.ts`:

- `urlParamsToPreferences()` runs on mount to hydrate stores from query params.
- `updateUrl(param, value)` is called from store subscriptions / event handlers; it omits params equal to defaults (defined in `COMPLETE_DEFAULT_VALUES` in `constants.ts`).
- The MapLibre `_hash` (zoom/center) is appended back into the URL.
