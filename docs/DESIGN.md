# Document de conception — Gambit Rogue

> Nom de travail provisoire. Ce document fixe les règles décidées ; toute
> évolution des règles doit être reportée ici. Les règles marquées ✅ sont
> implémentées et testées (`src/engine/` pour les règles, `src/run/` pour le run).

## 1. Concept

Roguelite d'échecs au tour par tour, jouable en PWA (mobile et bureau à égalité).
Un **run** est une suite de **mini-problèmes** sur des plateaux de forme
irrégulière, avec des terrains. Entre deux mini-problèmes, le joueur gagne une
nouvelle pièce ou un pouvoir pour une pièce qu'il possède.

## 2. Structure d'un run

- **Carte à embranchements** (à venir) : à chaque étape, le joueur choisit le
  prochain nœud. Pour l'instant, un run enchaîne les 6 niveaux de démonstration
  dans l'ordre.
- **Types de nœuds** : combat, survie, capture, boss (fin d'acte).
- **Héros** ✅ : en début de run, le joueur choisit une **classe de départ**. Chaque
  classe a un héros (une pièce) avec un pouvoir de départ et une armée.

  | Classe | Héros | Pouvoirs du héros | Armée de départ |
  |---|---|---|---|
  | Souverain | Roi (4 PV, 1 ATK) | Riposte | Tour |
  | Chevalière | Cavalier (4 PV, 2 ATK) | Bouclier, Vigueur | Fou |
  | Éclaireuse (à débloquer) | Fou (4 PV, 2 ATK) | Élan, Vigueur | Cavalier |

  On part avec **2 pièces** (héros compris) ; l'armée grandit avec les récompenses.
- **Ennemis** ✅ : de plus en plus nombreux au fil du run : 2, puis 3, 3, 3
  (interception), 4 (+ renforts) et 4 (le dernier niveau compte la cible Gardienne).

- **Armée** ✅ : **6 pièces au maximum**, héros compris.
- **Défaite** ✅ : **tout niveau perdu met fin au run** (mort du héros, temps
  écoulé, blocage).
- **Entre deux niveaux** ✅ :
  - une pièce morte est **perdue pour le reste du run** ;
  - les pièces survivantes **récupèrent tous leurs PV** et gardent leurs pouvoirs ;
  - récompense : **choisir 1 option parmi 3**, nouvelle pièce ou pouvoir à donner à
    une pièce de l'armée (le joueur choisit laquelle parmi celles qui peuvent le
    recevoir).
- **Tirage des récompenses** ✅ : 3 options distinctes, **au moins une pièce et au
  moins un pouvoir** (tant que l'armée n'est pas complète et qu'un pouvoir peut
  servir). Rareté des pièces : Pion 35, Cavalier 22, Fou 22, Tour 15, Dame 6
  (jamais de Roi). Seuls les pouvoirs utilisables par au moins une pièce sont
  proposés ; Vigueur et Force un peu plus souvent.
- **Progression entre runs** ✅ : de la **variété, jamais de la puissance**. Profil
  sur l'appareil (combats gagnés, plus haut niveau atteint, runs gagnés) :
  - 3 combats gagnés : **Repousser** et **Vampirisme** entrent dans les récompenses ;
  - atteindre le niveau 4 : classe **Éclaireuse**.
  Les pouvoirs verrouillés sont fixés au début du run (tirages reproductibles). Le
  bilan annonce les déblocages ; l'écran des classes donne la condition.
  (À venir : option pour désactiver la progression.)
- **Sauvegarde** ✅ : le run et le combat en cours sont sauvegardés à chaque action
  (`localStorage`) ; « Continuer le run » sur l'accueil. Un combat terminé est
  aussi sauvegardé : recharger ne permet pas d'annuler une défaite. Une sauvegarde
  illisible ou incompatible (nombre de niveaux changé) est ignorée.
- **Entraînement** ✅ : chaque niveau se rejoue à volonté avec une armée fixe, hors run.

## 3. Niveaux (mini-problèmes)

### Plateaux ✅
- Grille avec des **cases absentes** : formes irrégulières (L, trous, îlots…).
  Le vide se comporte comme l'eau : on ne s'y arrête pas et on ne le traverse pas
  en glissant ; le Cavalier peut le sauter.
- Chaque gabarit définit la **direction « avant »** de chaque camp (pour les pions).
- Chaque gabarit définit une **zone de déploiement** ✅ (au moins 6 cases) : avant
  le niveau, le jeu **propose un placement** (héros au centre de la rangée arrière,
  Pions devant, les autres près du héros) que le joueur peut retoucher : toucher une
  pièce, puis une case de la zone (ou une autre pièce pour les échanger).
- **Cartes** ✅ : environ **9 × 10**, zone de départ de **3 × 2 cases au centre de
  la dernière rangée**. Les murs y sont **décoratifs** : ils ne servent jamais à
  couper les lignes entre la zone et les ennemis.
- **Pas de prise au premier coup** ✅ : depuis n'importe quelle case de zone, aucune
  pièce du joueur ne peut attaquer à son premier coup, même une Dame avec
  Forestier, un Roi ou un Pion avec Allonge. Les ennemis partent donc des côtés,
  hors des colonnes et des diagonales qui partent de la zone. Un test le vérifie
  pour chaque niveau, avec et sans les murs. L'ennemi, lui, peut punir un placement
  imprudent dès son premier coup.

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
| Combat | Capturer **toutes** les pièces adverses. | Limite de tours facultative (défaite « temps écoulé ») : 10 à 16 tours dans la démo. |
| Survie | Tenir **N tours** avec le héros vivant (5 dans la démo). | Un tour est fini quand l'ennemi a joué. Gagné aussi si plus aucun ennemi ne reste (renforts attendus compris). L'ennemi y est **très agressif** : chaque PV du héros vaut pour lui plus qu'une pièce mineure, et il fonce (agressivité 2). |
| Capture | Capturer **une pièce cible** précise. | Limite de tours facultative : le joueur dispose alors de N coups (12 pour la Gardienne). |
| Interception | Empêcher les ennemis d'atteindre une **sortie** pendant N tours. | Perdu dès qu'un ennemi se tient sur une sortie (« Le col » : 2 sorties, 6 tours). Une pièce posée sur la sortie la bloque. |
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

### Pouvoirs ✅
Gagnés en récompense (ou portés par le héros dès le départ), conservés tout le run.

| Pouvoir | Effet | Pièces | Max |
|---|---|---|---|
| Vigueur | +2 PV max | toutes | 3 |
| Force | +1 ATK | toutes | 3 |
| Forestier | La forêt n'arrête plus ses glissades (ni le double pas du Pion) | Dame, Tour, Fou, Pion | 1 |
| Patins | Ne glisse pas sur la glace et ne peut pas être repoussé (proposé plus rarement) | toutes sauf Cavalier | 1 |
| Allonge | Roi : se déplace et attaque jusqu'à 3 cases. Pion : deux cases de plus vers l'avant (4 au premier coup) | Roi, Pion | 1 |
| Bouclier | La première attaque reçue à chaque niveau ne fait aucun dégât (riposte comprise) | toutes | 1 |
| Riposte | Si la pièce survit à une attaque et peut atteindre l'attaquant là où il a fini (même à distance), elle le frappe aussitôt (sans riposte en retour) | toutes | 1 |
| Promotion | Un Pion qui atteint la dernière rangée (plus aucune case devant lui dans sa colonne) devient une Dame **pour tout le run** ; ses PV montent d'autant que son maximum. **Tous les Pions naissent avec ce pouvoir** (ennemis, renforts et Pions gagnés en récompense), qui n'est donc plus proposé en récompense | Pion | 1 |
| Perçage | Ses glissades traversent la première pièce alliée (pas si elle se tient dans une forêt qui l'arrêterait). Si cet allié est juste devant une cible qui survit, l'attaquant reste sur place | Dame, Tour, Fou | 1 |
| Élan | Après une capture, la pièce **rejoue aussitôt** (elle seule ; « Terminer le tour » pour s'arrêter). Une fois par tour : une capture pendant l'Élan n'en redonne pas | toutes | 1 |
| Balayage | Chaque attaque inflige aussi les mêmes dégâts aux ennemis voisins de la cible | toutes | 1 |
| Repousser | Une cible qui survit recule d'une case dans l'axe de l'attaque (et glisse sur la glace) ; si la case est bloquée, elle est **écrasée** : 1 dégât | toutes | 1 |
| Vampirisme | Regagne autant de PV que les dégâts infligés (balayage compris), sans dépasser son maximum | toutes | 1 |

Ordre de résolution d'une attaque : coup → balayage → déplacement de l'attaquant →
poussée (ou écrasement) → riposte → promotion → Élan.

### Rythme ✅
- L'ennemi joue au plus tôt **0,25 s** après le coup du joueur ; animations de
  déplacement de 160 ms, flash de dégâts de 400 ms.
- Tous les niveaux de combat ont une **limite de tours** ; le lac gelé oppose un
  Cavalier (au lieu d'une Tour, trop fuyante) et deux Pions.

### Renforts ✅
- Un niveau peut prévoir des **vagues de renforts** : au début du tour indiqué,
  leurs pièces apparaissent sur leur case, ou attendent qu'elle se libère.
- Tant que des renforts ennemis sont attendus, il reste des ennemis : pas de
  victoire « toutes les pièces ennemies sont tombées ».
- À l'écran : cases d'arrivée de la prochaine vague en pointillés rouges (avec le
  numéro du tour), annonce dans le panneau, entrée de journal, légende.
- « Tenir la ligne » : 2 Cavaliers sur les flancs au tour 2, puis une Dame et
  2 Pions (avec Promotion) au tour 3. La ligne de promotion ennemie s'affiche en
  rouge dès qu'un Pion ennemi peut se promouvoir.

## 5. IA ennemie ✅
- Recherche **minimax avec élagage alpha-bêta** (`src/engine/ai/`), calculée dans un
  **Web Worker** (repli automatique sur le fil principal si besoin). Quelques
  millisecondes par coup sur nos plateaux.
- **Évaluation** : valeur de chaque pièce (type + PV), PV du héros comptés en plus
  (l'ennemi cherche à l'user), bonus pour la cible d'un niveau de capture, et
  **approche** des ennemis vers le héros. L'approche est un **bonus positif par
  pièce**, plus grand près du but : une pièce garde toujours de la valeur et une
  capture rapporte toujours, même loin du héros. Elle se mesure en **distance de
  marche** (contournement des murs, de l'eau et du vide), pour que les ennemis
  cherchent les brèches au lieu de rester bloqués derrière un mur.
- Pour les parties simulées seulement, deux réglages font venir au contact les
  pièces et le héros du joueur simulé (sans effet sur l'IA ennemie en jeu).
- **Ennemis acculés** ✅ : quand il ne reste que **2 pièces ennemies ou moins**, ou
  après **3 tours (6 actions) sans aucune attaque**, leur agressivité passe à au
  moins 2 : ils cessent de fuir et viennent au contact. Décidé une fois par coup,
  au début de la recherche. Le panneau l'annonce (« Acculés, les ennemis passent à
  l'attaque ! »).
- Une **issue certaine reste départagée par la position** : un ennemi condamné (ex.
  la survie va réussir) continue d'user le héros au lieu de jouer au hasard.
- **Réglages par niveau** : profondeur (demi-coups anticipés), **agressivité**
  (poids de l'approche ; 1 par défaut) et **audace** (part de la valeur de ses
  pièces qu'elle accepte de risquer ; 0,3 par défaut, 0,8 quand elle est acculée).
  La Gardienne garde une agressivité de 0,5 (à 1, ses gardes la délaissent).
- **Pas de jeu la montre** ✅ : l'IA ennemie ne compte pas une défaite « temps
  écoulé » du joueur comme une victoire ; elle cherche à blesser le héros jusqu'au
  bout. Constat de l'audit : avant, presque toutes les défaites hors survie venaient
  du temps, héros intact.
- **Interception** : les ennemis visent la sortie la plus proche (distance de marche).
- Les égalités sont départagées par le générateur à graine.
- Difficulté croissante : profondeur 1 au niveau 1, 2 au niveau 2, 3 ensuite.
  Ces réglages ont été choisis d'après des parties IA contre IA ; un test vérifie
  que chaque niveau reste gagnable par un joueur simulé.

### Mesures de l'audit (joueur simulé, 6 parties par niveau et par réglage)
- Pouvoirs donnés à toutes les pièces des armées d'entraînement, 36 parties
  (sans pouvoir : 19 victoires) : Élan 30, Allonge 30, Bouclier 29 (héros jamais
  blessé), Riposte 27, Forestier 23, Vigueur 22, Repousser 22, Vampirisme 22,
  Perçage 21, Force 20, Patins 19 et Balayage 18 avant renforcement (21 après).
  Les cumuls extrêmes (Vigueur ×3 : 22, Force ×3 : 26, Élan + Balayage : 24) ne
  déforment pas le jeu. À confirmer par des parties humaines.

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
    powers/        pouvoirs : définitions, statistiques dérivées, règles d'attribution
  content/         niveaux de démonstration (plateau, ennemis, zone de déploiement)
  run/             run : classes, armée, déploiement, récompenses, enchaînement
                   (carte et déblocages à venir)
  ui/              interface React/SVG
    board/         plateau, terrains, pièces vectorielles
    game/          déroulement d'un combat (clics, tour de l'IA, journal)
    screens/       accueil, entraînement, partie
    run/           choix de la classe, déploiement, récompense, bilan
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
- **Écrans** : accueil (langue), **run** (choix de la classe → déploiement →
  combat → récompense → … → bilan), **entraînement** (choix du niveau → partie →
  fenêtre de fin : niveau suivant, recommencer, retour aux niveaux).
- **Run** : pas de « Recommencer » pendant un combat ; « Abandonner » demande
  confirmation. Le bilan donne les niveaux réussis et l'armée finale.
- **Récompense** : 3 cartes ; pour un pouvoir, le joueur choisit ensuite la pièce
  (seules celles qui peuvent le recevoir sont actives), puis valide.
- **Jouer** : toucher une de ses pièces affiche ses options : **point** = case où
  aller, **cadre rouge** = pièce à attaquer, **cadre bleu pointillé** = case
  d'atterrissage à choisir quand la cible survit. Toucher la pièce à nouveau
  l'annule ; toucher une autre pièce la sélectionne.
- **Sur chaque pièce** : barre de PV (verte pour le joueur, rouge pour l'ennemi),
  pastille d'ATK, couronne pour le héros, viseur pour la cible, écusson bleu tant
  que le Bouclier est actif.
- **Ligne de promotion** ✅ : dès qu'un Pion du joueur porte Promotion (déploiement
  et combat), un **liseré violet** sur le bord avant et une **petite couronne**
  marquent les cases de promotion : la dernière case praticable de chaque colonne
  (sur un plateau irrégulier, la ligne n'est pas forcément droite). Elle figure
  aussi dans la légende et dans la description des cases.
- **Annonce des menaces** ✅ (principe d'Into the Breach) : toucher un ennemi montre
  ce qu'il peut attaquer au prochain coup (cases hachurées) et sa fiche ; le bouton
  « Menaces ennemies » montre les cases menacées par tous les ennemis.
- **Aperçu d'attaque** ✅ : une pièce sélectionnée affiche sur chaque cible le
  résultat prévu (« −2 » ou « K.O. », et « ↩ −1 » si la cible riposte).
- **Temps** ✅ : à 3 tours de la limite, le compteur passe en rouge et le panneau
  annonce « Plus que N tours ! ».
- **Fin de combat** ✅ : la défaite nomme le coup fatal (ou l'ennemi évadé) et
  donne une astuce liée à sa cause.
- **Récompense** ✅ : aperçu du niveau suivant (plateau, objectif, ennemis,
  renforts, terrains) pour choisir en connaissance de cause.
- **Panneau** : tour en cours, consigne, fiche de la pièce choisie (avec ses
  pouvoirs), journal (attaques, ripostes, boucliers, captures, glissades,
  promotions), légende des terrains.
- Le dernier déplacement est surligné ; une pièce touchée clignote en rouge ; une
  pièce capturée s'efface en fondu ; dégâts et soins s'affichent en nombres
  flottants ; **sons synthétisés** (Web Audio, aucun fichier) avec bouton muet
  mémorisé. Sans animations (mouvements réduits), ces effets sont masqués.
- **Contraste** ✅ vérifié (WCAG) en clair et en sombre : texte ≥ 4,5:1, marques du
  plateau ≥ 3:1 (le plateau reste clair en thème sombre : marques foncées).
- Accessible au clavier (cases actives focalisables, Entrée/Espace) et aux
  lecteurs d'écran (chaque case est décrite). Mouvements réduits respectés.

## 8. Jalon 1 — Prototype jouable
1. ✅ Projet initialisé (Vite, React, TS, Vitest, PWA, i18n FR/EN, RNG à graine).
2. ✅ Moteur testé : plateau irrégulier, terrains, déplacements des 6 pièces,
   combat PV/ATK, glace, objectifs (capturer tout, survivre, capturer une cible),
   mort du héros, blocage.
3. ✅ IA (minimax alpha-bêta dans un Web Worker, réglable par niveau).
4. ✅ Interface SVG responsive, FR/EN, clair/sombre.
5. ✅ Run de 6 niveaux avec déploiement, récompenses (13 pouvoirs, nouvelles
   pièces) et 3 classes de héros (dont une à débloquer).
6. ✅ Sauvegarde locale du run (`localStorage`) et profil de progression.

### Ensuite
- Carte à embranchements et types de nœuds.
- Option pour désactiver les déblocages (mode roguelike pur).
- Équilibrage du run : dans les parties simulées, beaucoup de runs échouent au
  niveau 5 (« Le gardien », temps écoulé) ; les blocages restants viennent surtout
  des limites du joueur simulé (il défend au lieu d'attaquer). À confirmer par des
  parties humaines.
