import type { Direction, GoalDefinition, LevelDefinition, Pos, Side, UnitSpec } from '../engine'
import { posKey, unitsFromAscii } from '../engine'

/**
 * Un niveau jouable : sa définition pour le moteur et quelques réglages.
 * En entraînement, on joue `definition` telle quelle (armée fixe). Dans un run,
 * seules ses pièces ennemies sont reprises : l'armée du joueur est placée dans
 * la zone `deployment`.
 */
export interface LevelContent {
  /** Identifiant stable, aussi utilisé pour les textes : `levels.<id>.name` et `.description`. */
  readonly id: string
  readonly definition: LevelDefinition
  /** Cases où le joueur déploie son armée dans un run. */
  readonly deployment: readonly Pos[]
  /** Profondeur de recherche de l'IA ennemie. */
  readonly aiDepth: number
  /** Agressivité de l'IA ennemie (voir `AiOptions.aggression`). */
  readonly aiAggression: number
}

/** Réglages par défaut de l'IA des niveaux, choisis d'après des parties IA contre IA. */
export const DEFAULT_LEVEL_AI = { depth: 3, aggression: 0.5 } as const

interface LevelSpec {
  /** Plateau en texte : `.` sol, `f` forêt, `~` eau, `#` mur, `i` glace, espace = vide. */
  readonly terrain: readonly string[]
  /** Pièces en texte : K Q R B N P = joueur, k q r b n p = ennemi. */
  readonly units: readonly string[]
  /** Zone de déploiement en texte, alignée sur le plateau : `x` = case de la zone. */
  readonly deployment: readonly string[]
  readonly hero: Pos
  readonly goal: GoalDefinition
  readonly forward?: Readonly<Record<Side, Direction>>
  /** Statistiques particulières, par case « x,y ». */
  readonly stats?: Readonly<Record<string, Partial<Pick<UnitSpec, 'id' | 'hp' | 'maxHp' | 'atk'>>>>
  readonly aiDepth?: number
  readonly aiAggression?: number
}

function cellsMarked(rows: readonly string[]): Pos[] {
  return rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === 'x' ? [{ x, y }] : [])))
}

function level(id: string, spec: LevelSpec): LevelContent {
  const units = unitsFromAscii(spec.units).map((unit) => ({ ...unit, ...spec.stats?.[posKey(unit.at)] }))
  return {
    id,
    deployment: cellsMarked(spec.deployment),
    aiDepth: spec.aiDepth ?? DEFAULT_LEVEL_AI.depth,
    aiAggression: spec.aiAggression ?? DEFAULT_LEVEL_AI.aggression,
    definition: {
      terrain: spec.terrain,
      units,
      hero: spec.hero,
      goal: spec.goal,
      forward: spec.forward ?? { player: 'up', enemy: 'down' },
    },
  }
}

/**
 * Niveaux de démonstration, joués dans l'ordre. Ils présentent les règles une à
 * une ; les vrais runs les remplaceront par des niveaux générés.
 */
export const DEMO_LEVELS: readonly LevelContent[] = [
  // Cartes d'environ 9 × 10, zone de départ de 3 × 2 cases au centre en bas.
  // Ennemis : 2, puis 3, 3, 4, 4, partis des côtés : aucune pièce placée dans la
  // zone ne peut attaquer dès son premier coup, même sans les murs (testé).
  level('first-steps', {
    terrain: [
      ' ....... ',
      '.........',
      '...f.....',
      '.........',
      '.....#...',
      '..f......',
      '.........',
      '......f..',
      '.........',
      ' ....... ',
    ],
    units: [
      '',
      '.p.....b.',
      '',
      '',
      '',
      '',
      '',
      '',
      '....R....',
      '....K....',
    ],
    deployment: ['', '', '', '', '', '', '', '', '   xxx', '   xxx'],
    hero: { x: 4, y: 9 },
    goal: { kind: 'eliminate', maxRounds: 10 },
    // Niveau d'introduction : l'ennemi ne voit qu'un coup (le joueur gagne même en jouant à courte vue).
    aiDepth: 1,
  }),

  level('the-bend', {
    terrain: [
      '.....    ',
      '.f...    ',
      '.....    ',
      '...f.    ',
      '.....    ',
      '.........',
      '....#....',
      '..f...~..',
      '.........',
      ' ....... ',
    ],
    units: [
      '.n...    ',
      '..p..    ',
      'p....    ',
      '',
      '',
      '',
      '',
      '',
      '...B.....',
      '....KR...',
    ],
    deployment: ['', '', '', '', '', '', '', '', '   xxx', '   xxx'],
    hero: { x: 4, y: 9 },
    goal: { kind: 'eliminate', maxRounds: 16 },
    aiDepth: 2,
  }),

  level('frozen-lake', {
    terrain: [
      '.........',
      '.........',
      '..iiiii..',
      '..i~~~i..',
      '..i~~~i..',
      '..iiiii..',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    units: [
      '........n',
      '.p.....p.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '...NKR...',
    ],
    deployment: ['', '', '', '', '', '', '', '', '   xxx', '   xxx'],
    hero: { x: 4, y: 9 },
    goal: { kind: 'eliminate', maxRounds: 16 },
    // Plus agressifs : sur la glace, des ennemis prudents tournent en rond.
    aiAggression: 1,
  }),

  level('hold-the-line', {
    terrain: [
      '.........',
      '.........',
      '.f.....f.',
      '.........',
      '...#.#...',
      '.........',
      '..f...f..',
      '.........',
      '.........',
      '.........',
    ],
    units: [
      'n.......n',
      '..b...r..',
      '',
      '',
      '',
      '',
      '',
      '',
      '...P.P...',
      '...RK....',
    ],
    deployment: ['', '', '', '', '', '', '', '', '   xxx', '   xxx'],
    hero: { x: 4, y: 9 },
    goal: { kind: 'survive', rounds: 5 },
  }),

  level('the-warden', {
    terrain: [
      ' ....... ',
      '.........',
      '..f...f..',
      '....#....',
      '.~.....~.',
      '.........',
      '...f.....',
      '.........',
      '.........',
      ' ....... ',
    ],
    units: [
      ' r....n. ',
      'p......p.',
      '',
      '',
      '',
      '',
      '',
      '',
      '....P....',
      '...NKQ...',
    ],
    deployment: ['', '', '', '', '', '', '', '', '   xxx', '   xxx'],
    hero: { x: 4, y: 9 },
    goal: { kind: 'capture', target: { x: 1, y: 0 }, maxRounds: 12 },
    stats: { '1,0': { id: 'warden', hp: 5 } },
  }),
]
