import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createLevel, pieceAt, samePos, type Pos } from '../../engine'
import type { LevelContent } from '../../content/levels'
import { autoDeploy, battleDefinition, movePlacement, playerForward, type Placement } from '../../run/deploy'
import { MAX_ARMY, type RunState } from '../../run/run'
import { Board } from '../board/Board'
import { hasPromotionPawn } from '../board/promotion'
import { ArmyList } from './ArmyList'

export interface DeployScreenProps {
  readonly level: LevelContent
  readonly run: RunState
  readonly placement: Placement
  readonly onPlacementChange: (placement: Placement) => void
  readonly onStart: () => void
  readonly onAbandon: () => void
}

const NO_HIGHLIGHTS = { moves: [], attacks: [], landings: [] } as const

/**
 * Placement de l'armée avant un niveau : la proposition automatique peut être
 * retouchée (toucher une pièce, puis une case de la zone ou une autre pièce).
 */
export function DeployScreen({ level, run, placement, onPlacementChange, onStart, onAbandon }: DeployScreenProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const preview = useMemo(() => createLevel(battleDefinition(level, run, placement)), [level, run, placement])

  const onCellClick = (pos: Pos) => {
    const piece = pieceAt(preview, pos)
    const inZone = level.deployment.some((cell) => samePos(cell, pos))
    if (selectedId && inZone && piece?.id !== selectedId) {
      onPlacementChange(movePlacement(placement, selectedId, pos, level.deployment))
      setSelectedId(null)
    } else if (piece?.side === 'player' && piece.id !== selectedId) {
      setSelectedId(piece.id)
    } else {
      setSelectedId(null)
    }
  }

  return (
    <div className="game">
      <header className="game-header">
        <button type="button" className="button-ghost" onClick={onAbandon}>
          ← {t('run.abandon')}
        </button>
        <div className="game-heading">
          <p className="game-level">{t('run.level', { number: run.levelIndex + 1, total: run.levelCount })}</p>
          <h1>{t(`levels.${level.id}.name`)}</h1>
        </div>
        <p className="game-round">{t('run.deployTitle')}</p>
      </header>
      <p className="game-goal">{t(`levels.${level.id}.description`)}</p>

      <div className="game-body">
        <div className="board-area">
          <Board
            state={preview}
            selectedId={selectedId}
            highlights={NO_HIGHLIGHTS}
            lastMove={null}
            hits={[]}
            hitKey={0}
            interactive
            onCellClick={onCellClick}
            zone={level.deployment}
          />
        </div>
        <aside className="game-panel">
          <section className="turn" aria-live="polite">
            <p className="turn-status">{t('run.deployTitle')}</p>
            <p className="turn-hint">{selectedId ? t('run.deployMove') : t('run.deployHint')}</p>
            {hasPromotionPawn(preview) && <p className="turn-hint">{t('run.promotionHint')}</p>}
            <button type="button" className="button-primary" onClick={onStart}>
              {t('run.start')}
            </button>
          </section>
          <section className="journal">
            <h2>
              {t('run.army')}{' '}
              <span className="muted">({t('run.armyCount', { count: run.army.length, max: MAX_ARMY })})</span>
            </h2>
            <ArmyList
              army={run.army}
              heroId={run.heroId}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            />
          </section>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setSelectedId(null)
              onPlacementChange(autoDeploy(run.army, run.heroId, level.deployment, playerForward(level)))
            }}
          >
            {t('run.autoPlace')}
          </button>
        </aside>
      </div>
    </div>
  )
}
