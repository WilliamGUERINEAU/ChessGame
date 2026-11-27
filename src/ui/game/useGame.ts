import { useCallback, useEffect, useReducer } from 'react'
import {
  applyAction,
  createLevel,
  legalActions,
  seedFromString,
  type Action,
  type GameState,
  type LevelDefinition,
  type Pos,
} from '../../engine'
import { getAiClient } from '../aiClient'
import {
  highlightsFor,
  interpretClick,
  lastMoveOf,
  logEntriesFor,
  NO_SELECTION,
  type Highlights,
  type LogEntry,
  type Selection,
} from './interaction'

/** Délai minimal avant le coup ennemi, pour que le joueur voie son propre coup. */
const ENEMY_MIN_DELAY_MS = 250
const LOG_SIZE = 30
const STRIKE_EVENTS: ReadonlySet<string> = new Set(['attack', 'riposte', 'sweep', 'crush'])

/** Tout ce qu'il faut pour jouer un combat, en entraînement comme dans un run. */
export interface BattleSetup {
  readonly definition: LevelDefinition
  readonly aiDepth: number
  readonly aiAggression: number
  readonly aiBoldness: number
  /** Graine des choix de l'IA (avec le nombre d'actions jouées). */
  readonly seedKey: string
  /** Reprise d'un combat sauvegardé (sinon le niveau commence). */
  readonly resume?: { readonly state: GameState; readonly plies: number }
}

export interface GameModel {
  readonly state: GameState
  readonly selection: Selection
  /** Entrées du journal, la plus récente en premier. */
  readonly log: readonly LogEntry[]
  readonly lastMove: { readonly from: Pos; readonly to: Pos } | null
  /** Pièces touchées par la dernière action (pour un effet visuel). */
  readonly hits: readonly string[]
  /** Nombre d'actions jouées depuis le début du niveau. */
  readonly plies: number
}

type Message =
  | { readonly type: 'play'; readonly action: Action; readonly from: GameState }
  | { readonly type: 'select'; readonly selection: Selection }

function initialModel(setup: BattleSetup): GameModel {
  return {
    state: setup.resume?.state ?? createLevel(setup.definition),
    selection: NO_SELECTION,
    log: [],
    lastMove: null,
    hits: [],
    plies: setup.resume?.plies ?? 0,
  }
}

function reducer(model: GameModel, message: Message): GameModel {
  switch (message.type) {
    case 'select':
      return { ...model, selection: message.selection }
    case 'play': {
      // Une action calculée sur un état dépassé (ex. coup de l'IA arrivé trop tard) est ignorée.
      if (model.state !== message.from) return model
      const { state, events } = applyAction(model.state, message.action)
      const entries = logEntriesFor(model.state, events, model.plies * 100)
      return {
        state,
        // Élan du joueur : la pièce qui rejoue est déjà sélectionnée.
        selection:
          state.bonusPieceId && state.sideToMove === 'player'
            ? { kind: 'piece', pieceId: state.bonusPieceId }
            : NO_SELECTION,
        log: [...entries.reverse(), ...model.log].slice(0, LOG_SIZE),
        lastMove: lastMoveOf(events),
        hits: events.flatMap((event) => (STRIKE_EVENTS.has(event.type) && 'targetId' in event ? [event.targetId] : [])),
        plies: model.plies + 1,
      }
    }
  }
}

export interface GameController {
  readonly model: GameModel
  readonly highlights: Highlights
  /** L'IA ennemie est en train de jouer. */
  readonly thinking: boolean
  /** Le joueur n'a aucune action possible et doit passer. */
  readonly mustPass: boolean
  /** Élan : pièce du joueur qui rejoue (il peut aussi terminer son tour). */
  readonly bonusPieceId: string | null
  readonly clickCell: (pos: Pos) => void
  readonly pass: () => void
}

/**
 * État et déroulement d'un combat : clics du joueur, tour de l'IA (dans un worker),
 * journal. Pour recommencer, remonter le composant (changer sa `key`).
 */
export function useGame(setup: BattleSetup): GameController {
  const [model, dispatch] = useReducer(reducer, setup, initialModel)
  const { state, selection, plies } = model
  const thinking = state.status === 'ongoing' && state.sideToMove === 'enemy'
  const { aiDepth, aiAggression, aiBoldness, seedKey } = setup

  useEffect(() => {
    if (!thinking) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = performance.now()
    const seed = seedFromString(`${seedKey}:${plies}`)
    void getAiClient()
      .choose(state, { depth: aiDepth, aggression: aiAggression, boldness: aiBoldness, seed })
      .then((action) => {
        if (cancelled) return
        const wait = Math.max(0, ENEMY_MIN_DELAY_MS - (performance.now() - startedAt))
        timer = setTimeout(() => dispatch({ type: 'play', action, from: state }), wait)
      })
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [thinking, state, aiDepth, aiAggression, aiBoldness, seedKey, plies])

  const clickCell = useCallback(
    (pos: Pos) => {
      if (thinking) return
      const result = interpretClick(state, selection, pos)
      if (result.kind === 'play') dispatch({ type: 'play', action: result.action, from: state })
      else dispatch({ type: 'select', selection: result.selection })
    },
    [thinking, state, selection],
  )

  const playerActions = !thinking && state.status === 'ongoing' ? legalActions(state) : []
  const mustPass = playerActions.length === 1 && playerActions[0].kind === 'pass'
  const pass = useCallback(() => dispatch({ type: 'play', action: { kind: 'pass' }, from: state }), [state])

  return {
    model,
    highlights: highlightsFor(state, selection),
    thinking,
    mustPass,
    bonusPieceId: !thinking && state.status === 'ongoing' ? state.bonusPieceId : null,
    clickCell,
    pass,
  }
}
