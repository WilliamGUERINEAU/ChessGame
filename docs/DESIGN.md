# Document de conception — Gambit Rogue

> Nom de travail provisoire. Ce document fixe les règles décidées ; toute
> évolution des règles doit être reportée ici.

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

### Plateaux
- Grille avec un **masque de cases** : formes irrégulières (L, trous, îlots…).
- Chaque gabarit définit la **direction « avant »** de chaque camp (pour les pions).
- Chaque gabarit définit une **zone de déploiement** : le joueur y place ses
  pièces avant le début du niveau.

### Génération (hybride)
- Formes de plateau et gabarits **faits main**.
- Ennemis et terrains **tirés au hasard** selon un **budget de difficulté**.
- Tout le hasard passe par un générateur à seed (`src/engine/rng.ts`) : un même
  seed rejoue le même run.

### Terrains
| Terrain | Effet |
|---|---|
| Forêt / boue | Une pièce qui glisse (Tour, Fou, Dame) **s'arrête** en y entrant. |
| Eau / gouffre | On ne peut ni s'y arrêter ni la traverser en glissant ; **un saut (Cavalier) passe par-dessus**. |
| Mur / rocher | Bloque tout, y compris les lignes de vue (éventuellement destructible, avec PV). |
| Glace | Une pièce qui s'y arrête **glisse d'une case de plus** dans la même direction. |

### Objectifs
| Type | Victoire |
|---|---|
| Combat | Capturer **toutes** les pièces adverses. |
| Survie | Tenir **N tours** avec le héros vivant. |
| Capture | Capturer **une pièce cible** précise (limite de tours possible). |
| Boss | Vaincre un ennemi à beaucoup de PV (il peut jouer deux fois par tour). |

## 4. Règles de jeu

### Tour
- Alternance stricte : le joueur déplace **une** pièce, puis l'ennemi (IA) en
  déplace **une** (un boss peut agir deux fois).
- **Pas d'échec ni de mat** : le héros a des PV et peut aller sur une case menacée.

### Pièces
- **Uniquement les 6 pièces classiques** ; la variété vient des pouvoirs.
- Chaque pièce a des **PV** et une **ATK** (valeurs par type, modifiables par pouvoirs).
- **Pion** : avance d'**une case tout droit** (jamais en diagonale pour se déplacer),
  **deux cases à son premier coup** du niveau ; il **attaque en diagonale vers
  l'avant**. Pas de prise en passant. Pas de promotion par défaut (peut venir d'un
  pouvoir).
- Les autres pièces se déplacent comme aux échecs, sous réserve des terrains.

### Combat
- Une attaque inflige **ATK de l'attaquant** en dégâts aux PV de la cible.
- **Cible tuée** : l'attaquant prend sa case.
- **Cible survivante** :
  - pièce qui glisse depuis une distance ≥ 2 : l'attaquant **s'arrête sur la case
    juste avant** la cible ;
  - attaque **adjacente** ou **saut** (Cavalier) : l'attaquant atterrit sur une
    **case libre adjacente à la cible, au choix du joueur** (l'IA choisit pour
    l'ennemi) ; s'il n'y en a aucune, il **reste sur sa case d'origine**.

### Exemples de pouvoirs (à équilibrer)
+1 PV, +1 ATK, +1 de portée, traverser la forêt, bouclier (annule la 1re attaque
reçue), riposte, saut, promotion du pion.

## 5. IA ennemie
- Minimax / alpha-bêta de profondeur 2–3, exécuté dans un **Web Worker**.
- Difficulté croissante au fil des actes (profondeur, heuristiques).

## 6. Technique

| Couche | Choix |
|---|---|
| Langage / build | TypeScript strict, Vite |
| Interface | React + SVG (vectoriel épuré), responsive mobile/bureau |
| PWA | vite-plugin-pwa (manifest, service worker, hors ligne) |
| Tests | Vitest (moteur), Playwright plus tard pour l'interface |
| i18n | i18next + react-i18next, **FR + EN dès le départ** |
| Sauvegarde | IndexedDB via idb-keyval |
| Hébergement | GitHub Pages via GitHub Actions (`BASE_PATH=/ChessGame/`) |

### Organisation du code
```
src/
  engine/    règles pures TS, sans dépendance UI, testées
    board/   grille, masque, terrains
    pieces/  définitions data-driven (mouvements, PV, ATK)
    powers/  pouvoirs = modificateurs
    combat/  résolution d'attaque, case d'arrivée
    ai/      IA (Web Worker)
    goals/   objectifs de niveau
  run/       carte, récompenses, héros, déblocages
  content/   gabarits de niveaux, classes de héros, pouvoirs
  ui/        composants React/SVG
  i18n/      traductions FR/EN
```

## 7. Jalon 1 — Prototype jouable
1. ✅ Projet initialisé (Vite, React, TS, Vitest, PWA, i18n FR/EN, RNG à seed).
2. Moteur testé : plateau irrégulier, terrains, déplacements des 6 pièces,
   combat PV/ATK, objectif « capturer tout ».
3. IA simple.
4. Interface SVG responsive.
5. 3 à 5 niveaux enchaînés avec choix de récompense, 2 classes de héros.
6. Sauvegarde locale (IndexedDB).
