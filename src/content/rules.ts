import type { PowerId, UnitSpec } from '../engine'

/** Règle du jeu : tous les Pions naissent avec Promotion. */
export function withStartingPowers<T extends Pick<UnitSpec, 'type' | 'powers'>>(unit: T): T {
  if (unit.type !== 'pawn' || unit.powers?.includes('promotion')) return unit
  const powers: PowerId[] = [...(unit.powers ?? []), 'promotion']
  return { ...unit, powers }
}
