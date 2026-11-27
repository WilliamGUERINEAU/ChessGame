import {
  canReceive,
  createRng,
  POWER_IDS,
  type EndReason,
  type GameState,
  type PieceType,
  type PowerId,
  type Rng,
} from '../engine'
import { withStartingPowers } from '../content/rules'
import { CLASSES, type ClassId } from './classes'

/** Taille maximale de l'armée, héros compris. */
export const MAX_ARMY = 6

/** Une pièce de l'armée du joueur, conservée d'un niveau à l'autre. */
export interface ArmyPiece {
  readonly id: string
  readonly type: PieceType
  readonly powers: readonly PowerId[]
}

/**
 * Étapes d'un run :
 * `deploy` (placer l'armée) → `battle` → `reward` (après une victoire) → `deploy`…
 * jusqu'à `won` (dernier niveau gagné) ou `lost` (n'importe quel niveau perdu).
 */
export type RunPhase = 'deploy' | 'battle' | 'reward' | 'won' | 'lost'

export type RewardOption =
  | { readonly kind: 'piece'; readonly type: PieceType }
  | { readonly kind: 'power'; readonly power: PowerId }

export interface RunState {
  readonly classId: ClassId
  readonly seed: number
  /** État du générateur des récompenses, pour reprendre un run à l'identique. */
  readonly rngState: number
  readonly army: readonly ArmyPiece[]
  readonly heroId: string
  /** Niveau en cours (ou à venir), dans l'ordre de la liste des niveaux du run. */
  readonly levelIndex: number
  readonly levelCount: number
  readonly levelsCleared: number
  readonly phase: RunPhase
  readonly rewardOptions: readonly RewardOption[]
  readonly nextPieceNumber: number
  /** Raison de la défaite quand `phase` vaut `lost`. */
  readonly endReason: EndReason | null
}

/** Rareté des pièces proposées en récompense (jamais de Roi). */
const PIECE_WEIGHTS: ReadonlyArray<readonly [PieceType, number]> = [
  ['pawn', 35],
  ['knight', 22],
  ['bishop', 22],
  ['rook', 15],
  ['queen', 6],
]

/** Fréquence des pouvoirs proposés : les statistiques un peu plus souvent. */
const POWER_WEIGHTS: Readonly<Record<PowerId, number>> = {
  vigor: 3,
  strength: 3,
  shield: 2,
  riposte: 2,
  forester: 2,
  skates: 2,
  reach: 2,
  piercing: 2,
  promotion: 2,
  momentum: 2,
  sweep: 2,
  knockback: 2,
  lifesteal: 2,
}

export function startRun(classId: ClassId, seed: number, levelCount: number): RunState {
  const definition = CLASSES[classId]
  const army: ArmyPiece[] = [
    { id: 'a1', type: definition.hero.type, powers: definition.hero.powers },
    ...definition.army.map((type, index) => withStartingPowers({ id: `a${index + 2}`, type, powers: [] })),
  ]
  return {
    classId,
    seed,
    rngState: createRng(seed).state,
    army,
    heroId: 'a1',
    levelIndex: 0,
    levelCount,
    levelsCleared: 0,
    phase: 'deploy',
    rewardOptions: [],
    nextPieceNumber: army.length + 1,
    endReason: null,
  }
}

export function beginBattle(run: RunState): RunState {
  if (run.phase !== 'deploy') throw new Error(`Impossible de lancer un combat pendant « ${run.phase} »`)
  return { ...run, phase: 'battle' }
}

/**
 * Fin d'un combat. Perdu : le run est perdu. Gagné : les pièces mortes quittent
 * l'armée, les survivantes gardent leurs pouvoirs (et leur promotion) et
 * récupèrent tous leurs PV ; puis récompense, ou victoire du run au dernier niveau.
 */
export function finishBattle(run: RunState, final: GameState): RunState {
  if (run.phase !== 'battle') throw new Error(`Aucun combat en cours (« ${run.phase} »)`)
  if (final.status === 'ongoing') throw new Error('Le combat n’est pas terminé')
  if (final.status === 'lost') return { ...run, phase: 'lost', endReason: final.endReason }

  const army = run.army.flatMap((piece) => {
    const survivor = final.pieces.find((candidate) => candidate.id === piece.id)
    return survivor ? [{ id: piece.id, type: survivor.type, powers: survivor.powers }] : []
  })
  const cleared = { ...run, army, levelsCleared: run.levelsCleared + 1 }
  if (run.levelIndex + 1 >= run.levelCount) return { ...cleared, phase: 'won' }

  const rng = createRng(run.rngState)
  const rewardOptions = drawRewards(army, rng)
  return { ...cleared, phase: 'reward', rewardOptions, rngState: rng.state }
}

/** Pièces de l'armée qui peuvent recevoir ce pouvoir. */
export function eligibleTargets(army: readonly ArmyPiece[], power: PowerId): ArmyPiece[] {
  return army.filter((piece) => canReceive(piece.type, piece.powers, power))
}

/**
 * Applique la récompense choisie (`targetId` : la pièce qui reçoit un pouvoir),
 * puis passe au déploiement du niveau suivant.
 */
export function applyReward(run: RunState, option: RewardOption, targetId?: string): RunState {
  if (run.phase !== 'reward') throw new Error(`Aucune récompense à choisir (« ${run.phase} »)`)
  if (!run.rewardOptions.some((candidate) => sameReward(candidate, option))) {
    throw new Error(`Récompense non proposée : ${JSON.stringify(option)}`)
  }

  let army = run.army
  let nextPieceNumber = run.nextPieceNumber
  if (option.kind === 'piece') {
    if (army.length >= MAX_ARMY) throw new Error('Armée complète')
    army = [...army, withStartingPowers({ id: `a${nextPieceNumber}`, type: option.type, powers: [] })]
    nextPieceNumber += 1
  } else {
    const target = army.find((piece) => piece.id === targetId)
    if (!target || !canReceive(target.type, target.powers, option.power)) {
      throw new Error(`La pièce ${targetId ?? '?'} ne peut pas recevoir « ${option.power} »`)
    }
    army = army.map((piece) => (piece === target ? { ...piece, powers: [...piece.powers, option.power] } : piece))
  }

  return {
    ...run,
    army,
    nextPieceNumber,
    levelIndex: run.levelIndex + 1,
    phase: 'deploy',
    rewardOptions: [],
  }
}

export function sameReward(a: RewardOption, b: RewardOption): boolean {
  if (a.kind === 'piece' && b.kind === 'piece') return a.type === b.type
  if (a.kind === 'power' && b.kind === 'power') return a.power === b.power
  return false
}

/**
 * Trois récompenses distinctes. Tant que l'armée n'est pas complète et qu'un
 * pouvoir peut servir, au moins une nouvelle pièce et au moins un pouvoir.
 */
export function drawRewards(army: readonly ArmyPiece[], rng: Rng): RewardOption[] {
  const pieces: RewardOption[] = army.length < MAX_ARMY ? PIECE_WEIGHTS.map(([type]) => ({ kind: 'piece', type })) : []
  const powers: RewardOption[] = POWER_IDS.filter((power) => eligibleTargets(army, power).length > 0).map(
    (power) => ({ kind: 'power', power }),
  )
  const weight = (option: RewardOption) =>
    option.kind === 'piece'
      ? (PIECE_WEIGHTS.find(([type]) => type === option.type)?.[1] ?? 0)
      : POWER_WEIGHTS[option.power]

  const chosen: RewardOption[] = []
  const takeFrom = (pool: RewardOption[]) => {
    const available = pool.filter((option) => !chosen.some((picked) => sameReward(picked, option)))
    const picked = weightedPick(available, weight, rng)
    if (picked) chosen.push(picked)
  }

  if (pieces.length > 0) takeFrom(pieces)
  if (powers.length > 0) takeFrom(powers)
  while (chosen.length < 3) {
    const before = chosen.length
    takeFrom([...pieces, ...powers])
    if (chosen.length === before) break
  }
  return rng.shuffle(chosen)
}

function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T | undefined {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  if (total <= 0) return undefined
  let roll = rng.next() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}
