import { describe, expect, it } from 'vitest'
import { applyAction, IllegalActionError } from './apply'
import type { Pos } from './geometry'
import type { Action } from './moves'
import { findPiece } from './state'
import { attacksOn, idAt, testLevel, where } from './testing'

const move = (pieceId: string, x: number, y: number): Action => ({ kind: 'move', pieceId, to: { x, y } })
const attack = (pieceId: string, x: number, y: number, landing?: Pos): Action =>
  landing
    ? { kind: 'attack', pieceId, target: { x, y }, landing }
    : { kind: 'attack', pieceId, target: { x, y } }

describe('combat', () => {
  it('une cible tuée est retirée et l’attaquant prend sa case', () => {
    const state = testLevel({ terrain: ['....'], units: ['Q.pk'] })
    const queen = idAt(state, 0, 0)
    const pawn = idAt(state, 2, 0)
    const { state: after, events } = applyAction(state, attack(queen, 2, 0))
    expect(findPiece(after, pawn)).toBeUndefined()
    expect(where(after, queen)).toBe('2,0')
    expect(events).toEqual([
      { type: 'attack', pieceId: queen, targetId: pawn, damage: 3, targetHp: 0 },
      { type: 'capture', pieceId: pawn, byId: queen },
      { type: 'move', pieceId: queen, from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
    ])
  })

  it('les dégâts valent l’attaque de l’attaquant', () => {
    const state = testLevel({ terrain: ['....'], units: ['R..r'] })
    const target = idAt(state, 3, 0)
    const after = applyAction(state, attack(idAt(state, 0, 0), 3, 0)).state
    expect(findPiece(after, target)?.hp).toBe(1)
  })

  it('glissade depuis 2 cases ou plus : l’attaquant s’arrête juste avant la cible', () => {
    const state = testLevel({ terrain: ['....'], units: ['R..r'] })
    const rook = idAt(state, 0, 0)
    expect(attacksOn(state, rook, { x: 3, y: 0 })).toEqual([attack(rook, 3, 0)])
    const after = applyAction(state, attack(rook, 3, 0)).state
    expect(where(after, rook)).toBe('2,0')
  })

  it('attaque adjacente : atterrissage au choix sur une case voisine libre (8 directions)', () => {
    const state = testLevel({
      terrain: ['....', '....', '..~.'],
      units: ['.p..', '.Rr.'],
    })
    const rook = idAt(state, 1, 1)
    const landings = attacksOn(state, rook, { x: 2, y: 1 })
      .map((action) => (action.kind === 'attack' && action.landing ? `${action.landing.x},${action.landing.y}` : '-'))
      .sort()
    // (1,0) est occupée, (2,2) est de l'eau ; la case de départ (1,1) reste possible.
    expect(landings).toEqual(['1,1', '1,2', '2,0', '3,0', '3,1', '3,2'])

    const after = applyAction(state, attack(rook, 2, 1, { x: 3, y: 2 })).state
    expect(where(after, rook)).toBe('3,2')
    expect(findPiece(after, idAt(state, 2, 1))?.hp).toBe(1)
  })

  it('attaque adjacente : rester sur place ne produit pas de déplacement', () => {
    const state = testLevel({ terrain: ['...'], units: ['Rr.'] })
    const rook = idAt(state, 0, 0)
    const { state: after, events } = applyAction(state, attack(rook, 1, 0, { x: 0, y: 0 }))
    expect(where(after, rook)).toBe('0,0')
    expect(events.map((event) => event.type)).toEqual(['attack'])
  })

  it('saut du Cavalier : atterrissage sur une case voisine de la cible, pas sur sa case de départ', () => {
    const state = testLevel({ terrain: ['...', '...', '...'], units: ['N..', '', '.r.'] })
    const knight = idAt(state, 0, 0)
    const landings = attacksOn(state, knight, { x: 1, y: 2 })
      .map((action) => (action.kind === 'attack' && action.landing ? `${action.landing.x},${action.landing.y}` : '-'))
      .sort()
    expect(landings).toEqual(['0,1', '0,2', '1,1', '2,1', '2,2'])
  })

  it('saut du Cavalier sans case libre autour de la cible : il reste sur sa case', () => {
    const state = testLevel({ terrain: ['...', '~~~', '#.#'], units: ['N..', '', '.r.'] })
    const knight = idAt(state, 0, 0)
    expect(attacksOn(state, knight, { x: 1, y: 2 })).toEqual([attack(knight, 1, 2)])
    const after = applyAction(state, attack(knight, 1, 2)).state
    expect(where(after, knight)).toBe('0,0')
    expect(findPiece(after, knight)?.hasMoved).toBe(true)
  })

  it('le pion attaque en diagonale et atterrit au choix si la cible survit', () => {
    const state = testLevel({ terrain: ['...', '...'], units: ['..r', '.P.'] })
    const pawn = idAt(state, 1, 1)
    expect(attacksOn(state, pawn, { x: 2, y: 0 }).length).toBeGreaterThan(1)
    const after = applyAction(state, attack(pawn, 2, 0, { x: 1, y: 0 })).state
    expect(where(after, pawn)).toBe('1,0')
  })

  it('un atterrissage sur la glace ne fait pas glisser', () => {
    // Plateau assez large pour qu'une glissade erronée soit possible dans toute direction.
    const state = testLevel({ terrain: ['.....', '...i.', '.....'], units: ['', 'N....', '..r..'] })
    // Le Cavalier (0,1) attaque la Tour (2,2) et atterrit sur la glace en (3,1).
    const knight = idAt(state, 0, 1)
    const after = applyAction(state, attack(knight, 2, 2, { x: 3, y: 1 })).state
    expect(where(after, knight)).toBe('3,1')
  })
})

describe('glace', () => {
  it('une pièce qui s’arrête sur la glace glisse d’une case de plus', () => {
    const state = testLevel({ terrain: ['..i..'], units: ['R...p'] })
    const rook = idAt(state, 0, 0)
    const { state: after, events } = applyAction(state, move(rook, 2, 0))
    expect(where(after, rook)).toBe('3,0')
    expect(events).toEqual([
      { type: 'move', pieceId: rook, from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
      { type: 'iceSlide', pieceId: rook, from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
    ])
  })

  it('elle glisse tant qu’elle reste sur la glace', () => {
    const state = testLevel({ terrain: ['.iii..'], units: ['R....p'] })
    const rook = idAt(state, 0, 0)
    const { state: after, events } = applyAction(state, move(rook, 1, 0))
    expect(where(after, rook)).toBe('4,0')
    expect(events.filter((event) => event.type === 'iceSlide')).toHaveLength(3)
  })

  it.each([
    ['l’eau', ['..i~', '....'], ['R...', '...p']],
    ['un mur', ['..i#', '....'], ['R...', '...p']],
    ['une pièce', ['..i.'], ['R..p']],
    ['le bord du plateau', ['..i', '...'], ['R..', '..p']],
    ['le vide', ['..i .', '.....'], ['R....', '....p']],
  ])('elle reste sur la glace devant %s', (_label, terrain, units) => {
    const state = testLevel({ terrain, units })
    const rook = idAt(state, 0, 0)
    expect(where(applyAction(state, move(rook, 2, 0)).state, rook)).toBe('2,0')
  })

  it('elle s’arrête en arrivant dans une forêt', () => {
    const state = testLevel({ terrain: ['.iif.'], units: ['R...p'] })
    const rook = idAt(state, 0, 0)
    expect(where(applyAction(state, move(rook, 1, 0)).state, rook)).toBe('3,0')
  })

  it('le Roi et le pion glissent aussi', () => {
    const king = testLevel({ terrain: ['.i.', '...'], units: ['K..', '..p'] })
    expect(where(applyAction(king, move(idAt(king, 0, 0), 1, 0)).state, idAt(king, 0, 0))).toBe('2,0')

    const pawn = testLevel({ terrain: ['...', '...', '.i.', '...'], units: ['p..', '', '', '.P.'] })
    const pawnId = idAt(pawn, 1, 3)
    expect(where(applyAction(pawn, move(pawnId, 1, 2)).state, pawnId)).toBe('1,1')
  })

  it('un Cavalier qui atterrit sur la glace ne glisse pas', () => {
    // Plateau 4×4 : une glissade erronée vers (2,3) serait possible.
    const state = testLevel({ terrain: ['....', '....', '.i..', '....'], units: ['N.p'] })
    const knight = idAt(state, 0, 0)
    expect(where(applyAction(state, move(knight, 1, 2)).state, knight)).toBe('1,2')
  })

  it('après avoir tué une cible sur la glace, l’attaquant glisse', () => {
    const state = testLevel({ terrain: ['..i.', '....'], units: ['R.p.', '...k'] })
    const rook = idAt(state, 0, 0)
    expect(where(applyAction(state, attack(rook, 2, 0)).state, rook)).toBe('3,0')
  })

  it('s’arrêter sur la glace juste avant une cible qui survit ne fait pas glisser', () => {
    const state = testLevel({ terrain: ['..i.'], units: ['R..r'] })
    const rook = idAt(state, 0, 0)
    expect(where(applyAction(state, attack(rook, 3, 0)).state, rook)).toBe('2,0')
  })
})

describe('tours et actions illégales', () => {
  it('alterne les camps et compte les tours après l’action de l’ennemi', () => {
    let state = testLevel({ terrain: ['...', '...', '...'], units: ['..k', '', 'K..'] })
    state = applyAction(state, move(idAt(state, 0, 2), 0, 1)).state
    expect(state.sideToMove).toBe('enemy')
    expect(state.round).toBe(1)
    state = applyAction(state, move(idAt(state, 2, 0), 2, 1)).state
    expect(state.sideToMove).toBe('player')
    expect(state.round).toBe(2)
  })

  it('refuse une action illégale', () => {
    const state = testLevel({ terrain: ['....'], units: ['R..r'] })
    const rook = idAt(state, 0, 0)
    const enemy = idAt(state, 3, 0)
    expect(() => applyAction(state, move(enemy, 2, 0))).toThrow(IllegalActionError)
    expect(() => applyAction(state, move(rook, 3, 0))).toThrow(IllegalActionError)
    expect(() => applyAction(state, { kind: 'pass' })).toThrow(IllegalActionError)
    expect(() => applyAction(state, attack(rook, 3, 0, { x: 2, y: 0 }))).toThrow(IllegalActionError)
  })

  it('exige une case d’atterrissage quand le choix existe', () => {
    const state = testLevel({ terrain: ['...'], units: ['Rr.'] })
    expect(() => applyAction(state, attack(idAt(state, 0, 0), 1, 0))).toThrow(IllegalActionError)
  })

  it('ne modifie jamais l’état d’origine', () => {
    const state = testLevel({ terrain: ['....'], units: ['R..r'] })
    const snapshot = JSON.stringify(state)
    applyAction(state, attack(idAt(state, 0, 0), 3, 0))
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})
