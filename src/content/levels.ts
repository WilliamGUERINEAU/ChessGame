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
  // Ennemis : 2, puis 3, 3, 4, 4. Les zones de déploiement sont hors de portée des
  // ennemis : aucune pièce du joueur ne peut attaquer dès son premier coup (testé).
  level('first-steps', {
    terrain: [
      ' ..... ',
      '...f...',
      '.......',
      '#.###.#',
      '.......',
      '.......',
      ' ..... ',
    ],
    units: [
      ' ..... ',
      '..p.b..',
      '.......',
      '.......',
      '.......',
      '..R....',
      ' ..K.. ',
    ],
    deployment: ['', '', '', '', '', 'xxxxxxx', ' xxxxx '],
    hero: { x: 3, y: 6 },
    goal: { kind: 'eliminate' },
    // Niveau d'introduction : l'ennemi ne voit qu'un coup (le joueur gagne même en jouant à courte vue).
    aiDepth: 1,
  }),

  level('the-bend', {
    terrain: [
      '.....   ',
      '.f...   ',
      '....#   ',
      '...##...',
      '........',
      '...~....',
    ],
    units: [
      '.n.p.   ',
      '..p..   ',
      '.....   ',
      '........',
      '......B.',
      '.....K.R',
    ],
    deployment: ['', '', '', '', '    xxxx', '    xxxx'],
    hero: { x: 5, y: 5 },
    goal: { kind: 'eliminate' },
    aiDepth: 2,
  }),

  level('frozen-lake', {
    terrain: [
      '.......',
      '.iiiii.',
      '.i~~~i.',
      '.iiiii.',
      '.......',
      '.......',
    ],
    units: [
      '..prp..',
      '.......',
      '.......',
      '.......',
      '.......',
      '.N.K.R.',
    ],
    deployment: ['', '', '', '', 'xxxxxxx', 'xxxxxxx'],
    hero: { x: 3, y: 5 },
    goal: { kind: 'eliminate' },
    // Plus agressifs : sur la glace, des ennemis prudents tournent en rond.
    aiAggression: 1,
  }),

  level('hold-the-line', {
    terrain: [
      '......',
      '......',
      '#.##.#',
      '......',
      '......',
      '.f..f.',
      '......',
    ],
    units: [
      'n.r..n',
      '...q..',
      '......',
      '......',
      '......',
      '.P..P.',
      '..KR..',
    ],
    deployment: ['', '', '', '', '', 'xxxxxx', 'xxxxxx'],
    hero: { x: 2, y: 6 },
    goal: { kind: 'survive', rounds: 6 },
  }),

  level('the-warden', {
    terrain: [
      ' ..... ',
      '...#...',
      '.f...f.',
      '.#.#.#.',
      '..~.~..',
      '.......',
      '.......',
      ' ..... ',
    ],
    units: [
      ' ..r.. ',
      '..p.p..',
      '...n...',
      '.......',
      '.......',
      '.......',
      '...P...',
      ' .NKQ. ',
    ],
    deployment: ['', '', '', '', '', '', 'xxxxxxx', ' xxxxx '],
    hero: { x: 3, y: 7 },
    goal: { kind: 'capture', target: { x: 3, y: 0 }, maxRounds: 12 },
    stats: { '3,0': { id: 'warden', hp: 5 } },
  }),
]
