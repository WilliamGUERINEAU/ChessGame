import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { GoalDefinition } from '../../engine'
import { DEMO_LEVELS } from '../../content/levels'

export interface LevelSelectProps {
  readonly onBack: () => void
  readonly onPlay: (index: number) => void
}

export function LevelSelect({ onBack, onPlay }: LevelSelectProps) {
  const { t } = useTranslation()
  return (
    <main className="levels">
      <header className="levels-header">
        <button type="button" className="button-ghost" onClick={onBack}>
          ← {t('menu.back')}
        </button>
        <h1>{t('levels.title')}</h1>
      </header>
      <p className="muted">{t('levels.subtitle')}</p>
      <ol className="level-list">
        {DEMO_LEVELS.map((level, index) => (
          <li key={level.id}>
            <button type="button" className="level-card" onClick={() => onPlay(index)}>
              <span className="level-card-number">{t('levels.number', { number: index + 1 })}</span>
              <span className="level-card-name">{t(`levels.${level.id}.name`)}</span>
              <span className="level-card-description">{t(`levels.${level.id}.description`)}</span>
              <span className="level-card-goal">{goalSummary(level.definition.goal, t)}</span>
            </button>
          </li>
        ))}
      </ol>
    </main>
  )
}

function goalSummary(goal: GoalDefinition, t: TFunction): string {
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
