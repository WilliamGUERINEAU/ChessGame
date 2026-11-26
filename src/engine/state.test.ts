import { describe, expect, it } from 'vitest'
import { PIECES } from './pieces/pieces'
import { createLevel, findPiece, unitsFromAscii, type LevelDefinition } from './state'

const base: LevelDefinition = {
  terrain: ['...', '.~.', '...'],
  units: [
    { type: 'king', side: 'player', at: { x: 0, y: 2 } },
    { type: 'rook', side: 'enemy', at: { x: 2, y: 0 } },
  ],
  forward: { player: 'up', enemy: 'down' },
  goal: { kind: 'eliminate' },
  hero: { x: 0, y: 2 },
}

describe('createLevel', () => {
  it('crée un niveau en cours, au joueur de commencer', () => {
    const state = createLevel(base)
    expect(state.status).toBe('ongoing')
    expect(state.sideToMove).toBe('player')
    expect(state.round).toBe(1)
    expect(state.heroId).toBe('p1')
  })

  it('donne aux pièces les PV et l’attaque de base', () => {
    const rook = findPiece(createLevel(base), 'e1')
    expect(rook).toMatchObject({
      hp: PIECES.rook.hp,
      maxHp: PIECES.rook.hp,
      atk: PIECES.rook.atk,
      hasMoved: false,
    })
  })

  it('accepte des statistiques personnalisées (boss, pièce blessée)', () => {
    const state = createLevel({
      ...base,
      units: [
        base.units[0],
        { type: 'rook', side: 'enemy', at: { x: 2, y: 0 }, id: 'boss', hp: 10, atk: 4 },
        { type: 'pawn', side: 'enemy', at: { x: 2, y: 2 }, hp: 1, maxHp: 3 },
      ],
    })
    expect(findPiece(state, 'boss')).toMatchObject({ hp: 10, maxHp: 10, atk: 4 })
    expect(findPiece(state, 'e1')).toMatchObject({ hp: 1, maxHp: 3 })
  })

  it('n’attribue pas un identifiant automatique déjà pris', () => {
    const state = createLevel({
      ...base,
      units: [
        base.units[0],
        { type: 'rook', side: 'enemy', at: { x: 2, y: 0 }, id: 'e1' },
        { type: 'pawn', side: 'enemy', at: { x: 2, y: 2 } },
      ],
    })
    expect(state.pieces.map((piece) => piece.id)).toEqual(['p1', 'e1', 'e2'])
  })

  it('refuse une unité sur l’eau, hors plateau ou sur une case occupée', () => {
    const on = (x: number, y: number) => ({
      ...base,
      units: [...base.units, { type: 'pawn' as const, side: 'enemy' as const, at: { x, y } }],
    })
    expect(() => createLevel(on(1, 1))).toThrow('case impossible')
    expect(() => createLevel(on(5, 0))).toThrow('case impossible')
    expect(() => createLevel(on(2, 0))).toThrow('même case')
  })

  it('refuse un héros qui n’est pas une pièce du joueur', () => {
    expect(() => createLevel({ ...base, hero: { x: 2, y: 0 } })).toThrow('héros')
    expect(() => createLevel({ ...base, hero: { x: 1, y: 0 } })).toThrow('héros')
  })

  it('résout la cible d’un objectif de capture', () => {
    const state = createLevel({ ...base, goal: { kind: 'capture', target: { x: 2, y: 0 }, maxRounds: 5 } })
    expect(state.goal).toEqual({ kind: 'capture', targetId: 'e1', maxRounds: 5 })
    expect(() =>
      createLevel({ ...base, goal: { kind: 'capture', target: { x: 0, y: 2 } } }),
    ).toThrow('ennemie')
  })

  it('refuse des valeurs invalides', () => {
    expect(() => createLevel({ ...base, goal: { kind: 'survive', rounds: 0 } })).toThrow()
    expect(() =>
      createLevel({ ...base, units: [{ ...base.units[0], hp: 5, maxHp: 3 }, base.units[1]] }),
    ).toThrow('PV')
    expect(() =>
      createLevel({ ...base, units: [base.units[0], { ...base.units[1], atk: -1 }] }),
    ).toThrow('Attaque')
  })
})

describe('unitsFromAscii', () => {
  it('lit les pièces : majuscules = joueur, minuscules = ennemi', () => {
    expect(unitsFromAscii(['K.n', ' p'])).toEqual([
      { type: 'king', side: 'player', at: { x: 0, y: 0 } },
      { type: 'knight', side: 'enemy', at: { x: 2, y: 0 } },
      { type: 'pawn', side: 'enemy', at: { x: 1, y: 1 } },
    ])
  })

  it('refuse une lettre inconnue', () => {
    expect(() => unitsFromAscii(['K.x'])).toThrow('(2, 0)')
  })
})
