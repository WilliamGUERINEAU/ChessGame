import { hasPower, type GameState, type Piece, type Side } from '../../engine'

/** Un Pion de ce camp porte-t-il le pouvoir Promotion ? (Sa ligne de promotion n'est montrée que dans ce cas.) */
export function hasPromotionPawn(state: Pick<GameState, 'pieces'>, side: Side = 'player'): boolean {
  return state.pieces.some((piece) => piece.side === side && piece.type === 'pawn' && hasPower(piece, 'promotion'))
}

/** Prochaine vague de renforts attendue : son tour et ses pièces (cases d'arrivée). */
export function nextReinforcements(
  state: Pick<GameState, 'reinforcements'>,
): { readonly round: number; readonly pieces: readonly Piece[] } | null {
  if (state.reinforcements.length === 0) return null
  const round = Math.min(...state.reinforcements.map((reinforcement) => reinforcement.round))
  return {
    round,
    pieces: state.reinforcements.filter((r) => r.round === round).map((r) => r.piece),
  }
}
