import type { PieceType, PowerId } from '../engine'

export type ClassId = 'sovereign' | 'knightess'

/** Une classe de départ : le héros (type et pouvoirs) et le reste de l'armée. */
export interface ClassDefinition {
  readonly id: ClassId
  readonly hero: { readonly type: PieceType; readonly powers: readonly PowerId[] }
  /** Pièces de départ en plus du héros. */
  readonly army: readonly PieceType[]
}

export const CLASSES: Readonly<Record<ClassId, ClassDefinition>> = {
  /** Souverain : Roi (4 PV, 1 ATK) avec Riposte ; armée nombreuse et défensive. */
  sovereign: {
    id: 'sovereign',
    hero: { type: 'king', powers: ['riposte'] },
    army: ['rook', 'knight', 'pawn', 'pawn'],
  },
  /** Chevalière : Cavalier (4 PV grâce à 2 Vigueur, 2 ATK) avec Bouclier ; armée mobile et offensive. */
  knightess: {
    id: 'knightess',
    hero: { type: 'knight', powers: ['shield', 'vigor', 'vigor'] },
    army: ['bishop', 'bishop', 'pawn'],
  },
}

export const CLASS_IDS: readonly ClassId[] = ['sovereign', 'knightess']
