import { describe, expect, it } from 'vitest'
import { applyAction, createLevel, createRng, legalActions } from '../engine'
import { chooseAction } from '../engine/ai/ai'
import { DEMO_LEVELS, type LevelContent } from './levels'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'

/**
 * Partie IA contre IA : l'ennemi joue avec les réglages du niveau, le joueur est
 * simulé par une IA qui anticipe 4 demi-coups (un joueur humain attentif fait mieux).
 */
function selfPlay(level: LevelContent, seed: number, maxPlies = 120) {
  let state = createLevel(level.definition)
  const rng = createRng(seed)
  for (let ply = 0; ply < maxPlies && state.status === 'ongoing'; ply++) {
    const enemy = state.sideToMove === 'enemy'
    const action = chooseAction(state, {
      depth: enemy ? level.aiDepth : 4,
      aggression: enemy ? level.aiAggression : undefined,
      rng,
    })
    state = applyAction(state, action).state
  }
  return state
}

describe('niveaux de démonstration', () => {
  it('ont des identifiants uniques', () => {
    const ids = DEMO_LEVELS.map((level) => level.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : se crée sans erreur et le joueur peut jouer',
    (_id, level) => {
      const state = createLevel(level.definition)
      expect(state.status).toBe('ongoing')
      expect(legalActions(state).some((action) => action.kind !== 'pass')).toBe(true)
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : a un nom et une description en français et en anglais',
    (id) => {
      for (const locale of [fr, en] as const) {
        const texts = (locale.levels as Record<string, { name?: string; description?: string }>)[id]
        expect(texts?.name, `levels.${id}.name`).toBeTruthy()
        expect(texts?.description, `levels.${id}.description`).toBeTruthy()
      }
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : est gagnable (au moins une victoire du joueur simulé sur 10 graines)',
    (_id, level) => {
      let won = false
      for (let seed = 1; seed <= 10 && !won; seed++) won = selfPlay(level, seed).status === 'won'
      expect(won).toBe(true)
    },
    30_000,
  )
})
