import { describe, expect, it } from 'vitest'
import { applyAction } from '../apply'
import { legalActions, sameAction, type Action } from '../moves'
import { createRng } from '../rng'
import type { GameState } from '../state'
import { idAt, testLevel, where } from '../testing'
import { kingDistance } from '../geometry'
import { findPiece } from '../state'
import {
  chooseAction,
  rankActions,
  CORNERED_AGGRESSION,
  CORNERED_QUIET_PLIES,
  effectiveAggression,
  enemiesCornered,
} from './ai'

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

describe('ennemis acculés', () => {
  it('compte les actions sans combat et repart de zéro à chaque attaque', () => {
    let state = testLevel({ terrain: ['....', '....', '....'], units: ['...r', 'R...', '...K'], hero: { x: 3, y: 2 } })
    expect(state.quietPlies).toBe(0)
    state = applyAction(state, { kind: 'move', pieceId: idAt(state, 3, 2), to: { x: 2, y: 2 } }).state
    expect(state.quietPlies).toBe(1)
    state = applyAction(state, { kind: 'move', pieceId: idAt(state, 3, 0), to: { x: 3, y: 1 } }).state
    expect(state.quietPlies).toBe(2)
    // La Tour du joueur (0,1) attaque la Tour ennemie (3,1) le long de la rangée.
    state = applyAction(state, { kind: 'attack', pieceId: idAt(state, 0, 1), target: { x: 3, y: 1 } }).state
    expect(state.quietPlies).toBe(0)
  })

  it('acculés : 2 pièces ou moins, ou plusieurs tours sans combat', () => {
    const three = testLevel({ terrain: ['.....'], units: ['K.ppp'] })
    expect(enemiesCornered(three)).toBe(false)
    expect(enemiesCornered({ ...three, quietPlies: CORNERED_QUIET_PLIES })).toBe(true)
    const two = testLevel({ terrain: ['....'], units: ['K.pp'] })
    expect(enemiesCornered(two)).toBe(true)
  })

  it('l’agressivité n’est renforcée que pour des ennemis acculés', () => {
    const three = testLevel({ terrain: ['.....'], units: ['K.ppp'] })
    expect(effectiveAggression(three, 0.5)).toBe(0.5)
    expect(effectiveAggression({ ...three, quietPlies: CORNERED_QUIET_PLIES }, 0.5)).toBe(CORNERED_AGGRESSION)
    expect(effectiveAggression({ ...three, quietPlies: CORNERED_QUIET_PLIES }, 5)).toBe(5)
  })

  it('un ennemi isolé vient au contact au lieu de rester au loin', () => {
    // Dame ennemie seule en (5,0), héros en (0,5) : sans le renfort (agressivité 0),
    // tous les coups calmes se valent et elle resterait à distance.
    let state = testLevel({
      terrain: ['......', '......', '......', '......', '......', '......'],
      units: ['.....q', '', '', '', '', 'K.....'],
    })
    state = applyAction(state, { kind: 'move', pieceId: idAt(state, 0, 5), to: { x: 0, y: 4 } }).state
    const hero = findPiece(state, state.heroId)
    const queen = idAt(state, 5, 0)
    const before = kingDistance(findPiece(state, queen)!.pos, hero!.pos)
    const after = applyAction(state, chooseAction(state, { aggression: 0 })).state
    const queenAfter = findPiece(after, queen)
    expect(queenAfter && kingDistance(queenAfter.pos, findPiece(after, after.heroId)!.pos)).toBeLessThan(before)
  })

  it('capturer une pièce ennemie loin du héros reste intéressant', () => {
    // Deux ennemis (donc acculés) : la Tour du joueur ne peut prendre que le Pion isolé
    // en (5,0), loin du héros (0,5). Avec l'ancienne évaluation, elle s'en abstenait.
    const state = testLevel({
      terrain: ['......', '......', '......', '......', '......', '......'],
      units: ['....Rp', '', 'n.....', '', '', 'K.....'],
      hero: { x: 0, y: 5 },
    })
    expect(chooseAction(state)).toMatchObject({ kind: 'attack', target: { x: 5, y: 0 } })
  })
})

describe('IA en survie', () => {
  // L'ennemi peut prendre une Tour blessée (1 PV) ou toucher le héros d'1 PV.
  // En combat, il prend la Tour ; en survie, il frappe le héros.
  const position = (goal: 'eliminate' | 'survive') =>
    testLevel({
      terrain: ['.....', '.....', '.....', '.....', '.....'],
      units: ['p.r.R', '', 'p....', '', '..K..'],
      hero: { x: 2, y: 4 },
      goal: goal === 'survive' ? { kind: 'survive', rounds: 5 } : { kind: 'eliminate' },
      stats: { '2,0': { atk: 1 }, '4,0': { hp: 1 } },
      forward: { player: 'up', enemy: 'down' },
    })
  const enemyTurn = (state: GameState) => ({ ...state, sideToMove: 'enemy' as const })

  it('en combat, préfère le matériel', () => {
    expect(chooseAction(enemyTurn(position('eliminate')), { depth: 2, aggression: 0 })).toMatchObject({
      kind: 'attack',
      target: { x: 4, y: 0 },
    })
  })

  it('en survie, fonce sur le héros', () => {
    expect(chooseAction(enemyTurn(position('survive')), { depth: 2, aggression: 0 })).toMatchObject({
      kind: 'attack',
      target: { x: 2, y: 4 },
    })
  })
})

describe('IA : interception et horloge', () => {
  it('en interception, l’ennemi court vers la sortie', () => {
    const state = testLevel({
      terrain: ['.....', '.....', '.....', '.....', '.....'],
      units: ['..k..', '', '', '', 'K....'],
      hero: { x: 0, y: 4 },
      goal: { kind: 'intercept', exits: [{ x: 2, y: 4 }], rounds: 9 },
    })
    const ranked = rankActions({ ...state, sideToMove: 'enemy' }, { depth: 1 })
    const toward = ranked.filter((entry) => entry.action.kind === 'move' && entry.action.to.y === 1)
    const sideways = ranked.filter((entry) => entry.action.kind === 'move' && entry.action.to.y === 0)
    expect(toward.length).toBeGreaterThan(0)
    expect(Math.min(...toward.map((entry) => entry.score))).toBeGreaterThan(Math.max(...sideways.map((entry) => entry.score)))
  })

  it('l’ennemi ne compte pas une défaite au temps du joueur comme une victoire', () => {
    // Dernier tour : quoi que joue l'ennemi, le joueur perd au temps.
    const state = testLevel({
      terrain: ['.....', '.....', '.....'],
      units: ['r....', '.....', '....K'],
      hero: { x: 4, y: 2 },
      goal: { kind: 'eliminate', maxRounds: 1 },
    })
    const scores = rankActions({ ...state, sideToMove: 'enemy' }, { depth: 1 }).map((entry) => entry.score)
    // Seule la position compte (loin du score d'une victoire) : l'ennemi ne joue pas la montre.
    expect(Math.max(...scores)).toBeLessThan(1000)
  })
})

describe('IA : dernier ennemi', () => {
  it('blessé et seul, il frappe le héros au lieu de fuir (sa mort ne lui fait plus peur)', () => {
    // La Tour ennemie (1 PV) peut frapper le Roi en ligne ; elle sera prise ensuite.
    const state = testLevel({
      terrain: ['.....', '.....', '.....'],
      units: ['K...r', '.....', 'R....'],
      hero: { x: 0, y: 0 },
      goal: { kind: 'eliminate', maxRounds: 20 },
      stats: { '4,0': { hp: 1, maxHp: 3 } },
    })
    const enemyTurn = { ...state, sideToMove: 'enemy' as const }
    expect(chooseAction(enemyTurn, { depth: 3, aggression: 1, boldness: 0.3 })).toMatchObject({
      kind: 'attack',
      target: { x: 0, y: 0 },
    })
  })
})
