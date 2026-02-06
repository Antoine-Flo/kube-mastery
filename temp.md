1. Hero
Titre : léger dégradé sur le h1 (ex. background: linear-gradient(...); -webkit-background-clip: text; color: transparent) ou une ombre portée douce (text-shadow) pour le faire ressortir.
Bouton CTA : box-shadow discret (ex. cyan avec opacité) ou léger transform: translateY(-1px) au hover pour un effet “bouton qui se soulève”.
Terminal : ombre portée sur .terminal-container (box-shadow avec blur) pour le détacher du fond.
2. Sections (features, concerns, stats)
Titres de section (h2) : petite ligne ou point décoratif en dessous (pseudo-élément ::after avec une barre cyan ou un losange), ou sous-titre en couleur (ex. color: var(--color-cyan-11)).
Cartes features / stats :
léger box-shadow au repos, un peu plus marqué au hover ;
ou bordure qui passe au cyan au hover (border-color: var(--color-cyan-8)).
Icônes : fond circulaire ou carré arrondi derrière l’icône (ex. background: var(--color-cyan-a2) + padding + border-radius) pour les mettre en valeur.
3. Hiérarchie visuelle
Alternance de fonds : une section sur deux avec un fond très léger (ex. var(--color-gray-a1) ou var(--color-gray-2)) pour casser la monotonie.
Espacement : augmenter un peu le padding vertical des blocs (features, concerns, stats) pour aérer.
4. Micro-interactions
Cartes : transition sur transform + au hover transform: translateY(-2px) (déjà des transition-delay sur les .anim, tu peux ajouter une transition sur transform/box-shadow au hover).
Liens / boutons secondaires : léger soulignement ou changement de couleur au hover.
5. Cohérence thème sombre
Vérifier que le halo, les ombres et les couleurs (cyan, gris) restent lisibles en dark (variables déjà utilisées comme --color-cyan-11, --color-gray-*).
En dark, des ombres très douces (ex. box-shadow: 0 4px 24px rgba(0,0,0,0.2)) peuvent suffire ; en light, tu peux être un peu plus marqué.
En priorité, les plus impactants pour peu de code : ombre sur le terminal, hover sur les cartes (translateY + shadow ou bordure), petit détail sous les h2 (ligne ou couleur), et fond alterné sur une section. Si tu veux, en mode Agent je peux appliquer concrètement 2–3 de ces idées dans ton index.astro et tes styles.