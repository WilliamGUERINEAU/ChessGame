import type { GameState } from '../engine'
import type { Placement } from './deploy'
import type { RunState } from './run'

/** Run sauvegardé sur l'appareil, pour reprendre après un rechargement ou une fermeture. */
export interface SavedRun {
  readonly version: 1
  readonly run: RunState
  readonly placement: Placement
  /** Combat en cours (absent hors combat). */
  readonly battle: { readonly state: GameState; readonly plies: number } | null
}

/** Accès minimal au stockage, remplaçable dans les tests. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'gambit-rogue.run.v1'

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Vérification de forme : un run illisible ou d'une autre version est ignoré. */
function isSavedRun(value: unknown, levelCount: number): value is SavedRun {
  if (!isObject(value) || value.version !== 1 || !isObject(value.run) || !isObject(value.placement)) return false
  const run = value.run
  if (!Array.isArray(run.army) || typeof run.heroId !== 'string' || typeof run.phase !== 'string') return false
  if (typeof run.levelIndex !== 'number' || run.levelIndex < 0 || run.levelIndex >= levelCount) return false
  if (run.levelCount !== levelCount) return false
  if (run.phase === 'won' || run.phase === 'lost') return false
  if (value.battle !== null) {
    const battle = value.battle
    if (!isObject(battle) || typeof battle.plies !== 'number' || !isObject(battle.state)) return false
    const state = battle.state
    if (!isObject(state.board) || !Array.isArray(state.pieces) || typeof state.status !== 'string') return false
    if (!Array.isArray(state.reinforcements)) return false
  }
  return true
}

/** Run en cours sauvegardé, ou `null` (rien, illisible, ou plus compatible avec les niveaux). */
export function loadRun(levelCount: number, store = defaultStore()): SavedRun | null {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (isSavedRun(value, levelCount)) return value
    store?.removeItem(KEY)
    return null
  } catch {
    return null
  }
}

export function saveRun(saved: SavedRun, store = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Stockage plein ou interdit : le jeu continue sans sauvegarde.
  }
}

export function clearRun(store = defaultStore()): void {
  try {
    store?.removeItem(KEY)
  } catch {
    // Rien à faire.
  }
}
