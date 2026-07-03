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

Map controls are plain Svelte components rendered in the app chrome, not MapLibre `IControl`s (les contrôles **natifs** MapLibre — zoom, boussole, géoloc, globe, 3D — sont ancrés en **bas-droite**, remontés au-dessus de la timeline via `bottomChromeHeight` dans `+page.svelte`). Chrome (refonte header + sidebar, spec `docs/superpowers/specs/2026-07-01-refonte-interface-precip-design.md` ; **coquille tableau de bord** — chrome bleu-nuit, bande de contexte, actions flottantes, en-tête = modèle/run/validité — spec `docs/superpowers/specs/2026-07-02-refonte-interface-dashboard-design.md`) :

- `chrome/header.svelte` — barre fine pleine largeur (44 px, `h-11`) : logo Infoclimat, onglet « Carte » en pilule (emplacement des futures pages), **fil contextuel `Modèle · Run · Validité`** (chiffres `tabular-nums`) + badge « Run en cours » quand le run affiché est encore en génération (`inProgressReferenceTime`, calqué sur `time-selector.svelte`), bouton « Avancé » qui toggle `advancedOpen`. La **variable** ne vit plus dans le header (déplacée dans `context-strip`).
- `chrome/sidebar.svelte` (desktop) — sous le header (`top-11`), repliable en rail (état persisté `sidebarCollapsed`), largeur publiée dans `sidebarWidth` pour décaler timeline (`time-selector.svelte`) et légende (`scale.svelte`). Compose `model-selector`, la section Calques (`chrome/layer-list.svelte`), Affichage (`chrome/display-section.svelte`) et Style (`chrome/style-section.svelte`).
- `chrome/layer-list.svelte` — liste verticale des variables par catégorie, niveaux de la variable active en radios. **Unité d'affichage alignée à droite** de chaque ligne variable (`tabular-nums`), calculée par ligne via `getColorScale`→`getDisplayUnit` (miroir de `scale.svelte`/`context-strip.svelte` ; omise quand vide). Logique pure dans `src/lib/layer-list.ts` (testée : `src/lib/tests/layer-list.test.ts`).
- `chrome/context-strip.svelte` — bande de contexte fine (`h-[26px]`, `bg-glass/70 glass-blur`) sous le header, au-dessus de la carte, décalée à droite par `sidebarWidth` (desktop). Affiche `Variable (unité)` — libellé via `translateVariableLabel($selectedVariable.label)`, unité d'affichage réelle en miroir inline de `scale.svelte` (`mode.current` étant une rune, pas de store partagé possible sans cycle). Masquée si aucune variable.
- `chrome/map-actions.svelte` — cluster flottant **desktop-only** en haut-droite de la carte (`fixed top-[82px] right-3 z-40` = header 44 + context-strip 26 + 12) : **copier le lien** (`location.href`, retour ✓ 1,5 s) et **plein écran** (`requestFullscreen`/`exitFullscreen`, listener `fullscreenchange` nettoyé). Pas de bouton capture/télécharger (la capture reste au header desktop / FAB mobile — anti-doublon).
- `chrome/display-section.svelte` — toggles « premier plan » : contours, flèches, valeurs aux nœuds, popup, départements, villes & pays, relief ombré, fond de carte sombre.
- `chrome/style-section.svelte` — opacité (l'édition d'échelle reste dans la légende `scale/`).
- `chrome/mobile-dock.svelte` (mobile) — FAB capture + poignée au-dessus de la timeline ouvrant un bottom-sheet à onglets (Calques = modèle + `layer-list` ; Affichage & style = mêmes sections que la sidebar).
- `chrome/advanced-panel.svelte` — panneau « Avancé » (drawer desktop ancré sous le header / Sheet mobile) : calque secondaire, unités, performance (tuiles + cache), réglages avancés (points de grille, sondage, réinitialisation), outils (capture, découpage, aide). N'a plus de bouton déclencheur propre.
- `chrome/app-chrome.svelte` — compose header (toujours) + sidebar (desktop) ou bottom-sheet (mobile) + advanced-panel + `context-strip` ; `map-actions` monté desktop-only.

`top-bar.svelte` et `variable-tabs.svelte` n'existent plus. Hillshade is initialized from prefs via `initHillshadeFromPrefs()` (`src/lib/hillshade.ts`), not a button.

`sounding/` — panel tabulé (Skew-T / hodographe / indices) avec tracés SVG sur mesure, ouvert depuis le popup de valeur au clic sur la carte (`src/lib/popup.ts`). Voir `src/lib/sounding/` pour la logique pure associée.

`point-workspace/` — « espace point » : tiroir bas ouvert depuis le bouton « Meteogram » du popup (`popup.ts`, gaté par `hasMeteogram(domaine)` — voir `.claude/rules/architecture.md`), pensé comme une **coquille extensible** dont le meteogram est le premier module (v1).

- `point-drawer.svelte` — le tiroir lui-même : redimensionnable (poignée `pointerdown`/`pointerup` en haut, plus flèches haut/bas au clavier sur un `role="separator"`), en-tête `<Modèle> · dernier run` + coordonnées du point, bouton « Exporter PNG » (délègue à `png-export.ts`) et bouton fermer. Pose un `maplibregl.Marker` ambre dédié sur la carte pour matérialiser le point choisi, distinct du popup de valeur (créé/déplacé/retiré au fil de `$pointWorkspace`).
- `meteogram/meteogram.svelte` — orchestration : un `$effect` sur `(lat, lng, model)` déclenche `fetchMeteogram()` (mémoïsé en `SvelteMap`, jamais sur le scrub du temps), convertit chaque série dans l'unité d'affichage courante (`convertValue`/`getDisplayUnit`, `stores/units.ts`), gère les états chargement (squelette), rate-limit (HTTP 429), erreur réseau et « aucune donnée », calcule le playhead (`$derived` sur `$time`, pas de refetch) et route un clic sur un panneau vers `nearestValidTime()` + `goToValidTime()`. Compose 4 `Panel` (Température, Précipitations, Vent, Avancés) + une `WindDirection`.
- `meteogram/panel.svelte` — panneau SVG générique (props `PanelProps`/`PanelSeries` dans `panel-types.ts`) : séries en ligne ou en barres, grille jour (minuit UTC), graduations Y, trait de playhead, crosshair au survol partagé entre panneaux (rendu uniquement si `hoverIndex` est dans les bornes de `times`, réinitialisé côté `meteogram.svelte` à chaque nouvelle série pour éviter un index périmé après un rechargement plus court), clic → `onSeek(t)`.
- `meteogram/wind-direction.svelte` — bande de flèches de direction du vent sous le panneau Vent, alignée sur son échelle temps via le padding partagé `PANEL_PAD` (`panel-types.ts`, prop `x` calculée côté `meteogram.svelte`).
- `meteogram/png-export.ts` — capture tous les `<svg>` du conteneur (un par panneau, pas un seul SVG racine), fige les styles Tailwind calculés (`getComputedStyle`) en attributs de présentation SVG (sinon perdus hors DOM vivant), empile sur un `<canvas>` avec un bandeau d'en-tête, puis réutilise `downloadBlob()` (`src/lib/png-export.ts`, partagé avec la capture carte).

Logique pure associée sous `src/lib/meteogram/` (source API, scales, paths, snapping — testée), voir `.claude/rules/architecture.md`.
