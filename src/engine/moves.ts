import { isStandable, terrainAt, TERRAIN_RULES } from './board/board'
import { survivedApproach, wouldKill } from './combat/combat'
import { add, DIRECTION_VECTORS, perpendiculars, samePos, type Pos, type Vec } from './geometry'
import { PIECES, type Piece } from './pieces/pieces'
import { hasPower, REACH_BONUS } from './powers/powers'
import { findPiece, pieceAt, type GameState } from './state'

/**
 * Action d'un camp pendant son tour :
 * - `move` : aller sur une case vide ;
 * - `attack` : attaquer la pièce en `target`. `landing` est la case d'atterrissage
 *   choisie quand la cible survit à une attaque adjacente ou à un saut ;
 * - `pass` : uniquement quand aucune autre action n'est possible.
 */
export type Action =
  | { readonly kind: 'move'; readonly pieceId: string; readonly to: Pos }
  | {
      readonly kind: 'attack'
      readonly pieceId: string
      readonly target: Pos
      readonly landing?: Pos
    }
  | { readonly kind: 'pass' }

/**
 * Actions possibles du camp qui joue : `[pass]` s'il est bloqué, `[]` si la partie est finie.
 * Pendant un Élan, seule la pièce qui rejoue peut agir, et `pass` termine le tour.
 */
export function legalActions(state: GameState): Action[] {
  if (state.status !== 'ongoing') return []
  if (state.bonusPieceId) {
    const bonus = findPiece(state, state.bonusPieceId)
    return [...(bonus ? actionsFrom(state, bonus) : []), { kind: 'pass' }]
  }
  const actions = state.pieces
    .filter((piece) => piece.side === state.sideToMove)
    .flatMap((piece) => actionsFrom(state, piece))
  return actions.length > 0 ? actions : [{ kind: 'pass' }]
}

/** Actions d'une pièce ; vide si la partie est finie ou si ce n'est pas à son camp de jouer. */
export function pieceActions(state: GameState, pieceId: string): Action[] {
  const piece = findPiece(state, pieceId)
  if (!piece || state.status !== 'ongoing' || piece.side !== state.sideToMove) return []
  if (state.bonusPieceId && state.bonusPieceId !== pieceId) return []
  return actionsFrom(state, piece)
}

/** Pièces adverses qu'une pièce pourrait attaquer depuis sa case (quel que soit le camp qui joue). */
export function attackTargetsOf(state: Pick<GameState, 'board' | 'pieces' | 'forward'>, piece: Piece): Piece[] {
  return reach(state as GameState, piece).targets
}

export function sameAction(a: Action, b: Action): boolean {
  if (a.kind === 'pass' || b.kind === 'pass') return a.kind === b.kind
  if (a.kind === 'move' && b.kind === 'move') {
    return a.pieceId === b.pieceId && samePos(a.to, b.to)
  }
  if (a.kind === 'attack' && b.kind === 'attack') {
    const sameLanding =
      a.landing === undefined || b.landing === undefined
        ? a.landing === b.landing
        : samePos(a.landing, b.landing)
    return a.pieceId === b.pieceId && samePos(a.target, b.target) && sameLanding
  }
  return false
}

function actionsFrom(state: GameState, piece: Piece): Action[] {
  const { moves, targets } = reach(state, piece)
  return [
    ...moves.map((to): Action => ({ kind: 'move', pieceId: piece.id, to })),
    ...targets.flatMap((target) => attackActions(state, piece, target)),
  ]
}

function attackActions(state: GameState, attacker: Piece, target: Piece): Action[] {
  const attack: Action = { kind: 'attack', pieceId: attacker.id, target: target.pos }
  if (wouldKill(attacker, target)) return [attack]
  const approach = survivedApproach(state, attacker, target)
  if (approach.kind === 'stopBefore' || approach.options.length === 0) return [attack]
  return approach.options.map((landing): Action => ({ ...attack, landing }))
}

interface Reach {
  /** Cases vides où la pièce peut aller. */
  readonly moves: Pos[]
  /** Pièces adverses qu'elle peut attaquer. */
  readonly targets: Piece[]
}

function reach(state: GameState, piece: Piece): Reach {
  const movement = PIECES[piece.type].movement
  switch (movement.kind) {
    case 'slide': {
      // Allonge : le Roi va plus loin.
      const range = movement.range + (piece.type === 'king' && hasPower(piece, 'reach') ? REACH_BONUS : 0)
      return slideReach(state, piece, movement.vectors, range)
    }
    case 'leap':
      return leapReach(state, piece, movement.vectors)
    case 'pawn':
      return pawnReach(state, piece)
  }
}

/**
 * Déplacement en ligne : avance case par case jusqu'à la portée. S'arrête avant
 * le vide, l'eau, un mur ou une pièce (une pièce adverse devient une cible),
 * et juste après être entré dans une forêt (sauf Forestier). Avec Perçage, la
 * première pièce alliée rencontrée est traversée (on ne peut pas s'arrêter dessus).
 */
function slideReach(state: GameState, piece: Piece, vectors: readonly Vec[], range: number): Reach {
  const moves: Pos[] = []
  const targets: Piece[] = []
  const forester = hasPower(piece, 'forester')
  const piercing = hasPower(piece, 'piercing')
  for (const v of vectors) {
    let current = piece.pos
    let pierced = false
    for (let step = 1; step <= range; step++) {
      const next = add(current, v)
      const terrain = terrainAt(state.board, next)
      if (terrain === null || !TERRAIN_RULES[terrain].standable) break
      const stops = TERRAIN_RULES[terrain].stopsSlide && !forester
      const occupant = pieceAt(state, next)
      if (occupant) {
        if (occupant.side !== piece.side) {
          targets.push(occupant)
          break
        }
        // Perçage : traverse un seul allié, et pas s'il se tient dans une forêt qui l'arrêterait.
        if (piercing && !pierced && !stops) {
          pierced = true
          current = next
          continue
        }
        break
      }
      moves.push(next)
      if (stops) break
      current = next
    }
  }
  return { moves, targets }
}

/** Saut : ignore tout ce qui se trouve entre la case de départ et celle d'arrivée. */
function leapReach(state: GameState, piece: Piece, vectors: readonly Vec[]): Reach {
  const moves: Pos[] = []
  const targets: Piece[] = []
  for (const v of vectors) {
    const landing = add(piece.pos, v)
    if (!isStandable(state.board, landing)) continue
    const occupant = pieceAt(state, landing)
    if (!occupant) moves.push(landing)
    else if (occupant.side !== piece.side) targets.push(occupant)
  }
  return { moves, targets }
}

/**
 * Pion : avance tout droit vers l'avant de son camp, d'une case, ou de deux à son
 * premier coup ; Allonge ajoute une case. Au-delà d'une case, c'est une glissade :
 * la forêt l'arrête (sauf Forestier). Il n'attaque qu'en diagonale vers l'avant.
 * Pas de prise en passant ; la promotion vient du pouvoir du même nom.
 */
function pawnReach(state: GameState, piece: Piece): Reach {
  const moves: Pos[] = []
  const targets: Piece[] = []
  const forward = DIRECTION_VECTORS[state.forward[piece.side]]
  const forester = hasPower(piece, 'forester')
  const maxSteps = 1 + (piece.hasMoved ? 0 : 1) + (hasPower(piece, 'reach') ? REACH_BONUS : 0)

  let current = piece.pos
  for (let step = 1; step <= maxSteps; step++) {
    const next = add(current, forward)
    const terrain = terrainAt(state.board, next)
    if (terrain === null || !TERRAIN_RULES[terrain].standable || pieceAt(state, next)) break
    moves.push(next)
    if (TERRAIN_RULES[terrain].stopsSlide && !forester) break
    current = next
  }

  const one = add(piece.pos, forward)
  for (const side of perpendiculars(forward)) {
    const diagonal = add(one, side)
    const occupant = pieceAt(state, diagonal)
    if (occupant && occupant.side !== piece.side) targets.push(occupant)
  }
  return { moves, targets }
}
