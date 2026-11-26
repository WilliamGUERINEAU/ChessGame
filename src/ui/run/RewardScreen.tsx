import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { statsFor } from '../../engine'
import { eligibleTargets, MAX_ARMY, sameReward, type RewardOption, type RunState } from '../../run/run'
import { PieceGlyph } from '../board/PieceGlyph'
import { ArmyList } from './ArmyList'

export interface RewardScreenProps {
  readonly run: RunState
  readonly onConfirm: (option: RewardOption, targetId?: string) => void
  readonly onAbandon: () => void
}

/** Choix d'une récompense parmi trois, puis (pour un pouvoir) de la pièce qui le reçoit. */
export function RewardScreen({ run, onConfirm, onAbandon }: RewardScreenProps) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<RewardOption | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)

  const targets = chosen?.kind === 'power' ? eligibleTargets(run.army, chosen.power) : []
  const ready = chosen !== null && (chosen.kind === 'piece' || targetId !== null)

  const choose = (option: RewardOption) => {
    setChosen(option)
    // Une seule pièce possible : elle est choisie d'office.
    const eligible = option.kind === 'power' ? eligibleTargets(run.army, option.power) : []
    setTargetId(eligible.length === 1 ? eligible[0].id : null)
  }

  return (
    <main className="levels reward">
      <header className="levels-header">
        <button type="button" className="button-ghost" onClick={onAbandon}>
          ← {t('run.abandon')}
        </button>
        <h1>{t('run.rewardTitle')}</h1>
      </header>
      <p className="muted">{t('run.rewardSubtitle', { number: run.levelsCleared, total: run.levelCount })}</p>

      <ul className="reward-list">
        {run.rewardOptions.map((option) => {
          const selected = chosen !== null && sameReward(chosen, option)
          return (
            <li key={option.kind === 'piece' ? `piece-${option.type}` : `power-${option.power}`}>
              <button
                type="button"
                className={selected ? 'reward-card is-selected' : 'reward-card'}
                aria-pressed={selected}
                onClick={() => choose(option)}
              >
                {option.kind === 'piece' ? <PieceReward type={option.type} /> : <PowerReward option={option} run={run} />}
              </button>
            </li>
          )
        })}
      </ul>

      {chosen?.kind === 'power' && (
        <section className="reward-target">
          <h2>{t('run.chooseTarget')}</h2>
          <ArmyList
            army={run.army}
            heroId={run.heroId}
            selectedId={targetId}
            isEnabled={(piece) => targets.some((target) => target.id === piece.id)}
            onSelect={setTargetId}
          />
        </section>
      )}

      {chosen?.kind !== 'power' && (
        <section className="reward-target">
          <h2>
            {t('run.army')}{' '}
            <span className="muted">({t('run.armyCount', { count: run.army.length, max: MAX_ARMY })})</span>
          </h2>
          <ArmyList army={run.army} heroId={run.heroId} />
        </section>
      )}

      <div className="reward-actions">
        <button
          type="button"
          className="button-primary"
          disabled={!ready}
          onClick={() => chosen && onConfirm(chosen, targetId ?? undefined)}
        >
          {t('run.confirm')}
        </button>
      </div>
    </main>
  )
}

function PieceReward({ type }: { type: Extract<RewardOption, { kind: 'piece' }>['type'] }) {
  const { t } = useTranslation()
  const { maxHp, atk } = statsFor(type, [])
  return (
    <>
      <svg viewBox="0 0 100 100" className="reward-glyph piece--player" aria-hidden="true">
        <PieceGlyph type={type} />
      </svg>
      <span className="reward-kind">{t('run.newPiece')}</span>
      <span className="reward-name">{t(`pieces.${type}`)}</span>
      <span className="reward-description">
        {t('game.hp')} {maxHp} · {t('game.atk')} {atk}
      </span>
    </>
  )
}

function PowerReward({ option, run }: { option: Extract<RewardOption, { kind: 'power' }>; run: RunState }) {
  const { t } = useTranslation()
  const holders = [...new Set(eligibleTargets(run.army, option.power).map((piece) => t(`pieces.${piece.type}`)))]
  return (
    <>
      <span className={`reward-power reward-power--${option.power}`} aria-hidden="true">
        ✦
      </span>
      <span className="reward-kind">{t('run.power')}</span>
      <span className="reward-name">{t(`powers.${option.power}.name`)}</span>
      <span className="reward-description">{t(`powers.${option.power}.description`)}</span>
      <span className="reward-for">{t('run.forPieces', { pieces: holders.join(', ') })}</span>
    </>
  )
}
