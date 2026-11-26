# Gambit Rogue (nom provisoire)

Roguelite d'échecs en PWA : une suite de mini-problèmes sur des plateaux
irréguliers, avec terrains, pièces à PV et pouvoirs gagnés entre les niveaux.

Règles et choix de conception : [docs/DESIGN.md](docs/DESIGN.md).

## Jouer

En ligne : <https://williamguerineau.github.io/ChessGame/> (installable comme une
application, jouable hors ligne).

- **Nouvelle partie** : choisissez votre héros (Souverain ou Chevalière), placez
  votre armée, puis enchaînez cinq niveaux. Après chaque victoire, choisissez une
  récompense : une nouvelle pièce ou un pouvoir. Si un niveau est perdu, le run
  s'arrête.
- **Entraînement** : rejouez chaque niveau avec une armée fixe.

En combat, touchez une de vos pièces pour voir où elle peut aller (point), qui
elle peut attaquer (cadre rouge) et, si la cible survit, où atterrir (cadre bleu).

## Développement

Prérequis : Node 22+.

```bash
npm install        # dépendances
npm run dev        # serveur de développement
npm test           # tests (Vitest)
npm run lint       # lint (oxlint)
npm run build      # vérification des types + build de production (dist/)
npm run preview    # sert le build, service worker compris
```

Pour servir le jeu depuis un sous-dossier (ex. GitHub Pages) :

```bash
BASE_PATH=/ChessGame/ npm run build
```

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : lint, tests, build,
puis publication sur GitHub Pages (`https://williamguerineau.github.io/ChessGame/`).
Le workflow peut aussi être lancé à la main (onglet Actions → « Run workflow »).

Réglage requis une fois : **Settings → Pages → Source : GitHub Actions**.
