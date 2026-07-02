# Refonte interface « tableau de bord » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser le chrome de Open-Meteo Maps vers la mise en page « tableau de bord » du prototype `weather-grid-view` (chrome sombre bleuté, carte claire encadrée, timeline bas à pastilles), sans toucher au moteur.

**Architecture:** Réhabillage + réorganisation de composants Svelte 5 présentationnels sous `src/lib/components/chrome` et `.../time`, plus deux nouveaux composants (`context-strip`, `map-actions`). Les stores, le pipeline `om://`, le SlotManager, la logique de temps et le rendu MapLibre restent inchangés. Le thème sombre du chrome repose sur le token `--glass` (dans `src/styles.css`) + `text-white`.

**Tech Stack:** SvelteKit (static), Svelte 5 runes, Tailwind v4 (`@tailwindcss/vite`, tokens dans `src/styles.css`), `@lucide/svelte`, `bits-ui`, MapLibre GL via `@cm3r/weather-map-layer`.

**Spec:** `docs/superpowers/specs/2026-07-02-refonte-interface-dashboard-design.md`

## Global Constraints

- **Svelte 5 runes uniquement** (`$state`, `$derived`, `$effect`, `$props`) — jamais la réactivité Svelte 4.
- **Éditions `.svelte`/`.svelte.ts` déléguées à l'agent `svelte-file-editor`** (plugin `svelte`) et **validées avec `svelte-autofixer`** avant tout `git add`.
- **Tailwind v4** ; tokens dans `src/styles.css` ; ne pas hardcoder des couleurs quand un token existe (`bg-glass/85`, `text-white`, `border-white/15`, accent `sky`).
- **Prettier** : tabs, single quotes, no trailing commas, 100 col ; imports auto-triés — **ne jamais ordonner les imports à la main**, lancer `npm run format`.
- **Lint** : vérifier via `rtk proxy npm run lint` (le hook rtk peut cacher un faux « OK » masquant un échec CI).
- **Alias** : `$lib/*` → `src/lib/*` ; pas de chemins relatifs inter-dossiers.
- **Ne pas régresser** le fond de carte **clair par défaut** (mode sombre opt-in) — la refonte ne touche que le chrome.
- **Chiffres tabulaires** : `tabular-nums` sur toute donnée numérique (run, échéance, index, %).
- **Titres de commit sémantiques** (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`).
- **Accessibilité** : `focus-visible:ring`, `aria-*` sur tout bouton, cibles ≥ 44 px sur mobile.

## Cycle de vérification (adapté — refonte présentationnelle)

Le repo n'a pas de tests unitaires de chrome (Vitest est réservé à la logique `$lib/*.ts`, cf. `.claude/rules/tests.md`). Chaque tâche visuelle se ferme donc par :

1. `svelte-autofixer` sur les fichiers touchés (via le plugin svelte).
2. `npm run format`
3. `npm run check` (typecheck) → **0 erreur**
4. `rtk proxy npm run lint` → **0 erreur**
5. **Capture headless** de spot-check (voir Task 9 pour le protocole) quand la tâche change le rendu.
6. `git commit`.

Aucune tâche n'introduit de fonction pure nouvelle ⇒ pas de test Vitest. Si un implémenteur extrait une fonction pure (ex. formatage de fil), il ajoute un test Vitest sous `src/lib/tests/`.

## Structure des fichiers

| Fichier                                           | Responsabilité                                                           | Nature      |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ----------- |
| `src/styles.css`                                  | Token `--glass` teinté bleuté (chrome sombre)                            | modif       |
| `src/lib/components/chrome/header.svelte`         | Fil `Variable · Modèle · Run · Validité` + badge « run en cours »        | modif       |
| `src/lib/components/chrome/context-strip.svelte`  | Bande de contexte `Variable (unité) · description` au-dessus de la carte | **nouveau** |
| `src/lib/components/chrome/map-actions.svelte`    | Cluster flottant carte : copier-lien + plein écran                       | **nouveau** |
| `src/lib/components/chrome/app-chrome.svelte`     | Câblage `context-strip` + `map-actions`                                  | modif       |
| `src/lib/components/chrome/layer-list.svelte`     | Unité alignée à droite façon proto                                       | modif       |
| `src/lib/components/time/time-selector.svelte`    | Transport en pastilles + compteur + bande restylée                       | modif       |
| `src/lib/components/chrome/advanced-panel.svelte` | Alignement palette (aucune logique)                                      | modif style |
| `src/lib/components/chrome/mobile-dock.svelte`    | Alignement palette (aucune logique)                                      | modif style |

---

## Task 1: Palette — chrome sombre bleuté

**Files:**

- Modify: `src/styles.css:102` (token `--glass` du bloc `.dark`) et `src/styles.css:67` (bloc `:root`)

**Interfaces:**

- Consumes: rien.
- Produces: un chrome au voile légèrement bleuté ; les composants continuent d'utiliser `bg-glass/…` sans changement d'API.

Le chrome utilise partout `bg-glass/85 text-white`. Le token `--glass` est aujourd'hui un gris neutre (`rgba(15,15,15)` sombre, `rgba(240,240,240)` clair). Le proto a un voile **bleuté**. On teinte `--glass` vers un bleu-nuit sombre, sans toucher aux autres tokens.

- [ ] **Step 1: Teinter le token `--glass`**

Dans `src/styles.css`, remplacer les deux déclarations `--glass` :

Bloc `.dark` (ligne ~102) :

```css
--glass: rgb(17 24 34);
```

Bloc `:root` (ligne ~67) — garder clair mais très légèrement bleuté pour cohérence si le chrome retombait en clair :

```css
--glass: rgb(232 237 244);
```

- [ ] **Step 2: `npm run format` puis `npm run check`**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 3: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Spot-check headless (protocole Task 9), viewport desktop**

Vérifier : header/sidebar/timeline prennent une teinte bleu-nuit ; texte blanc lisible ; carte claire inchangée. Calibrer la valeur `rgb()` si le bleu est trop/pas assez marqué (rester très désaturé, L proche de l'actuel `15,15,15`).

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "style(chrome): voile verre teinté bleu-nuit"
```

---

## Task 2: En-tête — fil contextuel enrichi + badge « run en cours »

**Files:**

- Modify: `src/lib/components/chrome/header.svelte`

**Interfaces:**

- Consumes: `selectedVariable`, `selectedDomain` (`$lib/stores/variables`) ; `modelRun`, `time`, `inProgress` (`$lib/stores/time`) ; `translateVariableLabel` (`$lib/i18n/variables-fr`) ; formatteurs de `$lib/time-format` (`formatUTCTime`/`formatUTCDateTime` — vérifier les noms exacts exportés).
- Produces: rien (composant terminal).

Le fil actuel montre `variable · modèle`. On l'enrichit en `Variable · Modèle · Run · Validité`, et on ajoute un badge quand le run affiché est le run en cours de génération.

- [ ] **Step 1: Ajouter les dérivations run/validité + inProgress**

Dans `<script>` de `header.svelte`, après `domainLabel`, ajouter (déléguer à `svelte-file-editor`) :

```svelte
import {(inProgress, modelRun, time)} from '$lib/stores/time'; import {(formatUTCDateTime,
formatUTCTime)} from '$lib/time-format'; const runLabel = $derived($modelRun ? formatUTCTime($modelRun)
: ''); const validLabel = $derived(formatUTCDateTime($time)); // Badge « run en cours » : le run affiché
correspond au run encore en génération. const runIsInProgress = $derived( !!$modelRun && !!$inProgress?.reference_time
&& new Date($inProgress.reference_time).getTime() === $modelRun.getTime() );
```

> Vérifier le champ exact du run en cours dans `DomainMetaDataJson` (`reference_time` supposé) et les noms de formatteurs — ajuster à ce qui existe dans `$lib/time-format` / le type `metaJson`.

- [ ] **Step 2: Étendre le fil dans le markup**

Remplacer le bloc `{#if variableLabel}…{/if}` par un fil enrichi :

```svelte
{#if variableLabel}
	<p
		class="hidden min-w-0 flex-1 truncate px-2 text-center text-sm text-white/50 md:block"
		title={`${variableLabel}${domainLabel ? ` · ${domainLabel}` : ''}`}
	>
		<span class="font-medium text-white">{variableLabel}</span>
		{#if domainLabel}<span> · {domainLabel}</span>{/if}
		{#if runLabel}<span class="tabular-nums"> · Run {runLabel}</span>{/if}
		{#if validLabel}<span class="tabular-nums"> · {validLabel}</span>{/if}
		{#if runIsInProgress}
			<span
				class="ml-2 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-300 uppercase"
			>
				Run en cours
			</span>
		{/if}
	</p>
{/if}
```

- [ ] **Step 3: `svelte-autofixer` + `npm run format` + `npm run check`**

Run: `npm run format && npm run check`
Expected: 0 erreur (si un formatteur/champ n'existe pas, l'erreur de type le signale → corriger le nom).

- [ ] **Step 4: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 5: Spot-check headless (desktop)**

Vérifier le fil `Température 2 m · AROME France · Run 06:00 · <date> ` centré, tronqué proprement ; badge ambre visible si run en cours.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/chrome/header.svelte
git commit -m "feat(chrome): fil d'en-tête variable · modèle · run · validité + badge run en cours"
```

---

## Task 3: Bande de contexte carte (`context-strip.svelte`)

**Files:**

- Create: `src/lib/components/chrome/context-strip.svelte`
- Modify: `src/lib/components/chrome/app-chrome.svelte`

**Interfaces:**

- Consumes: `selectedVariable` (`$lib/stores/variables`), `translateVariableLabel` (`$lib/i18n/variables-fr`).
- Produces: composant sans props, à monter en tête de la zone carte.

- [ ] **Step 1: Créer `context-strip.svelte`**

```svelte
<script lang="ts">
	import { selectedVariable } from '$lib/stores/variables';

	import { translateVariableLabel } from '$lib/i18n/variables-fr';

	const label = $derived($selectedVariable ? translateVariableLabel($selectedVariable.label) : '');
	const unit = $derived($selectedVariable?.unit ?? '');
	const description = $derived($selectedVariable?.description ?? '');
</script>

{#if label}
	<!-- Bande de contexte : rappelle « qu'est-ce que je regarde ? » juste au-dessus
	     de la carte. Masquée si aucune variable. -->
	<div
		class="bg-glass/70 flex h-[26px] shrink-0 items-center gap-2 border-b border-white/10 px-3 text-xs text-white/60 glass-blur"
	>
		<span class="font-medium text-white">{label}</span>
		{#if unit}<span class="text-white/45">({unit})</span>{/if}
		{#if description}
			<span class="text-white/30">·</span>
			<span class="truncate">{description}</span>
		{/if}
	</div>
{/if}
```

> Vérifier les champs réels de l'objet variable (`label`, `unit`, `description`) dans le type consommé par `selectedVariable` ; adapter si nécessaire.

- [ ] **Step 2: Monter la bande dans `app-chrome.svelte`**

`app-chrome` monte aujourd'hui `Header`, `Sidebar`/`MobileDock`, `AdvancedPanel`. La bande de contexte doit apparaître **en haut de la zone carte** (sous le header, décalée par la sidebar). Ajouter l'import et un conteneur fixe calé sur `sidebarWidth` :

```svelte
import {sidebarWidth} from '$lib/stores/preferences'; import ContextStrip from './context-strip.svelte';
```

Puis, après `<Header>…</Header>` :

```svelte
<!-- Bande de contexte : sous le header (44px), décalée à droite par la sidebar. -->
<div
	class="fixed top-11 right-0 z-40 transition-[left] duration-200 motion-reduce:transition-none"
	style="left: {desktop.current ? $sidebarWidth : 0}px"
>
	<ContextStrip />
</div>
```

> Importer `desktop` depuis `$lib/stores/preferences` (déjà importé dans le fichier). Vérifier que `z-40` passe sous header (`z-60`) mais au-dessus de la carte.

- [ ] **Step 3: `svelte-autofixer` + format + check**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 4: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 5: Spot-check headless (desktop + mobile)**

Desktop : bande alignée au bord de la sidebar, se décale quand on replie la sidebar. Mobile : pleine largeur, ne masque pas les contrôles MapLibre.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/chrome/context-strip.svelte src/lib/components/chrome/app-chrome.svelte
git commit -m "feat(chrome): bande de contexte variable au-dessus de la carte"
```

---

## Task 4: Actions flottantes carte (`map-actions.svelte`)

**Files:**

- Create: `src/lib/components/chrome/map-actions.svelte`
- Modify: `src/lib/components/chrome/app-chrome.svelte`

**Interfaces:**

- Consumes: rien (lit `window.location`, `document`).
- Produces: cluster flottant top-droite. **Desktop uniquement** (mobile a déjà le FAB capture + contrôles MapLibre ; on évite d'encombrer le pouce).

> **Décision de raffinement** : la capture reste dans le header (desktop) / FAB (mobile) — inchangée. Le cluster flottant se limite à **copier-lien + plein écran** pour éviter de dupliquer le bouton capture (le spec §4 autorise explicitement cette réduction).

- [ ] **Step 1: Créer `map-actions.svelte`**

```svelte
<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import MaximizeIcon from '@lucide/svelte/icons/maximize';
	import MinimizeIcon from '@lucide/svelte/icons/minimize';

	let copied = $state(false);
	let isFullscreen = $state(false);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* presse-papier indisponible : silencieux */
		}
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			void document.documentElement.requestFullscreen?.();
		} else {
			void document.exitFullscreen?.();
		}
	}

	$effect(() => {
		const onChange = () => (isFullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});
</script>

<div class="absolute top-3 right-3 z-40 flex gap-1">
	<button
		type="button"
		onclick={copyLink}
		aria-label="Copier le lien de la vue"
		title="Copier le lien"
		class="bg-glass/85 hover:bg-glass/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 text-white shadow-md glass-blur"
	>
		{#if copied}
			<CheckIcon class="size-4 text-emerald-400" aria-hidden="true" />
		{:else}
			<LinkIcon class="size-4" aria-hidden="true" />
		{/if}
	</button>
	<button
		type="button"
		onclick={toggleFullscreen}
		aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
		title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
		class="bg-glass/85 hover:bg-glass/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 text-white shadow-md glass-blur"
	>
		{#if isFullscreen}
			<MinimizeIcon class="size-4" aria-hidden="true" />
		{:else}
			<MaximizeIcon class="size-4" aria-hidden="true" />
		{/if}
	</button>
</div>
```

> Vérifier que les noms d'icônes Lucide existent (`link`, `maximize`, `minimize`, `check`) dans `@lucide/svelte/icons/*` ; ajuster sinon.

- [ ] **Step 2: Monter dans `app-chrome.svelte` (desktop uniquement)**

```svelte
import MapActions from './map-actions.svelte';
```

Dans la branche `{#if desktop.current}`, ajouter :

```svelte
<MapActions />
```

> Le cluster est en `absolute` : il se place par rapport au conteneur carte positionné (`#map_container`). Vérifier au spot-check qu'il apparaît bien en haut-droite de la carte et non collé au viewport ; si le parent n'est pas positionné, remonter le montage dans le conteneur carte de `+page.svelte`.

- [ ] **Step 3: `svelte-autofixer` + format + check**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 4: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 5: Spot-check headless (desktop)**

Cluster en haut-droite, sous le header, ne recouvre pas la bande de contexte. Clic « copier » → icône ✓ 1,5 s. Bouton plein écran bascule l'icône.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/chrome/map-actions.svelte src/lib/components/chrome/app-chrome.svelte
git commit -m "feat(chrome): actions flottantes carte (copier-lien, plein écran)"
```

---

## Task 5: Sidebar — unité alignée à droite dans `layer-list`

**Files:**

- Modify: `src/lib/components/chrome/layer-list.svelte`

**Interfaces:**

- Consumes: la source de calques/variables déjà utilisée par `layer-list`.
- Produces: rien.

Aligner l'unité de chaque calque à droite (`libellé …… °C`) façon proto. **Aucune section « Zone » à ajouter** (inexistante). Purement visuel.

- [ ] **Step 1: Lire `layer-list.svelte` et repérer le rendu d'un item**

Identifier la ligne qui rend un calque/variable. Ajouter l'unité à droite via `flex justify-between` :

```svelte
<span class="flex-1 truncate">{label}</span>
<span class="ml-2 shrink-0 text-[11px] text-white/45 tabular-nums">{unit}</span>
```

> Adapter aux noms de variables locales réels (`label`, `unit`) et au wrapper existant (`flex items-center`). Ne pas casser le toggle/clic existant.

- [ ] **Step 2: `svelte-autofixer` + format + check**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 3: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Spot-check headless (desktop)**

Unités alignées à droite, libellés tronqués sans déborder ; état sélectionné inchangé.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/chrome/layer-list.svelte
git commit -m "style(chrome): unité alignée à droite dans la liste des calques"
```

---

## Task 6: Timeline — transport en pastilles + compteur + bande restylée

> **ABANDONNÉ (2026-07-02)** — non livré. Recoloration puis pastilles discrètes jugées non satisfaisantes ; le sélecteur de temps d'origine est conservé tel quel. Tâche laissée ici pour trace.

**Files:**

- Modify: `src/lib/components/time/time-selector.svelte`

**Interfaces:**

- Consumes: contrôles existants du fichier (`previousHour`, `nextHour`, jump début/fin, `PlaybackButton`, `PrefetchButton`, `timeSteps`, `currentIndex`, `centerDateButton`).
- Produces: rien. **Logique de navigation inchangée** — uniquement l'habillage.

> **Contrainte** : ne PAS modifier la logique run/jour/heure/anomalie ni `checkClosestModelRun`. On restyle les boutons et on réutilise `PrefetchButton` à l'emplacement « vitesse » du proto (mode de plage : Aujourd'hui / 24 h / Run complet). Pas de Lent/Normal/Rapide.

- [ ] **Step 1: Lire le markup actuel de la barre de transport et de la bande**

Repérer : (a) les boutons de transport, (b) l'emplacement de `PlaybackButton` et `PrefetchButton`, (c) la bande scrollable de dates (`timeSteps`), (d) tout compteur existant.

- [ ] **Step 2: Restyler les boutons de transport en pastilles**

Uniformiser début/précédent/play/suivant/fin en pastilles (play accentué). Classe de base :

```svelte
class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 inline-flex
size-7 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-white/[0.06]
text-white/80 hover:text-white"
```

Play accentué :

```svelte
class="… border-sky-400/50 bg-sky-400/20 text-sky-200"
```

> Conserver les `onclick`/`title`/`aria-label` existants. `PlaybackButton` garde sa logique ; l'habiller de la pastille accentuée si l'intégration le permet, sinon laisser tel quel.

- [ ] **Step 3: Placer le contrôle de plage (`PrefetchButton`) à l'emplacement « vitesse »**

Vérifier que `PrefetchButton` est bien rendu dans la barre ; le grouper visuellement après le transport, séparé par un `<div class="mx-2 h-5 w-px bg-white/15">`. Aucun changement de logique.

- [ ] **Step 4: Ajouter/aligner le compteur à droite**

À droite de la rangée transport, un compteur `tabular-nums` :

```svelte
<div class="ml-auto text-xs text-white/50 tabular-nums">
	Échéance <span class="font-medium text-white">{currentLabel}</span>
	· {currentIndex + 1}/{timeSteps.length}
</div>
```

> `currentLabel` = libellé date/heure de l'échéance courante (réutiliser le formatage déjà présent). **« préchargé % » : n'ajouter QUE si un état de préchargement est déjà exposé dans le composant** ; sinon l'omettre (follow-up spec, ne pas bloquer).

- [ ] **Step 5: Restyler les pastilles-dates de la bande**

Chaque bouton de date en pastille — actif / manquant :

```svelte
class={[
	'inline-flex shrink-0 flex-col items-center justify-center rounded-md border text-[10px] tabular-nums transition-colors',
	'h-8 w-10',
	isActive
		? 'border-sky-400 bg-sky-400/20 text-sky-200'
		: isMissing
			? 'border-dashed border-amber-500/40 text-amber-400/70 hover:bg-amber-500/10'
			: 'border-white/15 bg-white/[0.04] text-white/60 hover:border-white/30 hover:text-white'
]
	.filter(Boolean)
	.join(' ')}
```

> Mapper `isActive`/`isMissing` sur les conditions déjà utilisées dans la bande. **Ne pas toucher** au `centerDateButton`/scroll ni aux `onclick`.

- [ ] **Step 6: `svelte-autofixer` + format + check**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 7: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 8: Spot-check headless (desktop + mobile) + non-régression**

Vérifier : transport en pastilles, play accentué ; contrôle de plage présent ; compteur à droite ; bande restylée, pastille active centrée, état manquant en pointillés ambre. **Non-régression** : ← → changent d'échéance, play anime en boucle, changement de run recale correctement (piloter manuellement en `npm run dev` si besoin).

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/time/time-selector.svelte
git commit -m "style(time): timeline en pastilles façon tableau de bord (logique inchangée)"
```

---

## Task 7: Tiroir Avancé + bottom-sheet mobile — alignement palette

**Files:**

- Modify: `src/lib/components/chrome/advanced-panel.svelte`
- Modify: `src/lib/components/chrome/mobile-dock.svelte`

**Interfaces:**

- Consumes: —
- Produces: —

Purement cosmétique : le token `--glass` teinté (Task 1) propage déjà le bleuté. Cette tâche vérifie la cohérence et corrige tout écart ponctuel (couleurs d'accent codées en dur type `text-sky-300` → OK à garder ; fonds `bg-white/[0.04]` → OK).

- [ ] **Step 1: Revue visuelle des deux panneaux**

Ouvrir tiroir Avancé (desktop) et bottom-sheet mobile ; repérer toute couleur qui jure avec le nouveau voile bleuté (ex. un `backdrop-blur-md` neutre vs `glass-blur`). Corriger uniquement les écarts (préférer `glass-blur` + `bg-glass/…` aux `backdrop-blur-*` ad hoc si un écart de teinte apparaît).

- [ ] **Step 2: `svelte-autofixer` + format + check**

Run: `npm run format && npm run check`
Expected: 0 erreur.

- [ ] **Step 3: Lint**

Run: `rtk proxy npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Spot-check headless (desktop tiroir + mobile sheet)**

Teinte cohérente avec header/sidebar/timeline ; texte lisible.

- [ ] **Step 5: Commit (si des écarts ont été corrigés)**

```bash
git add src/lib/components/chrome/advanced-panel.svelte src/lib/components/chrome/mobile-dock.svelte
git commit -m "style(chrome): tiroir avancé et bottom-sheet alignés sur le voile bleuté"
```

> Si aucun écart n'a été trouvé, ne rien committer et cocher la tâche comme « vérifiée, aucun changement nécessaire ».

---

## Task 8: Passe finale format/check/lint globale

**Files:** —

- [ ] **Step 1: Format + check + lint sur tout le repo**

Run: `npm run format && npm run check && rtk proxy npm run lint`
Expected: 0 erreur, arbre de travail propre après format.

- [ ] **Step 2: Committer un éventuel reformat résiduel**

```bash
git add -A
git commit -m "style: reformat après refonte tableau de bord" || echo "rien à committer"
```

---

## Task 9: Vérification headless finale (desktop + mobile)

**Files:** —

Protocole headless (playwright-core + Chrome système + swiftshader, cf. mémoire `headless-map-verification`). Aucun script dédié dans le repo → écrire un script jetable sous le scratchpad.

- [ ] **Step 1: Lancer le serveur de dev**

Run (background) : `npm run dev`
Noter l'URL locale (par défaut `http://localhost:5173`).

- [ ] **Step 2: Écrire un script de capture jetable**

Créer `<scratchpad>/shot.mjs` : lance playwright-core sur le Chrome système avec `--use-gl=swiftshader`, **seed le localStorage** avant chargement (attention au piège `breakpoints=true` qui court-circuite `contourInterval`), navigue sur l'URL avec `?domain=…&variable=…&model_run=…&time=…`, attend l'idle carte, capture en **viewport desktop (1440×900)** puis **mobile (390×844)**.

- [ ] **Step 3: Capturer et inspecter**

Run: `node <scratchpad>/shot.mjs`
Vérifier sur les deux captures, contre le wireframe validé :

- En-tête : fil `Variable · Modèle · Run · Validité` (+ badge run en cours si applicable).
- Sidebar : Modèle / Calques (unités à droite) / Affichage / Style / Aide ; repli en rail OK.
- Bande de contexte alignée au bord de la sidebar, se décale au repli.
- Actions flottantes (copier-lien, plein écran) en haut-droite desktop.
- Timeline : transport pastilles, play accentué, contrôle de plage, compteur, bande restylée (actif centré, manquant pointillés).
- Contraste chrome bleu-nuit / carte claire.
- Mobile : bottom-sheet réhabillé, cibles ≥ 44 px, pas de chevauchement.

- [ ] **Step 4: Corriger toute régression visuelle**

Si un écart avec le wireframe apparaît, revenir à la tâche concernée, corriger, re-capturer.

- [ ] **Step 5: Arrêter le dev + nettoyer le scratchpad**

Arrêter `npm run dev`. Le script `shot.mjs` reste dans le scratchpad (non versionné).

- [ ] **Step 6: Mettre à jour la doc scoped si la structure a bougé**

Si l'ajout de `context-strip`/`map-actions` change l'organisation du chrome décrite dans `.claude/rules/components.md` ou l'architecture dans `.claude/rules/architecture.md`, mettre à jour la doc **dans ce même commit** (règle « Keeping these docs in sync » du CLAUDE.md).

```bash
git add -A
git commit -m "docs(rules): refonte chrome tableau de bord (context-strip, map-actions)" || echo "rien à committer"
```

---

## Self-review (couverture spec)

- §1 En-tête → Task 2 ✓
- §2 Sidebar (ordre sections, repli rail) → existant + Task 5 (unités) ✓ ; ordre déjà conforme (Modèle→Calques→Affichage→Style→Aide), pas de « Zone » ✓
- §3 Bande de contexte → Task 3 ✓
- §4 Actions flottantes → Task 4 ✓ (raffinement : copier-lien + plein écran ; capture reste au header/FAB)
- §5 Timeline → Task 6 ✓ (plage réutilisée, pas de vitesse ; « préchargé % » conditionnel)
- §6 Thème/palette → Task 1 ✓
- §7 Tiroir Avancé → Task 7 ✓
- §8 Mobile → Task 7 + vérif Task 9 ✓
- §9 Orchestration → Tasks 3 & 4 (câblage `app-chrome`) ✓
- Vérification → Task 8 (statique) + Task 9 (headless) ✓
