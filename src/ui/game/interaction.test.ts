import { describe, expect, it } from 'vitest'
import { applyAction } from '../../engine'
import { idAt, testLevel } from '../../engine/testing'
import { highlightsFor, interpretClick, lastMoveOf, logEntriesFor, NO_SELECTION } from './interaction'

describe('interpretClick', () => {
  const state = testLevel({ terrain: ['....', '....', '....'], units: ['...r', '', 'R..K'] })
  const rook = idAt(state, 0, 2)

  it('sélectionne une pièce du joueur', () => {
    expect(interpretClick(state, NO_SELECTION, { x: 0, y: 2 })).toEqual({
      kind: 'select',
      selection: { kind: 'piece', pieceId: rook },
    })
  })

  it('ne sélectionne pas une pièce ennemie', () => {
    expect(interpretClick(state, NO_SELECTION, { x: 3, y: 0 })).toEqual({ kind: 'select', selection: NO_SELECTION })
  })

  it('joue un déplacement vers une case en surbrillance', () => {
    const result = interpretClick(state, { kind: 'piece', pieceId: rook }, { x: 0, y: 0 })
    expect(result).toEqual({ kind: 'play', action: { kind: 'move', pieceId: rook, to: { x: 0, y: 0 } } })
  })

  it('recliquer sur la pièce sélectionnée la désélectionne', () => {
    expect(interpretClick(state, { kind: 'piece', pieceId: rook }, { x: 0, y: 2 })).toEqual({
      kind: 'select',
      selection: NO_SELECTION,
    })
  })

  it('passe à une autre pièce du joueur', () => {
    const king = idAt(state, 3, 2)
    expect(interpretClick(state, { kind: 'piece', pieceId: rook }, { x: 3, y: 2 })).toEqual({
      kind: 'select',
      selection: { kind: 'piece', pieceId: king },
    })
  })

  it('attaque directement quand il n’y a pas de choix d’atterrissage', () => {
    const lethal = testLevel({ terrain: ['....'], units: ['Q..p'] })
    const queen = idAt(lethal, 0, 0)
    expect(interpretClick(lethal, { kind: 'piece', pieceId: queen }, { x: 3, y: 0 })).toEqual({
      kind: 'play',
      action: { kind: 'attack', pieceId: queen, target: { x: 3, y: 0 } },
    })
  })

  it('demande la case d’atterrissage puis joue l’attaque choisie', () => {
    const close = testLevel({ terrain: ['....', '....'], units: ['Rr..', '....'] })
    const attacker = idAt(close, 0, 0)
    const first = interpretClick(close, { kind: 'piece', pieceId: attacker }, { x: 1, y: 0 })
    expect(first.kind).toBe('select')
    if (first.kind !== 'select' || first.selection.kind !== 'landing') throw new Error('choix attendu')
    expect(first.selection.options).toContainEqual({ x: 2, y: 1 })

    const second = interpretClick(close, first.selection, { x: 2, y: 1 })
    expect(second).toEqual({
      kind: 'play',
      action: { kind: 'attack', pieceId: attacker, target: { x: 1, y: 0 }, landing: { x: 2, y: 1 } },
    })
    // Un clic hors des cases proposées annule le choix mais garde la pièce sélectionnée.
    expect(interpretClick(close, first.selection, { x: 3, y: 1 })).toEqual({
      kind: 'select',
      selection: { kind: 'piece', pieceId: attacker },
    })
  })

  it('ignore les clics pendant le tour de l’ennemi', () => {
    const enemyTurn = applyAction(state, { kind: 'move', pieceId: rook, to: { x: 0, y: 1 } }).state
    expect(interpretClick(enemyTurn, NO_SELECTION, { x: 3, y: 2 })).toEqual({ kind: 'select', selection: NO_SELECTION })
  })
})

describe('highlightsFor', () => {
  it('distingue déplacements et attaques', () => {
    const state = testLevel({ terrain: ['...'], units: ['R.p'] })
    const h = highlightsFor(state, { kind: 'piece', pieceId: idAt(state, 0, 0) })
    expect(h.moves).toEqual([{ x: 1, y: 0 }])
    expect(h.attacks).toEqual([{ x: 2, y: 0 }])
    expect(h.landings).toEqual([])
  })
})

describe('journal et dernier déplacement', () => {
  it('décrit attaques, captures et glissades, et suit la pièce jusqu’au bout de la glace', () => {
    const state = testLevel({ terrain: ['..i.', '....'], units: ['R.p.', '...k'] })
    const { events } = applyAction(state, { kind: 'attack', pieceId: idAt(state, 0, 0), target: { x: 2, y: 0 } })
    expect(logEntriesFor(state, events, 1).map((entry) => entry.kind)).toEqual(['attack', 'capture', 'iceSlide'])
    expect(lastMoveOf(events)).toEqual({ from: { x: 0, y: 0 }, to: { x: 3, y: 0 } })
  })
})

describe('journal des nouveaux pouvoirs', () => {
  it('note balayage, vampirisme et élan', () => {
    const state = testLevel({
      terrain: ['....', '....'],
      units: ['R.p.', '...p'],
      stats: { '0,0': { powers: ['sweep', 'lifesteal', 'momentum'], hp: 1, maxHp: 4 }, '3,1': { hp: 3 } },
    })
    const { events } = applyAction(state, { kind: 'attack', pieceId: idAt(state, 0, 0), target: { x: 2, y: 0 } })
    const kinds = logEntriesFor(state, events, 1).map((entry) => entry.kind)
    expect(kinds).toEqual(expect.arrayContaining(['attack', 'capture', 'sweep', 'heal', 'momentum']))
  })

  it('note la poussée et l’écrasement', () => {
    const pushed = testLevel({
      terrain: ['....'],
      units: ['R.n.'],
      stats: { '0,0': { powers: ['knockback'] }, '2,0': { hp: 5 } },
    })
    const push = applyAction(pushed, { kind: 'attack', pieceId: idAt(pushed, 0, 0), target: { x: 2, y: 0 } })
    expect(logEntriesFor(pushed, push.events, 1).map((entry) => entry.kind)).toContain('push')

    const crushed = testLevel({
      terrain: ['...'],
      units: ['R.n'],
      stats: { '0,0': { powers: ['knockback'] }, '2,0': { hp: 5 } },
    })
    const crush = applyAction(crushed, { kind: 'attack', pieceId: idAt(crushed, 0, 0), target: { x: 2, y: 0 } })
    expect(logEntriesFor(crushed, crush.events, 1).map((entry) => entry.kind)).toContain('crush')
  })
})
