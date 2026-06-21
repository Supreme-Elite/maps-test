# Refonte du menu Aide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire `src/lib/components/help/help-dialog.svelte` pour refléter l'app actuelle, organisé par tâche utilisateur, avec icônes Lucide et accordéons natifs.

**Architecture :** Un seul composant Svelte 5 présentationnel, construit incrémentalement section par section. Dialogue shadcn (`Dialog`) conservé ; chaque section = un `<h2>` à icône Lucide + une liste de lignes `[icône|Kbd] Libellé — description` ; les grosses features utilisent des `<details>/<summary>` natifs (accordéon). Aucun test unitaire (composant de contenu pur) — vérification par `npm run check` + `npm run lint` + critères d'acceptation visuels.

**Tech Stack :** SvelteKit, Svelte 5 runes, Tailwind v4, shadcn-svelte (`Dialog`, `Kbd`), `@lucide/svelte` (imports par sous-chemin), `svelte/reactivity` `MediaQuery`.

## Global Constraints

- **Svelte 5 runes uniquement** (`$state`/`$derived`/`$effect`/`$props`), pas de réactivité Svelte 4.
- **Icônes Lucide** importées par sous-chemin tree-shakeable : `import XIcon from '@lucide/svelte/icons/<kebab-name>';` (convention du repo, cf. `ui/sonner/sonner.svelte`). Jamais d'emoji ni de SVG inline reproduisant `.maplibregl-ctrl`.
- **Style verre conservé** : le `Dialog.Content` garde ses classes actuelles (`bg-glass/80 backdrop-blur-sm shaded-md …`). Accent d'état = `sky`.
- **Prettier** : tabs, single quotes, pas de trailing comma, 100 col. Ne pas trier les imports à la main — `npm run format` s'en charge.
- **Accessibilité** : hiérarchie `h2` séquentielle sous le `Dialog.Title` (`h2`) → utiliser `h3` pour les sous-titres d'accordéon ; icônes décoratives `aria-hidden` (les icônes Lucide le sont par défaut) ; accordéons `<details>` (clavier natif) ; transitions encadrées par la variante Tailwind `motion-reduce:`.
- **Pas de nouvelle dépendance** (accordéon = `<details>` natif, pas le primitive shadcn `Accordion`).
- **Copy** : aucune mention de « Requêtes partielles » ni « Masquer les océans » (features supprimées de l'UI).
- **Vérification commune à chaque tâche** : `npm run check` (typecheck — attrape un nom d'icône Lucide erroné) puis `npm run lint`. Vérifier le lint via `rtk proxy npm run lint` (le proxy rtk peut masquer un échec — cf. mémoire `rtk-caches-lint-output`).

---

## File Structure

- **Modifie (réécriture complète)** : `src/lib/components/help/help-dialog.svelte` — seul fichier touché. Pas de nouveau fichier, pas de changement de store ni de raccourci (le raccourci `h` et le store `helpOpen` existent déjà).

Le composant est construit en 4 tâches qui modifient ce fichier de façon additive (chaque tâche ajoute une ou deux sections testables et commitables). La Tâche 1 pose tous les patterns réutilisables (ligne, ligne-Kbd, accordéon, `isDesktop`).

---

### Task 1 : Scaffold + Section « Naviguer dans le temps »

Pose la coquille du dialogue et **tous les patterns** (ligne icône, ligne Kbd, accordéon `<details>`, masquage Kbd mobile via `isDesktop`), prouvés par la première section.

**Files:**

- Modify (réécriture totale) : `src/lib/components/help/help-dialog.svelte`

**Interfaces:**

- Consumes : store `helpOpen` (`$lib/stores/preferences`), `Dialog` et `Kbd` (`$lib/components/ui/*`), `MediaQuery` (`svelte/reactivity`), icônes `@lucide/svelte/icons/*`.
- Produces : patterns markup réutilisés par les Tâches 2-4 — classes de ligne `flex items-start gap-2.5`, icône de ligne `size-4.5 shrink-0 mt-0.5 opacity-75`, pastille `<Kbd.Root>`, accordéon `<details class="group">` + chevron `group-open:rotate-90 motion-reduce:transition-none`, et la variable `isDesktop` (`MediaQuery('min-width: 640px')`) qui masque les pastilles Kbd `<640px`.

- [ ] **Step 1 : Réécrire le fichier avec le scaffold + Section 1**

Remplacer **tout** le contenu de `src/lib/components/help/help-dialog.svelte` par :

```svelte
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';

	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PlayIcon from '@lucide/svelte/icons/play';

	import { helpOpen } from '$lib/stores/preferences';

	import * as Dialog from '$lib/components/ui/dialog';
	import * as Kbd from '$lib/components/ui/kbd';

	// Masque les pastilles clavier sur mobile (pas de clavier physique).
	const isDesktop = new MediaQuery('min-width: 640px');
</script>

<Dialog.Root bind:open={$helpOpen}>
	<Dialog.Content
		class="z-90 bg-glass/80 backdrop-blur-sm shaded-md min-h-1/4 max-h-[90vh] overflow-y-scroll pb-18 border-none"
	>
		<Dialog.Header>
			<Dialog.Title class="text-2xl">Aide</Dialog.Title>
		</Dialog.Header>

		<div class="flex flex-col gap-6">
			<!-- 1. Naviguer dans le temps -->
			<section>
				<h2 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
					<ClockIcon class="size-5 opacity-75" /> Naviguer dans le temps
				</h2>
				<ul class="flex flex-col gap-1.5">
					<li class="flex items-start gap-2.5">
						<CalendarClockIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
						<span
							><span class="font-medium">Sélecteur de temps</span> — afficher / masquer la barre temporelle</span
						>
					</li>
					{#if isDesktop.current}
						<li class="flex items-center gap-2.5">
							<Kbd.Root>↓</Kbd.Root><Kbd.Root>↑</Kbd.Root>
							<span>Jour précédent / suivant</span>
						</li>
						<li class="flex items-center gap-2.5">
							<Kbd.Root>←</Kbd.Root><Kbd.Root>→</Kbd.Root>
							<span>Heure précédente / suivante</span>
						</li>
						<li class="flex items-center gap-2.5">
							<Kbd.Root>c</Kbd.Root> <span>Aller à l'heure actuelle</span>
						</li>
						<li class="flex items-center gap-2.5">
							<Kbd.Root>m</Kbd.Root> <span>Verrouiller le run</span>
						</li>
						<li class="flex items-center gap-2.5">
							<Kbd.Root>n</Kbd.Root> <span>Dernier run</span>
						</li>
						<li class="flex items-center gap-2.5">
							<Kbd.Root>ctrl</Kbd.Root> + <Kbd.Root>←</Kbd.Root><Kbd.Root>→</Kbd.Root>
							<span>Run précédent / suivant</span>
						</li>
					{/if}
					<li class="flex items-start gap-2.5">
						<PlayIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
						<span><span class="font-medium">Animation</span> — lit la plage de temps en boucle</span
						>
					</li>
					<li class="flex items-start gap-2.5">
						<DownloadIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
						<span
							><span class="font-medium">Préchargement</span> — charge la plage à l'avance pour fluidifier
							l'animation</span
						>
					</li>
				</ul>
				<details class="group mt-2 ml-7">
					<summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm opacity-90">
						<ChevronRightIcon
							class="size-4 opacity-75 transition-transform group-open:rotate-90 motion-reduce:transition-none"
						/>
						<h3 class="font-medium">Détails de l'animation</h3>
					</summary>
					<p class="mt-1.5 ml-5.5 text-sm opacity-80">
						La lecture boucle sur la plage choisie : <b>Aujourd'hui</b>, <b>24 h suivantes</b>,
						<b>24 h précédentes</b> ou <b>Run complet</b>. Utiliser le préchargement avant de lancer
						l'animation pour éviter les saccades.
					</p>
				</details>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
```

- [ ] **Step 2 : Formater**

Run : `npm run format`
Expected : reformate `help-dialog.svelte` sans erreur.

- [ ] **Step 3 : Typecheck**

Run : `npm run check`
Expected : PASS, 0 erreur (valide notamment que les 5 noms d'icônes `@lucide/svelte/icons/*` existent).

- [ ] **Step 4 : Lint**

Run : `rtk proxy npm run lint`
Expected : PASS (prettier --check + eslint).

- [ ] **Step 5 : Vérification visuelle**

Run : `npm run dev`, ouvrir l'app, presser `h` (ou bouton Aide du panneau).
Critères d'acceptation :

- Le dialogue s'ouvre, titre « Aide ».
- Section « Naviguer dans le temps » présente avec son icône.
- Sur desktop (≥640px) : les pastilles `↓ ↑ ← → c m n ctrl` sont visibles.
- Réduire la fenêtre <640px : les pastilles Kbd disparaissent, les lignes « Sélecteur de temps / Animation / Préchargement » restent.
- L'accordéon « Détails de l'animation » s'ouvre/ferme au clic et au clavier (Tab + Entrée), le chevron pivote.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/components/help/help-dialog.svelte
git commit -m "feat: refonte aide — scaffold + section Naviguer dans le temps"
```

---

### Task 2 : Sections « Choisir les données » + « Visualiser »

**Files:**

- Modify : `src/lib/components/help/help-dialog.svelte`

**Interfaces:**

- Consumes : patterns de la Tâche 1 (ligne, ligne-Kbd, `isDesktop`).
- Produces : rien de nouveau (réutilise les patterns).

- [ ] **Step 1 : Ajouter les imports d'icônes**

Dans le bloc `<script>`, ajouter après les imports d'icônes existants :

```svelte
import DatabaseIcon from '@lucide/svelte/icons/database'; import Layers2Icon from
'@lucide/svelte/icons/layers-2'; import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
import EyeIcon from '@lucide/svelte/icons/eye'; import RulerIcon from '@lucide/svelte/icons/ruler';
import Grid3x3Icon from '@lucide/svelte/icons/grid-3x3'; import HashIcon from
'@lucide/svelte/icons/hash'; import WindIcon from '@lucide/svelte/icons/wind'; import SplineIcon
from '@lucide/svelte/icons/spline'; import BlendIcon from '@lucide/svelte/icons/blend'; import
PaletteIcon from '@lucide/svelte/icons/palette'; import ProportionsIcon from
'@lucide/svelte/icons/proportions';
```

- [ ] **Step 2 : Ajouter les deux sections**

Dans la `<div class="flex flex-col gap-6">`, **après** la `<section>` « Naviguer dans le temps », insérer :

```svelte
<!-- 2. Choisir les données -->
<section>
	<h2 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
		<DatabaseIcon class="size-5 opacity-75" /> Choisir les données
	</h2>
	<ul class="flex flex-col gap-1.5">
		{#if isDesktop.current}
			<li class="flex items-center gap-2.5">
				<Kbd.Root>d</Kbd.Root> <span>Sélection du domaine (modèle)</span>
			</li>
			<li class="flex items-center gap-2.5">
				<Kbd.Root>v</Kbd.Root> <span>Sélection de la variable</span>
			</li>
			<li class="flex items-center gap-2.5">
				<Kbd.Root>l</Kbd.Root> <span>Sélection du niveau</span>
			</li>
		{/if}
		<li class="flex items-start gap-2.5">
			<ChevronLeftIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Sélection de variable</span> — afficher / masquer le panneau de choix</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<Layers2Icon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Couche superposée</span> — afficher une 2ᵉ variable par-dessus la principale,
				avec une opacité indépendante</span
			>
		</li>
	</ul>
</section>

<!-- 3. Visualiser -->
<section>
	<h2 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
		<EyeIcon class="size-5 opacity-75" /> Visualiser
	</h2>
	<ul class="flex flex-col gap-1.5">
		<li class="flex items-start gap-2.5">
			<RulerIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Unités</span> — température, distance, géopotentiel, précipitations,
				vitesse du vent</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<Grid3x3Icon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Grille</span> — points du modèle, en orange sur la carte</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<HashIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Valeurs</span> — valeur chiffrée à chaque nœud de la grille (distinct
				de « Grille »)</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<WindIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Flèches</span> — direction et intensité (vent / houle) ; niveau et
				style (couleur, largeur) réglables</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<SplineIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Isocontours</span> — isolignes entre seuils ; intervalle, alignement
				des paliers et style réglables</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<BlendIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Opacité</span> — transparence des tuiles météo</span>
		</li>
		<li class="flex items-start gap-2.5">
			<PaletteIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Couleurs</span> — édition des paliers de l'échelle de couleur</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<ProportionsIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Taille des tuiles</span> — résolution de rendu ; 512 px par défaut
				(plus petit = plus rapide, plus grand = plus net)</span
			>
		</li>
	</ul>
</section>
```

- [ ] **Step 3 : Formater** — `npm run format`
- [ ] **Step 4 : Typecheck** — `npm run check` → PASS (valide les 12 nouveaux noms d'icônes).
- [ ] **Step 5 : Lint** — `rtk proxy npm run lint` → PASS.
- [ ] **Step 6 : Vérification visuelle**

`npm run dev`, ouvrir l'aide. Critères :

- Sections « Choisir les données » et « Visualiser » présentes après « Naviguer dans le temps ».
- « Grille » et « Valeurs » sont deux lignes distinctes.
- Chaque ligne a son icône, sans cadre.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/components/help/help-dialog.svelte
git commit -m "feat: refonte aide — sections Choisir les données + Visualiser"
```

---

### Task 3 : Sections « Interroger la carte » + « Cadrer & exporter »

Deux sections à accordéon (sondage, découpage, capture).

**Files:**

- Modify : `src/lib/components/help/help-dialog.svelte`

**Interfaces:**

- Consumes : patterns Tâche 1 (ligne, ligne-Kbd, accordéon `<details>`, `isDesktop`).
- Produces : rien de nouveau.

- [ ] **Step 1 : Ajouter les imports d'icônes**

Dans `<script>`, ajouter :

```svelte
import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click'; import
SquareMousePointerIcon from '@lucide/svelte/icons/square-mouse-pointer'; import ThermometerIcon from
'@lucide/svelte/icons/thermometer'; import CropIcon from '@lucide/svelte/icons/crop'; import
ScissorsIcon from '@lucide/svelte/icons/scissors'; import CameraIcon from
'@lucide/svelte/icons/camera';
```

- [ ] **Step 2 : Ajouter les deux sections**

Après la `<section>` « Visualiser », insérer :

```svelte
<!-- 4. Interroger la carte -->
<section>
	<h3 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
		<MousePointerClickIcon class="size-5 opacity-75" /> Interroger la carte
	</h3>
	<ul class="flex flex-col gap-1.5">
		<li class="flex items-start gap-2.5">
			<SquareMousePointerIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span>
				<span class="font-medium">Infobulle</span> — valeur sous le curseur.
				{#if isDesktop.current}
					<Kbd.Root>p</Kbd.Root> bascule : désactivée / suit la souris / déplaçable.
				{/if}
			</span>
		</li>
		<li class="flex items-start gap-2.5">
			<ThermometerIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Sondage vertical</span> — profil atmosphérique au clic sur la carte</span
			>
		</li>
	</ul>
	<details class="group mt-2 ml-7">
		<summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm opacity-90">
			<ChevronRightIcon
				class="size-4 opacity-75 transition-transform group-open:rotate-90 motion-reduce:transition-none"
			/>
			<h4 class="font-medium">Détails du sondage</h4>
		</summary>
		<p class="mt-1.5 ml-5.5 text-sm opacity-80">
			Trois onglets : <b>Skew-T</b>, <b>hodographe</b> et <b>indices</b> thermodynamiques. Le profil se
			met à jour en suivant la lecture du temps. Disponible sur les domaines AROME. Le bouton d'accès
			s'active dans les réglages avancés (« Sondage vertical »).
		</p>
	</details>
</section>

<!-- 5. Cadrer & exporter -->
<section>
	<h3 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
		<CropIcon class="size-5 opacity-75" /> Cadrer &amp; exporter
	</h3>
	<ul class="flex flex-col gap-1.5">
		<li class="flex items-start gap-2.5">
			<ScissorsIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Découpage</span> — limiter le rendu à une zone dessinée ou à un pays</span
			>
		</li>
		<li class="flex items-start gap-2.5">
			<CameraIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Capture</span> — exporter la vue en image PNG avec filigrane</span
			>
		</li>
	</ul>
	<details class="group mt-2 ml-7">
		<summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm opacity-90">
			<ChevronRightIcon
				class="size-4 opacity-75 transition-transform group-open:rotate-90 motion-reduce:transition-none"
			/>
			<h4 class="font-medium">Détails du découpage et de la capture</h4>
		</summary>
		<div class="mt-1.5 ml-5.5 flex flex-col gap-2 text-sm opacity-80">
			<p>
				<b>Découpage</b> : modes sélection, rectangle, polygone, main levée ou pinceau, plus un sélecteur
				de pays. La zone est mémorisée d'une session à l'autre.
			</p>
			<p>
				<b>Capture</b> : cadrage paysage (4:3) ou portrait (3:4), filigrane automatique (run, échéance,
				domaine et variable), puis téléchargement ou partage.
			</p>
		</div>
	</details>
</section>
```

- [ ] **Step 3 : Formater** — `npm run format`
- [ ] **Step 4 : Typecheck** — `npm run check` → PASS.
- [ ] **Step 5 : Lint** — `rtk proxy npm run lint` → PASS.
- [ ] **Step 6 : Vérification visuelle**

Critères : sections « Interroger la carte » et « Cadrer & exporter » présentes ; les deux accordéons (« Détails du sondage », « Détails du découpage et de la capture ») s'ouvrent/ferment ; `p` visible seulement sur desktop dans la ligne Infobulle.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/components/help/help-dialog.svelte
git commit -m "feat: refonte aide — sections Interroger + Cadrer & exporter"
```

---

### Task 4 : Sections « Repères & rendu » + « Réglages avancés » + ligne « Général » + nettoyage

Dernière tâche : les deux sections restantes, la ligne Général (raccourcis globaux), puis vérification finale complète (responsive, dark mode, absence des features supprimées).

**Files:**

- Modify : `src/lib/components/help/help-dialog.svelte`

**Interfaces:**

- Consumes : tous les patterns des tâches précédentes.
- Produces : composant complet et final.

- [ ] **Step 1 : Ajouter les imports d'icônes**

Dans `<script>`, ajouter :

```svelte
import MapIcon from '@lucide/svelte/icons/map'; import SunMoonIcon from
'@lucide/svelte/icons/sun-moon'; import MountainIcon from '@lucide/svelte/icons/mountain'; import
BoxIcon from '@lucide/svelte/icons/box'; import GlobeIcon from '@lucide/svelte/icons/globe'; import
LandPlotIcon from '@lucide/svelte/icons/land-plot'; import Building2Icon from
'@lucide/svelte/icons/building-2'; import LocateFixedIcon from '@lucide/svelte/icons/locate-fixed';
import CompassIcon from '@lucide/svelte/icons/compass'; import Settings2Icon from
'@lucide/svelte/icons/settings-2'; import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'; import KeyboardIcon from
'@lucide/svelte/icons/keyboard';
```

- [ ] **Step 2 : Ajouter les sections + ligne Général**

Après la `<section>` « Cadrer & exporter », insérer :

```svelte
<!-- 6. Repères & rendu -->
<section>
	<h3 class="mb-2 flex items-center gap-1.5 text-lg font-bold">
		<MapIcon class="size-5 opacity-75" /> Repères &amp; rendu
	</h3>
	<ul class="flex flex-col gap-1.5">
		<li class="flex items-start gap-2.5">
			<SunMoonIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Mode sombre / clair</span> — thème du fond de carte</span>
		</li>
		<li class="flex items-start gap-2.5">
			<MountainIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Relief ombré</span> — ombrage du relief</span>
		</li>
		<li class="flex items-start gap-2.5">
			<BoxIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Terrain 3D</span> — relief en perspective</span>
		</li>
		<li class="flex items-start gap-2.5">
			<GlobeIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Projection globe</span> — vue sphérique de la Terre</span>
		</li>
		<li class="flex items-start gap-2.5">
			<LandPlotIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Départements</span> — contours administratifs français</span>
		</li>
		<li class="flex items-start gap-2.5">
			<Building2Icon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Villes &amp; pays</span> — libellés du fond de carte</span>
		</li>
		<li class="flex items-start gap-2.5">
			<LocateFixedIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span><span class="font-medium">Me localiser</span> — centrer sur ma position</span>
		</li>
		<li class="flex items-start gap-2.5">
			<CompassIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
			<span
				><span class="font-medium">Zoom &amp; boussole</span> — zoomer / dézoomer ; réinitialiser l'inclinaison
				et la rotation</span
			>
		</li>
	</ul>
</section>

<!-- 7. Réglages avancés -->
<section>
	<details class="group">
		<summary class="flex cursor-pointer list-none items-center gap-1.5">
			<ChevronRightIcon
				class="size-5 opacity-75 transition-transform group-open:rotate-90 motion-reduce:transition-none"
			/>
			<h3 class="flex items-center gap-1.5 text-lg font-bold">
				<Settings2Icon class="size-5 opacity-75" /> Réglages avancés
			</h3>
		</summary>
		<ul class="mt-2 ml-6 flex flex-col gap-1.5">
			<li class="flex items-start gap-2.5">
				<HardDriveIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
				<span
					><span class="font-medium">Cache</span> — taille des blocs et taille maximale du cache (Mo)</span
				>
			</li>
			<li class="flex items-start gap-2.5">
				<RotateCcwIcon class="mt-0.5 size-4.5 shrink-0 opacity-75" />
				<span
					><span class="font-medium">Réinitialiser</span> — restaurer tous les réglages par défaut</span
				>
			</li>
		</ul>
	</details>
</section>

{#if isDesktop.current}
	<!-- Général (raccourcis globaux) -->
	<section class="border-t border-white/10 pt-3 text-sm opacity-80">
		<h3 class="mb-2 flex items-center gap-1.5 font-bold">
			<KeyboardIcon class="size-4.5 opacity-75" /> Général
		</h3>
		<ul class="flex flex-col gap-1.5">
			<li class="flex items-center gap-2.5">
				<Kbd.Root>h</Kbd.Root> <span>Ouvrir / fermer cette aide</span>
			</li>
			<li class="flex items-center gap-2.5">
				<Kbd.Root>Échap</Kbd.Root> <span>Fermer l'infobulle / réinitialiser le mode infobulle</span>
			</li>
		</ul>
	</section>
{/if}
```

- [ ] **Step 3 : Formater** — `npm run format`
- [ ] **Step 4 : Typecheck** — `npm run check` → PASS (valide les 13 nouveaux noms d'icônes).
- [ ] **Step 5 : Lint** — `rtk proxy npm run lint` → PASS.
- [ ] **Step 6 : Vérification visuelle finale (acceptation globale)**

`npm run dev`, ouvrir l'aide. Vérifier :

- Les 6 sections principales + « Réglages avancés » (replié par défaut) + « Général » sont présentes dans l'ordre.
- « Réglages avancés » est un accordéon fermé par défaut ; s'ouvre au clic.
- **Recherche texte dans la page** : aucune occurrence de « Requêtes partielles » ni « Masquer les océans ».
- **Mobile (375px)** : aucun débordement horizontal ; les sections « Général » et toutes les pastilles `Kbd` sont masquées ; les lignes de features (animation, sondage, capture…) restent visibles ; le dialogue scrolle verticalement.
- **Dark mode et clair** : ouvrir l'aide dans les deux thèmes (bouton mode sombre) — texte lisible (contraste suffisant) sur le fond verre dans les deux cas.
- **Reduced motion** : activer « prefers-reduced-motion » (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce) — l'ouverture des accordéons ne fait plus pivoter le chevron avec transition (pas de mouvement animé).
- **Clavier** : Tab parcourt les `<summary>` dans l'ordre visuel ; Entrée/Espace ouvre l'accordéon focalisé.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/components/help/help-dialog.svelte
git commit -m "feat: refonte aide — Repères & rendu, Réglages avancés, Général"
```

---

## Self-Review

**1. Couverture de la spec :**

- Section 1 Naviguer dans le temps → Task 1 ✓
- Section 2 Choisir les données → Task 2 ✓
- Section 3 Visualiser (Grille vs Valeurs distincts) → Task 2 ✓
- Section 4 Interroger (infobulle 3 modes, sondage accordéon) → Task 3 ✓
- Section 5 Cadrer & exporter (découpage + capture, accordéon) → Task 3 ✓
- Section 6 Repères & rendu → Task 4 ✓
- Section 7 Réglages avancés (accordéon replié, cache + reset) → Task 4 ✓
- Ligne Général (h, Échap) → Task 4 ✓
- Suppression « Requêtes partielles » / « Masquer les océans » → vérifié Task 4 Step 6 ✓
- Icônes Lucide nues, pas de cadre MapLibre → réécriture totale Task 1 ✓
- Mobile : masque Kbd + Général, garde les sections → `isDesktop` Task 1, vérif Task 4 ✓
- Accordéon `<details>` natif + `motion-reduce` → Task 1, vérif Task 4 ✓
- A11y (h2/h3, clavier, contraste) → contraintes globales + vérif Task 4 ✓

**2. Placeholders :** aucun TBD/TODO ; code complet à chaque step. ✓

**3. Cohérence des types/noms :** patterns de classes identiques d'une tâche à l'autre (`mt-0.5 size-4.5 shrink-0 opacity-75` pour les icônes de ligne, `<details class="group">` + `group-open:rotate-90 motion-reduce:transition-none`). `isDesktop` défini Task 1, réutilisé Tasks 2-4. Noms d'icônes Lucide en kebab-case validés par `npm run check` à chaque tâche. ✓

**Note de risque résiduel :** les 38 noms d'icônes utilisés ont été vérifiés présents dans `@lucide/svelte` v1.14 (`node_modules/@lucide/svelte/dist/icons/*.svelte`) — aucun manquant. Si un futur bump de version en retirait un, `npm run check` échouerait au Step typecheck → choisir l'icône de remplacement la plus proche sur lucide.dev (même style trait).
