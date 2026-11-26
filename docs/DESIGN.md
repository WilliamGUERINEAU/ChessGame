# Document de conception — Gambit Rogue

> Nom de travail provisoire. Ce document fixe les règles décidées ; toute
> évolution des règles doit être reportée ici. Les règles marquées ✅ sont
> implémentées et testées dans `src/engine/`.

## 1. Concept

Roguelite d'échecs au tour par tour, jouable en PWA (mobile et bureau à égalité).
Un **run** est une suite de **mini-problèmes** sur des plateaux de forme
irrégulière, avec des terrains. Entre deux mini-problèmes, le joueur gagne une
nouvelle pièce ou un pouvoir pour une pièce qu'il possède.

## 2. Structure d'un run

- **Carte à embranchements** : à chaque étape, le joueur choisit le prochain nœud.
- **Types de nœuds** : combat, survie, capture, boss (fin d'acte).
- **Héros** : en début de run, le joueur choisit une **classe de départ**. Chaque
  classe a un héros (une pièce) avec un pouvoir unique et une armée de départ.
- **Défaite** : le run est perdu si le **héros meurt**.
- **Entre deux niveaux** :
  - une pièce morte est **perdue pour le reste du run** ;
  - les pièces survivantes **récupèrent tous leurs PV** ;
  - récompense : **choisir 1 option parmi 3** (nouvelle pièce, ou pouvoir à appliquer
    à une pièce possédée).
- **Progression** : roguelite par défaut (les runs débloquent des classes, pièces,
  pouvoirs qui entrent ensuite dans les tirages). **Option pour la désactiver**
  (mode roguelike pur : rien n'est conservé hors statistiques).

## 3. Niveaux (mini-problèmes)

### Plateaux ✅
- Grille avec des **cases absentes** : formes irrégulières (L, trous, îlots…).
  Le vide se comporte comme l'eau : on ne s'y arrête pas et on ne le traverse pas
  en glissant ; le Cavalier peut le sauter.
- Chaque gabarit définit la **direction « avant »** de chaque camp (pour les pions).
- Chaque gabarit définit une **zone de déploiement** : le joueur y place ses
  pièces avant le début du niveau (à implémenter).

### Génération (hybride)
- Formes de plateau et gabarits **faits main**.
- Ennemis et terrains **tirés au hasard** selon un **budget de difficulté**.
- Tout le hasard passe par un générateur à graine (`src/engine/rng.ts`) : une même
  graine rejoue le même run.

### Terrains ✅
| Terrain | Effet |
|---|---|
| Forêt / boue | Une pièce qui glisse (Tour, Fou, Dame, double pas du Pion) **s'arrête** en y entrant. On peut attaquer une pièce qui s'y trouve, pas au-delà. On en sort librement. |
| Eau / gouffre | On ne peut ni s'y arrêter ni la traverser en glissant ; le **Cavalier saute par-dessus**. |
| Mur / rocher | Comme l'eau pour les déplacements (le **Cavalier saute aussi par-dessus**), mais **bloque les lignes de vue** (futurs effets à distance). Éventuellement destructible. |
| Glace | Une pièce qui s'y arrête après un déplacement **en ligne** (Tour, Fou, Dame, Roi, Pion) **glisse d'une case** dans la même direction, et **recommence tant qu'elle est sur la glace** et que la case suivante est libre. Un **saut** (Cavalier) et un **atterrissage** après une attaque ne font pas glisser. |

### Objectifs ✅
| Type | Victoire | Précisions |
|---|---|---|
| Combat | Capturer **toutes** les pièces adverses. | |
| Survie | Tenir **N tours** avec le héros vivant. | Un tour est fini quand l'ennemi a joué. Gagné aussi si plus aucun ennemi ne reste. |
| Capture | Capturer **une pièce cible** précise. | Limite de tours facultative : le joueur dispose alors de N coups. |
| Boss | Vaincre un ennemi à beaucoup de PV (il peut jouer deux fois par tour). | PV personnalisables ✅ ; double action à implémenter. |

## 4. Règles de jeu

### Tour ✅
- Alternance stricte : le joueur commence ; il déplace **une** pièce, puis l'ennemi
  (IA) en déplace **une** (un boss pourra agir deux fois).
- **Pas d'échec ni de mat** : le héros a des PV et peut aller sur une case menacée.
- Un camp **sans aucune action possible passe** son tour. **Deux passes d'affilée**
  (les deux camps bloqués) = **défaite**, sauf en survie où les tours continuent
  d'avancer.

### Pièces ✅
- **Uniquement les 6 pièces classiques** ; la variété vient des pouvoirs.
- Chaque pièce a des **PV** et une **ATK**. Valeurs de base **provisoires**, à
  équilibrer (`src/engine/pieces/pieces.ts`) :

  | Pièce | PV | ATK | Déplacement |
  |---|---|---|---|
  | Roi | 4 | 1 | 1 case, 8 directions |
  | Dame | 3 | 3 | En ligne, 8 directions |
  | Tour | 3 | 2 | En ligne, orthogonal |
  | Fou | 2 | 2 | En ligne, diagonal |
  | Cavalier | 2 | 2 | Saut en L, par-dessus tout |
  | Pion | 1 | 1 | Voir ci-dessous |

- **Pion** : avance d'**une case tout droit** (jamais en diagonale pour se déplacer),
  **deux cases à son premier coup** du niveau (ce double pas est une glissade : la
  forêt l'arrête, la glace ne l'empêche pas) ; il **attaque en diagonale vers
  l'avant** et jamais tout droit. Pas de prise en passant. Pas de promotion par
  défaut (peut venir d'un pouvoir).

### Combat ✅
- Une attaque inflige **l'ATK de l'attaquant** aux PV de la cible.
- **Cible tuée** : l'attaquant prend sa case (et glisse si c'est de la glace).
- **Cible survivante** :
  - attaque **en ligne depuis 2 cases ou plus** : l'attaquant **s'arrête sur la case
    juste avant** la cible ;
  - attaque **adjacente** (Roi, Pion, pièce en ligne collée à sa cible) ou **saut**
    (Cavalier) : l'attaquant atterrit sur une **case libre voisine de la cible
    (8 directions)**, **au choix du joueur** (l'IA choisit pour l'ennemi). Sa propre
    case compte comme libre. S'il n'y en a aucune, il **reste sur sa case**.

### Exemples de pouvoirs (à équilibrer)
+1 PV, +1 ATK, +1 de portée, traverser la forêt, bouclier (annule la 1re attaque
reçue), riposte, saut, promotion du pion.

## 5. IA ennemie ✅
- Recherche **minimax avec élagage alpha-bêta** (`src/engine/ai/`), calculée dans un
  **Web Worker** (repli automatique sur le fil principal si besoin). Quelques
  millisecondes par coup sur nos plateaux.
- **Évaluation** : valeur de chaque pièce (type + PV), PV du héros comptés en plus
  (l'ennemi cherche à l'user), bonus pour la cible d'un niveau de capture, et
  **approche** des ennemis vers le héros.
- Une **issue certaine reste départagée par la position** : un ennemi condamné (ex.
  la survie va réussir) continue d'user le héros au lieu de jouer au hasard.
- **Réglages par niveau** : profondeur (demi-coups anticipés) et **agressivité**
  (poids de l'approche ; 0,5 par défaut). Trop prudente, l'IA fuit et la fin de
  partie tourne à la course-poursuite ; trop agressive, elle se sacrifie.
- Les égalités sont départagées par le générateur à graine.
- Difficulté croissante : profondeur 1 au niveau 1, 2 au niveau 2, 3 ensuite.
  Ces réglages ont été choisis d'après des parties IA contre IA ; un test vérifie
  que chaque niveau reste gagnable par un joueur simulé.

## 6. Technique

| Couche | Choix |
|---|---|
| Langage / build | TypeScript strict, Vite |
| Interface | React + SVG (vectoriel épuré), responsive mobile/bureau |
| PWA | vite-plugin-pwa (manifest, service worker, hors ligne) |
| Tests | Vitest (moteur, IA, niveaux, logique d'interface) ; parcours complets vérifiés dans Chromium avec Playwright (pas encore automatisés en CI) |
| i18n | i18next + react-i18next, **FR + EN dès le départ** |
| Sauvegarde | IndexedDB via idb-keyval |
| Hébergement | GitHub Pages via GitHub Actions (déploiement à chaque push sur `main`) |

### Organisation du code
```
src/
  engine/          règles pures TS, sans dépendance UI, déterministes et testées
    geometry.ts    positions, directions
    board/         plateau irrégulier, terrains
    pieces/        définitions des pièces (mouvements, PV, ATK)
    state.ts       état d'un niveau, création à partir d'une définition
    moves.ts       actions légales (déplacer, attaquer, passer)
    combat/        dégâts, case d'arrivée quand la cible survit
    apply.ts       application d'une action, glace, événements, alternance
    goals/         objectifs et fin de partie
    rng.ts         hasard à graine
    testing.ts     aides pour les tests (plateaux en texte)
    ai/            IA (minimax alpha-bêta) et son Web Worker
    powers/        (à venir) pouvoirs = modificateurs
  content/         niveaux de démonstration (gabarits, classes et pouvoirs à venir)
  run/             (à venir) carte, récompenses, héros, déblocages
  ui/              interface React/SVG
    board/         plateau, terrains, pièces vectorielles
    game/          déroulement d'un niveau (clics, tour de l'IA, journal)
    screens/       accueil, choix du niveau, partie, fin de niveau
  i18n/            traductions FR/EN
```

Les plateaux et les pièces s'écrivent en texte, ce qui rend les niveaux et les
tests lisibles :

```ts
testLevel({
  terrain: ['..f.', '.~..', 'i...'], // . sol, f forêt, ~ eau, # mur, i glace, espace = vide
  units:   ['R..p', '....', 'K...'], // majuscules = joueur, minuscules = ennemi (K Q R B N P)
})
```

## 7. Interface ✅
- **Écrans** : accueil (langue), choix du niveau, partie, fenêtre de fin
  (niveau suivant, recommencer, retour aux niveaux).
- **Jouer** : toucher une de ses pièces affiche ses options : **point** = case où
  aller, **cadre rouge** = pièce à attaquer, **cadre bleu pointillé** = case
  d'atterrissage à choisir quand la cible survit. Toucher la pièce à nouveau
  l'annule ; toucher une autre pièce la sélectionne.
- **Sur chaque pièce** : barre de PV (verte pour le joueur, rouge pour l'ennemi),
  pastille d'ATK, couronne pour le héros, viseur pour la cible.
- **Panneau** : tour en cours, consigne, fiche de la pièce choisie, journal des
  attaques, captures et glissades, légende des terrains.
- Le dernier déplacement est surligné ; une pièce touchée clignote en rouge.
- Accessible au clavier (cases actives focalisables, Entrée/Espace) et aux
  lecteurs d'écran (chaque case est décrite). Mouvements réduits respectés.

## 8. Jalon 1 — Prototype jouable
1. ✅ Projet initialisé (Vite, React, TS, Vitest, PWA, i18n FR/EN, RNG à graine).
2. ✅ Moteur testé : plateau irrégulier, terrains, déplacements des 6 pièces,
   combat PV/ATK, glace, objectifs (capturer tout, survivre, capturer une cible),
   mort du héros, blocage.
3. ✅ IA (minimax alpha-bêta dans un Web Worker, réglable par niveau).
4. ✅ Interface SVG responsive, FR/EN, clair/sombre.
5. ◐ 5 niveaux de démonstration enchaînés. Reste : choix de récompense entre
   les niveaux, 2 classes de héros, carte à embranchements.
6. Sauvegarde locale (IndexedDB).
