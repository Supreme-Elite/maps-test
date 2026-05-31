<!--
	Dégradés sombres haut/bas DERRIÈRE les panneaux verre.
	Garantit le contraste du texte blanc même sur une carte claire (critère AA).
	pointer-events:none → n'intercepte aucune interaction carte.
-->
<div
	class="pointer-events-none fixed inset-x-0 top-0 z-40 h-24 bg-gradient-to-b from-black/30 to-transparent"
	aria-hidden="true"
></div>
<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-28 bg-gradient-to-t from-black/35 to-transparent"
	aria-hidden="true"
></div>
