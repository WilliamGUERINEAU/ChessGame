/**
 * Calcule le coup de l'IA hors du fil principal, pour que l'interface reste fluide.
 */
import type { Action } from '../moves'
import { createRng } from '../rng'
import type { GameState } from '../state'
import { chooseAction } from './ai'

export interface AiRequest {
  readonly id: number
  readonly state: GameState
  readonly depth: number
  readonly aggression: number
  readonly seed: number
}

export type AiResponse =
  | { readonly id: number; readonly action: Action }
  | { readonly id: number; readonly error: string }

/** Le strict nécessaire du contexte d'un worker (évite le conflit entre les types DOM et WebWorker). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<AiRequest>) => void) | null
  postMessage(message: AiResponse): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  const { id, state, depth, aggression, seed } = event.data
  try {
    scope.postMessage({ id, action: chooseAction(state, { depth, aggression, rng: createRng(seed) }) })
  } catch (error) {
    scope.postMessage({ id, error: String(error) })
  }
}
