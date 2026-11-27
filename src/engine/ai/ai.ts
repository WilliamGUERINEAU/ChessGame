import { resolveAction } from '../apply'
import { isStandable, type Board } from '../board/board'
import { add, ALL_DIRECTIONS, type Pos } from '../geometry'
import { legalActions, type Action } from '../moves'
import { PIECES, type PieceType } from '../pieces/pieces'
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
  /**
   * Approche des pièces du joueur vers leur objectif (hors héros). Sert surtout aux
   * parties simulées : un joueur simulé trop prudent ne vient jamais au contact.
   */
  readonly playerApproach?: number
  /** Approche du héros du joueur vers l'objectif (0 par défaut : il reste en retrait). */
  readonly heroApproach?: number
  /**
   * Audace de l'ennemi (0 à 1) : part de la valeur de ses propres pièces qu'il accepte
   * de risquer. À 0,5, un échange de pièces égales lui paraît avantageux : il attaque.
   */
  readonly boldness?: number
}

export const DEFAULT_AI_DEPTH = 2
export const DEFAULT_AGGRESSION = 0.1

/**
 * Ennemis acculés : quand il ne leur reste que peu de pièces, ou après plusieurs
 * tours sans combat, ils cessent de fuir et viennent au contact (agressivité renforcée).
 */
export const CORNERED_MAX_PIECES = 2
/** Actions sans attaque, tous camps confondus, avant que les ennemis passent à l'attaque (3 tours). */
export const CORNERED_QUIET_PLIES = 6
export const CORNERED_AGGRESSION = 2
/** Acculés, les ennemis ne ménagent plus leurs pièces (audace minimale). */
export const CORNERED_BOLDNESS = 0.8

export function enemiesCornered(state: Pick<GameState, 'pieces' | 'quietPlies'>): boolean {
  const enemies = state.pieces.filter((piece) => piece.side === 'enemy').length
  return enemies <= CORNERED_MAX_PIECES || state.quietPlies >= CORNERED_QUIET_PLIES
}

/** Agressivité effective, décidée une fois pour toute la recherche à partir de la position actuelle. */
export function effectiveAggression(state: Pick<GameState, 'pieces' | 'quietPlies'>, base: number): number {
  return enemiesCornered(state) ? Math.max(base, CORNERED_AGGRESSION) : base
}

/** Audace effective : renforcée quand les ennemis sont acculés. */
export function effectiveBoldness(state: Pick<GameState, 'pieces' | 'quietPlies'>, base: number): number {
  const clamped = Math.min(1, Math.max(0, base))
  return enemiesCornered(state) ? Math.max(clamped, CORNERED_BOLDNESS) : clamped
}

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
/** Valeur de chaque pouvoir porté (Vigueur et Force comptent déjà via PV et ATK). */
const POWER_VALUE = 0.5
/** Valeur de chaque point d'ATK au-delà de la base du type (Force, promotion…). */
const BONUS_ATK_VALUE = 1
/** Valeur d'un bouclier encore actif : il vaut à peu près une attaque encaissée. */
const SHIELD_VALUE = 1.5
/** Valeur supplémentaire de chaque PV du héros : l'ennemi cherche à l'user. */
const HERO_HP_VALUE = 3
/**
 * En survie, l'ennemi n'a qu'un but : abattre le héros. Chaque PV du héros vaut
 * plus qu'une pièce mineure, donc l'ennemi sacrifie volontiers une pièce pour le toucher.
 */
const SURVIVE_HERO_HP_VALUE = 8
/** Valeur supplémentaire de la cible d'un niveau de capture. */
const TARGET_BONUS = 6
/** Interception : valeur de chaque case gagnée par un ennemi vers la sortie la plus proche. */
const EXIT_APPROACH = 1
/** Poids de l'approche des pièces du joueur vers leur objectif (parties IA contre IA). */
const PLAYER_APPROACH = 0.1
/** Score d'une partie gagnée (bien au-dessus de toute différence de matériel). */
const WIN_SCORE = 100_000
/** Coût de chaque demi-coup avant une fin de partie : gagner vite, perdre tard. */
const PLY_COST = 1_000

interface Weights {
  readonly enemyApproach: number
  readonly playerApproach: number
  readonly heroApproach: number
  /** Poids de la valeur des pièces ennemies (1 − audace). */
  readonly enemySelfValue: number
  /**
   * L'IA ennemie ne compte pas sur la limite de tours : une défaite « temps écoulé »
   * du joueur ne vaut rien de plus pour elle que la position. Elle se bat au lieu de
   * jouer la montre (le joueur simulé, lui, la redoute).
   */
  readonly ignoreClock: boolean
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
  const weights: Weights = {
    enemyApproach: effectiveAggression(state, options.aggression ?? DEFAULT_AGGRESSION),
    playerApproach: options.playerApproach ?? PLAYER_APPROACH,
    heroApproach: options.heroApproach ?? 0,
    enemySelfValue: 1 - effectiveBoldness(state, options.boldness ?? 0),
    ignoreClock: state.sideToMove === 'enemy',
  }
  const actions = orderActions(legalActions(state))
  if (actions.length <= 1) return actions.map((action) => ({ action, score: 0 }))
  const ranked = actions.map((action) => ({
    action,
    score: childScore(state, resolveAction(state, action).state, depth - 1, -Infinity, Infinity, 1, weights),
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
    const score = childScore(state, child, depth - 1, alpha, beta, ply + 1, weights)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/**
 * Valeur d'un état enfant pour le camp qui joue dans `parent`. Normalement l'autre
 * camp joue ensuite (on inverse) ; avec l'Élan, c'est le même camp qui rejoue.
 */
function childScore(
  parent: GameState,
  child: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  weights: Weights,
): number {
  return child.sideToMove === parent.sideToMove
    ? negamax(child, depth, alpha, beta, ply, weights)
    : -negamax(child, depth, -beta, -alpha, ply, weights)
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
  if (state.status === 'lost' && !(weights.ignoreClock && state.endReason === 'timeUp')) {
    return WIN_SCORE - ply * PLY_COST + position
  }
  return position
}

/** Matériel, PV et approche, du point de vue de l'ennemi. */
function positionForEnemy(state: GameState, weights: Weights): number {
  const hero = state.pieces.find((piece) => piece.id === state.heroId)
  const targetId = state.goal.kind === 'capture' ? state.goal.targetId : null
  const enemies = state.pieces.filter((piece) => piece.side === 'enemy')
  const objectives = targetId ? enemies.filter((piece) => piece.id === targetId) : enemies

  const heroHpValue = state.goal.kind === 'survive' ? SURVIVE_HERO_HP_VALUE : HERO_HP_VALUE
  let score = 0
  for (const piece of state.pieces) {
    let value = TYPE_VALUE[piece.type] + piece.hp * HP_VALUE
    value += Math.max(0, piece.atk - PIECES[piece.type].atk) * BONUS_ATK_VALUE
    value += piece.powers.length * POWER_VALUE + (piece.shieldActive ? SHIELD_VALUE : 0)
    if (piece.id === state.heroId) value += piece.hp * heroHpValue
    if (piece.id === targetId) value += TARGET_BONUS
    score += piece.side === 'enemy' ? value * weights.enemySelfValue : -value
  }

  // L'ennemi converge vers le héros (sauf la cible, qui se garde) ;
  // les pièces du joueur (hors héros) vers leur objectif.
  // L'approche est un bonus positif, plus grand près du but : une pièce garde
  // toujours de la valeur, et une capture rapporte toujours (sinon, perdre une
  // pièce lointaine « améliorerait » la position de son camp).
  const board = state.board
  const reach = board.width + board.height
  const exits = state.goal.kind === 'intercept' ? state.goal.exits : null
  for (const piece of state.pieces) {
    if (piece.side === 'enemy' && exits) {
      // Interception : les ennemis courent vers la sortie la plus proche.
      const nearest = Math.min(...exits.map((exit) => walkDistance(board, exit, piece.pos)))
      score += EXIT_APPROACH * Math.max(0, reach - nearest)
    } else if (piece.side === 'enemy' && hero && piece.id !== targetId) {
      score += weights.enemyApproach * Math.max(0, reach - walkDistance(board, hero.pos, piece.pos))
    } else if (piece.side === 'player' && objectives.length > 0) {
      const weight = piece.id === state.heroId ? weights.heroApproach : weights.playerApproach
      const nearest = Math.min(...objectives.map((o) => walkDistance(board, o.pos, piece.pos)))
      score -= weight * Math.max(0, reach - nearest)
    }
  }
  return score
}

/**
 * Distance de marche (pas de Roi) entre deux cases, en contournant murs, eau et vide
 * (les pièces sont ignorées). Sans chemin : très grande. Mise en cache par plateau et
 * par case de départ : la recherche de l'IA réévalue souvent les mêmes positions.
 */
const walkCache = new WeakMap<Board, Map<number, Int16Array>>()

function walkDistance(board: Board, from: Pos, to: Pos): number {
  const distance = walkDistances(board, from)[to.y * board.width + to.x]
  return distance < 0 ? Number.MAX_SAFE_INTEGER : distance
}

function walkDistances(board: Board, from: Pos): Int16Array {
  let perBoard = walkCache.get(board)
  if (!perBoard) {
    perBoard = new Map()
    walkCache.set(board, perBoard)
  }
  const start = from.y * board.width + from.x
  const cached = perBoard.get(start)
  if (cached) return cached

  const distances = new Int16Array(board.width * board.height).fill(-1)
  distances[start] = 0
  const queue: Pos[] = [from]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    const next = distances[current.y * board.width + current.x] + 1
    for (const v of ALL_DIRECTIONS) {
      const p = add(current, v)
      if (!isStandable(board, p)) continue
      const index = p.y * board.width + p.x
      if (distances[index] >= 0) continue
      distances[index] = next
      queue.push(p)
    }
  }
  perBoard.set(start, distances)
  return distances
}
