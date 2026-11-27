import { useTranslation } from 'react-i18next'
import type { Unlock } from '../../run/profile'
import type { RunState } from '../../run/run'
import { UnlockList } from './UnlockList'
import { ArmyList } from './ArmyList'

export interface RunSummaryProps {
  readonly run: RunState
  /** Déblocages obtenus pendant ce run. */
  readonly unlocks: readonly Unlock[]
  readonly onNewRun: () => void
  readonly onMenu: () => void
}

/** Bilan d'un run gagné ou perdu. */
export function RunSummary({ run, unlocks, onNewRun, onMenu }: RunSummaryProps) {
  const { t } = useTranslation()
  const won = run.phase === 'won'
  return (
    <main className="levels run-summary">
      <h1 className={won ? 'dialog-title dialog-title--won' : 'dialog-title dialog-title--lost'}>
        {won ? t('run.wonTitle') : t('run.lostTitle')}
      </h1>
      <p>
        {won
          ? t('run.wonText', { total: run.levelCount })
          : run.endReason
            ? t(`end.reason.${run.endReason}`)
            : ''}
      </p>
      <p className="muted">
        {t(`classes.${run.classId}.name`)} · {t('run.levelsCleared', { count: run.levelsCleared, total: run.levelCount })}
      </p>
      {unlocks.length > 0 && (
        <section className="unlocks">
          <h2>{t('unlock.title')}</h2>
          <UnlockList unlocks={unlocks} />
        </section>
      )}
      <section className="reward-target">
        <h2>{t('run.finalArmy')}</h2>
        <ArmyList army={run.army} heroId={run.heroId} />
      </section>
      <div className="reward-actions">
        <button type="button" className="button-primary" onClick={onNewRun}>
          {t('run.newRun')}
        </button>
        <button type="button" className="button-secondary" onClick={onMenu}>
          {t('run.menu')}
        </button>
      </div>
    </main>
  )
}
