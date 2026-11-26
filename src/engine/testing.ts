/**
 * Aides pour écrire des tests lisibles. Ne pas utiliser dans le jeu.
 */
import { posKey, type Direction, type Pos } from './geometry'
import type { GoalDefinition } from './goals/goals'
import { pieceActions, type Action } from './moves'
import type { Side } from './pieces/pieces'
import { createLevel, findPiece, pieceAt, unitsFromAscii, type GameState, type UnitSpec } from './state'

export interface TestLevelOptions {
  /** Plateau en texte (voir `parseBoard`). */
  readonly terrain: readonly string[]
  /** Pièces en texte, alignées sur le plateau (voir `unitsFromAscii`). */
  readonly units: readonly string[]
  /** Case du héros ; par défaut la première pièce du joueur en ordre de lecture. */
  readonly hero?: Pos
  /** Par défaut : le joueur avance vers le haut, l'ennemi vers le bas. */
  readonly forward?: Readonly<Record<Side, Direction>>
  /** Par défaut : capturer toutes les pièces adverses. */
  readonly goal?: GoalDefinition
  /** Statistiques et pouvoirs à forcer, par case « x,y ». */
  readonly stats?: Readonly<Record<string, Partial<Pick<UnitSpec, 'id' | 'hp' | 'maxHp' | 'atk' | 'powers'>>>>
}

export function testLevel(options: TestLevelOptions): GameState {
  const units = unitsFromAscii(options.units).map((unit) => ({
    ...unit,
    ...options.stats?.[posKey(unit.at)],
  }))
  const firstPlayer = units.find((unit) => unit.side === 'player')
  const hero = options.hero ?? firstPlayer?.at
  if (!hero) throw new Error('Niveau de test sans pièce du joueur')
  return createLevel({
    terrain: options.terrain,
    units,
    hero,
    forward: options.forward ?? { player: 'up', enemy: 'down' },
    goal: options.goal ?? { kind: 'eliminate' },
  })
}

/** Identifiant de la pièce sur une case (lève une erreur s'il n'y en a pas). */
export function idAt(state: GameState, x: number, y: number): string {
  const piece = pieceAt(state, { x, y })
  if (!piece) throw new Error(`Aucune pièce en (${x}, ${y})`)
  return piece.id
}

/** Cases (« x,y », triées) où la pièce peut se déplacer sans attaquer. */
export function moveKeys(state: GameState, pieceId: string): string[] {
  return pieceActions(state, pieceId)
    .flatMap((action) => (action.kind === 'move' ? [posKey(action.to)] : []))
    .sort()
}

/** Cases (« x,y », triées, sans doublon) des pièces que la pièce peut attaquer. */
export function attackKeys(state: GameState, pieceId: string): string[] {
  const keys = pieceActions(state, pieceId).flatMap((action) =>
    action.kind === 'attack' ? [posKey(action.target)] : [],
  )
  return [...new Set(keys)].sort()
}

/** Actions d'attaque d'une pièce contre une case donnée. */
export function attacksOn(state: GameState, pieceId: string, target: Pos): Action[] {
  return pieceActions(state, pieceId).filter(
    (action) => action.kind === 'attack' && posKey(action.target) === posKey(target),
  )
}

/** Case actuelle d'une pièce, en « x,y ». */
export function where(state: GameState, pieceId: string): string | undefined {
  const piece = findPiece(state, pieceId)
  return piece ? posKey(piece.pos) : undefined
}
