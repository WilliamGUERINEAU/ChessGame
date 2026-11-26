import type { Pos } from '../geometry'

export type Terrain = 'floor' | 'forest' | 'water' | 'wall' | 'ice'

export interface TerrainRules {
  /** Une pièce peut s'arrêter (et donc se tenir) sur cette case. Sinon, la case bloque aussi les glissades. */
  readonly standable: boolean
  /** Entrer sur cette case termine une glissade (Tour, Fou, Dame, double pas du pion). */
  readonly stopsSlide: boolean
  /** Une pièce qui s'y arrête après un déplacement en ligne glisse d'une case de plus. */
  readonly slippery: boolean
  /** Bloque les lignes de vue : réservé aux futurs effets à distance. */
  readonly blocksSight: boolean
}

export const TERRAIN_RULES: Readonly<Record<Terrain, TerrainRules>> = {
  floor: { standable: true, stopsSlide: false, slippery: false, blocksSight: false },
  forest: { standable: true, stopsSlide: true, slippery: false, blocksSight: false },
  // L'eau et le mur ne se distinguent que par la vue : le Cavalier saute les deux.
  water: { standable: false, stopsSlide: false, slippery: false, blocksSight: false },
  wall: { standable: false, stopsSlide: false, slippery: false, blocksSight: true },
  ice: { standable: true, stopsSlide: false, slippery: true, blocksSight: false },
}

/**
 * Plateau de forme libre : une grille dont certaines cases n'existent pas.
 * `cells[y * width + x]` vaut le terrain, ou `null` hors du plateau.
 */
export interface Board {
  readonly width: number
  readonly height: number
  readonly cells: readonly (Terrain | null)[]
}

/** Correspondance caractère ↔ terrain pour décrire les plateaux en texte. */
const CHAR_TO_TERRAIN = new Map<string, Terrain | null>([
  ['.', 'floor'],
  ['f', 'forest'],
  ['~', 'water'],
  ['#', 'wall'],
  ['i', 'ice'],
  [' ', null],
])

const TERRAIN_TO_CHAR = new Map<Terrain | null, string>(
  [...CHAR_TO_TERRAIN].map(([ch, terrain]) => [terrain, ch]),
)

/**
 * Construit un plateau à partir de lignes de texte.
 * `.` sol, `f` forêt, `~` eau, `#` mur, `i` glace, espace = hors plateau.
 * Les lignes plus courtes sont complétées par du vide.
 */
export function parseBoard(rows: readonly string[]): Board {
  if (rows.length === 0) throw new Error('Plateau vide : aucune ligne')
  const width = Math.max(...rows.map((row) => row.length))
  const cells: (Terrain | null)[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const ch = x < row.length ? row[x] : ' '
      const terrain = CHAR_TO_TERRAIN.get(ch)
      if (terrain === undefined) {
        throw new Error(`Caractère de terrain inconnu « ${ch} » en (${x}, ${y})`)
      }
      cells.push(terrain)
    }
  })
  if (cells.every((cell) => cell === null)) throw new Error('Plateau sans aucune case')
  return { width, height: rows.length, cells }
}

/** Représentation texte du plateau (inverse de `parseBoard`, espaces finaux retirés). */
export function boardToAscii(board: Board): string[] {
  const rows: string[] = []
  for (let y = 0; y < board.height; y++) {
    let row = ''
    for (let x = 0; x < board.width; x++) {
      row += TERRAIN_TO_CHAR.get(board.cells[y * board.width + x])
    }
    rows.push(row.trimEnd())
  }
  return rows
}

/** Terrain d'une case, ou `null` si elle est hors du plateau. */
export function terrainAt(board: Board, p: Pos): Terrain | null {
  if (p.x < 0 || p.y < 0 || p.x >= board.width || p.y >= board.height) return null
  return board.cells[p.y * board.width + p.x]
}

export function isOnBoard(board: Board, p: Pos): boolean {
  return terrainAt(board, p) !== null
}

/** Une pièce peut-elle se tenir sur cette case (en ignorant les autres pièces) ? */
export function isStandable(board: Board, p: Pos): boolean {
  const terrain = terrainAt(board, p)
  return terrain !== null && TERRAIN_RULES[terrain].standable
}

/** Toutes les cases du plateau, en ordre de lecture. */
export function boardCells(board: Board): Pos[] {
  const out: Pos[] = []
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y * board.width + x] !== null) out.push({ x, y })
    }
  }
  return out
}
