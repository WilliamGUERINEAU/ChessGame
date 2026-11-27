import type { Goal } from '../../engine'

/** Limite de tours de l'objectif, s'il y en a une. */
export function roundLimit(goal: Goal): number | undefined {
  return goal.kind === 'survive' || goal.kind === 'intercept' ? goal.rounds : goal.maxRounds
}

/**
 * Tours restants avant une défaite au temps (combat ou capture limités), y compris
 * le tour en cours ; `null` si l'objectif n'a pas de limite qui fait perdre.
 */
export function roundsBeforeTimeUp(goal: Goal, round: number): number | null {
  if (goal.kind !== 'eliminate' && goal.kind !== 'capture') return null
  return goal.maxRounds === undefined ? null : goal.maxRounds - round + 1
}

/** Seuil d'alerte : à partir de ce nombre de tours restants, le compteur passe en alerte. */
export const TIME_WARNING_ROUNDS = 3
