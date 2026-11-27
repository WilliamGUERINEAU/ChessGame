import type { TFunction } from 'i18next'
import type { GoalDefinition } from '../../engine'

/** Objectif d'un niveau en une phrase. */
export function goalSummary(goal: GoalDefinition, t: TFunction): string {
  switch (goal.kind) {
    case 'eliminate':
      return goal.maxRounds ? t('goal.eliminateLimited', { rounds: goal.maxRounds }) : t('goal.eliminate')
    case 'survive':
      return t('goal.survive', { rounds: goal.rounds })
    case 'capture':
      return goal.maxRounds ? t('goal.captureLimited', { rounds: goal.maxRounds }) : t('goal.capture')
    case 'intercept':
      return t('goal.intercept', { rounds: goal.rounds })
  }
}
