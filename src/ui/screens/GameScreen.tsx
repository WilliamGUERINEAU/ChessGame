import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { findPiece, type Goal, type Piece, type Terrain } from '../../engine'
import type { LevelContent } from '../../content/levels'
import { Board } from '../board/Board'
import { PieceGlyph } from '../board/PieceGlyph'
import { CELL, TerrainTile } from '../board/TerrainTile'
import type { LogEntry, PieceLabel } from '../game/interaction'
import { useGame } from '../game/useGame'
import { EndDialog } from './EndDialog'

export interface GameScreenProps {
  readonly level: LevelContent
  /** Numéro du niveau, à partir de 1. */
  readonly levelNumber: number
  readonly attempt: number
  readonly hasNext: boolean
  readonly onRestart: () => void
  readonly onNext: () => void
  readonly onLevels: () => void
}

const TERRAINS: readonly Terrain[] = ['floor', 'forest', 'water', 'wall', 'ice']

export function GameScreen({ level, levelNumber, attempt, hasNext, onRestart, onNext, onLevels }: GameScreenProps) {
  const { t } = useTranslation()
  const game = useGame(level, attempt)
  const { state, selection, log, lastMove, hits, plies } = game.model
  const ended = state.status !== 'ongoing'
  const selected = selection.kind === 'none' ? undefined : findPiece(state, selection.pieceId)

  let hint = ''
  if (!ended && !game.thinking) {
    if (game.mustPass) hint = t('game.noMoves')
    else if (selection.kind === 'landing') hint = t('game.chooseLanding')
    else if (selection.kind === 'piece') hint = t('game.chooseTarget')
    else hint = t('game.selectPiece')
  }

  return (
    <div className="game">
      <header className="game-header">
        <button type="button" className="button-ghost" onClick={onLevels}>
          ← {t('game.levels')}
        </button>
        <div className="game-heading">
          <p className="game-level">{t('levels.number', { number: levelNumber })}</p>
          <h1>{t(`levels.${level.id}.name`)}</h1>
        </div>
        <p className="game-round">{roundLabel(state.goal, state.round, t)}</p>
      </header>

      <p className="game-goal">{goalLabel(state.goal, t)}</p>

      <div className="game-body">
        <div className="board-area">
          <Board
            state={state}
            selectedId={selected?.id ?? null}
            highlights={game.highlights}
            lastMove={lastMove}
            hits={hits}
            hitKey={plies}
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
            {game.mustPass && (
              <button type="button" className="button-primary" onClick={game.pass}>
                {t('game.pass')}
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
            </ul>
          </details>

          <button type="button" className="button-secondary" onClick={onRestart}>
            {t('game.restart')}
          </button>
        </aside>
      </div>

      {ended && state.endReason && (
        <EndDialog
          status={state.status === 'won' ? 'won' : 'lost'}
          reason={state.endReason}
          hasNext={hasNext}
          onNext={onNext}
          onRestart={onRestart}
          onLevels={onLevels}
        />
      )}
    </div>
  )
}

function PieceCard({ piece, isHero, isTarget }: { piece: Piece; isHero: boolean; isTarget: boolean }) {
  const { t } = useTranslation()
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
        </p>
      </div>
    </section>
  )
}

function goalLabel(goal: Goal, t: TFunction): string {
  switch (goal.kind) {
    case 'eliminate':
      return t('goal.eliminate')
    case 'survive':
      return t('goal.survive', { rounds: goal.rounds })
    case 'capture':
      return goal.maxRounds ? t('goal.captureLimited', { rounds: goal.maxRounds }) : t('goal.capture')
  }
}

function roundLabel(goal: Goal, round: number, t: TFunction): string {
  const limit = goal.kind === 'survive' ? goal.rounds : goal.kind === 'capture' ? goal.maxRounds : undefined
  return limit
    ? t('game.roundOf', { round: Math.min(round, limit), total: limit })
    : t('game.round', { round })
}

function entrySide(entry: LogEntry): string {
  switch (entry.kind) {
    case 'attack':
      return entry.attacker.side
    case 'capture':
      return entry.target.side === 'player' ? 'enemy' : 'player'
    case 'iceSlide':
      return entry.piece.side
    case 'pass':
      return entry.side
  }
}

function describeEntry(entry: LogEntry, t: TFunction): string {
  const name = (label: PieceLabel) => `${t(`pieces.${label.type}`)} (${t(`sides.${label.side}`)})`
  switch (entry.kind) {
    case 'attack':
      return t('log.attack', { attacker: name(entry.attacker), target: name(entry.target), damage: entry.damage })
    case 'capture':
      return t('log.capture', { target: name(entry.target) })
    case 'iceSlide':
      return t('log.iceSlide', { piece: name(entry.piece) })
    case 'pass':
      return t('log.pass', { side: t(`sides.${entry.side}`) })
  }
}
