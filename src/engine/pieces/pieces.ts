import { ALL_DIRECTIONS, DIAGONAL, KNIGHT_JUMPS, ORTHOGONAL, type Pos, type Vec } from '../geometry'

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'

export type Side = 'player' | 'enemy'

export const opponent = (side: Side): Side => (side === 'player' ? 'enemy' : 'player')

/**
 * Façon de se déplacer :
 * - `slide` : en ligne, case par case, jusqu'à `range` cases (Roi = 1) ;
 * - `leap` : saut direct vers la case visée, par-dessus tout (Cavalier) ;
 * - `pawn` : une case vers l'avant (deux au premier coup), attaque en diagonale avant.
 */
export type Movement =
  | { readonly kind: 'slide'; readonly vectors: readonly Vec[]; readonly range: number }
  | { readonly kind: 'leap'; readonly vectors: readonly Vec[] }
  | { readonly kind: 'pawn' }

export interface PieceDefinition {
  readonly movement: Movement
  /** PV de base : valeur provisoire, à équilibrer. */
  readonly hp: number
  /** Attaque de base : valeur provisoire, à équilibrer. */
  readonly atk: number
}

export const PIECES: Readonly<Record<PieceType, PieceDefinition>> = {
  king: { movement: { kind: 'slide', vectors: ALL_DIRECTIONS, range: 1 }, hp: 4, atk: 1 },
  queen: { movement: { kind: 'slide', vectors: ALL_DIRECTIONS, range: Infinity }, hp: 3, atk: 3 },
  rook: { movement: { kind: 'slide', vectors: ORTHOGONAL, range: Infinity }, hp: 3, atk: 2 },
  bishop: { movement: { kind: 'slide', vectors: DIAGONAL, range: Infinity }, hp: 2, atk: 2 },
  knight: { movement: { kind: 'leap', vectors: KNIGHT_JUMPS }, hp: 2, atk: 2 },
  pawn: { movement: { kind: 'pawn' }, hp: 1, atk: 1 },
}

/** Lettre de chaque pièce dans les descriptions texte (majuscule = joueur). */
export const PIECE_LETTERS: Readonly<Record<PieceType, string>> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: 'P',
}

/** Une pièce sur le plateau pendant un niveau. */
export interface Piece {
  readonly id: string
  readonly type: PieceType
  readonly side: Side
  readonly pos: Pos
  readonly hp: number
  readonly maxHp: number
  readonly atk: number
  /** A déjà agi pendant ce niveau (perd le double pas du pion). */
  readonly hasMoved: boolean
}
