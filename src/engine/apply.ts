import { isStandable, terrainAt, TERRAIN_RULES } from './board/board'
import { attackDamage, survivedApproach } from './combat/combat'
import { add, samePos, stepToward, type Pos, type Vec } from './geometry'
import { evaluateOutcome, type EndReason } from './goals/goals'
import { legalActions, pieceActions, sameAction, type Action } from './moves'
import { opponent, PIECES, type Piece, type Side } from './pieces/pieces'
import type { GameState } from './state'

/** Ce qui s'est passé pendant une action, dans l'ordre (utile pour animer l'interface). */
export type GameEvent =
  | { readonly type: 'move'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'iceSlide'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | {
      readonly type: 'attack'
      readonly pieceId: string
      readonly targetId: string
      readonly damage: number
      readonly targetHp: number
    }
  | { readonly type: 'capture'; readonly pieceId: string; readonly byId: string }
  | { readonly type: 'pass'; readonly side: Side }
  | { readonly type: 'end'; readonly status: 'won' | 'lost'; readonly reason: EndReason }

export interface ActionResult {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalActionError'
  }
}

/**
 * Applique une action du camp qui joue et passe la main à l'autre camp.
 * Lève `IllegalActionError` si l'action ne fait pas partie des actions légales.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status !== 'ongoing') throw new IllegalActionError('La partie est terminée')
  const allowed = action.kind === 'pass' ? legalActions(state) : pieceActions(state, action.pieceId)
  if (!allowed.some((candidate) => sameAction(candidate, action))) {
    throw new IllegalActionError(`Action illégale : ${JSON.stringify(action)}`)
  }
  return resolveAction(state, action)
}

/**
 * Applique une action **déjà connue comme légale** (issue de `legalActions`), sans la
 * revalider. Réservé à l'IA, qui explore des milliers d'actions.
 */
export function resolveAction(state: GameState, action: Action): ActionResult {
  const turn = new TurnBuilder(state)
  switch (action.kind) {
    case 'pass':
      turn.events.push({ type: 'pass', side: state.sideToMove })
      break
    case 'move':
      turn.movePiece(action.pieceId, action.to)
      break
    case 'attack':
      turn.attack(action.pieceId, action.target, action.landing)
      break
  }
  return turn.finish(action.kind === 'pass')
}

/** Copie de travail des pièces pendant la résolution d'une action. */
class TurnBuilder {
  readonly events: GameEvent[] = []
  private pieces: Piece[]
  private readonly state: GameState

  constructor(state: GameState) {
    this.state = state
    this.pieces = [...state.pieces]
  }

  /** Déplacement simple vers une case vide, suivi d'une éventuelle glissade sur la glace. */
  movePiece(pieceId: string, to: Pos): void {
    const piece = this.get(pieceId)
    this.relocate(piece, to, 'move')
    this.slideOnIce(pieceId, iceDirection(piece, piece.pos, to))
  }

  attack(pieceId: string, targetPos: Pos, landing: Pos | undefined): void {
    const attacker = this.get(pieceId)
    const target = this.at(targetPos)
    if (!target) throw new IllegalActionError(`Aucune cible en (${targetPos.x}, ${targetPos.y})`)

    const damage = attackDamage(attacker)
    const targetHp = Math.max(0, target.hp - damage)
    this.events.push({ type: 'attack', pieceId, targetId: target.id, damage, targetHp })

    if (targetHp === 0) {
      // Cible tuée : l'attaquant prend sa case (et peut glisser si c'est de la glace).
      this.pieces = this.pieces.filter((piece) => piece.id !== target.id)
      this.events.push({ type: 'capture', pieceId: target.id, byId: pieceId })
      this.relocate(attacker, target.pos, 'move')
      this.slideOnIce(pieceId, iceDirection(attacker, attacker.pos, target.pos))
      return
    }

    this.update(target.id, { hp: targetHp })
    const approach = survivedApproach(this.state, attacker, target)
    if (approach.kind === 'stopBefore') {
      this.relocate(attacker, approach.at, 'move')
      this.slideOnIce(pieceId, iceDirection(attacker, attacker.pos, approach.at))
    } else {
      // Atterrissage au choix, ou sur place s'il n'y a aucune case libre : pas de glissade.
      this.relocate(attacker, landing ?? attacker.pos, 'move')
    }
  }

  finish(passed: boolean): ActionResult {
    const { state } = this
    const draft = {
      ...state,
      pieces: this.pieces,
      sideToMove: opponent(state.sideToMove),
      round: state.sideToMove === 'enemy' ? state.round + 1 : state.round,
      consecutivePasses: passed ? state.consecutivePasses + 1 : 0,
    }
    const outcome = evaluateOutcome(draft)
    if (outcome.status !== 'ongoing') {
      this.events.push({ type: 'end', status: outcome.status, reason: outcome.reason })
    }
    return {
      state: { ...draft, status: outcome.status, endReason: outcome.reason },
      events: this.events,
    }
  }

  /** Tant que la pièce est sur la glace, elle avance d'une case si la suivante est libre. */
  private slideOnIce(pieceId: string, direction: Vec | null): void {
    if (!direction) return
    for (;;) {
      const piece = this.get(pieceId)
      const terrain = terrainAt(this.state.board, piece.pos)
      if (terrain === null || !TERRAIN_RULES[terrain].slippery) return
      const next = add(piece.pos, direction)
      if (!isStandable(this.state.board, next) || this.at(next)) return
      this.relocate(piece, next, 'iceSlide')
    }
  }

  /** Place la pièce sur `to` (elle compte alors comme ayant agi) et note le déplacement. */
  private relocate(piece: Piece, to: Pos, type: 'move' | 'iceSlide'): void {
    const current = this.get(piece.id)
    this.update(piece.id, { pos: to, hasMoved: true })
    if (!samePos(current.pos, to)) {
      this.events.push({ type, pieceId: piece.id, from: current.pos, to })
    }
  }

  private update(pieceId: string, patch: Partial<Pick<Piece, 'pos' | 'hp' | 'hasMoved'>>): void {
    this.pieces = this.pieces.map((piece) => (piece.id === pieceId ? { ...piece, ...patch } : piece))
  }

  private get(pieceId: string): Piece {
    const piece = this.pieces.find((candidate) => candidate.id === pieceId)
    if (!piece) throw new IllegalActionError(`Pièce introuvable : ${pieceId}`)
    return piece
  }

  private at(p: Pos): Piece | undefined {
    return this.pieces.find((piece) => samePos(piece.pos, p))
  }
}

/**
 * Direction de glissade sur la glace : celle du déplacement pour les pièces qui
 * avancent en ligne (Tour, Fou, Dame, Roi, Pion) ; aucune pour un saut.
 */
function iceDirection(piece: Piece, from: Pos, to: Pos): Vec | null {
  if (PIECES[piece.type].movement.kind === 'leap') return null
  if (samePos(from, to)) return null
  return stepToward(from, to)
}
