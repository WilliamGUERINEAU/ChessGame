import type { Pos } from '../geometry'
import type { GameState } from '../state'

/** Objectif tel qu'écrit dans le contenu d'un niveau (la cible est désignée par sa case). */
export type GoalDefinition =
  | { readonly kind: 'eliminate'; readonly maxRounds?: number }
  | { readonly kind: 'survive'; readonly rounds: number }
  | { readonly kind: 'capture'; readonly target: Pos; readonly maxRounds?: number }

/** Objectif pendant la partie (la cible est désignée par son identifiant). */
export type Goal =
  | { readonly kind: 'eliminate'; readonly maxRounds?: number }
  | { readonly kind: 'survive'; readonly rounds: number }
  | { readonly kind: 'capture'; readonly targetId: string; readonly maxRounds?: number }

export type Status = 'ongoing' | 'won' | 'lost'

export type EndReason =
  /** Victoire : plus aucune pièce ennemie. */
  | 'allEliminated'
  /** Victoire : le joueur a tenu le nombre de tours demandé. */
  | 'survived'
  /** Victoire : la pièce cible a été capturée. */
  | 'targetCaptured'
  /** Défaite : le héros est mort. */
  | 'heroDied'
  /** Défaite : la limite de tours est dépassée. */
  | 'timeUp'
  /** Défaite : aucun des deux camps ne peut jouer. */
  | 'stalemate'

export type Outcome =
  | { readonly status: 'ongoing'; readonly reason: null }
  | { readonly status: 'won' | 'lost'; readonly reason: EndReason }

type OutcomeInput = Pick<GameState, 'pieces' | 'goal' | 'heroId' | 'round' | 'consecutivePasses' | 'reinforcements'>

const ONGOING: Outcome = { status: 'ongoing', reason: null }
const won = (reason: EndReason): Outcome => ({ status: 'won', reason })
const lost = (reason: EndReason): Outcome => ({ status: 'lost', reason })

/**
 * Évalue la fin de partie. La mort du héros prime sur tout le reste.
 * `round` augmente après chaque action de l'ennemi : « round > N » signifie
 * que l'ennemi a joué N fois.
 */
export function evaluateOutcome(state: OutcomeInput): Outcome {
  const isAlive = (id: string) => state.pieces.some((piece) => piece.id === id)
  if (!isAlive(state.heroId)) return lost('heroDied')

  // Des renforts ennemis encore attendus comptent comme des ennemis restants.
  const enemiesLeft =
    state.pieces.some((piece) => piece.side === 'enemy') ||
    state.reinforcements.some((reinforcement) => reinforcement.piece.side === 'enemy')
  const goal = state.goal

  switch (goal.kind) {
    case 'eliminate':
      if (!enemiesLeft) return won('allEliminated')
      if (goal.maxRounds !== undefined && state.round > goal.maxRounds) return lost('timeUp')
      break
    case 'survive':
      if (!enemiesLeft) return won('allEliminated')
      if (state.round > goal.rounds) return won('survived')
      // En survie, les passes font simplement avancer les tours : pas de blocage.
      return ONGOING
    case 'capture':
      if (!isAlive(goal.targetId)) return won('targetCaptured')
      if (goal.maxRounds !== undefined && state.round > goal.maxRounds) return lost('timeUp')
      break
  }

  if (state.consecutivePasses >= 2) return lost('stalemate')
  return ONGOING
}
