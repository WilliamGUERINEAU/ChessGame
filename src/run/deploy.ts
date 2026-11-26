import {
  DIRECTION_VECTORS,
  kingDistance,
  samePos,
  type LevelDefinition,
  type Pos,
  type UnitSpec,
} from '../engine'
import type { LevelContent } from '../content/levels'
import type { ArmyPiece, RunState } from './run'

/** Case de chaque pièce de l'armée dans la zone de déploiement. */
export type Placement = Readonly<Record<string, Pos>>

/** Ordre de placement des pièces autres que héros et Pions : les plus fortes près du héros. */
const PLACEMENT_ORDER = ['queen', 'rook', 'bishop', 'knight', 'king', 'pawn'] as const

/**
 * Placement proposé : le héros au centre de la rangée arrière, les Pions devant,
 * les autres pièces au plus près du héros. Déterministe.
 */
export function autoDeploy(
  army: readonly ArmyPiece[],
  heroId: string,
  zone: readonly Pos[],
  forward: Pos,
): Placement {
  if (army.length > zone.length) {
    throw new Error(`Zone de déploiement trop petite : ${zone.length} cases pour ${army.length} pièces`)
  }
  const front = (p: Pos) => p.x * forward.x + p.y * forward.y
  const lateral = (p: Pos) => (forward.x === 0 ? p.x : p.y)
  const center = zone.reduce((sum, p) => sum + lateral(p), 0) / zone.length
  const spread = (p: Pos) => Math.abs(lateral(p) - center)
  const free = [...zone]
  const take = (compare: (a: Pos, b: Pos) => number): Pos => {
    free.sort((a, b) => compare(a, b) || spread(a) - spread(b) || lateral(a) - lateral(b))
    const cell = free.shift()
    if (!cell) throw new Error('Plus de case libre dans la zone de déploiement')
    return cell
  }

  const placement: Record<string, Pos> = {}
  const heroPos = take((a, b) => front(a) - front(b))
  placement[heroId] = heroPos

  const others = army.filter((piece) => piece.id !== heroId)
  for (const pawn of others.filter((piece) => piece.type === 'pawn')) {
    placement[pawn.id] = take((a, b) => front(b) - front(a))
  }
  const rest = others
    .filter((piece) => piece.type !== 'pawn')
    .sort((a, b) => PLACEMENT_ORDER.indexOf(a.type) - PLACEMENT_ORDER.indexOf(b.type))
  for (const piece of rest) {
    placement[piece.id] = take((a, b) => kingDistance(a, heroPos) - kingDistance(b, heroPos))
  }
  return placement
}

/**
 * Déplace une pièce sur une autre case de la zone ; si la case est occupée, les
 * deux pièces échangent leur place. Une case hors zone ne change rien.
 */
export function movePlacement(placement: Placement, pieceId: string, to: Pos, zone: readonly Pos[]): Placement {
  const from = placement[pieceId]
  if (!from || !zone.some((cell) => samePos(cell, to))) return placement
  const occupant = Object.keys(placement).find((id) => id !== pieceId && samePos(placement[id], to))
  const next: Record<string, Pos> = { ...placement, [pieceId]: to }
  if (occupant) next[occupant] = from
  return next
}

/** Niveau du run : les ennemis du gabarit, et l'armée placée dans la zone. */
export function battleDefinition(level: LevelContent, run: RunState, placement: Placement): LevelDefinition {
  const heroPos = placement[run.heroId]
  if (!heroPos) throw new Error('Le héros n’est pas placé')
  const army: UnitSpec[] = run.army.map((piece) => {
    const at = placement[piece.id]
    if (!at) throw new Error(`Pièce non placée : ${piece.id}`)
    return { type: piece.type, side: 'player', at, id: piece.id, powers: piece.powers }
  })
  return {
    ...level.definition,
    units: [...level.definition.units.filter((unit) => unit.side === 'enemy'), ...army],
    hero: heroPos,
  }
}

/** Direction « avant » du joueur dans ce niveau, en vecteur. */
export function playerForward(level: LevelContent): Pos {
  return DIRECTION_VECTORS[level.definition.forward.player]
}
