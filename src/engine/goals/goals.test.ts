import { describe, expect, it } from 'vitest'
import { applyAction, IllegalActionError, type GameEvent } from '../apply'
import type { Action } from '../moves'
import type { GameState } from '../state'
import { idAt, testLevel } from '../testing'

const move = (pieceId: string, x: number, y: number): Action => ({ kind: 'move', pieceId, to: { x, y } })
const attack = (pieceId: string, x: number, y: number): Action => ({
  kind: 'attack',
  pieceId,
  target: { x, y },
})
const PASS: Action = { kind: 'pass' }

/** Joue une suite d'actions et renvoie l'état final et les événements de la dernière. */
function play(state: GameState, ...actions: Action[]): { state: GameState; events: readonly GameEvent[] } {
  let result: { state: GameState; events: readonly GameEvent[] } = { state, events: [] }
  for (const action of actions) result = applyAction(result.state, action)
  return result
}

describe('objectif : capturer toutes les pièces', () => {
  it('est gagné quand la dernière pièce ennemie tombe', () => {
    const state = testLevel({ terrain: ['....'], units: ['Q.p.'] })
    const { state: after, events } = play(state, attack(idAt(state, 0, 0), 2, 0))
    expect(after.status).toBe('won')
    expect(after.endReason).toBe('allEliminated')
    expect(events.at(-1)).toEqual({ type: 'end', status: 'won', reason: 'allEliminated' })
  })

  it('continue tant qu’il reste une pièce ennemie', () => {
    const state = testLevel({ terrain: ['....', '....'], units: ['Q.p.', '...k'] })
    expect(play(state, attack(idAt(state, 0, 0), 2, 0)).state.status).toBe('ongoing')
  })

  it('refuse toute action une fois la partie finie', () => {
    const state = testLevel({ terrain: ['....'], units: ['Q.p.'] })
    const { state: after } = play(state, attack(idAt(state, 0, 0), 2, 0))
    expect(() => applyAction(after, PASS)).toThrow(IllegalActionError)
  })
})

describe('défaite : mort du héros', () => {
  it('le niveau est perdu si le héros meurt', () => {
    // Héros : le pion (1,2), 1 PV. La Tour ennemie (1,0) peut le tuer.
    const state = testLevel({
      terrain: ['...', '...', '...'],
      units: ['.r.', '', 'KP.'],
      hero: { x: 1, y: 2 },
    })
    const { state: after, events } = play(
      state,
      move(idAt(state, 0, 2), 0, 1),
      attack(idAt(state, 1, 0), 1, 2),
    )
    expect(after.status).toBe('lost')
    expect(after.endReason).toBe('heroDied')
    expect(events.at(-1)).toEqual({ type: 'end', status: 'lost', reason: 'heroDied' })
  })

  it('perdre une autre pièce ne termine pas le niveau', () => {
    const state = testLevel({ terrain: ['...', '...', '...'], units: ['.r.', '', 'KP.'] })
    const after = play(state, move(idAt(state, 0, 2), 0, 1), attack(idAt(state, 1, 0), 1, 2)).state
    expect(after.status).toBe('ongoing')
  })
})

describe('objectif : survivre', () => {
  const survive = (rounds: number) =>
    testLevel({
      terrain: ['....', '....', '....', '....'],
      units: ['...k', '', '', 'K...'],
      goal: { kind: 'survive', rounds },
    })

  it('est gagné quand l’ennemi a joué le nombre de tours demandé', () => {
    const state = survive(2)
    const king = idAt(state, 0, 3)
    const enemy = idAt(state, 3, 0)
    let after = play(state, move(king, 1, 3), move(enemy, 3, 1)).state
    expect(after.status).toBe('ongoing')
    after = play(after, move(king, 0, 3)).state
    expect(after.status).toBe('ongoing')
    after = play(after, move(enemy, 3, 0)).state
    expect(after.status).toBe('won')
    expect(after.endReason).toBe('survived')
  })

  it('est gagné aussi si toutes les pièces ennemies sont éliminées', () => {
    const state = testLevel({ terrain: ['....'], units: ['Q.p.'], goal: { kind: 'survive', rounds: 5 } })
    const after = play(state, attack(idAt(state, 0, 0), 2, 0)).state
    expect(after.endReason).toBe('allEliminated')
  })
})

describe('objectif : capturer une cible', () => {
  it('est gagné dès que la cible tombe, même s’il reste des ennemis', () => {
    const state = testLevel({
      terrain: ['....', '....'],
      units: ['Q.p.', '...k'],
      goal: { kind: 'capture', target: { x: 2, y: 0 } },
    })
    const after = play(state, attack(idAt(state, 0, 0), 2, 0)).state
    expect(after.status).toBe('won')
    expect(after.endReason).toBe('targetCaptured')
  })

  it('est perdu si la limite de tours est dépassée', () => {
    const state = testLevel({
      terrain: ['....', '....', '....', '....'],
      units: ['...k', '', '', 'K...'],
      goal: { kind: 'capture', target: { x: 3, y: 0 }, maxRounds: 1 },
    })
    const after = play(state, move(idAt(state, 0, 3), 1, 3), move(idAt(state, 3, 0), 3, 1)).state
    expect(after.status).toBe('lost')
    expect(after.endReason).toBe('timeUp')
  })
})

describe('blocage', () => {
  // Chaque camp est enfermé par l'eau : aucun ne peut agir.
  const boxed = { terrain: ['.~.'], units: ['K.k'] } as const

  it('un camp sans action passe son tour', () => {
    const state = testLevel(boxed)
    const { state: after, events } = play(state, PASS)
    expect(events).toEqual([{ type: 'pass', side: 'player' }])
    expect(after.sideToMove).toBe('enemy')
    expect(after.consecutivePasses).toBe(1)
  })

  it('deux passes d’affilée font perdre le niveau', () => {
    const after = play(testLevel(boxed), PASS, PASS).state
    expect(after.status).toBe('lost')
    expect(after.endReason).toBe('stalemate')
  })

  it('en survie, les passes font seulement avancer les tours', () => {
    const state = testLevel({ ...boxed, goal: { kind: 'survive', rounds: 2 } })
    let after = play(state, PASS, PASS).state
    expect(after.status).toBe('ongoing')
    after = play(after, PASS, PASS).state
    expect(after.endReason).toBe('survived')
  })

  it('une action normale remet le compteur de passes à zéro', () => {
    const state = testLevel({ terrain: ['.~..'], units: ['K.k.'] })
    const after = play(state, PASS, move(idAt(state, 2, 0), 3, 0)).state
    expect(after.consecutivePasses).toBe(0)
    expect(after.status).toBe('ongoing')
  })
})

describe('objectif : interception', () => {
  const exits = [{ x: 0, y: 2 }]
  const level = () =>
    testLevel({
      terrain: ['....', '....', '....'],
      units: ['n..K', '', '....'],
      hero: { x: 3, y: 0 },
      goal: { kind: 'intercept', exits, rounds: 2 },
    })

  it('est perdu dès qu’un ennemi atteint une sortie', () => {
    const state = level()
    // Le Cavalier (0,0) saute en (1,2) puis… on le laisse plutôt aller directement : (0,0) → (1,2) n'est pas la sortie.
    const after = play(state, move(idAt(state, 3, 0), 3, 1), move(idAt(state, 0, 0), 1, 2)).state
    expect(after.status).toBe('ongoing')
    const exitState = testLevel({
      terrain: ['....', '....', '....'],
      units: ['...K', '..n.', '....'],
      hero: { x: 3, y: 0 },
      goal: { kind: 'intercept', exits, rounds: 2 },
    })
    const lost = play(exitState, move(idAt(exitState, 3, 0), 3, 1), move(idAt(exitState, 2, 1), 0, 2)).state
    expect(lost).toMatchObject({ status: 'lost', endReason: 'escaped' })
  })

  it('est gagné après le nombre de tours demandé sans fuite', () => {
    const state = level()
    const hero = idAt(state, 3, 0)
    const knight = idAt(state, 0, 0)
    const after = play(state, move(hero, 3, 1), move(knight, 2, 1), move(hero, 3, 0), move(knight, 0, 0)).state
    expect(after).toMatchObject({ status: 'won', endReason: 'survived' })
  })

  it('refuse une sortie impossible ou absente', () => {
    const base = { terrain: ['....'], units: ['n..K'], hero: { x: 3, y: 0 } }
    expect(() => testLevel({ ...base, goal: { kind: 'intercept', exits: [], rounds: 2 } })).toThrow(/sans sortie/)
    expect(() => testLevel({ ...base, goal: { kind: 'intercept', exits: [{ x: 9, y: 9 }], rounds: 2 } })).toThrow(
      /case impossible/,
    )
  })
})
