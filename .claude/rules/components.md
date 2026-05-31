---
description: Component organization, chrome controls, and shadcn-svelte UI primitives
paths:
  - 'src/lib/components/**'
---

# Components

Organized by feature under `src/lib/components/` (`chrome/`, `capture/`, `clipping/`, `time/`, `scale/`, `settings/`, `help/`, `keyboard/`, `dropzone/`, `loading/`, `sounding/`). Primitive UI lives under `src/lib/components/ui/` and is managed by `shadcn-svelte` — regenerate with `npm run upgrade:ui` (uses `components.json`). Aliases: `$lib/components`, `$lib/components/ui`, `$lib/utils`.

**Primitives `ui/` personnalisées (à réappliquer après `npm run upgrade:ui`)** — le verre dépoli du chrome a modifié certaines primitives au-delà de la génération shadcn :

- `ui/select/select-content.svelte` — fond verre translucide (`bg-glass/60 backdrop-blur-xl`, `border-none`, `rounded-lg`) au lieu de `bg-popover ... border shadow-md`, pour que les dropdowns `Select` (unités, run, fps…) s'accordent au reste du chrome verre. `text-popover-foreground` est conservé (adaptatif clair/sombre).

Si d'autres primitives `ui/` sont retouchées pour le style verre, les lister ici.

Map controls are plain Svelte components rendered in the app chrome, not MapLibre `IControl`s. `chrome/app-chrome.svelte` is the container; `chrome/advanced-panel.svelte` hosts the toggles that used to be IControl buttons (dark mode, help, clipping, labels, departments) plus the settings sub-components from `settings/` (unit, grid, arrows, contour, tile-size, popup, sounding, opacity, cache, state). Hillshade is initialized from prefs via `initHillshadeFromPrefs()` (`src/lib/hillshade.ts`), not a button. There is no longer a `buttons/` directory or a settings aggregator Sheet — `advanced-panel.svelte` is the single replacement.

`sounding/` — panel tabulé (Skew-T / hodographe / indices) avec tracés SVG sur mesure, ouvert depuis le popup de valeur au clic sur la carte (`src/lib/popup.ts`). Voir `src/lib/sounding/` pour la logique pure associée.
