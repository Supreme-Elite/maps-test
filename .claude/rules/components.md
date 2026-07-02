---
description: Component organization, chrome controls, and shadcn-svelte UI primitives
paths:
  - 'src/lib/components/**'
---

# Components

Organized by feature under `src/lib/components/` (`chrome/`, `capture/`, `clipping/`, `time/`, `scale/`, `settings/`, `help/`, `keyboard/`, `dropzone/`, `loading/`, `sounding/`). Primitive UI lives under `src/lib/components/ui/` and is managed by `shadcn-svelte` — regenerate with `npm run upgrade:ui` (uses `components.json`). Aliases: `$lib/components`, `$lib/components/ui`, `$lib/utils`.

**Primitives `ui/` personnalisées (à réappliquer après `npm run upgrade:ui`)** — le verre dépoli du chrome a modifié certaines primitives au-delà de la génération shadcn :

- `ui/select/select-content.svelte` — fond verre translucide (`bg-glass/85 backdrop-blur-xl`, `border-none`, `rounded-lg`) au lieu de `bg-popover ... border shadow-md`, pour que les dropdowns `Select` (unités, run…) s'accordent au reste du chrome verre. `text-popover-foreground` est conservé (adaptatif clair/sombre).
- `ui/switch/switch.svelte` — état coché en **bleu ciel** (`data-[state=checked]:bg-sky-500`, pouce blanc `dark:data-[state=checked]:bg-white`) au lieu de `bg-primary` (qui, en dark, vaut un quasi-blanc → switch peu lisible). L'accent « sky » est la teinte d'état actif du panneau Calques & réglages, fidèle au sujet (carte du ciel) ; icône + libellé d'un calque actif sont teintés `text-sky-300` (cf. `chrome/layer-toggle.svelte` et les composants `settings/`).

Si d'autres primitives `ui/` sont retouchées pour le style verre, les lister ici.

**Popovers `Command` scrollables (mobile)** — tout `Popover.Content` qui contient une liste `Command` scrollable doit poser `tabindex={0}` + `onOpenAutoFocus={(e) => e.preventDefault()}` (puis, optionnellement, focus de l'item actif via `[data-value="…"]`). Sans ça, le popover autofocuse l'`Command.Input` à l'ouverture → le clavier virtuel monte sur mobile et capte le geste de scroll de la liste (liste « bloquée » au doigt). Pattern en place sur le sélecteur de modèle (`chrome/model-selector.svelte`) — les sélecteurs de variable et de niveau sont désormais des listes simples (radios) dans `chrome/layer-list.svelte`, sans Popover ni Command. La recherche reste accessible : taper sur le champ ouvre le clavier volontairement.

Map controls are plain Svelte components rendered in the app chrome, not MapLibre `IControl`s (les contrôles **natifs** MapLibre — zoom, boussole, géoloc, globe, 3D — sont ancrés en **bas-droite**, remontés au-dessus de la timeline via `bottomChromeHeight` dans `+page.svelte`). Chrome (refonte header + sidebar, spec `docs/superpowers/specs/2026-07-01-refonte-interface-precip-design.md`) :

- `chrome/header.svelte` — barre fine pleine largeur (44 px, `h-11`) : logo Infoclimat, onglet « Carte » en pilule (emplacement des futures pages), bouton « Réglages » qui toggle `advancedOpen`. Seule entrée du panneau Avancé (desktop et mobile).
- `chrome/sidebar.svelte` (desktop) — sous le header (`top-11`), repliable en rail (état persisté `sidebarCollapsed`), largeur publiée dans `sidebarWidth` pour décaler timeline (`time-selector.svelte`) et légende (`scale.svelte`). Compose `model-selector`, la section Calques (`chrome/layer-list.svelte`), Affichage (`chrome/display-section.svelte`) et Style (`chrome/style-section.svelte`).
- `chrome/layer-list.svelte` — liste verticale des variables par catégorie, niveaux de la variable active en radios. Logique pure dans `src/lib/layer-list.ts` (testée : `src/lib/tests/layer-list.test.ts`).
- `chrome/display-section.svelte` — toggles « premier plan » : contours, flèches, valeurs aux nœuds, popup, départements, villes & pays, relief ombré, fond de carte sombre.
- `chrome/style-section.svelte` — opacité (l'édition d'échelle reste dans la légende `scale/`).
- `chrome/mobile-dock.svelte` (mobile) — FAB capture + poignée au-dessus de la timeline ouvrant un bottom-sheet à onglets (Calques = modèle + `layer-list` ; Affichage & style = mêmes sections que la sidebar).
- `chrome/advanced-panel.svelte` — panneau « Avancé » (drawer desktop ancré sous le header / Sheet mobile) : calque secondaire, unités, performance (tuiles + cache), réglages avancés (points de grille, sondage, réinitialisation), outils (capture, découpage, aide). N'a plus de bouton déclencheur propre.
- `chrome/app-chrome.svelte` — compose header (toujours) + sidebar (desktop) ou bottom-sheet (mobile) + advanced-panel.

`top-bar.svelte` et `variable-tabs.svelte` n'existent plus. Hillshade is initialized from prefs via `initHillshadeFromPrefs()` (`src/lib/hillshade.ts`), not a button.

`sounding/` — panel tabulé (Skew-T / hodographe / indices) avec tracés SVG sur mesure, ouvert depuis le popup de valeur au clic sur la carte (`src/lib/popup.ts`). Voir `src/lib/sounding/` pour la logique pure associée.
