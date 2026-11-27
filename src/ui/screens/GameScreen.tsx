import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { findPiece, type GameState, type Goal, type Piece, type Terrain } from '../../engine'
import { enemiesCornered } from '../../engine/ai/ai'
import { Board, ExitMark, PromotionMark, ReinforcementMark, ThreatMark } from '../board/Board'
import { hasPromotionPawn, nextReinforcements } from '../board/promotion'
import { PieceGlyph } from '../board/PieceGlyph'
import { CELL, TerrainTile } from '../board/TerrainTile'
import { Dialog, type DialogAction } from '../Dialog'
import { enemyThreats, type Highlights, type LogEntry, type PieceLabel } from '../game/interaction'
import { roundLimit, roundsBeforeTimeUp, TIME_WARNING_ROUNDS } from '../game/time'
import { useGame, type BattleSetup } from '../game/useGame'
import { powerNames } from '../powers'
import { isMuted, playCue, setMuted } from '../sound'

/** Entraînement (armée fixe, on peut recommencer) ou combat d'un run. */
export type GameMode =
  | {
      readonly kind: 'practice'
      readonly hasNext: boolean
      readonly onRestart: () => void
      readonly onNext: () => void
      readonly onLevels: () => void
    }
  | {
      readonly kind: 'run'
      readonly levelCount: number
      readonly isLastLevel: boolean
      /** Appelé quand le joueur quitte l'écran de fin, avec l'état final du combat. */
      readonly onFinished: (state: GameState) => void
      readonly onAbandon: () => void
      /** Après chaque action : pour sauvegarder le combat en cours. */
      readonly onProgress?: (state: GameState, plies: number) => void
    }

export interface GameScreenProps {
  readonly levelId: string
  /** Numéro du niveau, à partir de 1. */
  readonly levelNumber: number
  readonly setup: BattleSetup
  readonly mode: GameMode
}

const TERRAINS: readonly Terrain[] = ['floor', 'forest', 'water', 'wall', 'ice']

export function GameScreen({ levelId, levelNumber, setup, mode }: GameScreenProps) {
  const { t } = useTranslation()
  const game = useGame(setup)
  const [muted, setMutedState] = useState(isMuted)
  const { effects } = game.model
  useEffect(() => {
    playCue(effects.sound)
  }, [effects])
  const onProgress = mode.kind === 'run' ? mode.onProgress : undefined
  const { state: progressState, plies: progressPlies } = game.model
  useEffect(() => {
    onProgress?.(progressState, progressPlies)
  }, [onProgress, progressState, progressPlies])
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [showThreats, setShowThreats] = useState(false)
  const { state, selection, log, lastMove, hits, plies } = game.model
  const ended = state.status !== 'ongoing'
  const selected = selection.kind === 'none' ? undefined : findPiece(state, selection.pieceId)
  const bonusPiece = game.bonusPieceId ? findPiece(state, game.bonusPieceId) : undefined
  const wave = nextReinforcements(state)
  const roundsLeft = roundsBeforeTimeUp(state.goal, state.round)
  const urgent = !ended && roundsLeft !== null && roundsLeft <= TIME_WARNING_ROUNDS
  const allThreats = useMemo(() => (showThreats ? enemyThreats(state) : []), [showThreats, state])
  const highlights: Highlights = showThreats
    ? { ...game.highlights, threats: [...game.highlights.threats, ...allThreats] }
    : game.highlights

  let hint = ''
  if (!ended && !game.thinking) {
    if (bonusPiece) hint = t('game.momentum', { piece: t(`pieces.${bonusPiece.type}`) })
    else if (game.mustPass) hint = t('game.noMoves')
    else if (selection.kind === 'landing') hint = t('game.chooseLanding')
    else if (selection.kind === 'inspect') hint = t('game.inspectHint')
    else if (selection.kind === 'piece') hint = t('game.chooseTarget')
    else hint = t('game.selectPiece')
  }

  return (
    <div className="game">
      <header className="game-header">
        {mode.kind === 'practice' ? (
          <button type="button" className="button-ghost" onClick={mode.onLevels}>
            ← {t('game.levels')}
          </button>
        ) : (
          <button type="button" className="button-ghost" onClick={() => setConfirmAbandon(true)}>
            ← {t('run.abandon')}
          </button>
        )}
        <div className="game-heading">
          <p className="game-level">
            {mode.kind === 'run'
              ? t('run.level', { number: levelNumber, total: mode.levelCount })
              : t('levels.number', { number: levelNumber })}
          </p>
          <h1>{t(`levels.${levelId}.name`)}</h1>
        </div>
        <div className="game-header-side">
          <p className={urgent ? 'game-round game-round--urgent' : 'game-round'}>{roundLabel(state.goal, state.round, t)}</p>
          <button
            type="button"
            className="button-ghost sound-toggle"
            aria-pressed={!muted}
            aria-label={muted ? t('game.soundOn') : t('game.soundOff')}
            onClick={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <p className="game-goal">{goalLabel(state.goal, t)}</p>

      <div className="game-body">
        <div className="board-area">
          <Board
            state={state}
            selectedId={selected?.id ?? null}
            highlights={highlights}
            lastMove={lastMove}
            hits={hits}
            hitKey={plies}
            effects={game.model.effects}
            interactive={!ended && !game.thinking}
            onCellClick={game.clickCell}
          />
        </div>

        <aside className="game-panel">
          <section
            className={ended ? `turn turn--${state.status}` : game.thinking ? 'turn turn--enemy' : 'turn'}
            aria-live="polite"
          >
            <p className="turn-status">
              {ended ? t(`end.${state.status}`) : game.thinking ? t('game.enemyTurn') : t('game.yourTurn')}
            </p>
            {hint && <p className="turn-hint">{hint}</p>}
            {!ended && enemiesCornered(state) && <p className="turn-alert">{t('game.cornered')}</p>}
            {urgent && roundsLeft !== null && (
              <p className="turn-alert">{t('game.timeWarning', { count: roundsLeft })}</p>
            )}
            {!ended && wave && (
              <p className="turn-alert">{t('game.reinforcements', { round: wave.round, count: wave.pieces.length })}</p>
            )}
            {!ended && (
              <button
                type="button"
                className="button-secondary button-toggle"
                aria-pressed={showThreats}
                onClick={() => setShowThreats((value) => !value)}
              >
                {t('game.threats')}
              </button>
            )}
            {(game.mustPass || bonusPiece) && (
              <button type="button" className="button-primary" onClick={game.pass}>
                {bonusPiece ? t('game.endTurn') : t('game.pass')}
              </button>
            )}
          </section>

          {selected && (
            <PieceCard
              piece={selected}
              isHero={selected.id === state.heroId}
              isTarget={state.goal.kind === 'capture' && state.goal.targetId === selected.id}
            />
          )}

          <section className="journal">
            <h2>{t('game.journal')}</h2>
            {log.length === 0 ? (
              <p className="muted">{t('game.journalEmpty')}</p>
            ) : (
              <ol>
                {log.map((entry) => (
                  <li key={entry.id} className={`log log--${entrySide(entry)}`}>
                    {describeEntry(entry, t)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <details className="legend">
            <summary>{t('game.legend')}</summary>
            <ul>
              {TERRAINS.map((terrain) => (
                <li key={terrain}>
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                    <TerrainTile pos={{ x: 0, y: 0 }} terrain={terrain} />
                  </svg>
                  <span>
                    <strong>{t(`terrain.${terrain}.name`)}</strong> — {t(`terrain.${terrain}.rule`)}
                  </span>
                </li>
              ))}
              <li>
                <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                  <TerrainTile pos={{ x: 0, y: 0 }} terrain="floor" />
                  <ThreatMark pos={{ x: 0, y: 0 }} />
                </svg>
                <span>
                  <strong>{t('game.threatLegend')}</strong> — {t('game.threatRule')}
                </span>
              </li>
              {state.goal.kind === 'intercept' && (
                <li>
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                    <TerrainTile pos={{ x: 0, y: 0 }} terrain="floor" />
                    <ExitMark pos={{ x: 0, y: 0 }} />
                  </svg>
                  <span>
                    <strong>{t('game.exitLegend')}</strong> — {t('game.exitRule')}
                  </span>
                </li>
              )}
              {hasPromotionPawn(state) && (
                <li>
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                    <TerrainTile pos={{ x: 0, y: 0 }} terrain="floor" />
                    <PromotionMark pos={{ x: 0, y: 0 }} forward={{ x: 0, y: -1 }} />
                  </svg>
                  <span>
                    <strong>{t('game.promotionLine')}</strong> — {t('game.promotionRule')}
                  </span>
                </li>
              )}
              {hasPromotionPawn(state, 'enemy') && (
                <li>
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                    <TerrainTile pos={{ x: 0, y: 0 }} terrain="floor" />
                    <PromotionMark pos={{ x: 0, y: 0 }} forward={{ x: 0, y: 1 }} enemy />
                  </svg>
                  <span>
                    <strong>{t('game.enemyPromotionLine')}</strong> — {t('game.enemyPromotionRule')}
                  </span>
                </li>
              )}
              {wave && (
                <li>
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
                    <TerrainTile pos={{ x: 0, y: 0 }} terrain="floor" />
                    <ReinforcementMark pos={{ x: 0, y: 0 }} round={wave.round} />
                  </svg>
                  <span>
                    <strong>{t('game.reinforcementsLegend')}</strong> — {t('game.reinforcementsRule')}
                  </span>
                </li>
              )}
            </ul>
          </details>

          {mode.kind === 'practice' && (
            <button type="button" className="button-secondary" onClick={mode.onRestart}>
              {t('game.restart')}
            </button>
          )}
        </aside>
      </div>

      {ended && state.endReason && (
        <Dialog
          title={t(`end.${state.status}`)}
          tone={state.status === 'won' ? 'won' : 'lost'}
          actions={endActions(mode, state, t)}
        >
          <p>{t(`end.reason.${state.endReason}`)}</p>
          {state.status === 'lost' && game.model.effects.fatal && (
            <p>
              {t(state.endReason === 'escaped' ? 'end.escapedBy' : 'end.fatalBy', {
                piece: `${t(`pieces.${game.model.effects.fatal.type}`)} (${t(`sides.${game.model.effects.fatal.side}`)})`,
              })}
            </p>
          )}
          {state.status === 'lost' && <p className="muted">{t(`end.tip.${state.endReason}`)}</p>}
          {mode.kind === 'practice' && state.status === 'won' && !mode.hasNext && <p>{t('game.demoComplete')}</p>}
          {mode.kind === 'run' && state.status === 'lost' && <p>{t('run.over')}</p>}
        </Dialog>
      )}

      {confirmAbandon && mode.kind === 'run' && (
        <AbandonDialog onConfirm={mode.onAbandon} onCancel={() => setConfirmAbandon(false)} />
      )}
    </div>
  )
}

/** Confirmation avant d'abandonner un run (la progression est perdue). */
export function AbandonDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog
      title={t('run.abandonTitle')}
      onDismiss={onCancel}
      actions={[
        { label: t('run.abandonCancel'), onClick: onCancel, variant: 'primary' },
        { label: t('run.abandonConfirm'), onClick: onConfirm, variant: 'danger' },
      ]}
    >
      <p>{t('run.abandonText')}</p>
    </Dialog>
  )
}

function endActions(mode: GameMode, state: GameState, t: TFunction): DialogAction[] {
  if (mode.kind === 'run') {
    const label =
      state.status === 'won' && !mode.isLastLevel ? t('run.toReward') : t('run.toSummary')
    return [{ label, onClick: () => mode.onFinished(state), variant: 'primary' }]
  }
  const actions: DialogAction[] = []
  if (state.status === 'won' && mode.hasNext) {
    actions.push({ label: t('game.next'), onClick: mode.onNext, variant: 'primary' })
  }
  actions.push({ label: t('game.restart'), onClick: mode.onRestart, variant: actions.length ? 'secondary' : 'primary' })
  actions.push({ label: t('game.levels'), onClick: mode.onLevels })
  return actions
}

function PieceCard({ piece, isHero, isTarget }: { piece: Piece; isHero: boolean; isTarget: boolean }) {
  const { t } = useTranslation()
  const powers = powerNames(piece.powers, t)
  return (
    <section className="piece-card">
      <svg viewBox="0 0 100 100" className={`piece-card-glyph piece--${piece.side}`} aria-hidden="true">
        <PieceGlyph type={piece.type} />
      </svg>
      <div>
        <h2>
          {t(`pieces.${piece.type}`)}
          {isHero && <span className="tag tag-hero">{t('game.hero')}</span>}
          {isTarget && <span className="tag tag-target">{t('game.target')}</span>}
        </h2>
        <p>
          {t('game.hp')} {piece.hp}/{piece.maxHp} · {t('game.atk')} {piece.atk}
          {piece.shieldActive && ` · ${t('a11y.shield')}`}
        </p>
        {powers.length > 0 && <p className="piece-card-powers">{powers.join(', ')}</p>}
      </div>
    </section>
  )
}

function goalLabel(goal: Goal, t: TFunction): string {
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

function roundLabel(goal: Goal, round: number, t: TFunction): string {
  const limit = roundLimit(goal)
  return limit
    ? t('game.roundOf', { round: Math.min(round, limit), total: limit })
    : t('game.round', { round })
}

function entrySide(entry: LogEntry): string {
  switch (entry.kind) {
    case 'attack':
    case 'riposte':
    case 'sweep':
      return entry.attacker.side
    case 'capture':
    case 'crush':
      return entry.target.side === 'player' ? 'enemy' : 'player'
    case 'iceSlide':
    case 'shieldBlock':
    case 'promote':
    case 'momentum':
    case 'heal':
    case 'reinforce':
      return entry.piece.side
    case 'push':
      return entry.piece.side === 'player' ? 'enemy' : 'player'
    case 'pass':
      return entry.side
  }
}

function describeEntry(entry: LogEntry, t: TFunction): string {
  const name = (label: PieceLabel) => `${t(`pieces.${label.type}`)} (${t(`sides.${label.side}`)})`
  switch (entry.kind) {
    case 'attack':
    case 'riposte':
    case 'sweep':
      return t(`log.${entry.kind}`, { attacker: name(entry.attacker), target: name(entry.target), damage: entry.damage })
    case 'crush':
      return t('log.crush', { target: name(entry.target), damage: entry.damage })
    case 'capture':
      return t('log.capture', { target: name(entry.target) })
    case 'iceSlide':
    case 'shieldBlock':
    case 'promote':
    case 'push':
    case 'momentum':
    case 'reinforce':
      return t(`log.${entry.kind}`, { piece: name(entry.piece) })
    case 'heal':
      return t('log.heal', { piece: name(entry.piece), amount: entry.amount })
    case 'pass':
      return t('log.pass', { side: t(`sides.${entry.side}`) })
  }
}
