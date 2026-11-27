import { isStandable, parseBoard, type Board } from './board/board'
import { posKey, samePos, type Direction, type Pos } from './geometry'
import {
  evaluateOutcome,
  type EndReason,
  type Goal,
  type GoalDefinition,
  type Status,
} from './goals/goals'
import { PIECE_LETTERS, type Piece, type PieceType, type Side } from './pieces/pieces'
import { statsFor, type PowerId } from './powers/powers'

/** Une unité à placer au début d'un niveau. */
export interface UnitSpec {
  readonly type: PieceType
  readonly side: Side
  readonly at: Pos
  /** Identifiant stable ; sinon p1, p2… (joueur) et e1, e2… (ennemi) en ordre de déclaration. */
  readonly id?: string
  /** Pouvoirs portés ; Vigueur et Force s'ajoutent aux valeurs de base. */
  readonly powers?: readonly PowerId[]
  /** PV de départ (par défaut : PV max). */
  readonly hp?: number
  /** PV max (par défaut : `hp` s'il est donné, sinon base du type + Vigueur). */
  readonly maxHp?: number
  /** Attaque (par défaut : base du type + Force). */
  readonly atk?: number
}

/** Vague de renforts : des unités qui arrivent au début d'un tour donné. */
export interface ReinforcementSpec {
  /** Tour d'arrivée (2 ou plus) : elles apparaissent juste après la fin du tour précédent. */
  readonly round: number
  readonly units: readonly UnitSpec[]
}

/** Pièce en attente d'arriver sur le plateau. */
export interface Reinforcement {
  /** Premier tour où elle peut apparaître ; si sa case est occupée, elle attend qu'elle se libère. */
  readonly round: number
  readonly piece: Piece
}

export interface LevelDefinition {
  /** Plateau en texte, voir `parseBoard`. */
  readonly terrain: readonly string[]
  readonly units: readonly UnitSpec[]
  /** Direction « avant » des pions de chaque camp. */
  readonly forward: Readonly<Record<Side, Direction>>
  readonly goal: GoalDefinition
  /** Case où se trouve le héros du joueur. */
  readonly hero: Pos
  /** Renforts qui arrivent en cours de partie. */
  readonly reinforcements?: readonly ReinforcementSpec[]
}

/** État complet d'un niveau en cours. Immuable : chaque action produit un nouvel état. */
export interface GameState {
  readonly board: Board
  readonly pieces: readonly Piece[]
  readonly forward: Readonly<Record<Side, Direction>>
  readonly goal: Goal
  readonly heroId: string
  readonly sideToMove: Side
  /** Tour en cours, à partir de 1 ; augmente après chaque action de l'ennemi. */
  readonly round: number
  /** Passes consécutives des deux camps (deux d'affilée = blocage). */
  readonly consecutivePasses: number
  /** Actions jouées depuis la dernière attaque (riposte comprise), tous camps confondus. */
  readonly quietPlies: number
  /** Élan : pièce qui rejoue immédiatement (seule à pouvoir agir, ou passer pour finir le tour). */
  readonly bonusPieceId: string | null
  /** Renforts pas encore arrivés, dans l'ordre d'arrivée. */
  readonly reinforcements: readonly Reinforcement[]
  readonly status: Status
  readonly endReason: EndReason | null
}

type PieceQuery = Pick<GameState, 'pieces'>

export const pieceAt = (state: PieceQuery, p: Pos): Piece | undefined =>
  state.pieces.find((piece) => samePos(piece.pos, p))

export const findPiece = (state: PieceQuery, id: string): Piece | undefined =>
  state.pieces.find((piece) => piece.id === id)

export const piecesOf = (state: PieceQuery, side: Side): Piece[] =>
  state.pieces.filter((piece) => piece.side === side)

const isPositiveInteger = (n: number) => Number.isInteger(n) && n >= 1

/** Crée l'état initial d'un niveau ; lève une erreur si la définition est incohérente. */
export function createLevel(def: LevelDefinition): GameState {
  const board = parseBoard(def.terrain)
  const where = (p: Pos) => `(${p.x}, ${p.y})`

  const waves = def.reinforcements ?? []
  const allUnits = [...def.units, ...waves.flatMap((wave) => wave.units)]
  const explicitIds = new Set(allUnits.flatMap((unit) => (unit.id ? [unit.id] : [])))
  const counters: Record<Side, number> = { player: 0, enemy: 0 }
  const nextAutoId = (side: Side): string => {
    const prefix = side === 'player' ? 'p' : 'e'
    let id = `${prefix}${++counters[side]}`
    while (explicitIds.has(id)) id = `${prefix}${++counters[side]}`
    return id
  }

  const usedIds = new Set<string>()
  const buildPiece = (unit: UnitSpec): Piece => {
    if (!isStandable(board, unit.at)) {
      throw new Error(`Unité ${unit.type} placée sur une case impossible ${where(unit.at)}`)
    }
    const id = unit.id ?? nextAutoId(unit.side)
    if (usedIds.has(id)) throw new Error(`Identifiant d'unité en double : ${id}`)
    usedIds.add(id)

    const powers = unit.powers ?? []
    const stats = statsFor(unit.type, powers)
    const maxHp = unit.maxHp ?? unit.hp ?? stats.maxHp
    const hp = unit.hp ?? maxHp
    const atk = unit.atk ?? stats.atk
    if (!isPositiveInteger(maxHp) || !isPositiveInteger(hp) || hp > maxHp) {
      throw new Error(`PV invalides pour ${id} : ${hp}/${maxHp}`)
    }
    if (!Number.isInteger(atk) || atk < 0) throw new Error(`Attaque invalide pour ${id} : ${atk}`)

    return {
      id,
      type: unit.type,
      side: unit.side,
      pos: unit.at,
      hp,
      maxHp,
      atk,
      hasMoved: false,
      powers,
      shieldActive: powers.includes('shield'),
    }
  }

  const occupied = new Set<string>()
  const pieces: Piece[] = def.units.map((unit) => {
    if (occupied.has(posKey(unit.at))) {
      throw new Error(`Deux unités sur la même case ${where(unit.at)}`)
    }
    occupied.add(posKey(unit.at))
    return buildPiece(unit)
  })

  const reinforcements: Reinforcement[] = waves
    .map((wave) => {
      if (!Number.isInteger(wave.round) || wave.round < 2) {
        throw new Error(`Tour de renforts invalide : ${wave.round}`)
      }
      return wave
    })
    .sort((a, b) => a.round - b.round)
    .flatMap((wave) => wave.units.map((unit) => ({ round: wave.round, piece: buildPiece(unit) })))

  const hero = pieces.find((piece) => samePos(piece.pos, def.hero))
  if (!hero || hero.side !== 'player') {
    throw new Error(`Aucune pièce du joueur en ${where(def.hero)} pour être le héros`)
  }

  let goal: Goal
  switch (def.goal.kind) {
    case 'eliminate':
      if (def.goal.maxRounds !== undefined && !isPositiveInteger(def.goal.maxRounds)) {
        throw new Error(`Limite de tours invalide : ${def.goal.maxRounds}`)
      }
      goal = def.goal
      break
    case 'survive':
      if (!isPositiveInteger(def.goal.rounds)) {
        throw new Error(`Nombre de tours de survie invalide : ${def.goal.rounds}`)
      }
      goal = def.goal
      break
    case 'capture': {
      const { target: targetPos, maxRounds } = def.goal
      const target = pieces.find((piece) => samePos(piece.pos, targetPos))
      if (!target || target.side !== 'enemy') {
        throw new Error(`Aucune pièce ennemie en ${where(targetPos)} à capturer`)
      }
      if (maxRounds !== undefined && !isPositiveInteger(maxRounds)) {
        throw new Error(`Limite de tours invalide : ${maxRounds}`)
      }
      goal = maxRounds === undefined
        ? { kind: 'capture', targetId: target.id }
        : { kind: 'capture', targetId: target.id, maxRounds }
      break
    }
  }

  const draft = {
    board,
    pieces,
    forward: def.forward,
    goal,
    heroId: hero.id,
    sideToMove: 'player' as const,
    round: 1,
    consecutivePasses: 0,
    quietPlies: 0,
    bonusPieceId: null,
    reinforcements,
  }
  const outcome = evaluateOutcome(draft)
  return { ...draft, status: outcome.status, endReason: outcome.reason }
}

const LETTER_TO_TYPE = new Map<string, PieceType>(
  Object.entries(PIECE_LETTERS).map(([type, letter]) => [letter, type as PieceType]),
)

/**
 * Lit des unités depuis du texte aligné sur le plateau :
 * K Q R B N P = joueur, k q r b n p = ennemi, `.` ou espace = case sans pièce.
 */
export function unitsFromAscii(rows: readonly string[]): UnitSpec[] {
  const units: UnitSpec[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const type = LETTER_TO_TYPE.get(ch.toUpperCase())
      if (!type) throw new Error(`Lettre de pièce inconnue « ${ch} » en (${x}, ${y})`)
      units.push({ type, side: ch === ch.toUpperCase() ? 'player' : 'enemy', at: { x, y } })
    }
  })
  return units
}
