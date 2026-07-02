# Refonte interface — coquille « tableau de bord » (weather-grid-view)

**Date** : 2026-07-02
**Statut** : design validé (brainstorming), à transformer en plan d'implémentation
**Branche** : `feat/refonte-interface-precip`
**Référence visuelle** : prototype `weather-grid-view` (Lovable/React/TanStack), `~/Téléchargements/weather-grid-view`
**Évolue** : `2026-07-01-refonte-interface-precip-design.md` — même intention (chrome sombre, sidebar gauche, mobile à parité) mais **forme « tableau de bord »** : la timeline devient une **barre dédiée en bas** avec bande de pastilles, la carte est **encadrée** (bande de contexte au-dessus, actions flottantes), et le fil d'en-tête s'enrichit.

## Objectif

Refondre le _chrome_ de Open-Meteo Maps (Infoclimat) vers la mise en page « tableau de bord » du prototype `weather-grid-view` : **chrome sombre bleuté encadrant une carte MapLibre claire**, disposition `en-tête / sidebar gauche | carte / timeline bas`. Reprise du **langage visuel et de la structure** du proto — pas de son backend (le proto affiche des images pré-générées ; ici la carte reste des tuiles MapLibre live, pannables/zoomables).

C'est une **réorganisation du chrome**, pas une réécriture du moteur. Le pipeline `om://`, le SlotManager, les stores, la logique de temps (run/jour/anomalie), le playback et le rendu MapLibre restent **inchangés**.

### Non-goals

- Aucune nouvelle donnée/variable météo.
- Pas de refonte du moteur de temps ni du modèle de données (`metaJson`, `valid_times`).
- Pas de notion de « Zone » à la proto (découpes france/europe d'images fixes) : la carte est live et pannable, sans équivalent.
- Pas de vraie « vitesse » de lecture : on réutilise le **mode de plage** existant (voir §5).
- Pas de structure multi-pages ni de comptes/premium.
- Pas de changement de police de fond ; chiffres tabulaires (`tabular-nums`) comme aujourd'hui.

## Décisions de cadrage (issues du brainstorming)

| Question       | Décision                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Portée         | **Toute la mise en page** : coquille tableau de bord complète (en-tête + sidebar gauche + timeline bas)     |
| Thème          | **Chrome sombre bleuté** (palette du proto), **carte claire par défaut** conservée (fond clair opt-in sombre) |
| Timeline       | **Look du proto, logique dates conservée** : habillage de `time-selector`, chaque pastille = date réelle du run |
| Tiroir Avancé  | **Conservé** (bouton en-tête), réaligné sur la nouvelle palette                                             |
| Sidebar        | **Repliable en rail** conservée (288 ↔ 44 px) ; le proto est fixe mais replier libère la carte              |
| Mobile         | **Bottom-sheet `mobile-dock` existant conservé**, réhabillé (proto = desktop-only)                          |
| Section « Zone » | **Retirée** (aucun équivalent live)                                                                        |
| Sélecteur play | **Mode de plage existant** (`prefetchMode` : Aujourd'hui / 24 h suiv. / 24 h préc. / Run complet) à l'emplacement « vitesse » du proto — pas de changement moteur |

## Disposition

Grille plein écran, chrome sombre encadrant la carte claire :

```
┌───────────────────────────────────────────────────────────┐
│ Infoclimat  (Carte)   Temp 2m · AROME · Run 06h · mer.14h  │ ← en-tête (h-11)
│                                        [📷 Capture][⚙ Avancé]│
├──────────┬────────────────────────────────────────────────┤
│ MODÈLE   │ Température 2 m (°C) · à 2 mètres du sol         │ ← bande contexte
│ [AROME▾] ├────────────────────────────────────────────────┤
│ CALQUES  │                                      [🔗][⬇][⛶] │ ← actions flottantes
│ ◉ Temp °C│                                                  │
│ ○ Précip │                CARTE (claire)                    │
│ ○ Vent   │                                                  │
│ AFFICHAGE│                                                  │
│ STYLE    │ [■■■ légende]                                    │
│ ❓ Aide   │                                                  │
├──────────┴────────────────────────────────────────────────┤
│ ⏮ ◀ ▶ ▶ ⏭ │ plage:[Run complet▾] │ +9h·mer.14h·12/49·80% │ ← timeline
│ [08h][09h][10h]⋯[14h*]⋯[19h]  (bande de pastilles-dates)   │
└───────────────────────────────────────────────────────────┘
```

La carte MapLibre remplit la zone centrale et **reste interactive** (le « cadre » est visuel : bande de contexte au-dessus, chrome sombre autour).

## Composants — état cible

### 1. En-tête — `chrome/header.svelte` (modif)

- Logo Infoclimat + pilule « Carte » (inchangés).
- **Fil contextuel enrichi** : fusion de l'actuel `variable · modèle` avec le fil du proto → `Variable · Modèle · Run · Validité`. Sources : `selectedVariable`, `selectedDomain`, `$modelRun`, `$time`/`validTime`. Réutiliser `translateVariableLabel` et les formatteurs `time-format`.
- **Badge « run en cours »** quand `$inProgress` correspond au run affiché (repris du proto).
- Actions à droite inchangées : `CaptureFlow` (desktop) + bouton « Avancé ».
- Masqué/condensé sur mobile comme aujourd'hui (l'info vit dans la bande de contexte + bottom-sheet).

### 2. Sidebar gauche — `chrome/sidebar.svelte` (modif)

Sections empilées, ordre : **Modèle** (`ModelSelector`) → **Calques** (`LayerList`) → **Affichage** (`DisplaySection`, dépliant) → **Style** (`StyleSection`, dépliant) → pied **Aide**. Comportement repliable-en-rail conservé (`sidebarCollapsed`, `sidebarWidth`).

- **`LayerList`** : présenter chaque calque avec **l'unité alignée à droite** façon proto (`libellé …… °C`). Grouper par catégorie si la donnée le permet (sinon liste plate). Vérifier la source du libellé unité (métadonnées variable).
- Pas de section « Zone ».
- Palette : voir §6.

### 3. Bande de contexte carte — `chrome/context-strip.svelte` (**nouveau**)

Fine barre (~26 px) entre l'en-tête et la carte, plein largeur de la zone carte :
`Variable (unité) · description`. Données depuis `selectedVariable` (label traduit, unité, description). Élément signature du proto ; allège le fil d'en-tête. Masquable/condensé sur mobile.

### 4. Actions flottantes carte — `chrome/map-actions.svelte` (**nouveau**)

Cluster en haut-droite de la zone carte (z au-dessus des contrôles MapLibre) :

- **Copier le lien** (nouveau) : `navigator.clipboard.writeText(location.href)` + retour visuel (✓ 1,5 s).
- **Télécharger / capture** : réutiliser `CaptureFlow` (déjà l'action d'export image).
- **Plein écran** : `requestFullscreen`/`exitFullscreen` sur le conteneur racine.

Sur mobile, la capture reste le FAB de `mobile-dock` ; le cluster desktop peut se réduire à copier-lien + plein écran.

### 5. Timeline — `time/time-selector.svelte` (réhabillage)

Habillage visuel du sélecteur existant aux couleurs du proto, **logique inchangée** (navigation run/jour/heure, domaine anomalie, `checkClosestModelRun`, centrage) :

- **Rangée transport** : début / précédent / **play** (`PlaybackButton`) / suivant / fin, style pastilles du proto (play accentué).
- **Contrôle de plage** à l'emplacement « vitesse » du proto : réutiliser `PrefetchButton`/`prefetchMode` (Aujourd'hui / 24 h suiv. / 24 h préc. / Run complet). **Pas** de Lent/Normal/Rapide.
- **Compteur** à droite : `échéance (+Xh ou date) · index/total · préchargé %`. Le « préchargé % » réutilise l'état de préchargement existant s'il est exposé ; sinon follow-up (ne pas bloquer).
- **Bande de pastilles-dates** : restyler la bande scrollable existante (`centerDateButton`, `timeSteps`) en pastilles proto — chaque pastille montre la **date/heure réelle** ; états actif / manquant (pointillés ambre).
- La barre reste en bas, hauteur publiée via `bottomChromeHeight` (déjà utilisée pour décaler légende/dock).

### 6. Thème & palette — `src/styles.css` / tokens (modif)

- **Chrome** : adopter les **tons sombres bleutés du proto** (oklch). Le chrome actuel est déjà en verre sombre (`bg-glass/85 text-white`) ; ajuster teinte/contraste vers le bleuté du proto (fond `~oklch(0.18 0.02 250)`, cartes `~0.22`, bordures `~0.32`, accent sky `~0.75 0.15 220`). Réutiliser les tokens verre existants plutôt qu'en créer.
- **Carte** : fond clair par défaut conservé (opt-in sombre) — ne pas régresser le travail récent.
- Chiffres tabulaires conservés.

### 7. Tiroir Avancé — `chrome/advanced-panel.svelte` (réhabillage)

Contenu inchangé (Calque secondaire, Unités, Performance, Réglages avancés, Outils). Uniquement l'alignement visuel sur la nouvelle palette. Ouverture via bouton en-tête (`advancedOpen`), drawer droit desktop / bottom-sheet mobile inchangés.

### 8. Mobile — `chrome/mobile-dock.svelte` (réhabillage)

Bottom-sheet Calques / Affichage&style conservé, réhabillé. La bande de contexte (§3) et le cluster d'actions (§4) s'adaptent (condensés). Parité desktop/mobile maintenue.

### 9. Orchestration — `chrome/app-chrome.svelte` (modif)

Câbler les nouveaux composants : `context-strip` et `map-actions` rendus au-dessus/dans la zone carte (desktop et mobile). Ordre de rendu et `z-index` à préserver vis-à-vis des contrôles MapLibre et de la timeline.

## Fichiers touchés (synthèse)

| Fichier                              | Nature   |
| ------------------------------------ | -------- |
| `chrome/header.svelte`               | modif    |
| `chrome/sidebar.svelte`              | modif    |
| `chrome/layer-list.svelte`           | modif    |
| `chrome/context-strip.svelte`        | nouveau  |
| `chrome/map-actions.svelte`          | nouveau  |
| `chrome/app-chrome.svelte`           | modif    |
| `time/time-selector.svelte`          | modif    |
| `chrome/advanced-panel.svelte`       | modif (style) |
| `chrome/mobile-dock.svelte`          | modif (style) |
| `src/styles.css` (tokens)            | modif    |

Aucun store ni fichier `$lib/*.ts` moteur ne change de contrat.

## Vérification

- **Typecheck/lint** : `npm run check` puis `npm run lint` (via `rtk proxy npm run lint` pour éviter le faux « OK » masquant un échec CI — cf. mémoire).
- **Headless** : capture d'écran de la carte via playwright-core + chrome système + swiftshader (viewports desktop **et** mobile ; `resize_window` MCP ignoré par le WM). Seed localStorage (piège `breakpoints=true`).
- **Points à observer** : fil d'en-tête complet ; sidebar repliée→rail ; bande de contexte alignée ; actions flottantes cliquables (copier-lien retour ✓) ; timeline transport + pastilles centrées + état « manquant » ; contraste chrome sombre / carte claire ; parité mobile bottom-sheet.
- Pas de régression : navigation temps (run/jour/anomalie), playback en boucle, légende/échelle.

## Suivi / follow-ups

- « Préchargé % » dans le compteur timeline : à câbler seulement si l'état est déjà exposé ; sinon différer.
- Regroupement par catégorie dans `LayerList` : dépend de la présence d'une catégorie dans les métadonnées variable ; sinon liste plate.
- A11y : focus visibles conservés (déjà en place), `aria-*` sur nouveaux boutons (copier-lien, plein écran), cibles ≥ 44 px sur mobile.
