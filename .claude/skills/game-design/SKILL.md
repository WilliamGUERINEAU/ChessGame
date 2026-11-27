---
name: game-design
description: Principes de game design pour Gambit Rogue (rogue-lite d'échecs tactique au tour par tour, en PWA). À charger avant de concevoir ou de modifier une règle, un pouvoir, une pièce, un niveau, l'IA ennemie, la difficulté, les récompenses, le rythme ou le ressenti et l'interface du jeu.
---

# Game design — Gambit Rogue

Principes tirés de sources reconnues (voir « Sources »), traduits en règles
concrètes pour ce jeu. Ce sont des repères, pas des lois : un écart est permis
s'il est voulu, expliqué à l'utilisateur et noté dans `docs/DESIGN.md`.

## Démarche pour toute modification de design

1. **Intention joueur** : écrire en une phrase ce que le joueur doit ressentir ou
   décider grâce à la modification (« je dois choisir entre protéger mon héros et
   tuer la Dame »). Sans intention claire, demander à l'utilisateur.
2. **Passer la liste de contrôle** ci-dessous (lisibilité, choix, équilibre, ressenti).
3. **Mesurer** avant d'affirmer : simuler des parties IA contre IA (voir
   « Équilibrage ») et donner les chiffres à l'utilisateur, avec leurs limites.
4. **Une variable à la fois** : changer un réglage, mesurer, puis le suivant.
5. **Documenter** la règle et les chiffres retenus dans `docs/DESIGN.md`.

## 1. Tactique au tour par tour

- **Information parfaite, résolution déterministe.** Pas de jet de dés en
  combat : les dégâts sont connus d'avance. Le hasard n'intervient qu'*entre*
  les décisions (récompenses tirées, futurs niveaux générés), jamais pour
  annuler une bonne décision.
- **Toute défaite doit sembler être la faute du joueur.** S'il meurt sans
  comprendre pourquoi, c'est un défaut de design. Chaque menace doit être
  visible *avant* le coup où elle frappe.
- **Annoncer les menaces.** Exemples déjà en place : ligne de promotion (alliée
  en violet, ennemie en rouge), cases d'arrivée des renforts avec leur tour,
  alerte « ennemis acculés ». Toute nouvelle menace (pouvoir ennemi, boss,
  terrain qui change) doit avoir son indicateur sur le plateau, sa ligne dans
  la légende et une entrée dans le journal.
- **Règles cohérentes et partagées.** Les ennemis suivent les mêmes règles que
  le joueur (mouvements, terrains, pouvoirs). Une exception doit être annoncée.
- **Le puzzle naît des contraintes.** Une bonne position oblige à arbitrer
  (héros contre matériel, avancer contre tenir). Une limite de tours rend
  l'attentisme perdant et accélère le rythme ; un terrain doit changer les
  options, pas seulement le décor.
- **Une réponse existe toujours.** Pour chaque niveau, au moins une ligne de jeu
  gagne (test « est gagnable »). Aucune prise ne doit être possible dès le
  premier coup depuis la zone de déploiement (test de sécurité des zones).

## 2. Rogue-lite : runs, récompenses et pouvoirs

- **Des choix qui comptent.** Chaque récompense propose des options *distinctes*
  qui orientent vers des façons de jouer différentes (aujourd'hui : 3 options,
  au moins une pièce et un pouvoir tant que c'est possible). Une option qui est
  toujours la meilleure, ou jamais prise, est à revoir.
- **Chaque pouvoir a sa place.** Il doit exister une situation où il est le bon
  choix. Éviter les pouvoirs qui « déforment » tout le jeu (qui rendent les
  autres choix inutiles ou cassent l'équilibre des niveaux).
- **Synergies.** Rechercher des interactions lisibles entre pouvoirs (ex. Élan +
  Balayage, Repousser + glace) : des petites synergies de stats, quelques
  grosses synergies de style de jeu. Tester les combinaisons extrêmes avant
  d'ajouter un pouvoir.
- **Risque et récompense, sans épuiser.** Des décisions risquées mais payantes
  de temps en temps, pas à chaque coup.
- **Échouer vite, apprendre, recommencer.** Runs courts, niveaux courts, retour
  rapide au début ; la défaite doit apprendre quelque chose.
- **Progression entre runs : de la variété plutôt que de la puissance.**
  Débloquer de nouvelles options (classes, pièces, pouvoirs) plutôt que rendre
  les runs suivants simplement plus faciles.

## 3. Équilibrage

- **Piloté par les mesures.** Utiliser les parties simulées : le joueur simulé
  de `src/content/levels.test.ts` (`selfPlay`) et les scripts de calibrage
  temporaires (un fichier `*.test.ts` lancé avec `--silent=false`, puis supprimé).
- **Encadrer la force du joueur simulé.** Le joueur simulé n'est qu'une
  approximation : le mesurer à plusieurs profondeurs (2, 3, 4) et présenter les
  résultats comme une fourchette, sans les confondre avec un vrai joueur.
- **Courbe de difficulté.** Monter progressivement (ennemis : 2, 3, 3, 4, 4 dans
  la démo). Laisser de la marge aux limites de tours : régler la limite au-delà
  de la durée médiane d'une victoire simulée.
- **Repérer les extrêmes.** Un niveau gagné à 100 % sans dégâts ou jamais gagné
  est hors cible ; le noter et proposer un réglage à l'utilisateur.
- **Vérifier les tests eux-mêmes.** Pour une nouvelle règle, injecter
  volontairement un bug (inverser une condition, retirer un plafond) et
  s'assurer qu'un test échoue, puis restaurer le fichier.

## 4. Ressenti (game feel) et interface

- **Un retour pour chaque action.** Déplacement animé, flash de dégâts, entrée
  de journal, dernier coup surligné. Une règle sans retour visuel n'existe pas
  pour le joueur.
- **Les effets servent le jeu.** Les effets (flash, secousse, particules) doivent
  renforcer une information de jeu, jamais la masquer. Les garder courts : le
  tour ennemi arrive en ~0,25 s, les animations durent ~160 ms, le flash ~400 ms.
- **Respecter `prefers-reduced-motion`** : toute nouvelle animation doit s'y
  désactiver (bloc existant dans `src/ui/ui.css`).
- **Lisible sur téléphone.** Tester à la largeur d'un téléphone : cibles tactiles
  suffisantes, aucun défilement horizontal, textes FR et EN qui tiennent.
- **Apprendre en jouant.** Introduire une règle à la fois, dans un niveau qui la
  met en valeur ; un texte court (indice du panneau, légende) plutôt qu'un
  long tutoriel.

## 5. Accessibilité (niveau « basique » d'abord)

- **Jamais la couleur seule** : doubler par une forme, une icône ou un chiffre
  (ex. pastilles de PV et chiffres d'ATK, couronne de promotion, numéro de tour
  sur les renforts).
- **Contraste suffisant** en thèmes clair et sombre.
- **Chaque case a une étiquette accessible** (`aria-label` dans `Board.tsx`) :
  y ajouter toute nouvelle information de case (menace, renfort, terrain).
- **Pas de pression temporelle réelle** : le jeu reste au tour par tour ;
  aucun chronomètre en temps réel sans option pour le couper.

## Liste de contrôle avant de proposer un changement

- [ ] Intention joueur écrite en une phrase.
- [ ] Menace ou règle nouvelle visible avant qu'elle n'agisse (plateau, légende, journal).
- [ ] Aucun hasard ne peut annuler une bonne décision.
- [ ] Le choix ajouté est réel : aucune option dominante ou inutile.
- [ ] Mesuré par simulation (plusieurs graines, plusieurs forces de joueur), chiffres donnés.
- [ ] Tests de sécurité des zones et « est gagnable » toujours verts.
- [ ] Retour visuel, `prefers-reduced-motion`, largeur téléphone, FR et EN vérifiés.
- [ ] `docs/DESIGN.md` mis à jour.

## Sources

- Into the Breach (Subset Games) : attaques annoncées, information parfaite,
  « chaque mort doit être la faute du joueur » —
  [Road to the IGF](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-),
  [GDC 2019 : An Inside Look at Into the Breach](https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach),
  [Kotaku Review](https://kotaku.com/into-the-breach-the-kotaku-review-1823365331).
- Slay the Spire (Mega Crit), « Metrics Driven Design and Balance », GDC 2019 :
  « chaque carte doit avoir sa place », éviter ce qui déforme le jeu —
  [GDC](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019),
  [compte rendu](https://mechanicsofmagic.com/2022/05/22/critical-play-is-this-game-balanced-10/).
- Rogue-likes et rogue-lites : [Berlin Interpretation](https://en.wikipedia.org/wiki/Roguelike),
  [Meta as variety, not power](https://saschb2b.github.io/game-mechanics/concepts/meta-as-variety-not-power),
  [Balancing Randomness and Player Agency](https://echoesofmyth-devblog.blogspot.com/2025/02/balancing-randomness-and-player-agency.html).
- Game feel : « Juice it or lose it » (Jonasson et Purho, 2012) —
  [Game feel](https://en.wikipedia.org/wiki/Game_feel),
  [Squeezing more juice](https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-).
- Accessibilité : [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/).
