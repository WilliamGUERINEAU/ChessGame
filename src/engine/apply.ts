import { isLastRow, isStandable, terrainAt, TERRAIN_RULES } from './board/board'
import { attackDamage, survivedApproach } from './combat/combat'
import { add, ALL_DIRECTIONS, DIRECTION_VECTORS, samePos, stepToward, type Pos, type Vec } from './geometry'
import { evaluateOutcome, type EndReason } from './goals/goals'
import { attackTargetsOf, legalActions, pieceActions, sameAction, type Action } from './moves'
import { opponent, PIECES, type Piece, type Side } from './pieces/pieces'
import { hasPower, statsFor } from './powers/powers'
import type { GameState } from './state'

/** Coup porté : attaque, riposte, balayage (voisins de la cible) ou écrasement (Repousser bloqué). */
export type StrikeKind = 'attack' | 'riposte' | 'sweep' | 'crush'

/** Ce qui s'est passé pendant une action, dans l'ordre (utile pour animer l'interface). */
export type GameEvent =
  | { readonly type: 'move'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | { readonly type: 'iceSlide'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  /** La cible a été repoussée (pouvoir Repousser). */
  | { readonly type: 'push'; readonly pieceId: string; readonly from: Pos; readonly to: Pos }
  | {
      readonly type: StrikeKind
      readonly pieceId: string
      readonly targetId: string
      readonly damage: number
      readonly targetHp: number
    }
  /** Le bouclier de la pièce a absorbé une attaque (il est maintenant épuisé). */
  | { readonly type: 'shieldBlock'; readonly pieceId: string }
  | { readonly type: 'capture'; readonly pieceId: string; readonly byId: string }
  /** Vampirisme : la pièce a regagné des PV. */
  | { readonly type: 'heal'; readonly pieceId: string; readonly amount: number; readonly hp: number }
  /** Élan : la pièce rejoue immédiatement. */
  | { readonly type: 'momentum'; readonly pieceId: string }
  /** Des renforts sont arrivés sur le plateau. */
  | { readonly type: 'reinforce'; readonly pieceId: string; readonly at: Pos }
  /** Un Pion avec Promotion est devenu une Dame. */
  | { readonly type: 'promote'; readonly pieceId: string }
  | { readonly type: 'pass'; readonly side: Side }
  | { readonly type: 'end'; readonly status: 'won' | 'lost'; readonly reason: EndReason }

const STRIKES: ReadonlySet<GameEvent['type']> = new Set(['attack', 'riposte', 'sweep', 'crush'])

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
 * Applique une action du camp qui joue et passe la main à l'autre camp (sauf Élan).
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
  return turn.finish(action)
}

type PiecePatch = Partial<Pick<Piece, 'pos' | 'hp' | 'maxHp' | 'atk' | 'hasMoved' | 'type' | 'powers' | 'shieldActive'>>

/** Copie de travail des pièces pendant la résolution d'une action. */
class TurnBuilder {
  readonly events: GameEvent[] = []
  private pieces: Piece[]
  private readonly state: GameState
  /** Pièce qui a gagné une action bonus (Élan). */
  private bonusFor: string | null = null

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
    const origin = attacker.pos
    const target = this.at(targetPos)
    if (!target) throw new IllegalActionError(`Aucune cible en (${targetPos.x}, ${targetPos.y})`)

    const targetHp = this.strike('attack', attacker, target)
    if (hasPower(attacker, 'sweep')) this.sweep(pieceId, target)

    if (targetHp === 0) {
      // Cible tuée : l'attaquant prend sa case (et peut glisser si c'est de la glace).
      this.relocate(attacker, target.pos, 'move')
      this.slideOnIce(pieceId, iceDirection(attacker, origin, target.pos))
    } else {
      const approach = survivedApproach(this.state, attacker, target)
      if (approach.kind === 'stopBefore') {
        this.relocate(attacker, approach.at, 'move')
        this.slideOnIce(pieceId, iceDirection(attacker, origin, approach.at))
      } else {
        // Atterrissage au choix, ou sur place s'il n'y a aucune case libre : pas de glissade.
        this.relocate(attacker, landing ?? origin, 'move')
      }
      if (hasPower(attacker, 'knockback')) this.knockback(pieceId, target.id, stepToward(origin, target.pos))
      this.riposte(target.id, pieceId)
    }
    this.promoteIfNeeded(pieceId)

    // Élan : une seule action bonus par tour, après au moins une capture.
    const killed = this.events.some((event) => event.type === 'capture' && event.byId === pieceId)
    if (killed && !this.state.bonusPieceId && this.find(pieceId) && hasPower(attacker, 'momentum')) {
      this.bonusFor = pieceId
      this.events.push({ type: 'momentum', pieceId })
    }
  }

  finish(action: Action): ActionResult {
    const { state } = this
    const fought = this.events.some((event) => STRIKES.has(event.type))
    // Passer pour finir un Élan n'est pas un blocage.
    const passed = action.kind === 'pass' && !state.bonusPieceId
    const keepTurn = this.bonusFor !== null
    const round = !keepTurn && state.sideToMove === 'enemy' ? state.round + 1 : state.round
    const reinforcements = round > state.round ? this.bringReinforcements(round) : state.reinforcements
    const draft = {
      ...state,
      pieces: this.pieces,
      sideToMove: keepTurn ? state.sideToMove : opponent(state.sideToMove),
      round,
      reinforcements,
      consecutivePasses: passed ? state.consecutivePasses + 1 : 0,
      quietPlies: fought ? 0 : state.quietPlies + 1,
      bonusPieceId: this.bonusFor,
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
   * Début d'un nouveau tour : les renforts attendus arrivent, chacun seulement si sa
   * case est libre (sinon il attend un prochain tour). Renvoie ceux qui attendent encore.
   */
  private bringReinforcements(round: number): GameState['reinforcements'] {
    const waiting: GameState['reinforcements'][number][] = []
    for (const reinforcement of this.state.reinforcements) {
      const { piece } = reinforcement
      if (reinforcement.round > round || this.pieces.some((other) => samePos(other.pos, piece.pos))) {
        waiting.push(reinforcement)
        continue
      }
      this.pieces.push(piece)
      this.events.push({ type: 'reinforce', pieceId: piece.id, at: piece.pos })
    }
    return waiting
  }

  /**
   * Frappe `target` : le bouclier absorbe le coup s'il est actif, sinon les PV baissent ;
   * à 0 PV la cible est retirée. Vampirisme soigne le frappeur. Renvoie les PV restants.
   */
  private strike(kind: StrikeKind, striker: Piece, target: Piece, amount = attackDamage(striker)): number {
    const current = this.find(target.id) ?? target
    const shielded = current.shieldActive
    const damage = shielded ? 0 : amount
    const targetHp = Math.max(0, current.hp - damage)
    this.events.push({ type: kind, pieceId: striker.id, targetId: target.id, damage, targetHp })
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
    const dealt = current.hp - targetHp
    const healer = this.find(striker.id)
    if (dealt > 0 && healer && hasPower(healer, 'lifesteal') && healer.hp < healer.maxHp) {
      const hp = Math.min(healer.maxHp, healer.hp + dealt)
      this.update(healer.id, { hp })
      this.events.push({ type: 'heal', pieceId: healer.id, amount: hp - healer.hp, hp })
    }
    return targetHp
  }

  /** Balayage : chaque ennemi voisin de la cible prend les mêmes dégâts qu'elle. */
  private sweep(attackerId: string, target: Piece): void {
    const attacker = this.get(attackerId)
    const amount = attackDamage(attacker)
    for (const v of ALL_DIRECTIONS) {
      const neighbour = this.at(add(target.pos, v))
      if (neighbour && neighbour.side !== attacker.side) this.strike('sweep', this.get(attackerId), neighbour, amount)
    }
  }

  /**
   * Repousser : la cible recule d'une case ; si la case est bloquée, elle prend 1 dégât.
   * Une pièce avec Patins tient sur ses appuis : elle n'est pas repoussée.
   */
  private knockback(attackerId: string, targetId: string, direction: Vec): void {
    const target = this.find(targetId)
    const attacker = this.find(attackerId)
    if (!target || !attacker || hasPower(target, 'skates')) return
    const to = add(target.pos, direction)
    if (isStandable(this.state.board, to) && !this.at(to)) {
      this.relocate(target, to, 'push')
      this.slideOnIce(targetId, iceDirection(target, target.pos, to))
    } else {
      this.strike('crush', attacker, target, 1)
    }
  }

  /** Riposte : la cible qui a survécu frappe l'attaquant s'il est à sa portée d'attaque. */
  private riposte(defenderId: string, attackerId: string): void {
    const defender = this.find(defenderId)
    const attacker = this.find(attackerId)
    if (!defender || !attacker || !hasPower(defender, 'riposte')) return
    const reachable = attackTargetsOf({ ...this.state, pieces: this.pieces }, defender)
    if (!reachable.some((piece) => piece.id === attackerId)) return
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
      const piece = this.find(pieceId)
      if (!piece) return
      const terrain = terrainAt(this.state.board, piece.pos)
      if (terrain === null || !TERRAIN_RULES[terrain].slippery) return
      const next = add(piece.pos, direction)
      if (!isStandable(this.state.board, next) || this.at(next)) return
      this.relocate(piece, next, 'iceSlide')
    }
  }

  /** Place la pièce sur `to` et note le déplacement (une pièce qui se déplace d'elle-même a « agi »). */
  private relocate(piece: Piece, to: Pos, type: 'move' | 'iceSlide' | 'push'): void {
    const current = this.get(piece.id)
    this.update(piece.id, type === 'push' ? { pos: to } : { pos: to, hasMoved: true })
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

/** Résultat prévu d'une attaque, pour l'afficher avant de la jouer. */
export interface AttackPreview {
  /** Dégâts infligés à la cible (0 si un bouclier les absorbe). */
  readonly damage: number
  readonly kills: boolean
  /** Dégâts de riposte subis par l'attaquant. */
  readonly riposteDamage: number
  readonly attackerDies: boolean
  /** Autres ennemis touchés (balayage, écrasement). */
  readonly extraHits: number
}

/** Simule une attaque légale et résume ce qui se passerait. */
export function previewAttack(state: GameState, action: Extract<Action, { kind: 'attack' }>): AttackPreview {
  const { events } = resolveAction(state, action)
  const target = state.pieces.find((piece) => samePos(piece.pos, action.target))
  let damage = 0
  let riposteDamage = 0
  let extraHits = 0
  for (const event of events) {
    if (event.type === 'attack' && event.targetId === target?.id) damage += event.damage
    else if (event.type === 'riposte' && event.targetId === action.pieceId) riposteDamage += event.damage
    else if ((event.type === 'sweep' || event.type === 'crush') && event.damage > 0) extraHits += 1
  }
  const captured = (id: string | undefined) => events.some((event) => event.type === 'capture' && event.pieceId === id)
  return { damage, kills: captured(target?.id), riposteDamage, attackerDies: captured(action.pieceId), extraHits }
}
