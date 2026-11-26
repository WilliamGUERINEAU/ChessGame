import { resolveAction } from '../apply'
import { kingDistance } from '../geometry'
import { legalActions, type Action } from '../moves'
import type { PieceType } from '../pieces/pieces'
import type { Rng } from '../rng'
import type { GameState } from '../state'

export interface AiOptions {
  /** Nombre de demi-coups explorés (2 = mon action puis la réponse adverse). */
  readonly depth?: number
  /** Départage les actions de même valeur ; sans lui, la première est retenue. */
  readonly rng?: Rng
  /**
   * Agressivité de l'ennemi : valeur de chaque case gagnée vers le héros, par pièce.
   * Faible, l'ennemi se met à l'abri ; forte, il vient au contact quitte à prendre des coups.
   */
  readonly aggression?: number
}

export const DEFAULT_AI_DEPTH = 2
export const DEFAULT_AGGRESSION = 0.1

/** Valeur d'une pièce par type, hors PV. */
const TYPE_VALUE: Readonly<Record<PieceType, number>> = {
  king: 4,
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
}
/** Valeur de chaque PV restant. */
const HP_VALUE = 1
/** Valeur supplémentaire de chaque PV du héros : l'ennemi cherche à l'user. */
const HERO_HP_VALUE = 3
/** Valeur supplémentaire de la cible d'un niveau de capture. */
const TARGET_BONUS = 6
/** Poids de l'approche des pièces du joueur vers leur objectif (parties IA contre IA). */
const PLAYER_APPROACH = 0.1
/** Score d'une partie gagnée (bien au-dessus de toute différence de matériel). */
const WIN_SCORE = 100_000
/** Coût de chaque demi-coup avant une fin de partie : gagner vite, perdre tard. */
const PLY_COST = 1_000

interface Weights {
  readonly enemyApproach: number
}

/**
 * Choisit l'action du camp qui joue par une recherche minimax avec élagage
 * alpha-bêta. Renvoie `pass` si le camp est bloqué.
 */
export function chooseAction(state: GameState, options: AiOptions = {}): Action {
  const ranked = rankActions(state, options)
  if (ranked.length === 0) throw new Error('La partie est terminée : aucune action à choisir')
  const bestScore = ranked[0].score
  const best = ranked.filter((entry) => Math.abs(entry.score - bestScore) <= 1e-9).map((entry) => entry.action)
  return options.rng ? options.rng.pick(best) : best[0]
}

export interface RankedAction {
  readonly action: Action
  /** Valeur pour le camp qui joue (plus c'est haut, mieux c'est). */
  readonly score: number
}

/** Toutes les actions légales, de la meilleure à la moins bonne selon l'IA. */
export function rankActions(state: GameState, options: AiOptions = {}): RankedAction[] {
  const depth = Math.max(1, options.depth ?? DEFAULT_AI_DEPTH)
  const weights: Weights = { enemyApproach: options.aggression ?? DEFAULT_AGGRESSION }
  const actions = orderActions(legalActions(state))
  if (actions.length <= 1) return actions.map((action) => ({ action, score: 0 }))
  const ranked = actions.map((action) => ({
    action,
    score: -negamax(resolveAction(state, action).state, depth - 1, -Infinity, Infinity, 1, weights),
  }))
  // Tri stable : à score égal, l'ordre de génération est conservé.
  return ranked.sort((a, b) => b.score - a.score)
}

/** Valeur de `state` du point de vue du camp qui doit y jouer. */
function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  weights: Weights,
): number {
  if (depth === 0 || state.status !== 'ongoing') return evaluate(state, ply, weights)
  let best = -Infinity
  for (const action of orderActions(legalActions(state))) {
    const child = resolveAction(state, action).state
    const score = -negamax(child, depth - 1, -beta, -alpha, ply + 1, weights)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** Les attaques d'abord : l'élagage alpha-bêta en est plus efficace. */
function orderActions(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => Number(b.kind === 'attack') - Number(a.kind === 'attack'))
}

/** Évaluation du point de vue du camp qui doit jouer dans `state`. */
function evaluate(state: GameState, ply: number, weights: Weights): number {
  const forEnemy = evaluateForEnemy(state, ply, weights)
  return state.sideToMove === 'enemy' ? forEnemy : -forEnemy
}

/**
 * Évaluation du point de vue de l'ennemi. Une fin de partie domine tout, plus
 * tôt pour une victoire, plus tard pour une défaite. À issue égale, la position
 * départage : un camp condamné continue d'user l'adversaire au lieu de jouer au hasard.
 */
function evaluateForEnemy(state: GameState, ply: number, weights: Weights): number {
  const position = positionForEnemy(state, weights)
  if (state.status === 'won') return -WIN_SCORE + ply * PLY_COST + position
  if (state.status === 'lost') return WIN_SCORE - ply * PLY_COST + position
  return position
}

/** Matériel, PV et approche, du point de vue de l'ennemi. */
function positionForEnemy(state: GameState, weights: Weights): number {
  const hero = state.pieces.find((piece) => piece.id === state.heroId)
  const targetId = state.goal.kind === 'capture' ? state.goal.targetId : null
  const enemies = state.pieces.filter((piece) => piece.side === 'enemy')
  const objectives = targetId ? enemies.filter((piece) => piece.id === targetId) : enemies

  let score = 0
  for (const piece of state.pieces) {
    let value = TYPE_VALUE[piece.type] + piece.hp * HP_VALUE
    if (piece.id === state.heroId) value += piece.hp * HERO_HP_VALUE
    if (piece.id === targetId) value += TARGET_BONUS
    score += piece.side === 'enemy' ? value : -value
  }

  // L'ennemi converge vers le héros (sauf la cible, qui se garde) ;
  // les pièces du joueur (hors héros) vers leur objectif.
  for (const piece of state.pieces) {
    if (piece.side === 'enemy' && hero && piece.id !== targetId) {
      score -= weights.enemyApproach * kingDistance(piece.pos, hero.pos)
    } else if (piece.side === 'player' && piece.id !== state.heroId && objectives.length > 0) {
      const nearest = Math.min(...objectives.map((o) => kingDistance(piece.pos, o.pos)))
      score += PLAYER_APPROACH * nearest
    }
  }
  return score
}
