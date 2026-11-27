import { describe, expect, it } from 'vitest'
import { createRng } from '../engine'
import {
  EMPTY_PROFILE,
  isClassUnlocked,
  loadProfile,
  lockedPowers,
  newlyUnlocked,
  recordCombatWon,
  saveProfile,
} from './profile'
import { drawRewards, startRun } from './run'
import type { KeyValueStore } from './save'

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('progression entre les runs', () => {
  it('au départ, l’Éclaireuse et deux pouvoirs sont verrouillés', () => {
    expect(isClassUnlocked(EMPTY_PROFILE, 'scout')).toBe(false)
    expect(isClassUnlocked(EMPTY_PROFILE, 'sovereign')).toBe(true)
    expect(lockedPowers(EMPTY_PROFILE)).toEqual(['knockback', 'lifesteal'])
  })

  it('trois combats gagnés débloquent les pouvoirs, atteindre le niveau 4 débloque l’Éclaireuse', () => {
    let profile = EMPTY_PROFILE
    profile = recordCombatWon(profile, 1, false)
    profile = recordCombatWon(profile, 2, false)
    expect(newlyUnlocked(EMPTY_PROFILE, profile)).toEqual([])
    const before = profile
    profile = recordCombatWon(profile, 3, false)
    expect(profile.bestLevel).toBe(4)
    expect(newlyUnlocked(before, profile).map((unlock) => unlock.id)).toEqual(['powers-brutal', 'class-scout'])
    expect(lockedPowers(profile)).toEqual([])
  })

  it('un pouvoir verrouillé n’est jamais proposé en récompense', () => {
    const run = startRun('sovereign', 1, 6, lockedPowers(EMPTY_PROFILE))
    for (let seed = 1; seed <= 40; seed++) {
      for (const option of drawRewards(run.army, createRng(seed), run.lockedPowers)) {
        if (option.kind === 'power') expect(['knockback', 'lifesteal']).not.toContain(option.power)
      }
    }
  })

  it('se sauvegarde, et repart de zéro si les données sont illisibles', () => {
    const store = memoryStore()
    const profile = recordCombatWon(EMPTY_PROFILE, 6, true)
    saveProfile(profile, store)
    expect(loadProfile(store)).toEqual(profile)
    store.setItem('gambit-rogue.profile.v1', '{"version":1,"combatsWon":-3}')
    expect(loadProfile(store)).toEqual(EMPTY_PROFILE)
  })
})
