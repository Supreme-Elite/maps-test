# Refonte du menu Aide (`help-dialog.svelte`)

**Date :** 2026-06-21
**Composant cible :** `src/lib/components/help/help-dialog.svelte`
**Type :** refonte contenu + présentation (le format dialogue est conservé)

## Problème

Le contenu du dialogue d'aide a divergé de l'application réelle. Audit comparatif
(aide vs code) :

- **Faux / obsolète** (décrit mais n'existe plus dans l'UI) : « Requêtes partielles »,
  « Masquer les océans » (le store `clipWater` survit mais n'est plus exposé).
- **Raccourcis manquants** : `h` (ouvrir l'aide), `Échap` (fermer l'infobulle /
  réinitialiser le mode infobulle).
- **Boutons / contrôles manquants** : Capture PNG, Animation (play/pause),
  Préchargement.
- **Réglages manquants** : Valeurs (nombres aux nœuds), Opacité raster, Couche
  superposée (calque 2), Infobulle (réglage UI), Sondage vertical, Cache,
  Réinitialisation.
- **Features majeures absentes** : animation temporelle, préchargement, sondage
  Skew-T / hodographe, capture PNG, découpage avancé (modes de dessin + sélecteur
  de pays), couche secondaire.
- **Confusion** : « Grille » (points orange) et « Valeurs » (nombres aux nœuds)
  sont deux réglages distincts mélangés dans la doc.

## Objectif

Un aide-mémoire **dense et scannable**, à jour, organisé **par tâche utilisateur**
plutôt que par type d'élément (bouton / raccourci / réglage), avec **accordéons**
pour les grosses fonctionnalités. Pas un manuel exhaustif.

## Décisions de design (validées)

1. **Ampleur** : refonte complète, contenu + présentation, format dialogue conservé.
2. **Organisation** : par tâche utilisateur (« Option B »), 7 sections.
3. **Niveau de détail** : référence concise (une ligne par élément) + détails
   repliables (accordéon) pour les grosses features.
4. **Pictogrammes** : icône Lucide **nue** (même glyphe que sur la carte, sans le
   cadre `.maplibregl-ctrl`) pour boutons/réglages ; pastille `Kbd` pour les
   raccourcis.
5. **Raccourcis** : présentés **inline** dans la section concernée. Pas de tableau
   récapitulatif séparé.
6. **Accordéons** : `<details>/<summary>` HTML natif stylé Tailwind (pas de
   dépendance shadcn `Accordion` — éviterait la re-customisation verre après
   `npm run upgrade:ui`). Accessible clavier nativement ; animation conditionnée à
   `prefers-reduced-motion`.

## Structure des sections

Chaque section : titre `h2` + icône Lucide ; lignes `[icône|Kbd] Libellé — description`.

1. **Naviguer dans le temps**
   - Sélecteur de temps (activer/désactiver)
   - `↓`/`↑` jour précédent/suivant · `←`/`→` heure précédente/suivante ·
     `c` heure actuelle · `m` verrouiller le run · `n` dernier run ·
     `ctrl`+`←`/`→` run précédent/suivant
   - **Animation** ▶ — *accordéon* : lit la plage en boucle ; plages Aujourd'hui /
     24 h suivantes / 24 h précédentes / Run complet
   - **Préchargement** ⎙ — charge la plage à l'avance pour fluidifier l'animation

2. **Choisir les données**
   - Domaine `d` · Variable `v` · Niveau `l`
   - Afficher / masquer la sélection de variable (chevron)
   - **Couche superposée** — 2ᵉ variable par-dessus la principale, opacité indépendante

3. **Visualiser**
   - Unités (température, distance, géopotentiel, précipitations, vent)
   - Grille (points du modèle)
   - **Valeurs** (nombres aux nœuds — *distinct de Grille*)
   - Flèches (vent / houle ; niveau + style couleur/largeur)
   - Isocontours (intervalle, alignement des paliers, style couleur/largeur)
   - Opacité (transparence des tuiles raster)
   - Couleurs (édition des paliers de couleur)
   - Taille des tuiles (512 px par défaut)

4. **Interroger la carte**
   - Infobulle `p` — cycle 3 modes : désactivée / suit la souris / déplaçable
   - **Sondage vertical** — *accordéon* : Skew-T / hodographe / indices ; au clic
     sur la carte ; domaines AROME

5. **Cadrer & exporter**
   - **Découpage** — *accordéon* : modes sélection / rectangle / polygone /
     main levée / pinceau + sélecteur de pays ; tracé mémorisé
   - **Capture PNG** — *accordéon* : cadrage paysage 4:3 / portrait 3:4 ;
     filigrane (run + échéance + domaine/variable) ; télécharger ou partager

6. **Repères & rendu**
   - Mode sombre / clair · Relief ombré · Terrain 3D · Projection globe ·
     Départements · Villes & pays · Me localiser ·
     Zoom `+`/`−`, boussole (réinitialiser inclinaison / rotation)

7. **Réglages avancés** — *accordéon, repliée par défaut*
   - Cache (taille des blocs / cache max en Mo)
   - Réinitialiser tous les réglages

**Général** (petite ligne en bas) : `h` ouvrir/fermer l'aide · `Échap` fermer
l'infobulle / réinitialiser le mode infobulle.

## Présentation & technique

- **Primitives réutilisées** : `Dialog`, `Kbd` (existants). Accordéons via
  `<details>/<summary>` natif.
- **Style** : chrome verre `bg-glass` conservé ; accent `sky` ; icônes Lucide
  `opacity-75`, taille uniforme, `stroke-width` cohérent (≈1.75).
- **Suppression** : le `<svg>`/markup MapLibre reproduit aujourd'hui (cadres
  `.maplibregl-ctrl`) est retiré au profit d'icônes Lucide propres.
- **Mobile (`<640px`)** : toutes les sections par tâche restent affichées (les
  features tactiles — animation, capture, sondage — comptent autant sur mobile) ;
  seules les pastilles `Kbd` et la ligne « Général » sont masquées (pas de clavier).
  → remplace la logique actuelle qui masque des sections entières via
  `MediaQuery('min-width: 640px')`.
- **Accessibilité** : hiérarchie `h2`/`h3` séquentielle, accordéons natifs
  clavier-navigables, contraste vérifié sur fond verre clair/sombre, `aria-label`
  sur le dialogue, icônes décoratives `aria-hidden`.

## Hors périmètre (YAGNI)

- Pas de réorganisation du panneau « Calques & réglages » lui-même.
- Pas de tour guidé / onboarding interactif.
- Pas de nouvelle dépendance (Accordion shadcn écarté).
- Pas de tableau récapitulatif de raccourcis séparé.

## Vérification

- `npm run check` (typecheck) + `npm run lint`.
- Vérification headless (cf. mémoire « Vérif headless de la carte ») : ouvrir le
  dialogue (`h`), confirmer présence des nouvelles sections et bon fonctionnement
  des `<details>` ; tester à 375px et en clair/sombre.
- Revue manuelle : aucune mention de « Requêtes partielles » / « Masquer les océans ».
