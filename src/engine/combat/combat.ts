import { isStandable } from '../board/board'
import { add, ALL_DIRECTIONS, kingDistance, stepToward, type Pos } from '../geometry'
import { PIECES, type Piece } from '../pieces/pieces'
import { pieceAt, type GameState } from '../state'

/** Dégâts infligés par une attaque (Force comprise dans l'ATK). */
export function attackDamage(attacker: Piece): number {
  return attacker.atk
}

/** Dégâts réellement subis par la cible : aucun si son bouclier est encore actif. */
export function damageTaken(attacker: Piece, target: Piece): number {
  return target.shieldActive ? 0 : attackDamage(attacker)
}

export function wouldKill(attacker: Piece, target: Piece): boolean {
  return target.hp - damageTaken(attacker, target) <= 0
}

/**
 * Où finit l'attaquant quand sa cible survit :
 * - `stopBefore` : attaque en glissade depuis 2 cases ou plus → case juste avant la cible ;
 * - `land` : attaque adjacente ou saut → une des cases voisines libres de la cible
 *   (8 directions), au choix ; si `options` est vide, il reste sur sa case.
 *
 * Avec Perçage, la case juste avant la cible peut être occupée par l'allié traversé :
 * l'attaquant reste alors sur sa case.
 */
export type SurvivedApproach =
  | { readonly kind: 'stopBefore'; readonly at: Pos }
  | { readonly kind: 'land'; readonly options: readonly Pos[] }

export function survivedApproach(
  state: Pick<GameState, 'board' | 'pieces'>,
  attacker: Piece,
  target: Piece,
): SurvivedApproach {
  const movement = PIECES[attacker.type].movement
  if (movement.kind === 'slide' && kingDistance(attacker.pos, target.pos) >= 2) {
    const dir = stepToward(attacker.pos, target.pos)
    const at = { x: target.pos.x - dir.x, y: target.pos.y - dir.y }
    return pieceAt(state, at) ? { kind: 'land', options: [] } : { kind: 'stopBefore', at }
  }
  return { kind: 'land', options: landingOptions(state, attacker, target) }
}

/**
 * Cases voisines de la cible (diagonales comprises) où l'attaquant peut atterrir :
 * sur le plateau, praticables et libres. Sa propre case compte comme libre.
 */
export function landingOptions(
  state: Pick<GameState, 'board' | 'pieces'>,
  attacker: Piece,
  target: Piece,
): Pos[] {
  return ALL_DIRECTIONS.map((v) => add(target.pos, v)).filter((p) => {
    if (!isStandable(state.board, p)) return false
    const occupant = pieceAt(state, p)
    return occupant === undefined || occupant.id === attacker.id
  })
}
