import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { EndReason } from '../../engine'

export interface EndDialogProps {
  readonly status: 'won' | 'lost'
  readonly reason: EndReason
  readonly hasNext: boolean
  readonly onNext: () => void
  readonly onRestart: () => void
  readonly onLevels: () => void
}

/** Fin de niveau : résultat, raison et suite. Le plateau reste visible derrière. */
export function EndDialog({ status, reason, hasNext, onNext, onRestart, onLevels }: EndDialogProps) {
  const { t } = useTranslation()
  const firstButton = useRef<HTMLButtonElement>(null)
  const showNext = status === 'won' && hasNext

  useEffect(() => {
    firstButton.current?.focus()
  }, [])

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-reason">
        <h2 id="end-title" className={`dialog-title dialog-title--${status}`}>
          {t(`end.${status}`)}
        </h2>
        <p id="end-reason">{t(`end.reason.${reason}`)}</p>
        {status === 'won' && !hasNext && <p>{t('game.demoComplete')}</p>}
        <div className="dialog-actions">
          {showNext && (
            <button ref={firstButton} type="button" className="button-primary" onClick={onNext}>
              {t('game.next')}
            </button>
          )}
          <button
            ref={showNext ? undefined : firstButton}
            type="button"
            className={showNext ? 'button-secondary' : 'button-primary'}
            onClick={onRestart}
          >
            {t('game.restart')}
          </button>
          <button type="button" className="button-secondary" onClick={onLevels}>
            {t('game.levels')}
          </button>
        </div>
      </div>
    </div>
  )
}
