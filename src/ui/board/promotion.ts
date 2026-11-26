import { hasPower, type GameState } from '../../engine'

/** Un Pion du joueur porte-t-il le pouvoir Promotion ? (La ligne de promotion n'est montrée que dans ce cas.) */
export function hasPromotionPawn(state: Pick<GameState, 'pieces'>): boolean {
  return state.pieces.some((piece) => piece.side === 'player' && piece.type === 'pawn' && hasPower(piece, 'promotion'))
}
