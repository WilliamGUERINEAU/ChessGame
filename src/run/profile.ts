import type { PowerId } from '../engine'
import type { ClassId } from './classes'
import type { KeyValueStore } from './save'

/**
 * Progression entre les runs, sur l'appareil. Elle débloque de la variété (classes,
 * pouvoirs proposés), jamais de puissance brute.
 */
export interface Profile {
  readonly version: 1
  /** Combats gagnés, tous runs confondus. */
  readonly combatsWon: number
  /** Plus haut niveau atteint dans un run (1 = premier niveau). */
  readonly bestLevel: number
  readonly runsWon: number
}

export const EMPTY_PROFILE: Profile = { version: 1, combatsWon: 0, bestLevel: 1, runsWon: 0 }

export type Unlock =
  | { readonly id: 'powers-brutal'; readonly kind: 'powers'; readonly powers: readonly PowerId[] }
  | { readonly id: 'class-scout'; readonly kind: 'class'; readonly classId: ClassId }

interface UnlockRule {
  readonly unlock: Unlock
  readonly isMet: (profile: Profile) => boolean
}

/** Déblocages, du plus tôt au plus tard. Les conditions sont expliquées dans l'interface. */
export const UNLOCK_RULES: readonly UnlockRule[] = [
  {
    unlock: { id: 'powers-brutal', kind: 'powers', powers: ['knockback', 'lifesteal'] },
    isMet: (profile) => profile.combatsWon >= 3,
  },
  {
    unlock: { id: 'class-scout', kind: 'class', classId: 'scout' },
    isMet: (profile) => profile.bestLevel >= 4,
  },
]

export function unlocked(profile: Profile): Unlock[] {
  return UNLOCK_RULES.filter((rule) => rule.isMet(profile)).map((rule) => rule.unlock)
}

/** Déblocages obtenus entre deux états du profil (pour les annoncer). */
export function newlyUnlocked(before: Profile, after: Profile): Unlock[] {
  const had = new Set(unlocked(before).map((unlock) => unlock.id))
  return unlocked(after).filter((unlock) => !had.has(unlock.id))
}

/** Pouvoirs pas encore proposés en récompense. */
export function lockedPowers(profile: Profile): PowerId[] {
  return UNLOCK_RULES.filter((rule) => rule.unlock.kind === 'powers' && !rule.isMet(profile)).flatMap((rule) =>
    rule.unlock.kind === 'powers' ? rule.unlock.powers : [],
  )
}

export function isClassUnlocked(profile: Profile, classId: ClassId): boolean {
  const rule = UNLOCK_RULES.find((candidate) => candidate.unlock.kind === 'class' && candidate.unlock.classId === classId)
  return !rule || rule.isMet(profile)
}

/** Un combat gagné : `levelNumber` est le numéro du niveau gagné (le suivant est atteint). */
export function recordCombatWon(profile: Profile, levelNumber: number, runWon: boolean): Profile {
  return {
    ...profile,
    combatsWon: profile.combatsWon + 1,
    bestLevel: Math.max(profile.bestLevel, runWon ? levelNumber : levelNumber + 1),
    runsWon: profile.runsWon + (runWon ? 1 : 0),
  }
}

const KEY = 'gambit-rogue.profile.v1'

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

export function loadProfile(store = defaultStore()): Profile {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return EMPTY_PROFILE
    const value = JSON.parse(raw) as Partial<Profile>
    if (value.version !== 1 || !isCount(value.combatsWon) || !isCount(value.bestLevel) || !isCount(value.runsWon)) {
      return EMPTY_PROFILE
    }
    return { version: 1, combatsWon: value.combatsWon, bestLevel: Math.max(1, value.bestLevel), runsWon: value.runsWon }
  } catch {
    return EMPTY_PROFILE
  }
}

export function saveProfile(profile: Profile, store = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(profile))
  } catch {
    // Progression non mémorisée : le jeu continue.
  }
}
