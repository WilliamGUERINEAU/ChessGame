import { describe, expect, it } from 'vitest'
import { applyAction } from '../apply'
import type { Pos } from '../geometry'
import type { Action } from '../moves'
import { PIECES } from '../pieces/pieces'
import { findPiece } from '../state'
import { attackKeys, attacksOn, idAt, moveKeys, testLevel, where } from '../testing'
import { canReceive, powerCount, statsFor, type PowerId } from './powers'

const move = (pieceId: string, x: number, y: number): Action => ({ kind: 'move', pieceId, to: { x, y } })
const attack = (pieceId: string, x: number, y: number, landing?: Pos): Action =>
  landing
    ? { kind: 'attack', pieceId, target: { x, y }, landing }
    : { kind: 'attack', pieceId, target: { x, y } }
const powers = (...list: PowerId[]) => ({ powers: list })

describe('statistiques et règles d’attribution', () => {
  it('Vigueur et Force s’ajoutent aux valeurs de base', () => {
    expect(statsFor('rook', ['vigor', 'vigor', 'strength'])).toEqual({
      maxHp: PIECES.rook.hp + 2,
      atk: PIECES.rook.atk + 1,
    })
  })

  it('les pièces créées avec des pouvoirs en tiennent compte', () => {
    const state = testLevel({ terrain: ['...'], units: ['R.p'], stats: { '0,0': powers('vigor', 'shield') } })
    expect(findPiece(state, idAt(state, 0, 0))).toMatchObject({
      maxHp: PIECES.rook.hp + 1,
      hp: PIECES.rook.hp + 1,
      shieldActive: true,
      powers: ['vigor', 'shield'],
    })
  })

  it('canReceive respecte le type de pièce et le nombre maximal d’exemplaires', () => {
    expect(canReceive('pawn', [], 'promotion')).toBe(true)
    expect(canReceive('rook', [], 'promotion')).toBe(false)
    expect(canReceive('knight', [], 'skates')).toBe(false)
    expect(canReceive('king', [], 'reach')).toBe(true)
    expect(canReceive('rook', ['strength', 'strength'], 'strength')).toBe(false)
    expect(canReceive('rook', ['shield'], 'shield')).toBe(false)
    expect(powerCount(['vigor', 'shield', 'vigor'], 'vigor')).toBe(2)
  })
})

describe('Forestier', () => {
  it('la forêt n’arrête plus les glissades', () => {
    const state = testLevel({ terrain: ['.f..'], units: ['R..p'], stats: { '0,0': powers('forester') } })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0', '2,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual(['3,0'])
  })

  it('le double pas du Pion traverse la forêt', () => {
    const state = testLevel({
      terrain: ['...', '...', '...', '.f.', '...'],
      units: ['..k', '', '', '', '.P.'],
      stats: { '1,4': powers('forester') },
    })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual(['1,2', '1,3'])
  })
})

describe('Patins', () => {
  it('la pièce ne glisse pas sur la glace', () => {
    const state = testLevel({ terrain: ['..i..'], units: ['R...p'], stats: { '0,0': powers('skates') } })
    const rook = idAt(state, 0, 0)
    expect(where(applyAction(state, move(rook, 2, 0)).state, rook)).toBe('2,0')
  })
})

describe('Allonge', () => {
  it('le Roi se déplace jusqu’à 2 cases, en ligne', () => {
    const state = testLevel({ terrain: ['.....', '.....', '.....'], units: ['....k', '', 'K....'], stats: { '0,2': powers('reach') } })
    expect(moveKeys(state, idAt(state, 0, 2))).toEqual(['0,0', '0,1', '1,1', '1,2', '2,0', '2,2'])
  })

  it('le Roi attaque à 2 cases et s’arrête devant si la cible survit', () => {
    const state = testLevel({ terrain: ['...'], units: ['K.r'], stats: { '0,0': powers('reach') } })
    const king = idAt(state, 0, 0)
    expect(attacksOn(state, king, { x: 2, y: 0 })).toEqual([attack(king, 2, 0)])
    expect(where(applyAction(state, attack(king, 2, 0)).state, king)).toBe('1,0')
  })

  it('le Pion avance d’une case de plus (3 au premier coup, 2 ensuite)', () => {
    const column = ['...', '...', '...', '...', '...', '...']
    let state = testLevel({ terrain: column, units: ['..k', '', '', '', '', '.P.'], stats: { '1,5': powers('reach') } })
    const pawn = idAt(state, 1, 5)
    expect(moveKeys(state, pawn)).toEqual(['1,2', '1,3', '1,4'])
    state = applyAction(state, move(pawn, 1, 4)).state
    state = applyAction(state, move(idAt(state, 2, 0), 2, 1)).state
    expect(moveKeys(state, pawn)).toEqual(['1,2', '1,3'])
  })
})

describe('Bouclier', () => {
  it('la première attaque reçue ne fait aucun dégât, la suivante si', () => {
    let state = testLevel({
      terrain: ['....', '....'],
      units: ['R..r', '...k'],
      stats: { '3,0': powers('shield') },
    })
    const rook = idAt(state, 0, 0)
    const target = idAt(state, 3, 0)
    const first = applyAction(state, attack(rook, 3, 0))
    expect(first.events).toContainEqual({ type: 'shieldBlock', pieceId: target })
    expect(findPiece(first.state, target)).toMatchObject({ hp: PIECES.rook.hp, shieldActive: false })
    state = applyAction(first.state, move(idAt(first.state, 3, 1), 2, 1)).state
    // La Tour s'est arrêtée devant la cible (2,0) : nouvelle attaque, adjacente cette fois.
    const second = applyAction(state, attack(rook, 3, 0, { x: 2, y: 0 }))
    expect(findPiece(second.state, target)?.hp).toBe(PIECES.rook.hp - PIECES.rook.atk)
  })

  it('une cible protégée survit forcément : il faut choisir où atterrir', () => {
    const state = testLevel({ terrain: ['...', '...'], units: ['Qp.', '...'], stats: { '1,0': powers('shield') } })
    expect(attacksOn(state, idAt(state, 0, 0), { x: 1, y: 0 }).length).toBeGreaterThan(1)
  })
})

describe('Riposte', () => {
  it('la cible qui survit frappe l’attaquant resté à côté', () => {
    const state = testLevel({ terrain: ['....'], units: ['R..r'], stats: { '3,0': powers('riposte') } })
    const rook = idAt(state, 0, 0)
    const { state: after, events } = applyAction(state, attack(rook, 3, 0))
    expect(events.map((event) => event.type)).toEqual(['attack', 'move', 'riposte'])
    expect(findPiece(after, rook)?.hp).toBe(PIECES.rook.hp - PIECES.rook.atk)
  })

  it('peut tuer l’attaquant, y compris le héros', () => {
    const state = testLevel({
      terrain: ['....'],
      units: ['R..r'],
      stats: { '0,0': { hp: 1, maxHp: 3 }, '3,0': powers('riposte') },
    })
    const { state: after, events } = applyAction(state, attack(idAt(state, 0, 0), 3, 0))
    expect(events).toContainEqual({ type: 'capture', pieceId: idAt(state, 0, 0), byId: idAt(state, 3, 0) })
    expect(after.endReason).toBe('heroDied')
  })

  it('ne se déclenche pas si l’attaquant n’a pas fini à côté', () => {
    const state = testLevel({ terrain: ['...', '~~~', '#.#'], units: ['N..', '', '.r.'], stats: { '1,2': powers('riposte') } })
    const { events } = applyAction(state, attack(idAt(state, 0, 0), 1, 2))
    expect(events.some((event) => event.type === 'riposte')).toBe(false)
  })

  it('le bouclier de l’attaquant absorbe la riposte', () => {
    const state = testLevel({
      terrain: ['....'],
      units: ['R..r'],
      stats: { '0,0': powers('shield'), '3,0': powers('riposte') },
    })
    const rook = idAt(state, 0, 0)
    const after = applyAction(state, attack(rook, 3, 0)).state
    expect(findPiece(after, rook)).toMatchObject({ hp: PIECES.rook.hp, shieldActive: false })
  })
})

describe('Promotion', () => {
  it('un Pion qui atteint le bord opposé devient une Dame', () => {
    const state = testLevel({ terrain: ['...', '...'], units: ['..k', '.P.'], stats: { '1,1': powers('promotion', 'vigor') } })
    const pawn = idAt(state, 1, 1)
    const { state: after, events } = applyAction(state, move(pawn, 1, 0))
    expect(events).toContainEqual({ type: 'promote', pieceId: pawn })
    expect(findPiece(after, pawn)).toMatchObject({
      type: 'queen',
      powers: ['vigor'],
      maxHp: PIECES.queen.hp + 1,
      hp: PIECES.queen.hp + 1,
      atk: PIECES.queen.atk,
    })
  })

  it('garde ses blessures en devenant Dame', () => {
    const state = testLevel({
      terrain: ['...', '...'],
      units: ['..k', '.P.'],
      stats: { '1,1': { powers: ['promotion'], hp: 1, maxHp: 2 } },
    })
    const pawn = idAt(state, 1, 1)
    const after = applyAction(state, move(pawn, 1, 0)).state
    // PV max 2 → 3 (Dame) : les PV passent de 1 à 2.
    expect(findPiece(after, pawn)).toMatchObject({ type: 'queen', hp: 2, maxHp: 3 })
  })

  it('aussi après une attaque en diagonale qui l’amène sur la dernière rangée', () => {
    const state = testLevel({ terrain: ['...', '...'], units: ['p.k', '.P.'], stats: { '1,1': powers('promotion') } })
    const pawn = idAt(state, 1, 1)
    expect(findPiece(applyAction(state, attack(pawn, 0, 0)).state, pawn)?.type).toBe('queen')
  })

  it('pas sans le pouvoir, ni devant un trou si le plateau continue au-delà', () => {
    const plain = testLevel({ terrain: ['...', '...'], units: ['..k', '.P.'] })
    expect(findPiece(applyAction(plain, move(idAt(plain, 1, 1), 1, 0)).state, idAt(plain, 1, 1))?.type).toBe('pawn')

    const hole = testLevel({ terrain: ['...', '. .', '...', '...'], units: ['..k', '', '', '.P.'], stats: { '1,3': powers('promotion') } })
    const pawn = idAt(hole, 1, 3)
    expect(findPiece(applyAction(hole, move(pawn, 1, 2)).state, pawn)?.type).toBe('pawn')
  })
})

describe('Perçage', () => {
  it('la glissade traverse la première pièce alliée, sans pouvoir s’y arrêter', () => {
    const state = testLevel({ terrain: ['.....'], units: ['RP..p'], stats: { '0,0': powers('piercing') } })
    const rook = idAt(state, 0, 0)
    expect(moveKeys(state, rook)).toEqual(['2,0', '3,0'])
    expect(attackKeys(state, rook)).toEqual(['4,0'])
  })

  it('une deuxième pièce alliée bloque', () => {
    const state = testLevel({ terrain: ['.....'], units: ['RPP.p'], stats: { '0,0': powers('piercing') } })
    expect(pieceMoves(state)).toEqual([])
  })

  it('si l’allié traversé est juste devant une cible qui survit, l’attaquant reste sur place', () => {
    const state = testLevel({ terrain: ['...'], units: ['RPr'], stats: { '0,0': powers('piercing') } })
    const rook = idAt(state, 0, 0)
    expect(attacksOn(state, rook, { x: 2, y: 0 })).toEqual([attack(rook, 2, 0)])
    expect(where(applyAction(state, attack(rook, 2, 0)).state, rook)).toBe('0,0')
  })

  it('un allié dans une forêt ne peut pas être traversé (sauf Forestier)', () => {
    const blocked = testLevel({ terrain: ['.f..'], units: ['RP.p'], stats: { '0,0': powers('piercing') } })
    expect(moveKeys(blocked, idAt(blocked, 0, 0))).toEqual([])
    const free = testLevel({ terrain: ['.f..'], units: ['RP.p'], stats: { '0,0': powers('piercing', 'forester') } })
    expect(moveKeys(free, idAt(free, 0, 0))).toEqual(['2,0'])
  })

  function pieceMoves(state: ReturnType<typeof testLevel>) {
    return moveKeys(state, idAt(state, 0, 0))
  }
})
