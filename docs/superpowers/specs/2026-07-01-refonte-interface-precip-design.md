# Refonte interface — header + sidebar épurés façon precip.ai

**Date** : 2026-07-01 (révisé le 2026-07-01 : ajout du header)
**Statut** : design validé (brainstorming), à transformer en plan d'implémentation
**Référence visuelle** : `app.precip.ai/map`
**Skill UI/UX** : `ui-ux-pro-max` — archétype « Data-Dense Dashboard »

## Objectif

Refondre le *chrome* de Open-Meteo Maps (Infoclimat) vers une interface épurée
inspirée de `app.precip.ai/map` : thème sombre gris-bleu, verre dépoli, accent
sky, disposition **header fin + carte plein cadre + sidebar gauche repliable**.
Le header ménage l'emplacement des futures pages/options du site. Cible
**desktop + mobile à parité**.

Il s'agit d'une **réorganisation du chrome visuel**, pas d'une réécriture du
moteur. Le pipeline `om://`, le SlotManager, les stores, le playback et le rendu
MapLibre restent inchangés.

### Non-goals

- Aucune nouvelle donnée/variable météo.
- Pas de structure multi-pages (Forecast / Locations comme precip.ai) — mais le
  header en réserve l'emplacement (onglets en pilule).
- Pas de comptes / premium / calques verrouillés.
- Pas de changement de police de fond (voir « Typographie »).
- Pas de clonage de la marque « Precip » : on garde le logo/identité Infoclimat.

## Décisions de cadrage (issues du brainstorming)

| Question | Décision |
|---|---|
| Portée | Refonte **épurée** : fonctions avancées reléguées derrière un mode avancé |
| Premier plan | Sélecteur de modèle, timeline + playback, légende + échelle, contours + flèches vent |
| Responsive | **Desktop + mobile à parité** |
| Palette | **Sombre proche precip.ai**, réutilise les tokens verre + accent sky existants |
| Disposition | **Approche A′** (révision 2026-07-01) — header fin façon precip.ai **+** sidebar gauche ; le header porte la marque, un onglet « Carte » en pilule (futures pages) et le bouton « Réglages » (ex-« Avancé ») |
| Typographie | **Chiffres tabulaires uniquement** (`tabular-nums`), police de fond inchangée |

## Disposition (Approche A′)

Header fin en haut, carte MapLibre plein cadre en dessous. En superposition :

```
┌────────────────────────────────────────┐
│ ⛅ Infoclimat  (Carte)      [⚙ Réglages]│  ← header
├────────┬───────────────────────────────┤
│Réglages⊟│                 [rechercher] │
│[Modèle▾]│                              │
│Calques │                              │
│ ◉ Précip│            CARTE            │
│ ○ Temp  │        (plein cadre)        │
│ ○ Vent  │                             │
│Affichage│                           ⊞ │
│ ■ Contours                          ⊖ │
│ □ Flèches│                            │
│Style   │[■■■ légende]                 │
└────────┴──[▶ ──●── timeline]──────────┘
```

- **Header** (~44 px, pleine largeur, verre dépoli sombre), calqué sur
  precip.ai : logo + nom Infoclimat à gauche, onglets de navigation en pilule
  (un seul onglet **« Carte »** actif en v1 — emplacement des futures pages),
  bouton **« ⚙ Réglages »** à droite qui ouvre le panneau **Avancé**.
  `<header>` + `<nav>` sémantiques.
- **Sidebar gauche** repliable, hauteur = viewport − header (elle démarre sous
  le header, comme « Map settings » chez precip.ai), surface verre dépoli
  sombre (`bg-glass` + `glass-blur`). Repliée → fine barre d'icônes. En-tête
  simplifié : titre « Réglages carte » + bouton collapse (le logo vit dans le
  header).
- **Zone flottante haut-droite** : recherche de lieu (reste sur la carte,
  comme precip.ai — pas dans le header).
- **Légende couleur** flottante bas-gauche (garde libellés « Moins / Plus »).
- **Contrôles carte** bas-droite : géoloc, zoom ±, partage.
- **Timeline + playback** en barre basse, largeur de la zone carte (décalée par
  la sidebar quand ouverte).

## Structure de la sidebar

Sections dépliables (accordéon), denses et scannables :

| Section | Contenu |
|---|---|
| *(haut de sidebar)* | **Sélecteur de modèle** (AROME, ARPEGE, GFS…) + run / échéance |
| **Calques** | Liste verticale des variables (icône + libellé) ; la variable active déplie ses sous-échéances en radio |
| **Affichage** | Toggles : Contours · Flèches de vent · Mode exploration (survol = valeur) · Marqueurs · Relief 3D / hillshade · Départements/pays · Thème sombre |
| **Style** | Opacité du calque · choix / édition d'échelle de couleur |

Le panneau des fonctions avancées s'ouvre depuis le bouton **« ⚙ Réglages »**
du header (il n'y a plus de pied de sidebar).

## Premier plan vs. mode avancé

- **Premier plan** (sidebar + barres flottantes) : modèle, variables +
  sous-échéances, timeline/playback, légende, contours, flèches, opacité,
  échelle.
- **Avancé** (panneau/sheet séparé depuis le bouton « ⚙ Réglages » du header) : soundings
  (skew-T / hodographe — déclenchés au clic carte, inchangés), clipping par
  pays, capture, calque secondaire, réglages fins unités / tuiles / popup /
  cache.

## Direction visuelle (skill UI/UX)

- **Style** : « Data-Dense Dashboard » — padding minimal, dense mais scannable,
  grille régulière, support dark complet. Rythme d'espacement 4 / 8 px.
- **Couleurs** (tokens sémantiques, aucun hex en dur dans les composants) :
  - Actif / primaire = **sky** (déjà en place : switches, calque actif).
  - **Ambre** (`#D97706` / token dédié) réservé au *highlight / statut* (ex.
    futures vigilances), distinct de l'accent.
  - **Rouge** destructif = erreurs uniquement.
  - Réutilise `--glass`, l'utilitaire `glass-blur` et les tokens shadcn
    existants de `src/styles.css` ; pas de nouveau système de tokens.
- **Typographie** : police de fond inchangée ; **`font-variant-numeric:
  tabular-nums`** sur toutes les données numériques (heures de la timeline,
  valeurs de légende, coordonnées du popup) pour supprimer le saut visuel.
- **Micro-interactions** : survol → tooltip + surlignage de ligne dans la liste
  des calques ; transitions **150–300 ms** ; **skeleton** plutôt que spinner
  au-delà de 1 s de chargement.

### Garde-fous non négociables (checklist skill)

- Cibles tactiles **≥ 44 px** sur mobile (toggles, lignes de calque, poignée
  du bottom-sheet) ; gap **≥ 8 px**.
- `prefers-reduced-motion` respecté sur le repli de sidebar et l'ouverture du
  bottom-sheet.
- Focus clavier visibles ; contraste texte **≥ 4.5:1** en sombre.
- Légende **jamais couleur seule** (libellés conservés).

## Mobile (parité)

- **Header compact conservé** : même barre (logo + pilule « Carte » +
  ⚙ Réglages) au-dessus de la carte — coûte ~44 px de carte, prix accepté pour
  la parité et l'extensibilité.
- Sidebar → **bottom-sheet** à poignée, réutilisant le `mobile-dock` existant :
  onglet *Calques*, onglet *Affichage / Style*.
- Timeline reste en barre basse ; légende en overlay compact.
- Toutes les cibles tactiles respectent les garde-fous ci-dessus.

## Impact code (réorganisation, pas réécriture moteur)

| Fichier actuel | Devenir |
|---|---|
| *(nouveau)* | `chrome/header.svelte` — logo, onglets pilule, bouton « ⚙ Réglages » ; commun desktop/mobile |
| `chrome/top-bar.svelte` | Remplacé par `chrome/header.svelte` + `chrome/sidebar.svelte` (desktop) ; la sidebar compose `model-selector`, une liste verticale (issue de `variable-tabs`), et les toggles de `advanced-panel` |
| `chrome/variable-tabs.svelte` | Repensé en **liste verticale** de calques (ou nouveau `chrome/layer-list.svelte`) avec sous-échéances en radio |
| `chrome/advanced-panel.svelte` | **Scindé** : toggles « premier plan » (contours, flèches, relief, thème…) montent dans la section *Affichage* ; le reste (clipping, capture, calque secondaire, unités/tuiles/popup/cache) va dans un nouveau panneau **« Avancé »** |
| `chrome/mobile-dock.svelte` | Adapté en **bottom-sheet** à sections/onglets |
| `chrome/app-chrome.svelte` | Compose le header (toujours présent) et aiguille desktop (`sidebar`) / mobile (bottom-sheet) |
| Moteur `om://`, slots, stores, playback, `popup.ts`, soundings | **Inchangés** |

Primitives `ui/` déjà customisées (verre, switch sky) : préservées, réappliquées
après tout `npm run upgrade:ui` (cf. `.claude/rules/components.md`).

## Découpage en unités

Chaque unité a une responsabilité claire et testable :

- `chrome/header.svelte` — marque, onglets pilule (« Carte » seul en v1),
  bouton « ⚙ Réglages » ouvrant le panneau Avancé ; responsive.
- `chrome/sidebar.svelte` — conteneur desktop + état ouvert/replié (persisté).
- `chrome/layer-list.svelte` — liste des calques + sous-échéances, pilotée par
  les stores existants.
- `chrome/display-section.svelte` — regroupe les toggles d'affichage.
- `chrome/style-section.svelte` — opacité + échelle.
- Panneau **Avancé** — conteneur des sous-composants `settings/` déjà existants.
- Bottom-sheet mobile — équivalent tactile composant les mêmes sections.

## Critères de succès

- Desktop : header (marque + pilule + Réglages) et sidebar repliable, sections
  Calques/Affichage/Style opérationnelles, toutes les fonctions « premier
  plan » atteignables sans ouvrir « Avancé ».
- Mobile : header compact + bottom-sheet à parité fonctionnelle, cibles ≥ 44 px.
- Aucune régression du moteur (rendu, scrubbing, playback, soundings, export).
- `npm run check`, `npm run lint`, `npm run test` verts.
- Contraste/focus/reduced-motion vérifiés en sombre.
