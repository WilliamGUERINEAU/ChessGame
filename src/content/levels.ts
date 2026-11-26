import type { Direction, GoalDefinition, LevelDefinition, Pos, Side, UnitSpec } from '../engine'
import { posKey, unitsFromAscii } from '../engine'

/** Un niveau jouable : sa définition pour le moteur et quelques réglages. */
export interface LevelContent {
  /** Identifiant stable, aussi utilisé pour les textes : `levels.<id>.name` et `.description`. */
  readonly id: string
  readonly definition: LevelDefinition
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
  readonly hero: Pos
  readonly goal: GoalDefinition
  readonly forward?: Readonly<Record<Side, Direction>>
  /** Statistiques particulières, par case « x,y ». */
  readonly stats?: Readonly<Record<string, Partial<Pick<UnitSpec, 'id' | 'hp' | 'maxHp' | 'atk'>>>>
  readonly aiDepth?: number
  readonly aiAggression?: number
}

function level(id: string, spec: LevelSpec): LevelContent {
  const units = unitsFromAscii(spec.units).map((unit) => ({ ...unit, ...spec.stats?.[posKey(unit.at)] }))
  return {
    id,
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
  level('first-steps', {
    terrain: [
      ' ..... ',
      '...f...',
      '.......',
      '..f....',
      '.......',
      ' ..... ',
    ],
    units: [
      ' .p.p. ',
      '.......',
      '...b...',
      '.......',
      '.R...N.',
      ' ..K.. ',
    ],
    hero: { x: 3, y: 5 },
    goal: { kind: 'eliminate' },
    // Niveau d'introduction : l'ennemi ne voit qu'un coup (le joueur gagne même en jouant à courte vue).
    aiDepth: 1,
  }),

  level('the-bend', {
    terrain: [
      '.....   ',
      '.f...   ',
      '.....   ',
      '...f....',
      '........',
      '...~....',
    ],
    units: [
      '.n.p.   ',
      '..p..   ',
      '.....   ',
      '........',
      '.....B..',
      '....K..R',
    ],
    hero: { x: 4, y: 5 },
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
      '.p.r.p.',
      '.......',
      '.......',
      '.......',
      '.......',
      '.N.K.R.',
    ],
    hero: { x: 3, y: 5 },
    goal: { kind: 'eliminate' },
    // Plus agressifs : sur la glace, des ennemis prudents tournent en rond.
    aiAggression: 1,
  }),

  level('hold-the-line', {
    terrain: [
      '......',
      '......',
      '..##..',
      '......',
      '.f..f.',
      '......',
    ],
    units: [
      'n.rq.n',
      '......',
      '......',
      '......',
      '.P..P.',
      '..KR..',
    ],
    hero: { x: 2, y: 5 },
    goal: { kind: 'survive', rounds: 6 },
  }),

  level('the-warden', {
    terrain: [
      ' ..... ',
      '...#...',
      '.f...f.',
      '.......',
      '..~.~..',
      '.......',
      ' ..... ',
    ],
    units: [
      ' ..r.. ',
      '.p...p.',
      '.......',
      '.......',
      '.......',
      '.......',
      ' .NKQ. ',
    ],
    hero: { x: 3, y: 6 },
    goal: { kind: 'capture', target: { x: 3, y: 0 }, maxRounds: 12 },
    stats: { '3,0': { id: 'warden', hp: 5 } },
  }),
]
