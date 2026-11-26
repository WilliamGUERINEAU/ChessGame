import { describe, expect, it } from 'vitest'
import { applyAction } from '../apply'
import { legalActions, sameAction, type Action } from '../moves'
import { createRng } from '../rng'
import type { GameState } from '../state'
import { idAt, testLevel, where } from '../testing'
import { chooseAction } from './ai'

/** Fait jouer le joueur puis renvoie l'état où c'est à l'ennemi de choisir. */
function enemyToMove(state: GameState, playerAction: Action): GameState {
  return applyAction(state, playerAction).state
}

describe('chooseAction', () => {
  it('renvoie toujours une action légale', () => {
    const state = testLevel({
      terrain: ['.....', '..f..', '.~...', '.....'],
      units: ['.r.n.', '..p..', '', 'K.R..'],
    })
    const action = chooseAction(state)
    expect(legalActions(state).some((candidate) => sameAction(candidate, action))).toBe(true)
  })

  it('tue le héros quand il le peut', () => {
    // Héros : Roi à 1 PV. La Tour ennemie peut l'atteindre, ou prendre un pion.
    let state = testLevel({
      terrain: ['....', '....', '....', '....'],
      units: ['r...', '...p', '', 'K..P'],
      stats: { '0,3': { hp: 1, maxHp: 4 } },
    })
    state = enemyToMove(state, { kind: 'move', pieceId: idAt(state, 3, 3), to: { x: 3, y: 2 } })
    expect(chooseAction(state)).toEqual({ kind: 'attack', pieceId: idAt(state, 0, 0), target: { x: 0, y: 3 } })
  })

  it('prend une pièce qui n’est pas défendue', () => {
    let state = testLevel({
      terrain: ['.....', '.....', '.....', '.....', '.....'],
      units: ['r....', '', '', '....K', 'N....'],
    })
    // Le joueur déplace son Roi ; le Cavalier (0,4) reste à portée de la Tour sans défense.
    state = enemyToMove(state, { kind: 'move', pieceId: idAt(state, 4, 3), to: { x: 4, y: 2 } })
    const action = chooseAction(state)
    expect(action).toMatchObject({ kind: 'attack', target: { x: 0, y: 4 } })
  })

  it('ne prend pas un pion défendu au prix de sa Dame', () => {
    // La Dame (2,0) peut prendre le pion (2,3), mais la Tour du joueur (0,3), 3 ATK,
    // la tuerait aussitôt sur cette case. Une IA qui ne regarde qu'un coup tombe dans le piège.
    let state = testLevel({
      terrain: ['.....', '.....', '.....', '.....', '.....'],
      units: ['..q..', '', '', 'R.P..', '....K'],
      hero: { x: 4, y: 4 },
      stats: { '0,3': { atk: 3 } },
    })
    state = enemyToMove(state, { kind: 'move', pieceId: idAt(state, 4, 4), to: { x: 4, y: 3 } })
    const queen = idAt(state, 2, 0)
    const action = chooseAction(state)
    expect(action).not.toMatchObject({ kind: 'attack', target: { x: 2, y: 3 } })
    const after = applyAction(state, action).state
    const queenCanBeKilled = legalActions(after).some((reply) =>
      applyAction(after, reply).events.some((event) => event.type === 'capture' && event.pieceId === queen),
    )
    expect(queenCanBeKilled).toBe(false)
  })

  it('passe quand son camp est bloqué', () => {
    const state = testLevel({ terrain: ['.~.'], units: ['K.k'] })
    const blocked = applyAction(state, { kind: 'pass' }).state
    expect(chooseAction(blocked)).toEqual({ kind: 'pass' })
  })

  it('est déterministe pour une même graine', () => {
    const state = testLevel({
      terrain: ['......', '......', '......', '......'],
      units: ['.n..b.', '', '', '..K...'],
    })
    const enemyTurn = enemyToMove(state, { kind: 'move', pieceId: idAt(state, 2, 3), to: { x: 2, y: 2 } })
    const a = chooseAction(enemyTurn, { rng: createRng(5) })
    const b = chooseAction(enemyTurn, { rng: createRng(5) })
    expect(a).toEqual(b)
  })

  it('sait aussi jouer pour le joueur (parties IA contre IA)', () => {
    // La Tour du joueur peut prendre le dernier ennemi : victoire immédiate.
    const state = testLevel({ terrain: ['....', '....', '....'], units: ['R..p', '', '...K'] })
    const action = chooseAction(state)
    expect(action).toMatchObject({ kind: 'attack', target: { x: 3, y: 0 } })
    const after = applyAction(state, action).state
    expect(after.status).toBe('won')
    expect(where(after, idAt(state, 0, 0))).toBe('3,0')
  })
})
