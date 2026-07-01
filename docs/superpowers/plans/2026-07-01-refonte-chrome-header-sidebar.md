# Refonte chrome header + sidebar (façon precip.ai) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la barre haute flottante par un header fin pleine largeur + une sidebar gauche repliable (desktop) / un bottom-sheet à onglets (mobile), conformément à la spec `docs/superpowers/specs/2026-07-01-refonte-interface-precip-design.md`.

**Architecture:** Réorganisation du _chrome_ uniquement — le moteur (`om://`, SlotManager, stores de données, playback, popup, soundings) est intouché. Nouveaux composants `chrome/header.svelte`, `chrome/sidebar.svelte`, `chrome/layer-list.svelte`, `chrome/display-section.svelte`, `chrome/style-section.svelte` ; `advanced-panel.svelte` allégé (ouvert depuis le header) ; `mobile-dock.svelte` réécrit en bottom-sheet ; `top-bar.svelte` et `variable-tabs.svelte` supprimés. La logique de liste de variables est extraite en fonctions pures testées (`src/lib/layer-list.ts`).

**Tech Stack:** SvelteKit (static), Svelte 5 runes, Tailwind v4, shadcn-svelte (`ui/`), Lucide, `svelte-persisted-store`, Vitest (node, logique pure uniquement).

## Global Constraints

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`) — jamais de syntaxe Svelte 4.
- **Tokens existants uniquement** : `bg-glass/*`, utilitaire `glass-blur`, accent `sky` (`text-sky-300`, `accent-sky-400`), focus `focus-visible:ring-2 focus-visible:ring-white/70`. Aucun hex en dur dans les composants. Pas de nouveau système de tokens.
- **Icônes** : `@lucide/svelte/icons/*` exclusivement. Jamais d'emoji comme icône.
- **Cibles tactiles ≥ 44 px sur mobile** : pattern `h-11 md:h-8` / `min-h-11 md:min-h-9` (déjà utilisé dans le code). Gap ≥ 8 px.
- **`prefers-reduced-motion`** : transitions JS gardées par `new MediaQuery('(prefers-reduced-motion: reduce)')` → `duration: 0` ; transitions CSS avec `motion-reduce:transition-none`. Durées 150–300 ms.
- **Chiffres tabulaires** : classe Tailwind `tabular-nums` sur les conteneurs de données numériques (héritée — `font-variant-numeric` est héritable).
- **Textes UI en français** (« Carte », « Réglages », « Réglages carte », « Calques », « Affichage », « Style »).
- **Avant chaque commit** : `npm run format` (imports auto-triés — ne jamais ordonner à la main) puis `npm run check`. Lint : **`rtk proxy npm run lint`** (rtk met en cache la sortie de lint → un `npm run lint` via rtk peut afficher un faux OK).
- **Commits sémantiques** (`feat:`, `refactor:`, `docs:`…) — titres de PR vérifiés par CI.
- **Moteur intouché** : ne pas modifier `layers.ts`, `slot-manager.ts`, `url.ts`, `om-protocol-settings.ts` (seul `map-controls.ts` change, Task 7).
- Breakpoint desktop existant : `desktop = new MediaQuery('min-width: 768px')` (`stores/preferences.ts`).
- **Tests** : Vitest ne collecte que `src/lib/tests/**`, environnement `node` → tests de logique pure uniquement (pas de test de composant). La vérification des composants passe par `npm run check` + vérification manuelle listée dans chaque tâche.
- **Fenêtre transitoire assumée** : entre Task 4 et Task 5, certains toggles ne sont plus accessibles sur mobile (ils ont quitté le panneau Avancé, le bottom-sheet n'existe pas encore). Acceptable sur la branche (livraison en une PR) — ne pas « corriger » en dupliquant.

---

### Task 1: Logique pure de liste de variables (`src/lib/layer-list.ts`)

Extrait les trois dérivations de `variable-tabs.svelte` (liste pliée par préfixe, groupes de niveaux filtrés/triés, groupage par catégorie) en fonctions pures testées, puis refactore `variable-tabs.svelte` pour les consommer. Prépare `chrome/layer-list.svelte` (Task 3) sans dupliquer la logique.

**Files:**

- Create: `src/lib/layer-list.ts`
- Test: `src/lib/tests/layer-list.test.ts`
- Modify: `src/lib/components/chrome/variable-tabs.svelte:50-111` et `:136-148` (consomme les fonctions extraites)

**Interfaces:**

- Consumes: `LEVEL_PREFIX`, `LEVEL_REGEX`, `LEVEL_UNIT_REGEX`, `variableOptions` (`@openmeteo/weather-map-layer`) ; `HIDDEN_VARIABLES`, `VISIBLE_PRESSURE_LEVELS_HPA` (`$lib/constants`) ; `sortLevels` (`$lib/level-groups`) ; `CATEGORIES`, `categorize`, type `Category` (`$lib/variable-categories`).
- Produces (utilisé par Task 3) :
  - `buildVariableList(metaVariables: string[]): string[]`
  - `buildLevelGroups(metaVariables: string[]): Record<string, { value: string; label: string }[]>`
  - `groupVariablesByCategory(list: string[]): { cat: Category; items: string[] }[]`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/tests/layer-list.test.ts` :

```ts
import { LEVEL_PREFIX } from '@openmeteo/weather-map-layer';
import { describe, expect, it } from 'vitest';

import { buildLevelGroups, buildVariableList, groupVariablesByCategory } from '$lib/layer-list';

// Échantillon réaliste : surface, cumul, variable masquée, groupe de niveaux
// (2 m + hPa dont un hors whitelist), composantes vent.
const META_VARIABLES = [
	'temperature_2m',
	'precipitation',
	'precipitation_type', // HIDDEN_VARIABLES
	'temperature_850hPa',
	'temperature_500hPa',
	'temperature_150hPa' // hors VISIBLE_PRESSURE_LEVELS_HPA (1000…200)
];

// Préfixe de groupe calculé par la même regex que le runtime (contrat de pliage).
const TEMP_PREFIX = 'temperature_850hPa'.match(LEVEL_PREFIX)!.groups!.prefix!;

describe('buildVariableList', () => {
	it('plie les niveaux sur leur préfixe, exclut les variables masquées', () => {
		const list = buildVariableList([...META_VARIABLES]);
		expect(list).toContain('precipitation');
		expect(list).not.toContain('precipitation_type');
		// un seul item pour tout le groupe température, pas les niveaux individuels
		expect(list.filter((v) => v.startsWith('temperature'))).toEqual([TEMP_PREFIX]);
	});
});

describe('buildLevelGroups', () => {
	it('filtre les hPa hors whitelist et trie par altitude croissante', () => {
		const groups = buildLevelGroups([...META_VARIABLES]);
		const values = groups[TEMP_PREFIX].map((o) => o.value);
		expect(values).toContain('temperature_850hPa');
		expect(values).toContain('temperature_500hPa');
		expect(values).not.toContain('temperature_150hPa');
		// altitude croissante : 2 m < 850 hPa < 500 hPa
		expect(values.indexOf('temperature_2m')).toBeLessThan(values.indexOf('temperature_850hPa'));
		expect(values.indexOf('temperature_850hPa')).toBeLessThan(values.indexOf('temperature_500hPa'));
	});
});

describe('groupVariablesByCategory', () => {
	it('groupe par catégorie et exclut composantes _v_ et directions', () => {
		const grouped = groupVariablesByCategory([
			'temperature_2m',
			'precipitation',
			'wind_v_component_10m',
			'wind_direction_10m'
		]);
		const all = grouped.flatMap((g) => g.items);
		expect(all).not.toContain('wind_v_component_10m');
		expect(all).not.toContain('wind_direction_10m');
		expect(grouped.find((g) => g.cat.key === 'temperature')?.items).toContain('temperature_2m');
		expect(grouped.find((g) => g.cat.key === 'precipitation')?.items).toContain('precipitation');
	});
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/lib/tests/layer-list.test.ts`
Expected: FAIL — `Cannot find module '$lib/layer-list'` (ou équivalent).

- [ ] **Step 3: Implémenter `src/lib/layer-list.ts`**

```ts
import {
	LEVEL_PREFIX,
	LEVEL_REGEX,
	LEVEL_UNIT_REGEX,
	variableOptions
} from '@openmeteo/weather-map-layer';

import { HIDDEN_VARIABLES, VISIBLE_PRESSURE_LEVELS_HPA } from '$lib/constants';
import { sortLevels } from '$lib/level-groups';
import { CATEGORIES, type Category, categorize } from '$lib/variable-categories';

export interface VariableOption {
	value: string;
	label: string;
}

/**
 * Liste des variables affichables : groupes de niveaux repliés sur leur préfixe,
 * variables masquées (HIDDEN_VARIABLES) exclues. Logique extraite telle quelle
 * de l'ancien `variable-tabs.svelte`.
 */
export function buildVariableList(metaVariables: string[]): string[] {
	const variables: string[] = [];
	for (const mjVariable of metaVariables) {
		if (HIDDEN_VARIABLES.includes(mjVariable)) continue;
		if (mjVariable.match(LEVEL_REGEX)) {
			const prefix = mjVariable.match(LEVEL_PREFIX)?.groups?.prefix;
			if (prefix) {
				if (!variables.includes(prefix)) variables.push(prefix);
				continue;
			}
		}
		variables.push(mjVariable);
	}
	return variables;
}

/**
 * Groupes de niveaux : préfixe → options triées par altitude croissante.
 * Les niveaux hPa hors VISIBLE_PRESSURE_LEVELS_HPA sont filtrés (affichage
 * seulement) ; les hauteurs (m) passent toujours.
 */
export function buildLevelGroups(metaVariables: string[]): Record<string, VariableOption[]> {
	const visible = new Set<number>(VISIBLE_PRESSURE_LEVELS_HPA);
	const groups: Record<string, VariableOption[]> = {};
	for (const mjVariable of metaVariables) {
		if (!mjVariable.match(LEVEL_REGEX)?.groups) continue;
		const prefix = mjVariable.match(LEVEL_PREFIX)?.groups?.prefix;
		if (!prefix) continue;
		const unitMatch = mjVariable.match(LEVEL_UNIT_REGEX);
		if (unitMatch?.groups?.unit === 'hPa' && !visible.has(Number(unitMatch.groups.level))) {
			continue;
		}
		const option = variableOptions.find(({ value }) => value === mjVariable) ?? {
			value: mjVariable,
			label: mjVariable
		};
		(groups[prefix] ??= []).push(option);
	}
	for (const prefix of Object.keys(groups)) {
		groups[prefix] = sortLevels(groups[prefix]);
	}
	return groups;
}

/**
 * Variables groupées par catégorie (ordre = CATEGORIES) ; composantes `_v_`
 * et `_direction` exclues (dérivées, jamais affichées directement).
 */
export function groupVariablesByCategory(list: string[]): { cat: Category; items: string[] }[] {
	const groups: { cat: Category; items: string[] }[] = [];
	for (const cat of CATEGORIES) {
		const items = list.filter(
			(v) => !v.includes('_v_') && !v.includes('_direction') && categorize(v) === cat.key
		);
		if (items.length) groups.push({ cat, items });
	}
	return groups;
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run src/lib/tests/layer-list.test.ts`
Expected: PASS (3 tests). Si le test de pliage échoue sur `TEMP_PREFIX`, inspecter la valeur réelle de `LEVEL_PREFIX` — ne pas modifier l'implémentation pour forcer le test : la fonction doit reproduire exactement l'ancien comportement de `variable-tabs.svelte`.

- [ ] **Step 5: Refactorer `variable-tabs.svelte` pour consommer les fonctions**

Dans `src/lib/components/chrome/variable-tabs.svelte` :

1. Remplacer le bloc `let variableList = $derived.by(() => { … })` (lignes ~50-71) par :

```ts
// Liste de variables, avec les groupes de niveaux repliés sur leur préfixe.
let variableList = $derived($metaJson ? buildVariableList($metaJson.variables) : undefined);
```

2. Remplacer le bloc `const levelGroupsList = $derived.by(() => { … })` (lignes ~73-111, y compris `const visiblePressureLevels`) par :

```ts
const levelGroupsList = $derived($metaJson ? buildLevelGroups($metaJson.variables) : undefined);
```

3. Remplacer le bloc `let groupedVariables = $derived.by(() => { … })` (lignes ~136-148) par :

```ts
// Variables disponibles groupées par catégorie pour le sélecteur.
let groupedVariables = $derived(groupVariablesByCategory(variableList ?? []));
```

4. Ajouter l'import `import { buildLevelGroups, buildVariableList, groupVariablesByCategory } from '$lib/layer-list';` et supprimer les imports devenus inutilisés : `LEVEL_PREFIX`, `LEVEL_REGEX` (garder `LEVEL_UNIT_REGEX`), `HIDDEN_VARIABLES`, `VISIBLE_PRESSURE_LEVELS_HPA`, `sortLevels` (garder `pickDefaultLevel`), `CATEGORIES` (garder `type CategoryKey, categorize`).

- [ ] **Step 6: Vérifier check + tests complets**

Run: `npm run format && npm run check && npm run test -- --run`
Expected: 0 erreur svelte-check ; tous les tests passent.

- [ ] **Step 7: Vérification manuelle rapide**

Run: `npm run dev` — ouvrir `http://localhost:5173`, vérifier que le sélecteur de variable de la barre haute liste les mêmes variables qu'avant (catégories, groupes de niveaux, niveau par défaut 2 m).

- [ ] **Step 8: Commit**

```bash
git add src/lib/layer-list.ts src/lib/tests/layer-list.test.ts src/lib/components/chrome/variable-tabs.svelte
git commit -m "refactor(chrome): extrait la logique de liste de variables dans layer-list.ts"
```

---

### Task 2: Header fin façon precip.ai (`chrome/header.svelte`)

Header pleine largeur (~44 px, verre sombre) : logo Infoclimat, onglet « Carte » en pilule (réserve l'emplacement des futures pages), bouton « ⚙ Réglages » à droite qui toggle `advancedOpen`. Monté sur desktop **et** mobile. Les chromes existants (top-bar flottante, pastille modèle mobile) descendent sous le header en attendant les tâches suivantes.

**Files:**

- Create: `src/lib/components/chrome/header.svelte`
- Modify: `src/lib/components/chrome/app-chrome.svelte` (montage)
- Modify: `src/lib/components/chrome/top-bar.svelte:18` (`top-2.5` → `top-14`, transitoire)
- Modify: `src/lib/components/chrome/mobile-dock.svelte` (retrait du logo — il vit dans le header ; pastille modèle `top-2.5` → `top-14`)

**Interfaces:**

- Consumes: `advancedOpen` (`$lib/stores/preferences`, `Writable<boolean>` existant).
- Produces: `<Header />` sans props. Hauteur fixe **44 px** (`h-11`) — constante reprise par la sidebar (Task 3 : `top-11`) et l'ancrage du panneau Avancé (Task 7 : `top: 52px`).

- [ ] **Step 1: Créer `src/lib/components/chrome/header.svelte`**

```svelte
<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings-2';

	import { advancedOpen } from '$lib/stores/preferences';

	const SITE_URL = 'https://www.infoclimat.fr';
	const LOGO_URL = 'https://static.infoclimat.net/images/v5.1/logo_IC_5.1.png';
</script>

<!-- Header fin pleine largeur (44 px), calqué sur app.precip.ai/map :
     marque à gauche, onglets pilule (un seul en v1 — réserve l'emplacement
     des futures pages), « Réglages » à droite (ouvre le panneau Avancé). -->
<header
	class="bg-glass/45 fixed inset-x-0 top-0 z-60 flex h-11 items-center gap-3 border-b border-white/15 px-2.5 shadow-lg glass-blur"
>
	<a href={SITE_URL} title="Infoclimat" rel="noopener" class="flex h-11 shrink-0 items-center">
		<img src={LOGO_URL} alt="Infoclimat" class="h-6 w-auto" crossorigin="anonymous" />
	</a>

	<nav aria-label="Navigation principale" class="flex items-center">
		<span
			aria-current="page"
			class="rounded-full bg-white/12 px-3 py-1 text-sm font-medium text-white"
		>
			Carte
		</span>
	</nav>

	<button
		type="button"
		onclick={() => advancedOpen.update((v) => !v)}
		aria-label="Réglages avancés"
		class="bg-glass/50 hover:bg-glass/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ml-auto flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white shadow-md md:h-8"
	>
		<SettingsIcon class="size-4" aria-hidden="true" />
		<span class="hidden sm:inline">Réglages</span>
	</button>
</header>
```

- [ ] **Step 2: Monter le header dans `app-chrome.svelte`**

Remplacer le contenu de `src/lib/components/chrome/app-chrome.svelte` par :

```svelte
<script lang="ts">
	import { desktop } from '$lib/stores/preferences';

	import CaptureFlow from '$lib/components/capture/capture-flow.svelte';

	import AdvancedPanel from './advanced-panel.svelte';
	import Header from './header.svelte';
	import MobileDock from './mobile-dock.svelte';
	import TopBar from './top-bar.svelte';
</script>

<Header />

{#if desktop.current}
	<TopBar>
		{#snippet capture()}<CaptureFlow />{/snippet}
		{#snippet advanced()}<AdvancedPanel />{/snippet}
	</TopBar>
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
		{#snippet advanced()}<AdvancedPanel />{/snippet}
	</MobileDock>
{/if}
```

- [ ] **Step 3: Descendre les chromes existants sous le header (transitoire)**

Dans `top-bar.svelte` ligne 18, remplacer `fixed top-2.5 left-1/2` par `fixed top-14 left-1/2`.

Dans `mobile-dock.svelte` :

- Supprimer entièrement le bloc logo (commentaire `<!-- Logo Infoclimat, coin haut-gauche … -->` + le `<a … >…</a>`, lignes ~19-29) et les constantes `SITE_URL` / `LOGO_URL` devenues inutilisées.
- Dans le conteneur de la pastille modèle, remplacer `top-2.5` par `top-14`.

- [ ] **Step 4: Vérifier**

Run: `npm run format && npm run check`
Expected: 0 erreur.

Run: `npm run dev` — vérifier à 1440 px ET à 375 px (devtools) : header visible en haut (logo + pilule « Carte » + bouton Réglages), le bouton ⚙ ouvre/ferme le panneau « Calques & réglages » existant, l'ancienne barre flottante est lisible sous le header, rien ne se chevauche.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/chrome/header.svelte src/lib/components/chrome/app-chrome.svelte src/lib/components/chrome/top-bar.svelte src/lib/components/chrome/mobile-dock.svelte
git commit -m "feat(chrome): header fin façon precip.ai (logo, onglet Carte, bouton Réglages)"
```

---

### Task 3: Sidebar desktop repliable + liste verticale des calques

Bascule le desktop sur la disposition cible : sidebar gauche sous le header (sections Modèle + Calques), suppression de `top-bar.svelte`. Le bouton capture passe dans la section Outils du panneau Avancé, dont le bouton déclencheur propre disparaît (le header ⚙ est la seule entrée).

**Files:**

- Modify: `src/lib/stores/preferences.ts` (stores `sidebarCollapsed`, `sidebarWidth` + reset)
- Create: `src/lib/components/chrome/sidebar.svelte`
- Create: `src/lib/components/chrome/layer-list.svelte`
- Modify: `src/lib/components/chrome/advanced-panel.svelte` (retrait du bouton déclencheur, prop `capture` rendue dans Outils)
- Modify: `src/lib/components/chrome/app-chrome.svelte` (desktop : Header + Sidebar + AdvancedPanel)
- Modify: `src/lib/components/chrome/mobile-dock.svelte` (retrait du rendu `advanced` — l'entrée est le header)
- Delete: `src/lib/components/chrome/top-bar.svelte`

**Interfaces:**

- Consumes: `buildVariableList` / `buildLevelGroups` / `groupVariablesByCategory` (Task 1) ; stores existants `metaJson`, `variable`, `level`, `unit`, `levelGroupSelected`, `selectedVariable` ; `pickDefaultLevel` (`$lib/level-groups`) ; `localizeVariableOption`, `translateVariableLabel` (`$lib/i18n/variables-fr`) ; `levelGroupVariables`, `variableOptions`, `LEVEL_UNIT_REGEX` (package).
- Produces:
  - `sidebarCollapsed: Persisted<boolean>` et `sidebarWidth: Writable<number>` dans `$lib/stores/preferences` (consommés par Task 6 ; `sidebarWidth` vaut 0 quand la sidebar est démontée — mobile).
  - `<Sidebar display={Snippet?} style={Snippet?} />` (snippets branchés en Task 4).
  - `<LayerList />` sans props (réutilisé par le bottom-sheet, Task 5).
  - `advanced-panel.svelte` : prop `capture?: Snippet`, plus aucun bouton déclencheur — ouverture uniquement via `advancedOpen`.

- [ ] **Step 1: Stores sidebar dans `preferences.ts`**

Après la ligne `export const advancedOpen = writable(false);` ajouter :

```ts
// Sidebar desktop : état replié (persisté) + largeur effectivement occupée (px),
// publiée par le composant pour décaler timeline/légende (0 quand démontée — mobile).
export const sidebarCollapsed = persisted('sidebar-collapsed', false);
export const sidebarWidth = writable(0);
```

Dans `resetStates()`, après `helpOpen.set(false);` ajouter :

```ts
sidebarCollapsed.set(false);
```

- [ ] **Step 2: Créer `src/lib/components/chrome/layer-list.svelte`**

```svelte
<script lang="ts">
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Layers from '@lucide/svelte/icons/layers';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Wind from '@lucide/svelte/icons/wind';
	import {
		LEVEL_UNIT_REGEX,
		levelGroupVariables,
		variableOptions
	} from '@openmeteo/weather-map-layer';

	import { metaJson } from '$lib/stores/time';
	import {
		level,
		levelGroupSelected,
		selectedVariable,
		unit,
		variable
	} from '$lib/stores/variables';

	import { localizeVariableOption, translateVariableLabel } from '$lib/i18n/variables-fr';
	import { buildLevelGroups, buildVariableList, groupVariablesByCategory } from '$lib/layer-list';
	import { pickDefaultLevel } from '$lib/level-groups';

	const ICONS = {
		temperature: Thermometer,
		precipitation: CloudRain,
		wind: Wind,
		clouds: Cloud,
		pressure: Gauge,
		other: Layers
	} as const;

	const grouped = $derived(
		$metaJson ? groupVariablesByCategory(buildVariableList($metaJson.variables)) : []
	);
	const levelGroups = $derived($metaJson ? buildLevelGroups($metaJson.variables) : {});

	const activeValue = $derived($levelGroupSelected?.value ?? $selectedVariable?.value);

	// Sélectionne une ligne : groupe de niveaux → niveau par défaut (2 m > 10 m >
	// le plus bas), variable simple → sélection directe. Même logique que
	// l'ancien variable-tabs.
	function selectRow(value: string) {
		const option = variableOptions.find((o) => o.value === value) ?? { value, label: value };
		if (levelGroupVariables.includes(value)) {
			$levelGroupSelected = localizeVariableOption(option);
			const levels = levelGroups[value];
			$variable = (levels && pickDefaultLevel(levels)) ?? value;
		} else {
			$levelGroupSelected = undefined;
			$variable = value;
		}
	}
</script>

{#if $metaJson}
	<div class="flex flex-col gap-3">
		{#each grouped as { cat, items } (cat.key)}
			{@const Icon = ICONS[cat.key]}
			<div>
				<h4 class="mb-1 px-1 text-[11px] font-medium text-white/40">{cat.label}</h4>
				<div
					class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
				>
					{#each items as item (item)}
						{@const option = variableOptions.find(({ value }) => value === item) ?? {
							value: item,
							label: item
						}}
						{@const active = activeValue === item}
						<button
							type="button"
							onclick={() => selectRow(item)}
							aria-pressed={active}
							class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors md:min-h-9 {active
								? 'text-sky-300'
								: 'text-white'}"
						>
							<Icon class="size-[18px] shrink-0" aria-hidden="true" />
							<span class="truncate">{translateVariableLabel(option.label)}</span>
						</button>
						{#if active && levelGroups[item]?.length}
							<!-- Niveaux de la variable active, en radios (sous-échéances de la spec) -->
							<div
								role="radiogroup"
								aria-label="Niveau"
								class="flex flex-col border-t border-white/[0.06] bg-white/[0.02] py-1"
							>
								{#each levelGroups[item] as { value, label } (value)}
									{#if !value.includes('v_component') && !value.includes('_direction')}
										{@const lvl = value.match(LEVEL_UNIT_REGEX)?.groups?.level}
										{@const u = value.match(LEVEL_UNIT_REGEX)?.groups?.unit}
										{@const checked = lvl === $level && u === $unit}
										<label
											class="flex min-h-11 cursor-pointer items-center gap-2.5 pr-3 pl-10 text-sm md:min-h-9 {checked
												? 'text-sky-300'
												: 'text-white/80'}"
										>
											<input
												type="radio"
												name="layer-level-{item}"
												{checked}
												onchange={() => ($variable = value)}
												class="size-3.5 accent-sky-400"
											/>
											{translateVariableLabel(label)}
										</label>
									{/if}
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
```

- [ ] **Step 3: Créer `src/lib/components/chrome/sidebar.svelte`**

```svelte
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';

	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PanelLeftCloseIcon from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpenIcon from '@lucide/svelte/icons/panel-left-open';

	import { sidebarCollapsed, sidebarWidth } from '$lib/stores/preferences';

	import LayerList from './layer-list.svelte';
	import ModelSelector from './model-selector.svelte';

	import type { Snippet } from 'svelte';

	interface Props {
		display?: Snippet;
		style?: Snippet;
	}
	let { display, style }: Props = $props();

	const OPEN_W = 288; // = w-72
	const RAIL_W = 44; // = w-11

	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	// Sections dépliables, ouvertes par défaut (état local, non persisté).
	let layersOpen = $state(true);
	let displayOpen = $state(true);
	let styleOpen = $state(true);

	// Publie la largeur occupée pour que timeline/légende se décalent (Task 6).
	$effect(() => {
		sidebarWidth.set($sidebarCollapsed ? RAIL_W : OPEN_W);
		return () => sidebarWidth.set(0);
	});
</script>

{#snippet sectionHeader(title: string, open: boolean, toggle: () => void)}
	<button
		type="button"
		class="hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 flex min-h-9 w-full cursor-pointer items-center justify-between rounded-md px-2 text-xs font-semibold tracking-wide text-white/45 uppercase"
		aria-expanded={open}
		onclick={toggle}
	>
		{title}
		<ChevronDownIcon
			class="size-4 transition-transform duration-200 motion-reduce:transition-none {open
				? 'rotate-180'
				: ''}"
			aria-hidden="true"
		/>
	</button>
{/snippet}

<!-- Sidebar sous le header (top-11 = 44 px), pleine hauteur restante, repliable
     en rail d'icônes. La largeur est animée en CSS (transition-[width]) — pas de
     transform : le contenu carte derrière n'est pas déplacé. -->
<aside
	class="bg-glass/55 fixed top-11 bottom-0 left-0 z-50 flex flex-col overflow-hidden border-r border-white/15 text-white shadow-lg glass-blur transition-[width] duration-200 motion-reduce:transition-none"
	style="width: {$sidebarCollapsed ? RAIL_W : OPEN_W}px"
	aria-label="Réglages carte"
>
	{#if $sidebarCollapsed}
		<button
			type="button"
			onclick={() => sidebarCollapsed.set(false)}
			aria-label="Déplier les réglages carte"
			title="Réglages carte"
			class="hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 mx-auto mt-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-white/70 hover:text-white"
		>
			<PanelLeftOpenIcon class="size-4" aria-hidden="true" />
		</button>
	{:else}
		<div class="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
			<h2 class="text-sm font-semibold">Réglages carte</h2>
			<button
				type="button"
				onclick={() => sidebarCollapsed.set(true)}
				aria-label="Replier les réglages carte"
				class="hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 -mr-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-white/70 hover:text-white"
			>
				<PanelLeftCloseIcon class="size-4" aria-hidden="true" />
			</button>
		</div>

		<div class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
			<!-- Haut de sidebar : sélecteur de modèle (le run/échéance reste dans la timeline) -->
			<ModelSelector />

			<section>
				{@render sectionHeader('Calques', layersOpen, () => (layersOpen = !layersOpen))}
				{#if layersOpen}
					<div transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}>
						<LayerList />
					</div>
				{/if}
			</section>

			{#if display}
				<section>
					{@render sectionHeader('Affichage', displayOpen, () => (displayOpen = !displayOpen))}
					{#if displayOpen}
						<div transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}>
							{@render display()}
						</div>
					{/if}
				</section>
			{/if}

			{#if style}
				<section>
					{@render sectionHeader('Style', styleOpen, () => (styleOpen = !styleOpen))}
					{#if styleOpen}
						<div transition:slide={{ duration: reduceMotion.current ? 0 : 200 }}>
							{@render style()}
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</aside>
```

- [ ] **Step 4: Retirer le déclencheur d'`advanced-panel.svelte` et y accueillir la capture**

Dans `src/lib/components/chrome/advanced-panel.svelte` :

1. Ajouter la prop :

```ts
import type { Snippet } from 'svelte';

interface Props {
	capture?: Snippet;
}
let { capture }: Props = $props();
```

2. Supprimer entièrement le bouton déclencheur (bloc `<button type="button" onclick={() => advancedOpen.update((v) => !v)} aria-label="Calques et réglages" …>…</button>`, lignes ~303-311). L'ouverture passe exclusivement par le header (`advancedOpen`).

3. Dans la section « Outils », au-dessus du bouton « Découpage », insérer la capture :

```svelte
{#if capture}
	<div class="flex min-h-11 items-center px-3 py-2.5">
		{@render capture()}
	</div>
{/if}
```

- [ ] **Step 5: Basculer `app-chrome.svelte` (desktop) et alléger le dock mobile**

Remplacer le contenu de `app-chrome.svelte` par :

```svelte
<script lang="ts">
	import { desktop } from '$lib/stores/preferences';

	import CaptureFlow from '$lib/components/capture/capture-flow.svelte';

	import AdvancedPanel from './advanced-panel.svelte';
	import Header from './header.svelte';
	import MobileDock from './mobile-dock.svelte';
	import Sidebar from './sidebar.svelte';
</script>

<Header />

{#if desktop.current}
	<Sidebar />
	<AdvancedPanel>
		{#snippet capture()}<CaptureFlow />{/snippet}
	</AdvancedPanel>
{:else}
	<MobileDock>
		{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
	</MobileDock>
	<AdvancedPanel />
{/if}
```

Dans `mobile-dock.svelte` : supprimer la prop `advanced` de `Props` et son rendu (`<div class="shrink-0">{@render advanced?.()}</div>`) — le dock ne garde que `VariableTabs` + FAB capture (retravaillé en Task 5).

Supprimer `src/lib/components/chrome/top-bar.svelte` :

```bash
git rm src/lib/components/chrome/top-bar.svelte
```

- [ ] **Step 6: Vérifier**

Run: `npm run format && npm run check && npm run test -- --run`
Expected: 0 erreur, tests verts.

Run: `npm run dev` — à 1440 px : sidebar sous le header (modèle + liste des calques par catégorie), clic sur une variable → la carte change et la ligne passe en sky, variable à niveaux → radios dépliées sous la ligne, repli/dépli persiste au rechargement (localStorage `sidebar-collapsed`), bouton ⚙ du header → drawer Avancé avec la capture dans Outils. À 375 px : header + dock existant, ⚙ ouvre le sheet.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/components/chrome src/lib/stores/preferences.ts
git commit -m "feat(chrome): sidebar gauche repliable avec liste verticale des calques (desktop)"
```

---

### Task 4: Sections Affichage / Style + panneau Avancé allégé

Monte les toggles « premier plan » dans la sidebar (section Affichage : contours, flèches, valeurs, popup/exploration, départements, villes & pays, relief, fond sombre ; section Style : opacité) et retire tout cela du panneau Avancé, qui garde : calque secondaire, unités, performance (tuiles + cache), réglages avancés (points de grille, sondage, réinitialisation), outils (capture, découpage, aide).

**Files:**

- Create: `src/lib/components/chrome/display-section.svelte`
- Create: `src/lib/components/chrome/style-section.svelte`
- Modify: `src/lib/components/chrome/advanced-panel.svelte` (retrait des éléments déplacés)
- Modify: `src/lib/components/chrome/app-chrome.svelte` (branche les snippets `display`/`style` de la sidebar)

**Interfaces:**

- Consumes: composants `settings/` existants (`ArrowsSettings`, `ContourSettings`, `PopupSettings`, `OpacitySetting`) ; `LayerToggle` ; stores `gridValues`, `showDepartments`, `showLabels`, `preferences`, `basemapTheme` ; `setHillshadeEnabled`, `changeOMfileURL`, `reloadVectorStyle`, `updateUrl`.
- Produces: `<DisplaySection />` et `<StyleSection />` sans props, montés via les snippets `display`/`style` de `<Sidebar>` (Task 3) puis du bottom-sheet (Task 5).

- [ ] **Step 1: Créer `src/lib/components/chrome/display-section.svelte`**

Les handlers sont **déplacés tels quels** depuis `advanced-panel.svelte` (mêmes corps, mêmes commentaires) :

```svelte
<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import HashIcon from '@lucide/svelte/icons/hash';
	import MapIcon from '@lucide/svelte/icons/map';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MountainIcon from '@lucide/svelte/icons/mountain';

	import { basemapTheme } from '$lib/stores/basemap-theme';
	import { DEFAULT_SHOW_DEPARTMENTS, showDepartments } from '$lib/stores/departments';
	import { DEFAULT_SHOW_LABELS, showLabels } from '$lib/stores/labels';
	import { defaultPreferences, preferences } from '$lib/stores/preferences';
	import { gridValues } from '$lib/stores/vector';

	import ArrowsSettings from '$lib/components/settings/arrows-settings.svelte';
	import ContourSettings from '$lib/components/settings/contour-settings.svelte';
	import PopupSettings from '$lib/components/settings/popup-settings.svelte';

	import { setHillshadeEnabled } from '$lib/hillshade';
	import { changeOMfileURL, reloadVectorStyle } from '$lib/layers';
	import { updateUrl } from '$lib/url';

	import LayerToggle from './layer-toggle.svelte';

	const gridValuesOn = $derived($gridValues);
	const departmentsOn = $derived($showDepartments);
	const labelsOn = $derived($showLabels);
	const hillshadeOn = $derived($preferences.hillshade);
	// Thème du FOND DE CARTE (le chrome reste sombre en permanence — cf. basemap-theme.ts).
	const darkOn = $derived($basemapTheme === 'dark');

	// Valeurs aux nœuds : activer force `&grid=true` dans l'URL. Si les points étaient
	// off, l'URL change → `changeOMfileURL()` refait la source ; s'ils étaient déjà on,
	// l'URL est inchangée → `reloadVectorStyle()` reconstruit la couche vecteur en place
	// pour ajouter/retirer le symbol layer. Appeler les deux couvre tous les cas.
	function toggleGridValues(next: boolean) {
		gridValues.set(next);
		updateUrl('grid_values', String(next));
		changeOMfileURL();
		reloadVectorStyle();
	}

	function toggleDepartments(next: boolean) {
		showDepartments.set(next);
		updateUrl('departments', String(next), String(DEFAULT_SHOW_DEPARTMENTS));
	}

	function toggleLabels(next: boolean) {
		showLabels.set(next);
		updateUrl('labels', String(next), String(DEFAULT_SHOW_LABELS));
	}

	function toggleHillshade(next: boolean) {
		preferences.update((p) => ({ ...p, hillshade: next }));
		setHillshadeEnabled(next);
		updateUrl('hillshade', String(next), String(defaultPreferences.hillshade));
	}

	// Bascule le fond de carte clair/sombre (persisté). Le ré-affichage du basemap +
	// couches météo est piloté par l'effet réactif sur `basemapTheme` dans +page.svelte.
	function toggleDark(next: boolean) {
		basemapTheme.set(next ? 'dark' : 'light');
	}
</script>

<!-- Calques riches (dépliables) + lecture du champ -->
<div
	class="overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
>
	<ContourSettings />
	<ArrowsSettings />
	<LayerToggle label="Valeurs" checked={gridValuesOn} onCheckedChange={toggleGridValues}>
		{#snippet icon()}<HashIcon class="size-[18px]" aria-hidden="true" />{/snippet}
	</LayerToggle>
	<PopupSettings />
</div>

<!-- Habillage de la carte -->
<div
	class="mt-2.5 overflow-hidden rounded-xl bg-white/[0.04] [&>*+*]:border-t [&>*+*]:border-white/[0.06]"
>
	<LayerToggle label="Départements" checked={departmentsOn} onCheckedChange={toggleDepartments}>
		{#snippet icon()}<MapIcon class="size-[18px]" aria-hidden="true" />{/snippet}
	</LayerToggle>
	<LayerToggle label="Villes &amp; pays" checked={labelsOn} onCheckedChange={toggleLabels}>
		{#snippet icon()}<Building2Icon class="size-[18px]" aria-hidden="true" />{/snippet}
	</LayerToggle>
	<LayerToggle label="Relief ombré" checked={hillshadeOn} onCheckedChange={toggleHillshade}>
		{#snippet icon()}<MountainIcon class="size-[18px]" aria-hidden="true" />{/snippet}
	</LayerToggle>
	<LayerToggle label="Mode sombre" checked={darkOn} onCheckedChange={toggleDark}>
		{#snippet icon()}<MoonIcon class="size-[18px]" aria-hidden="true" />{/snippet}
	</LayerToggle>
</div>
```

- [ ] **Step 2: Créer `src/lib/components/chrome/style-section.svelte`**

```svelte
<script lang="ts">
	import OpacitySetting from '$lib/components/settings/opacity-setting.svelte';
</script>

<!-- Le choix/édition de l'échelle de couleur reste dans la légende (scale.svelte) :
     cette section porte les réglages de style du calque affiché. -->
<div class="overflow-hidden rounded-xl bg-white/[0.04]">
	<OpacitySetting />
</div>
```

- [ ] **Step 3: Alléger `advanced-panel.svelte`**

Dans le snippet `body()` :

1. Supprimer de la section « Calques » : `<ArrowsSettings />`, `<ContourSettings />`, le `LayerToggle` « Valeurs », et **tout le second encart** (`Départements`, `Villes & pays`, `Relief ombré`, `<OpacitySetting />`). Renommer le titre de la section restante `{@render sectionLabel('Calques')}` en `{@render sectionLabel('Calque secondaire')}` — elle ne contient plus que `<SecondaryLayerPanel />` dans son encart.
2. Dans la section « Affichage » : supprimer `<PopupSettings />` et le `LayerToggle` « Mode sombre ». Renommer le titre en `{@render sectionLabel('Unités')}` — il ne reste que `<UnitSettings />`.
3. Sections « Avancé » (Performance : tuiles + cache ; Réglages avancés : points de grille, sondage, réinitialisation) et « Outils » (capture — Task 3 —, découpage, aide) : **inchangées**.
4. Nettoyer les imports et symboles devenus inutilisés : `ArrowsSettings`, `ContourSettings`, `OpacitySetting`, `PopupSettings`, `Building2Icon`, `HashIcon`, `MapIcon`, `MoonIcon`, `MountainIcon`, `basemapTheme`, `showDepartments`/`DEFAULT_SHOW_DEPARTMENTS`, `showLabels`/`DEFAULT_SHOW_LABELS`, `preferences`/`defaultPreferences`, `gridValues`, `setHillshadeEnabled`, `reloadVectorStyle`, les dérivés (`gridValuesOn`, `departmentsOn`, `labelsOn`, `hillshadeOn`, `darkOn`) et les handlers déplacés (`toggleGridValues`, `toggleDepartments`, `toggleLabels`, `toggleHillshade`, `toggleDark`). **Garder** `toggleGridDots`, `vectorOptions`, `changeOMfileURL`, `updateUrl`, `LayerToggle`, `Grid3x3Icon` (points de grille, toujours dans Réglages avancés).

- [ ] **Step 4: Brancher les sections dans `app-chrome.svelte`**

Remplacer `<Sidebar />` par :

```svelte
<Sidebar>
	{#snippet display()}<DisplaySection />{/snippet}
	{#snippet style()}<StyleSection />{/snippet}
</Sidebar>
```

avec les imports :

```ts
import DisplaySection from './display-section.svelte';
import StyleSection from './style-section.svelte';
```

- [ ] **Step 5: Vérifier**

Run: `npm run format && npm run check && npm run test -- --run`
Expected: 0 erreur (svelte-check signale les imports morts oubliés au Step 3).

Run: `npm run dev` — à 1440 px : sections Affichage (contours, flèches, valeurs, popup, départements, villes, relief, mode sombre — chaque toggle agit sur la carte) et Style (opacité) dans la sidebar ; panneau Avancé : calque secondaire, unités, performance, réglages avancés, outils — sans doublon avec la sidebar.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/chrome
git commit -m "feat(chrome): sections Affichage/Style en sidebar, panneau Avancé allégé"
```

---

### Task 5: Bottom-sheet mobile à onglets

Réécrit `mobile-dock.svelte` : la pastille modèle et les onglets variables disparaissent au profit d'une poignée au-dessus de la timeline qui ouvre un bottom-sheet à deux onglets (Calques = modèle + liste des calques ; Affichage & style = mêmes sections que la sidebar). Le FAB capture est conservé. `variable-tabs.svelte` n'a plus de consommateur → supprimé.

**Files:**

- Modify: `src/lib/components/chrome/mobile-dock.svelte` (réécriture complète)
- Modify: `src/lib/components/chrome/app-chrome.svelte` (snippets `display`/`style` passés au dock)
- Delete: `src/lib/components/chrome/variable-tabs.svelte`

**Interfaces:**

- Consumes: `<LayerList />`, `<ModelSelector />`, snippets `display`/`style` (mêmes contenus que la sidebar), `bottomChromeHeight`, primitives `Sheet` (`$lib/components/ui/sheet`).
- Produces: `<MobileDock capture={Snippet?} display={Snippet?} style={Snippet?} />`.

- [ ] **Step 1: Réécrire `mobile-dock.svelte`**

```svelte
<script lang="ts">
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import LayersIcon from '@lucide/svelte/icons/layers';

	import { bottomChromeHeight } from '$lib/stores/preferences';

	import * as Sheet from '$lib/components/ui/sheet';

	import LayerList from './layer-list.svelte';
	import ModelSelector from './model-selector.svelte';

	import type { Snippet } from 'svelte';

	interface Props {
		capture?: Snippet;
		display?: Snippet;
		style?: Snippet;
	}
	let { capture, display, style }: Props = $props();

	let open = $state(false);
	let activeTab: 'layers' | 'display' = $state('layers');
</script>

<!-- FAB capture, côté pouce, au-dessus de la poignée -->
<div class="fixed right-2.5 z-60" style="bottom: calc({$bottomChromeHeight}px + 4.5rem)">
	{@render capture?.()}
</div>

<!-- Poignée d'ouverture du bottom-sheet, au-dessus de la timeline -->
<button
	type="button"
	onclick={() => (open = true)}
	class="bg-glass/50 hover:bg-glass/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 fixed left-1/2 z-60 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-4 text-sm text-white shadow-md glass-blur"
	style="bottom: calc({$bottomChromeHeight}px + 0.5rem)"
>
	<LayersIcon class="size-4" aria-hidden="true" />
	Calques &amp; affichage
	<ChevronUpIcon class="size-4 opacity-60" aria-hidden="true" />
</button>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="bg-glass/90 z-100 flex max-h-[85vh] flex-col gap-0 border-none text-white backdrop-blur-xl"
	>
		<!-- Onglets (cibles ≥ 44 px, gap ≥ 8 px) ; le corps seul défile. -->
		<div role="tablist" aria-label="Réglages carte" class="flex shrink-0 gap-2 px-4 pt-4">
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'layers'}
				onclick={() => (activeTab = 'layers')}
				class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-h-11 flex-1 cursor-pointer rounded-lg text-sm font-medium {activeTab ===
				'layers'
					? 'bg-white/12 text-sky-300'
					: 'text-white/70 hover:bg-white/[0.05]'}"
			>
				Calques
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'display'}
				onclick={() => (activeTab = 'display')}
				class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-h-11 flex-1 cursor-pointer rounded-lg text-sm font-medium {activeTab ===
				'display'
					? 'bg-white/12 text-sky-300'
					: 'text-white/70 hover:bg-white/[0.05]'}"
			>
				Affichage &amp; style
			</button>
		</div>
		<div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8">
			{#if activeTab === 'layers'}
				<div class="mb-3"><ModelSelector /></div>
				<LayerList />
			{:else}
				{@render display?.()}
				<div class="mt-4">{@render style?.()}</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
```

- [ ] **Step 2: Passer les snippets dans `app-chrome.svelte`**

Remplacer le bloc mobile par :

```svelte
<MobileDock>
	{#snippet capture()}<CaptureFlow variant="fab" />{/snippet}
	{#snippet display()}<DisplaySection />{/snippet}
	{#snippet style()}<StyleSection />{/snippet}
</MobileDock>
<AdvancedPanel />
```

- [ ] **Step 3: Supprimer `variable-tabs.svelte`**

```bash
git rm src/lib/components/chrome/variable-tabs.svelte
```

`npm run check` doit confirmer qu'aucun consommateur ne reste (sinon, le supprimer révèle l'oubli).

- [ ] **Step 4: Vérifier**

Run: `npm run format && npm run check && npm run test -- --run`
Expected: 0 erreur.

Run: `npm run dev` — à 375 px : poignée « Calques & affichage » au-dessus de la timeline → sheet à deux onglets ; onglet Calques = modèle + liste (sélection ferme la carte visible derrière ? non — le sheet reste ouvert, la carte se met à jour) ; onglet Affichage & style = toggles + opacité ; toutes les lignes font ≥ 44 px ; ⚙ du header → panneau Avancé ; FAB capture présent. Vérifier aussi que le desktop (1440 px) n'a pas régressé.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/components/chrome
git commit -m "feat(chrome): bottom-sheet mobile à onglets Calques / Affichage & style"
```

---

### Task 6: Timeline et légende décalées par la sidebar + chiffres tabulaires

La timeline (centrée) et la légende (bord gauche) se décalent de la largeur publiée par la sidebar (`sidebarWidth`, 0 sur mobile). Ajout de `tabular-nums` sur leurs conteneurs (hérité par toutes les valeurs numériques — heures, valeurs de légende).

**Files:**

- Modify: `src/lib/components/time/time-selector.svelte:781-786` (wrapper) + import
- Modify: `src/lib/components/scale/scale.svelte:162-171` et `:198-204` (+ popover d'édition ~`:288`) + import

**Interfaces:**

- Consumes: `sidebarWidth` (`$lib/stores/preferences`, Task 3).
- Produces: rien de nouveau — comportement visuel seulement.

- [ ] **Step 1: Décaler la timeline**

Dans `time-selector.svelte`, ajouter `sidebarWidth` à l'import existant depuis `$lib/stores/preferences` (ligne ~11), puis remplacer le wrapper (lignes 781-786) :

Avant :

```svelte
<div
	bind:this={chromeWrapper}
	class="fixed bottom-0 w-full md:w-[unset] md:max-w-[75vw] -translate-x-1/2 left-1/2 z-40 {disabled
		? 'text-foreground/50 cursor-not-allowed'
		: ''}"
>
```

Après :

```svelte
<div
	bind:this={chromeWrapper}
	class="fixed bottom-0 w-full md:w-[unset] md:max-w-[75vw] -translate-x-1/2 z-40 tabular-nums transition-[left] duration-200 motion-reduce:transition-none {disabled
		? 'text-foreground/50 cursor-not-allowed'
		: ''}"
	style="left: calc(50% + {$sidebarWidth / 2}px)"
>
```

- [ ] **Step 2: Décaler la légende**

Dans `scale.svelte`, ajouter `sidebarWidth` à l'import existant depuis `$lib/stores/preferences`, puis :

1. Bouton légende repliée (lignes ~162-171) : retirer `left-2.5` de la `class`, ajouter `tabular-nums transition-[left] duration-200 motion-reduce:transition-none`, et préfixer le `style` :

```svelte
style="left: calc({$sidebarWidth}px + 0.625rem);{!desktop.current
	? ` bottom: calc(${$bottomChromeHeight}px + 4.5rem);`
	: ''}"
```

2. Conteneur légende dépliée (lignes ~198-204) : même traitement — retirer `left-2.5`, ajouter `tabular-nums transition-[left] duration-200 motion-reduce:transition-none` à la `class`, préfixer le `style` par `left: calc({$sidebarWidth}px + 0.625rem);`.

3. Popover d'édition d'échelle (~ligne 288, `class="z-80 left-2.5 …"`) : remplacer `left-2.5` par le même `style` de décalage.

- [ ] **Step 3: Vérifier**

Run: `npm run format && npm run check`
Expected: 0 erreur.

Run: `npm run dev` — à 1440 px : replier/déplier la sidebar → la timeline glisse pour rester centrée sur la zone carte, la légende suit le bord de la sidebar (transition ~200 ms, aucune sous `prefers-reduced-motion` émulé). Les heures de la timeline ne « sautent » plus en largeur pendant le scrubbing (chiffres tabulaires). À 375 px : positions inchangées (offset 0).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/time/time-selector.svelte src/lib/components/scale/scale.svelte
git commit -m "feat(chrome): timeline et légende décalées par la sidebar, chiffres tabulaires"
```

---

### Task 7: Contrôles MapLibre en bas-droite

Déplace les contrôles natifs (zoom/boussole, géoloc, globe, 3D) de haut-droite vers bas-droite, décalés au-dessus de la timeline. Supprime la mesure `measureControls` du panneau Avancé (les contrôles ne sont plus en haut) au profit d'un ancrage fixe sous le header.

**Files:**

- Modify: `src/lib/map-controls.ts:44-59` (position `'bottom-right'`)
- Modify: `src/routes/+page.svelte` (effet de décalage au-dessus de la timeline)
- Modify: `src/lib/components/chrome/advanced-panel.svelte` (ancrage fixe, suppression de `measureControls`)

**Interfaces:**

- Consumes: `bottomChromeHeight` (`$lib/stores/preferences`), `$map` (`$lib/stores/map`).
- Produces: rien de nouveau.

- [ ] **Step 1: Positionner les contrôles en bas-droite**

Dans `src/lib/map-controls.ts`, ajouter `'bottom-right'` comme second argument des quatre `map.addControl(...)` (NavigationControl, GeolocateControl, globeControl, View3DControl) :

```ts
map.addControl(
	new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
	'bottom-right'
);
// … idem pour GeolocateControl, globeControl et View3DControl
```

Ne pas toucher à la gestion de l'attribution.

- [ ] **Step 2: Décaler les contrôles au-dessus de la timeline**

Dans `src/routes/+page.svelte`, ajouter cet effet après les `$effect` existants :

```ts
// Contrôles MapLibre en bas-droite : les remonte au-dessus de la barre du temps
// (hauteur mesurée dans bottomChromeHeight), sinon ils passeraient dessous.
$effect(() => {
	const mapInstance = $map;
	const h = $bottomChromeHeight;
	if (!mapInstance) return;
	const el = mapInstance
		.getContainer()
		.querySelector('.maplibregl-ctrl-bottom-right') as HTMLElement | null;
	if (el) el.style.bottom = `${h + 8}px`;
});
```

- [ ] **Step 3: Ancrer le drawer Avancé sous le header**

Dans `advanced-panel.svelte` :

1. Supprimer `TOP_FALLBACK`, `controlsBottom`, `measureControls()`, le `$effect` de mesure (lignes ~125-141) et l'appel `measureControls()` dans `portal()`.
2. Remplacer le `style` du drawer desktop (`style="top: {controlsBottom + 8}px; max-height: calc(100dvh - {controlsBottom + 24}px);"`) par :

```svelte
style="top: 52px; max-height: calc(100dvh - 68px);"
```

(52 = header 44 px + 8 px de marge ; 68 laisse 16 px en bas.)

- [ ] **Step 4: Vérifier**

Run: `npm run format && npm run check`
Expected: 0 erreur.

Run: `npm run dev` — à 1440 px : contrôles empilés en bas-droite au-dessus de la timeline (pas de chevauchement, y compris quand la barre de run est étendue) ; drawer Avancé ouvert juste sous le header. À 375 px : contrôles bas-droite au-dessus de la timeline, pas de collision avec le FAB capture (côté droit — si collision, remonter le FAB via son offset `4.5rem` → `7rem`). Vérifier qu'un toast (changement de modèle) ne masque pas les contrôles de façon gênante.

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-controls.ts src/routes/+page.svelte src/lib/components/chrome/advanced-panel.svelte
git commit -m "feat(map): contrôles MapLibre en bas-droite au-dessus de la timeline"
```

---

### Task 8: Documentation, nettoyage et vérification finale

Met à jour les docs de zone (règle projet : une règle path-scopée périmée est pire que pas de règle), passe la vérification complète et la revue visuelle finale des garde-fous de la spec.

**Files:**

- Modify: `.claude/rules/components.md` (paragraphe chrome)
- Modify: `.claude/rules/stores.md` (nouveaux stores)
- Modify: `README.md` (section `## Architecture`, description du chrome)

**Interfaces:**

- Consumes: état final des Tasks 1-7.
- Produces: docs à jour.

- [ ] **Step 1: Mettre à jour `.claude/rules/components.md`**

Remplacer le paragraphe commençant par « Map controls are plain Svelte components rendered in the app chrome » par :

```markdown
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
```

- [ ] **Step 2: Mettre à jour `.claude/rules/stores.md`**

Dans le premier paragraphe, après la liste des stores `persisted`, ajouter :

```markdown
`sidebarCollapsed` (persisté) mémorise le repli de la sidebar desktop ; `sidebarWidth` (writable non persisté, `preferences.ts`) publie la largeur occupée par la sidebar (0 quand démontée — mobile) et sert à décaler timeline et légende.
```

- [ ] **Step 3: Mettre à jour `README.md`**

Dans la section `## Architecture`, remplacer la ou les phrases décrivant le chrome (barre haute / dock / panneau réglages — repérer les mentions de `top-bar`, `variable-tabs` ou « barre haute ») par :

```markdown
Le chrome s'organise autour d'un header fin pleine largeur (marque Infoclimat, onglet « Carte », bouton « Réglages » ouvrant le panneau Avancé) et, sur desktop, d'une sidebar gauche repliable (sélecteur de modèle, liste verticale des calques, sections Affichage et Style) ; sur mobile, un bottom-sheet à onglets reprend les mêmes sections. La timeline et la légende se décalent de la largeur de la sidebar ; les contrôles MapLibre natifs sont ancrés en bas-droite au-dessus de la timeline.
```

Si le README ne décrit pas le chrome dans cette section, ajouter ce paragraphe à la fin de `## Architecture`.

- [ ] **Step 4: Vérification complète**

```bash
npm run format
npm run check
rtk proxy npm run lint
npm run test -- --run
npm run build
```

Expected: tout vert (`rtk proxy` obligatoire pour le lint — le cache rtk peut masquer un échec réel).

- [ ] **Step 5: Revue visuelle des garde-fous (spec « non négociables »)**

`npm run dev`, puis vérifier et noter le résultat :

- 1440 px : navigation clavier Tab → header (logo, Réglages) → sidebar (collapse, modèle, lignes de calques, radios, toggles) avec focus visibles partout ; repli sidebar fluide, instantané sous émulation `prefers-reduced-motion`.
- 375 px : toutes les cibles (lignes, radios, onglets du sheet, poignée, ⚙) ≥ 44 px ; pas de scroll horizontal.
- Contraste : libellés blancs/blanc-70 sur verre sombre au-dessus d'un fond de carte **clair** (basculer « Mode sombre » off) — le scrim + `bg-glass` doivent maintenir la lisibilité (AA).
- Légende : libellés « Moins / Plus » (ou valeurs) toujours présents.
- Aucune régression moteur : scrubbing timeline, playback, popup valeur, sondage (AROME), export capture.

- [ ] **Step 6: Commit**

```bash
git add .claude/rules/components.md .claude/rules/stores.md README.md
git commit -m "docs(chrome): met à jour rules et README après la refonte header + sidebar"
```
