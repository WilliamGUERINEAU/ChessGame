import { describe, expect, it } from 'vitest'
import { pos } from '../geometry'
import { boardCells, boardToAscii, isOnBoard, isStandable, parseBoard, terrainAt } from './board'

describe('parseBoard', () => {
  const lShape = parseBoard([
    '..',
    'f.',
    '.~#i',
    '....',
  ])

  it('calcule les dimensions à partir de la plus longue ligne', () => {
    expect(lShape.width).toBe(4)
    expect(lShape.height).toBe(4)
  })

  it('traduit chaque caractère en terrain', () => {
    expect(terrainAt(lShape, pos(0, 0))).toBe('floor')
    expect(terrainAt(lShape, pos(0, 1))).toBe('forest')
    expect(terrainAt(lShape, pos(1, 2))).toBe('water')
    expect(terrainAt(lShape, pos(2, 2))).toBe('wall')
    expect(terrainAt(lShape, pos(3, 2))).toBe('ice')
  })

  it('complète les lignes courtes par du vide (forme en L)', () => {
    expect(terrainAt(lShape, pos(2, 0))).toBeNull()
    expect(terrainAt(lShape, pos(3, 1))).toBeNull()
    expect(isOnBoard(lShape, pos(3, 1))).toBe(false)
  })

  it('traite les coordonnées hors grille comme hors plateau', () => {
    expect(terrainAt(lShape, pos(-1, 0))).toBeNull()
    expect(terrainAt(lShape, pos(0, 4))).toBeNull()
  })

  it('accepte des trous au milieu du plateau', () => {
    const ring = parseBoard(['...', '. .', '...'])
    expect(isOnBoard(ring, pos(1, 1))).toBe(false)
    expect(boardCells(ring)).toHaveLength(8)
  })

  it('refuse un caractère inconnu en indiquant sa position', () => {
    expect(() => parseBoard(['..', '.?'])).toThrow('(1, 1)')
  })

  it('refuse un plateau vide ou sans case', () => {
    expect(() => parseBoard([])).toThrow()
    expect(() => parseBoard(['   ', ''])).toThrow()
  })

  it('se retranscrit à l’identique en texte', () => {
    const rows = ['..', 'f.', '.~#i', '....']
    expect(boardToAscii(parseBoard(rows))).toEqual(rows)
  })
})

describe('isStandable', () => {
  const board = parseBoard(['.f~#i'])

  it('autorise le sol, la forêt et la glace', () => {
    expect(isStandable(board, pos(0, 0))).toBe(true)
    expect(isStandable(board, pos(1, 0))).toBe(true)
    expect(isStandable(board, pos(4, 0))).toBe(true)
  })

  it("interdit l'eau, le mur et le hors-plateau", () => {
    expect(isStandable(board, pos(2, 0))).toBe(false)
    expect(isStandable(board, pos(3, 0))).toBe(false)
    expect(isStandable(board, pos(5, 0))).toBe(false)
  })
})
