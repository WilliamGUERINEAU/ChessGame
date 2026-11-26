import { createRng, type Action, type GameState } from '../engine'
import { chooseAction } from '../engine/ai/ai'
import type { AiRequest, AiResponse } from '../engine/ai/ai.worker'

export interface AiSettings {
  readonly depth: number
  readonly aggression: number
  readonly seed: number
}

export interface AiClient {
  choose(state: GameState, settings: AiSettings): Promise<Action>
}

/** Calcul sur le fil principal : repli si les workers sont indisponibles. */
function chooseLocally(state: GameState, settings: AiSettings): Promise<Action> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { depth, aggression, seed } = settings
      resolve(chooseAction(state, { depth, aggression, rng: createRng(seed) }))
    }, 0)
  })
}

/** IA dans un Web Worker, avec repli automatique sur le fil principal en cas d'échec. */
function createAiClient(): AiClient {
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('../engine/ai/ai.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }

  let nextId = 0
  const pending = new Map<number, { resolve: (action: Action) => void; reject: (error: Error) => void }>()

  const failAll = () => {
    for (const request of pending.values()) request.reject(new Error('Worker indisponible'))
    pending.clear()
    worker?.terminate()
    worker = null
  }

  if (worker) {
    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      const request = pending.get(event.data.id)
      if (!request) return
      pending.delete(event.data.id)
      if ('action' in event.data) request.resolve(event.data.action)
      else request.reject(new Error(event.data.error))
    }
    worker.onerror = failAll
  }

  return {
    choose(state, settings) {
      const current = worker
      if (!current) return chooseLocally(state, settings)
      const id = ++nextId
      const request: AiRequest = { id, state, ...settings }
      return new Promise<Action>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        current.postMessage(request)
      }).catch(() => chooseLocally(state, settings))
    },
  }
}

let client: AiClient | null = null

/** Client IA partagé, créé à la première demande. */
export function getAiClient(): AiClient {
  client ??= createAiClient()
  return client
}
