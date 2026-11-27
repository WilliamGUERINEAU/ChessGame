import { describe, expect, it } from 'vitest'
import { applyAction } from '../../engine'
import { idAt, testLevel } from '../../engine/testing'
import { effectsFor } from './effects'

describe('effets d’une action', () => {
  it('une capture laisse un fantôme, des dégâts flottants et le son de capture', () => {
    const state = testLevel({ terrain: ['....', '....'], units: ['R.p.', '...k'] })
    const { state: after, events } = applyAction(state, { kind: 'attack', pieceId: idAt(state, 0, 0), target: { x: 2, y: 0 } })
    const effects = effectsFor(state, after, events)
    expect(effects.ghosts.map((ghost) => ghost.piece.pos)).toEqual([{ x: 2, y: 0 }])
    expect(effects.floats).toEqual([{ pos: { x: 2, y: 0 }, text: '−2', kind: 'damage' }])
    expect(effects.sound).toBe('capture')
  })

  it('un simple déplacement : son discret, aucun effet visuel ; la fin de partie prime', () => {
    const state = testLevel({ terrain: ['....', '....'], units: ['R...', '...k'] })
    const move = applyAction(state, { kind: 'move', pieceId: idAt(state, 0, 0), to: { x: 0, y: 1 } })
    expect(effectsFor(state, move.state, move.events)).toEqual({ ghosts: [], floats: [], sound: 'move', fatal: null })

    const last = testLevel({ terrain: ['....'], units: ['R.p.'] })
    const win = applyAction(last, { kind: 'attack', pieceId: idAt(last, 0, 0), target: { x: 2, y: 0 } })
    expect(effectsFor(last, win.state, win.events).sound).toBe('win')
  })

  it('soin et bouclier ont leur propre nombre', () => {
    const state = testLevel({
      terrain: ['.....'],
      units: ['R..r.'],
      stats: { '0,0': { powers: ['lifesteal'], hp: 1, maxHp: 3 }, '3,0': { hp: 5 } },
    })
    const { state: after, events } = applyAction(state, { kind: 'attack', pieceId: idAt(state, 0, 0), target: { x: 3, y: 0 } })
    expect(effectsFor(state, after, events).floats).toContainEqual({ pos: { x: 2, y: 0 }, text: '+2', kind: 'heal' })

    const shielded = testLevel({ terrain: ['....'], units: ['R..r'], stats: { '3,0': { powers: ['shield'] } } })
    const block = applyAction(shielded, { kind: 'attack', pieceId: idAt(shielded, 0, 0), target: { x: 3, y: 0 } })
    expect(effectsFor(shielded, block.state, block.events).floats).toEqual([{ pos: { x: 3, y: 0 }, text: '0', kind: 'block' }])
  })
})

describe('coup fatal', () => {
  it('nomme la pièce qui a abattu le héros', () => {
    const state = testLevel({ terrain: ['....'], units: ['K..q'], stats: { '0,0': { hp: 1 } } })
    const enemyTurn = { ...state, sideToMove: 'enemy' as const }
    const { state: after, events } = applyAction(enemyTurn, { kind: 'attack', pieceId: idAt(state, 3, 0), target: { x: 0, y: 0 } })
    expect(after.endReason).toBe('heroDied')
    expect(effectsFor(enemyTurn, after, events).fatal).toEqual({ type: 'queen', side: 'enemy' })
  })
})
