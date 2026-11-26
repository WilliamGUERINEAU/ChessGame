/**
 * Position d'une case : x = colonne (croît vers la droite),
 * y = ligne (croît vers le bas, comme à l'écran).
 */
export interface Pos {
  readonly x: number
  readonly y: number
}

/** Déplacement relatif entre deux cases. */
export type Vec = Pos

/** Direction « avant » d'un camp (utilisée par les pions). */
export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTION_VECTORS: Readonly<Record<Direction, Vec>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const ORTHOGONAL: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

export const DIAGONAL: readonly Vec[] = [
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
]

/** Les 8 directions autour d'une case (voisinage du Roi). */
export const ALL_DIRECTIONS: readonly Vec[] = [...ORTHOGONAL, ...DIAGONAL]

export const KNIGHT_JUMPS: readonly Vec[] = [
  { x: 1, y: -2 },
  { x: 2, y: -1 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: -1, y: 2 },
  { x: -2, y: 1 },
  { x: -2, y: -1 },
  { x: -1, y: -2 },
]

export const pos = (x: number, y: number): Pos => ({ x, y })

export const add = (p: Pos, v: Vec): Pos => ({ x: p.x + v.x, y: p.y + v.y })

export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y

/** Clé texte « x,y », pratique pour les Map et Set. */
export const posKey = (p: Pos): string => `${p.x},${p.y}`

/** Vecteur unitaire de a vers b (composantes -1, 0 ou 1). */
export const stepToward = (a: Pos, b: Pos): Vec => ({
  x: Math.sign(b.x - a.x) || 0,
  y: Math.sign(b.y - a.y) || 0,
})

/** Distance en nombre de pas de Roi (distance de Tchebychev). */
export const kingDistance = (a: Pos, b: Pos): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Les deux vecteurs perpendiculaires à une direction orthogonale. */
export function perpendiculars(v: Vec): readonly [Vec, Vec] {
  return v.x === 0
    ? [{ x: -1, y: 0 }, { x: 1, y: 0 }]
    : [{ x: 0, y: -1 }, { x: 0, y: 1 }]
}
