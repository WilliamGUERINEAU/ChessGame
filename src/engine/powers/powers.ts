import { PIECES, type PieceType } from '../pieces/pieces'

/**
 * Pouvoirs qu'une pièce peut porter (récompenses, classes de héros).
 * - `vigor` Vigueur : +2 PV max (cumulable) ;
 * - `strength` Force : +1 ATK (cumulable 3 fois) ;
 * - `forester` Forestier : la forêt n'arrête pas ses glissades ;
 * - `skates` Patins : ne glisse pas sur la glace ;
 * - `reach` Allonge : Roi jusqu'à 3 cases, Pion deux cases de plus vers l'avant ;
 * - `shield` Bouclier : la première attaque reçue à chaque niveau ne fait aucun dégât ;
 * - `riposte` Riposte : si elle survit à une attaque et que l'attaquant est à sa portée, elle le frappe ;
 * - `promotion` Promotion : un Pion qui atteint le bord opposé devient une Dame (pour tout le run) ;
 * - `piercing` Perçage : ses glissades traversent la première pièce alliée rencontrée ;
 * - `momentum` Élan : après avoir tué, la pièce rejoue une fois ;
 * - `sweep` Balayage : son attaque touche aussi les ennemis voisins de la cible (moitié des dégâts) ;
 * - `knockback` Repousser : une cible qui survit recule d'une case (+1 dégât si elle est bloquée) ;
 * - `lifesteal` Vampirisme : chaque dégât infligé lui rend 1 PV.
 */
export type PowerId =
  | 'vigor'
  | 'strength'
  | 'forester'
  | 'skates'
  | 'reach'
  | 'shield'
  | 'riposte'
  | 'promotion'
  | 'piercing'
  | 'momentum'
  | 'sweep'
  | 'knockback'
  | 'lifesteal'

export interface PowerDefinition {
  /** Nombre maximal d'exemplaires sur une même pièce. */
  readonly maxStacks: number
  /** Types de pièces sur lesquels le pouvoir a un effet. */
  readonly appliesTo: readonly PieceType[]
}

const ALL: readonly PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']
/** Pièces qui avancent en ligne et que la glace fait glisser (pas le Cavalier). */
const LINE_MOVERS: readonly PieceType[] = ['king', 'queen', 'rook', 'bishop', 'pawn']
/** Pièces dont les déplacements sont des glissades de plusieurs cases. */
const SLIDERS: readonly PieceType[] = ['queen', 'rook', 'bishop']

export const POWERS: Readonly<Record<PowerId, PowerDefinition>> = {
  vigor: { maxStacks: 3, appliesTo: ALL },
  strength: { maxStacks: 3, appliesTo: ALL },
  forester: { maxStacks: 1, appliesTo: [...SLIDERS, 'pawn'] },
  skates: { maxStacks: 1, appliesTo: LINE_MOVERS },
  reach: { maxStacks: 1, appliesTo: ['king', 'pawn'] },
  shield: { maxStacks: 1, appliesTo: ALL },
  riposte: { maxStacks: 1, appliesTo: ALL },
  promotion: { maxStacks: 1, appliesTo: ['pawn'] },
  piercing: { maxStacks: 1, appliesTo: SLIDERS },
  momentum: { maxStacks: 1, appliesTo: ALL },
  sweep: { maxStacks: 1, appliesTo: ALL },
  knockback: { maxStacks: 1, appliesTo: ALL },
  lifesteal: { maxStacks: 1, appliesTo: ALL },
}

/** PV max apportés par chaque exemplaire de Vigueur. */
export const VIGOR_HP = 2
/** Cases supplémentaires apportées par l'Allonge. */
export const REACH_BONUS = 2

export const POWER_IDS = Object.keys(POWERS) as PowerId[]

export const powerCount = (powers: readonly PowerId[], id: PowerId): number =>
  powers.filter((power) => power === id).length

export const hasPower = (piece: { readonly powers: readonly PowerId[] }, id: PowerId): boolean =>
  piece.powers.includes(id)

/** PV max et attaque : valeurs de base du type, plus Vigueur (+2 PV chacune) et Force. */
export function statsFor(type: PieceType, powers: readonly PowerId[]): { maxHp: number; atk: number } {
  return {
    maxHp: PIECES[type].hp + VIGOR_HP * powerCount(powers, 'vigor'),
    atk: PIECES[type].atk + powerCount(powers, 'strength'),
  }
}

/** Une pièce de ce type, avec ces pouvoirs, peut-elle en recevoir un exemplaire de plus ? */
export function canReceive(type: PieceType, powers: readonly PowerId[], id: PowerId): boolean {
  const definition = POWERS[id]
  return definition.appliesTo.includes(type) && powerCount(powers, id) < definition.maxStacks
}
