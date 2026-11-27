import { describe, expect, it } from 'vitest'
import { createLevel } from '../engine'
import { DEMO_LEVELS } from '../content/levels'
import { autoDeploy, battleDefinition, playerForward } from './deploy'
import { beginBattle, startRun } from './run'
import { clearRun, loadRun, saveRun, type KeyValueStore, type SavedRun } from './save'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const COUNT = DEMO_LEVELS.length

function savedBattle(): SavedRun {
  const run = beginBattle(startRun('sovereign', 42, COUNT))
  const level = DEMO_LEVELS[0]
  const placement = autoDeploy(run.army, run.heroId, level.deployment, playerForward(level))
  const state = createLevel(battleDefinition(level, run, placement))
  return { version: 1, run, placement, battle: { state, plies: 3 } }
}

describe('sauvegarde du run', () => {
  it('relit à l’identique un run en plein combat', () => {
    const store = memoryStore()
    const saved = savedBattle()
    saveRun(saved, store)
    expect(loadRun(COUNT, store)).toEqual(saved)
  })

  it('ignore et efface une sauvegarde illisible ou incompatible', () => {
    const store = memoryStore()
    store.setItem('gambit-rogue.run.v1', '{pas du json')
    expect(loadRun(COUNT, store)).toBeNull()

    saveRun(savedBattle(), store)
    // Le nombre de niveaux a changé depuis la sauvegarde : on ne reprend pas.
    expect(loadRun(COUNT + 1, store)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('ne propose pas de reprendre un run terminé, et l’effacement vide la sauvegarde', () => {
    const store = memoryStore()
    const saved = savedBattle()
    saveRun({ ...saved, run: { ...saved.run, phase: 'lost' } }, store)
    expect(loadRun(COUNT, store)).toBeNull()
    saveRun(saved, store)
    clearRun(store)
    expect(loadRun(COUNT, store)).toBeNull()
  })

  it('reste silencieuse si le stockage est indisponible', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('interdit')
      },
      setItem: () => {
        throw new Error('plein')
      },
      removeItem: () => {
        throw new Error('interdit')
      },
    }
    expect(() => saveRun(savedBattle(), broken)).not.toThrow()
    expect(loadRun(COUNT, broken)).toBeNull()
    expect(() => clearRun(broken)).not.toThrow()
  })
})
