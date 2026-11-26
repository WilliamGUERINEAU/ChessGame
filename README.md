# Gambit Rogue (nom provisoire)

Roguelite d'échecs en PWA : une suite de mini-problèmes sur des plateaux
irréguliers, avec terrains, pièces à PV et pouvoirs gagnés entre les niveaux.

Règles et choix de conception : [docs/DESIGN.md](docs/DESIGN.md).

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
