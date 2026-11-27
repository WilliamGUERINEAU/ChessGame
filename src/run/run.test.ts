import { describe, expect, it } from 'vitest'
import { applyAction, createLevel, createRng, findPiece, posKey, type GameState } from '../engine'
import { chooseAction } from '../engine/ai/ai'
import { DEMO_LEVELS } from '../content/levels'
import { CLASS_IDS, CLASSES } from './classes'
import { autoDeploy, battleDefinition, movePlacement, playerForward } from './deploy'
import {
  applyReward,
  beginBattle,
  drawRewards,
  eligibleTargets,
  finishBattle,
  MAX_ARMY,
  startRun,
  type ArmyPiece,
  type RunState,
} from './run'

const LEVELS = DEMO_LEVELS
const firstLevel = LEVELS[0]

function deployedBattle(run: RunState, levelIndex = run.levelIndex): GameState {
  const level = LEVELS[levelIndex]
  const placement = autoDeploy(run.army, run.heroId, level.deployment, playerForward(level))
  return createLevel(battleDefinition(level, run, placement))
}

/** Termine le combat en retirant les pièces indiquées puis en déclarant l'issue. */
function endedBattle(state: GameState, status: 'won' | 'lost', removed: readonly string[] = []): GameState {
  return {
    ...state,
    pieces: state.pieces.filter((piece) => !removed.includes(piece.id)),
    status,
    endReason: status === 'won' ? 'allEliminated' : 'heroDied',
  }
}

describe('startRun et classes', () => {
  it('Souverain : Roi héros avec Riposte, et une Tour (2 pièces)', () => {
    const run = startRun('sovereign', 1, LEVELS.length)
    expect(run.army.map((piece) => piece.type)).toEqual(['king', 'rook'])
    expect(run.army[0]).toEqual({ id: 'a1', type: 'king', powers: ['riposte'] })
    expect(run.heroId).toBe('a1')
    expect(run.phase).toBe('deploy')
  })

  it('Chevalière : Cavalier héros à 4 PV et 2 ATK, avec Bouclier', () => {
    const run = startRun('knightess', 1, LEVELS.length)
    const state = deployedBattle(beginBattle(run))
    expect(findPiece(state, 'a1')).toMatchObject({ type: 'knight', hp: 4, maxHp: 4, atk: 2, shieldActive: true })
    expect(run.army.map((piece) => piece.type)).toEqual(['knight', 'bishop'])
    expect(run.army).toHaveLength(1 + CLASSES.knightess.army.length)
  })
})

/** Armée plus fournie que celle de départ, pour tester le placement des Pions. */
const BIG_ARMY: ArmyPiece[] = [
  { id: 'a1', type: 'king', powers: ['riposte'] },
  { id: 'a2', type: 'rook', powers: [] },
  { id: 'a3', type: 'pawn', powers: [] },
  { id: 'a4', type: 'pawn', powers: [] },
]

describe('déploiement', () => {
  const run: RunState = { ...startRun('sovereign', 1, LEVELS.length), army: BIG_ARMY }
  const zone = firstLevel.deployment
  const placement = autoDeploy(run.army, run.heroId, zone, playerForward(firstLevel))

  it('place toute l’armée dans la zone, sur des cases distinctes', () => {
    const cells = Object.values(placement).map(posKey)
    expect(Object.keys(placement).sort()).toEqual(run.army.map((piece) => piece.id).sort())
    expect(new Set(cells).size).toBe(cells.length)
    for (const cell of Object.values(placement)) expect(zone.map(posKey)).toContain(posKey(cell))
  })

  it('le héros au centre de la rangée arrière, les Pions devant', () => {
    expect(placement.a1).toEqual({ x: 4, y: 9 })
    for (const pawn of run.army.filter((piece) => piece.type === 'pawn')) expect(placement[pawn.id].y).toBe(8)
  })

  it('est déterministe', () => {
    expect(autoDeploy(run.army, run.heroId, zone, playerForward(firstLevel))).toEqual(placement)
  })

  it('déplacer une pièce sur une case libre, ou échanger avec une pièce', () => {
    const free = zone.find((cell) => !Object.values(placement).some((p) => posKey(p) === posKey(cell)))!
    const moved = movePlacement(placement, 'a1', free, zone)
    expect(moved.a1).toEqual(free)
    const pawnCell = placement.a4
    const swapped = movePlacement(placement, 'a1', pawnCell, zone)
    expect(swapped.a1).toEqual(pawnCell)
    expect(swapped.a4).toEqual(placement.a1)
    expect(movePlacement(placement, 'a1', { x: 3, y: 0 }, zone)).toBe(placement)
  })

  it('refuse une armée plus grande que la zone', () => {
    const tooMany: ArmyPiece[] = Array.from({ length: 3 }, (_, i) => ({ id: `a${i + 1}`, type: 'pawn', powers: [] }))
    expect(() => autoDeploy(tooMany, 'a1', zone.slice(0, 2), { x: 0, y: -1 })).toThrow('trop petite')
  })

  it('le combat reprend les ennemis du niveau et l’armée placée, sans l’armée d’entraînement', () => {
    const state = createLevel(battleDefinition(firstLevel, run, placement))
    const enemies = firstLevel.definition.units.filter((unit) => unit.side === 'enemy')
    expect(state.pieces.filter((piece) => piece.side === 'enemy')).toHaveLength(enemies.length)
    expect(state.pieces.filter((piece) => piece.side === 'player').map((piece) => piece.id).sort()).toEqual(
      run.army.map((piece) => piece.id).sort(),
    )
    expect(state.heroId).toBe('a1')
    expect(findPiece(state, 'a1')?.powers).toEqual(['riposte'])
  })
})

describe('fin de combat', () => {
  it('une défaite termine le run', () => {
    const run = beginBattle(startRun('sovereign', 1, LEVELS.length))
    const after = finishBattle(run, endedBattle(deployedBattle(run), 'lost'))
    expect(after.phase).toBe('lost')
    expect(after.endReason).toBe('heroDied')
  })

  it('une victoire : les pièces mortes quittent l’armée, puis 3 récompenses', () => {
    const run = beginBattle({ ...startRun('sovereign', 1, LEVELS.length), army: BIG_ARMY })
    const after = finishBattle(run, endedBattle(deployedBattle(run), 'won', ['a3']))
    expect(after.phase).toBe('reward')
    expect(after.army.map((piece) => piece.id)).toEqual(['a1', 'a2', 'a4'])
    expect(after.levelsCleared).toBe(1)
    expect(after.rewardOptions).toHaveLength(3)
  })

  it('une promotion obtenue en combat est conservée', () => {
    const run = beginBattle({
      ...startRun('sovereign', 1, LEVELS.length),
      army: [
        { id: 'a1', type: 'king', powers: [] },
        { id: 'a2', type: 'pawn', powers: ['promotion', 'vigor'] },
      ],
    })
    const state = deployedBattle(run)
    const promoted: GameState = {
      ...state,
      pieces: state.pieces.map((piece) => (piece.id === 'a2' ? { ...piece, type: 'queen', powers: ['vigor'] } : piece)),
      status: 'won',
      endReason: 'allEliminated',
    }
    expect(finishBattle(run, promoted).army[1]).toEqual({ id: 'a2', type: 'queen', powers: ['vigor'] })
  })

  it('le dernier niveau gagné termine le run par une victoire', () => {
    const run = beginBattle({ ...startRun('knightess', 1, LEVELS.length), levelIndex: LEVELS.length - 1 })
    const after = finishBattle(run, endedBattle(deployedBattle(run), 'won'))
    expect(after.phase).toBe('won')
    expect(after.rewardOptions).toEqual([])
  })
})

describe('récompenses', () => {
  const army = startRun('sovereign', 1, LEVELS.length).army

  it('3 choix distincts, avec au moins une pièce et au moins un pouvoir', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const options = drawRewards(army, createRng(seed))
      expect(options).toHaveLength(3)
      expect(new Set(options.map((o) => JSON.stringify(o))).size).toBe(3)
      expect(options.some((o) => o.kind === 'piece')).toBe(true)
      expect(options.some((o) => o.kind === 'power')).toBe(true)
      expect(options.some((o) => o.kind === 'piece' && o.type === 'king')).toBe(false)
    }
  })

  it('ne propose que des pouvoirs utilisables par au moins une pièce', () => {
    const rooksOnly: ArmyPiece[] = [{ id: 'a1', type: 'rook', powers: ['shield', 'riposte'] }]
    for (let seed = 1; seed <= 50; seed++) {
      for (const option of drawRewards(rooksOnly, createRng(seed))) {
        if (option.kind === 'power') {
          expect(['promotion', 'reach', 'shield', 'riposte']).not.toContain(option.power)
          expect(eligibleTargets(rooksOnly, option.power).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('plus de nouvelle pièce quand l’armée est complète', () => {
    const full: ArmyPiece[] = Array.from({ length: MAX_ARMY }, (_, i) => ({ id: `a${i + 1}`, type: 'knight', powers: [] }))
    for (let seed = 1; seed <= 20; seed++) {
      const options = drawRewards(full, createRng(seed))
      expect(options.every((o) => o.kind === 'power')).toBe(true)
      expect(options).toHaveLength(3)
    }
  })

  it('le tirage est reproductible pour une même graine', () => {
    expect(drawRewards(army, createRng(9))).toEqual(drawRewards(army, createRng(9)))
  })

  it('une nouvelle pièce rejoint l’armée avec un nouvel identifiant', () => {
    const run: RunState = { ...startRun('sovereign', 1, LEVELS.length), phase: 'reward', rewardOptions: [{ kind: 'piece', type: 'bishop' }] }
    const after = applyReward(run, { kind: 'piece', type: 'bishop' })
    expect(after.army.at(-1)).toEqual({ id: 'a3', type: 'bishop', powers: [] })
    expect(after.phase).toBe('deploy')
    expect(after.levelIndex).toBe(1)
  })

  it('un pouvoir va sur la pièce choisie, si elle peut le recevoir', () => {
    const run: RunState = {
      ...startRun('sovereign', 1, LEVELS.length),
      army: BIG_ARMY,
      phase: 'reward',
      rewardOptions: [{ kind: 'power', power: 'promotion' }],
    }
    expect(applyReward(run, { kind: 'power', power: 'promotion' }, 'a4').army[3].powers).toEqual(['promotion'])
    expect(() => applyReward(run, { kind: 'power', power: 'promotion' }, 'a2')).toThrow()
    expect(() => applyReward(run, { kind: 'piece', type: 'queen' })).toThrow('non proposée')
  })
})

describe('runs complets simulés', () => {
  /** Joue un run entier : IA pour les deux camps, première récompense et première cible. */
  function simulate(classId: (typeof CLASS_IDS)[number], seed: number): RunState {
    let run = startRun(classId, seed, LEVELS.length)
    const rng = createRng(seed)
    while (run.phase === 'deploy') {
      const level = LEVELS[run.levelIndex]
      run = beginBattle(run)
      let state = createLevel(battleDefinition(level, run, autoDeploy(run.army, run.heroId, level.deployment, playerForward(level))))
      for (let ply = 0; ply < 200 && state.status === 'ongoing'; ply++) {
        const enemy = state.sideToMove === 'enemy'
        const action = chooseAction(state, { depth: enemy ? level.aiDepth : 3, aggression: enemy ? level.aiAggression : undefined, rng })
        state = applyAction(state, action).state
      }
      if (state.status === 'ongoing') return run
      run = finishBattle(run, state)
      if (run.phase === 'reward') {
        const option = run.rewardOptions[0]
        const target = option.kind === 'power' ? eligibleTargets(run.army, option.power)[0]?.id : undefined
        run = applyReward(run, option, target)
      }
    }
    return run
  }

  it.each(CLASS_IDS.flatMap((classId) => [1, 2].map((seed) => [classId, seed] as const)))(
    '%s, graine %d : le run se déroule jusqu’au bout sans erreur',
    (classId, seed) => {
      const end = simulate(classId, seed)
      expect(['won', 'lost', 'battle']).toContain(end.phase)
      expect(end.levelsCleared).toBeGreaterThanOrEqual(0)
    },
    60_000,
  )
})
