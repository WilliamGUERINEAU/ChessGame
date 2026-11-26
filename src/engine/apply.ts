import { isLastRow, isStandable, terrainAt, TERRAIN_RULES } from './board/board'
import { attackDamage, survivedApproach } from './combat/combat'
import { add, DIRECTION_VECTORS, kingDistance, samePos, stepToward, type Pos, type Vec } from './geometry'
import { evaluateOutcome, type EndReason } from './goals/goals'
import { legalActions, pieceActions, sameAction, type Action } from './moves'
import { opponent, PIECES, type Piece, type Side } from './pieces/pieces'
import { hasPower, statsFor } from './powers/powers'
import type { GameState } from './state'

/** Ce qui s'est passé pendant une action, dans l'ordre (utile pour animer l'interface). */
export type GameEvent =
  | { readonly type: 'move'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'iceSlide'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | {
      readonly type: 'attack' | 'riposte'
      readonly pieceId: string
      readonly targetId: string
      readonly damage: number
      readonly targetHp: number
    }
  /** Le bouclier de la pièce a absorbé une attaque (il est maintenant épuisé). */
  | { readonly type: 'shieldBlock'; readonly pieceId: string }
  | { readonly type: 'capture'; readonly pieceId: string; readonly byId: string }
  /** Un Pion avec Promotion est devenu une Dame. */
  | { readonly type: 'promote'; readonly pieceId: string }
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

type PiecePatch = Partial<Pick<Piece, 'pos' | 'hp' | 'maxHp' | 'atk' | 'hasMoved' | 'type' | 'powers' | 'shieldActive'>>

/** Copie de travail des pièces pendant la résolution d'une action. */
class TurnBuilder {
  readonly events: GameEvent[] = []
  private pieces: Piece[]
  private readonly state: GameState

  constructor(state: GameState) {
    this.state = state
    this.pieces = [...state.pieces]
  }

  /** Déplacement vers une case vide, suivi d'une éventuelle glissade et d'une promotion. */
  movePiece(pieceId: string, to: Pos): void {
    const piece = this.get(pieceId)
    this.relocate(piece, to, 'move')
    this.slideOnIce(pieceId, iceDirection(piece, piece.pos, to))
    this.promoteIfNeeded(pieceId)
  }

  attack(pieceId: string, targetPos: Pos, landing: Pos | undefined): void {
    const attacker = this.get(pieceId)
    const target = this.at(targetPos)
    if (!target) throw new IllegalActionError(`Aucune cible en (${targetPos.x}, ${targetPos.y})`)

    const targetHp = this.strike('attack', attacker, target)
    if (targetHp === 0) {
      // Cible tuée : l'attaquant prend sa case (et peut glisser si c'est de la glace).
      this.relocate(attacker, target.pos, 'move')
      this.slideOnIce(pieceId, iceDirection(attacker, attacker.pos, target.pos))
      this.promoteIfNeeded(pieceId)
      return
    }

    const approach = survivedApproach(this.state, attacker, target)
    if (approach.kind === 'stopBefore') {
      this.relocate(attacker, approach.at, 'move')
      this.slideOnIce(pieceId, iceDirection(attacker, attacker.pos, approach.at))
    } else {
      // Atterrissage au choix, ou sur place s'il n'y a aucune case libre : pas de glissade.
      this.relocate(attacker, landing ?? attacker.pos, 'move')
    }
    this.riposte(target.id, pieceId)
    this.promoteIfNeeded(pieceId)
  }

  finish(passed: boolean): ActionResult {
    const { state } = this
    const fought = this.events.some((event) => event.type === 'attack' || event.type === 'riposte')
    const draft = {
      ...state,
      pieces: this.pieces,
      sideToMove: opponent(state.sideToMove),
      round: state.sideToMove === 'enemy' ? state.round + 1 : state.round,
      consecutivePasses: passed ? state.consecutivePasses + 1 : 0,
      quietPlies: fought ? 0 : state.quietPlies + 1,
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

  /**
   * Frappe `target` (attaque ou riposte) : le bouclier absorbe le coup s'il est
   * actif, sinon les PV baissent ; à 0 PV la cible est retirée. Renvoie ses PV restants.
   */
  private strike(type: 'attack' | 'riposte', striker: Piece, target: Piece): number {
    const shielded = target.shieldActive
    const damage = shielded ? 0 : attackDamage(striker)
    const targetHp = Math.max(0, target.hp - damage)
    this.events.push({ type, pieceId: striker.id, targetId: target.id, damage, targetHp })
    if (shielded) {
      this.update(target.id, { shieldActive: false })
      this.events.push({ type: 'shieldBlock', pieceId: target.id })
    }
    if (targetHp === 0) {
      this.pieces = this.pieces.filter((piece) => piece.id !== target.id)
      this.events.push({ type: 'capture', pieceId: target.id, byId: striker.id })
    } else {
      this.update(target.id, { hp: targetHp })
    }
    return targetHp
  }

  /** Riposte : la cible qui a survécu frappe l'attaquant s'il a fini sur une case voisine. */
  private riposte(defenderId: string, attackerId: string): void {
    const defender = this.find(defenderId)
    const attacker = this.find(attackerId)
    if (!defender || !attacker || !hasPower(defender, 'riposte')) return
    if (kingDistance(defender.pos, attacker.pos) !== 1) return
    this.strike('riposte', defender, attacker)
  }

  /** Promotion : un Pion qui porte ce pouvoir et atteint le bord opposé devient une Dame. */
  private promoteIfNeeded(pieceId: string): void {
    const piece = this.find(pieceId)
    if (!piece || piece.type !== 'pawn' || !hasPower(piece, 'promotion')) return
    const forward = DIRECTION_VECTORS[this.state.forward[piece.side]]
    if (!isLastRow(this.state.board, piece.pos, forward)) return
    const powers = piece.powers.filter((power) => power !== 'promotion')
    const { maxHp, atk } = statsFor('queen', powers)
    // Les PV montent d'autant que le maximum : une blessure reste une blessure.
    const hp = Math.min(maxHp, piece.hp + Math.max(0, maxHp - piece.maxHp))
    this.update(pieceId, { type: 'queen', powers, maxHp, atk, hp })
    this.events.push({ type: 'promote', pieceId })
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

  private update(pieceId: string, patch: PiecePatch): void {
    this.pieces = this.pieces.map((piece) => (piece.id === pieceId ? { ...piece, ...patch } : piece))
  }

  private find(pieceId: string): Piece | undefined {
    return this.pieces.find((candidate) => candidate.id === pieceId)
  }

  private get(pieceId: string): Piece {
    const piece = this.find(pieceId)
    if (!piece) throw new IllegalActionError(`Pièce introuvable : ${pieceId}`)
    return piece
  }

  private at(p: Pos): Piece | undefined {
    return this.pieces.find((piece) => samePos(piece.pos, p))
  }
}

/**
 * Direction de glissade sur la glace : celle du déplacement pour les pièces qui
 * avancent en ligne (Tour, Fou, Dame, Roi, Pion) ; aucune pour un saut ou avec Patins.
 */
function iceDirection(piece: Piece, from: Pos, to: Pos): Vec | null {
  if (PIECES[piece.type].movement.kind === 'leap' || hasPower(piece, 'skates')) return null
  if (samePos(from, to)) return null
  return stepToward(from, to)
}
