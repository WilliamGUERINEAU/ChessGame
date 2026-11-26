import { useMemo, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  boardCells,
  findPiece,
  pieceAt,
  posKey,
  terrainAt,
  type GameState,
  type Piece,
  type Pos,
} from '../../engine'
import type { Highlights } from '../game/interaction'
import { PieceGlyph } from './PieceGlyph'
import { CELL, TerrainTile } from './TerrainTile'

export interface BoardProps {
  readonly state: GameState
  readonly selectedId: string | null
  readonly highlights: Highlights
  readonly lastMove: { readonly from: Pos; readonly to: Pos } | null
  /** Pièces touchées par la dernière action. */
  readonly hits: readonly string[]
  /** Change à chaque action : relance l'effet de coup reçu. */
  readonly hitKey: number
  /** Le joueur peut agir (c'est son tour). */
  readonly interactive: boolean
  readonly onCellClick: (pos: Pos) => void
  /** Zone de déploiement à mettre en évidence (écran de placement). */
  readonly zone?: readonly Pos[]
}

type CellRole = 'move' | 'attack' | 'landing' | 'deploy'

export function Board({
  state,
  selectedId,
  highlights,
  lastMove,
  hits,
  hitKey,
  interactive,
  onCellClick,
  zone = [],
}: BoardProps) {
  const { t } = useTranslation()
  const { board } = state
  const cells = useMemo(() => boardCells(board), [board])

  const roles = new Map<string, CellRole>()
  for (const p of zone) roles.set(posKey(p), 'deploy')
  for (const p of highlights.moves) roles.set(posKey(p), 'move')
  for (const p of highlights.landings) roles.set(posKey(p), 'landing')
  for (const p of highlights.attacks) roles.set(posKey(p), 'attack')

  const selected = selectedId ? findPiece(state, selectedId) : undefined
  const targetId = state.goal.kind === 'capture' ? state.goal.targetId : null
  const coordinate = (p: Pos) => `${String.fromCharCode(97 + p.x)}${board.height - p.y}`

  const describe = (p: Pos, piece: Piece | undefined, role: CellRole | undefined) => {
    const terrain = terrainAt(board, p) ?? 'floor'
    const parts = [t('a11y.cell', { coord: coordinate(p), terrain: t(`terrain.${terrain}.name`) })]
    if (piece) {
      parts.push(
        t('a11y.piece', {
          piece: t(`pieces.${piece.type}`),
          side: t(`sides.${piece.side}`),
          hp: piece.hp,
          maxHp: piece.maxHp,
          atk: piece.atk,
        }),
      )
      if (piece.shieldActive) parts.push(t('a11y.shield'))
    }
    if (role) parts.push(t(`a11y.${role}`))
    return parts.join(', ')
  }

  const onKey = (event: KeyboardEvent, p: Pos) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCellClick(p)
    }
  }

  return (
    <svg
      className="board"
      viewBox={`0 0 ${board.width * CELL} ${board.height * CELL}`}
      aria-label={t('a11y.board')}
    >
      <g>
        {cells.map((p) => (
          <TerrainTile key={posKey(p)} pos={p} terrain={terrainAt(board, p) ?? 'floor'} />
        ))}
      </g>

      <g className="marks" aria-hidden="true">
        {zone.map((p) => (
          <rect key={`zone-${posKey(p)}`} className="mark-zone" x={p.x * CELL} y={p.y * CELL} width={CELL} height={CELL} />
        ))}
        {lastMove &&
          [lastMove.from, lastMove.to].map((p, i) => (
            <rect key={`last-${i}`} className="mark-last" x={p.x * CELL} y={p.y * CELL} width={CELL} height={CELL} />
          ))}
        {selected && (
          <rect
            className="mark-selected"
            x={selected.pos.x * CELL + 4}
            y={selected.pos.y * CELL + 4}
            width={CELL - 8}
            height={CELL - 8}
            rx="12"
          />
        )}
        {highlights.landings.map((p) => (
          <rect
            key={`land-${posKey(p)}`}
            className="mark-landing"
            x={p.x * CELL + 8}
            y={p.y * CELL + 8}
            width={CELL - 16}
            height={CELL - 16}
            rx="12"
          />
        ))}
        {highlights.moves.map((p) => (
          <circle key={`move-${posKey(p)}`} className="mark-move" cx={p.x * CELL + CELL / 2} cy={p.y * CELL + CELL / 2} r="13" />
        ))}
        {highlights.attacks.map((p) => (
          <rect
            key={`atk-${posKey(p)}`}
            className="mark-attack"
            x={p.x * CELL + 5}
            y={p.y * CELL + 5}
            width={CELL - 10}
            height={CELL - 10}
            rx="14"
          />
        ))}
      </g>

      <g className="pieces" aria-hidden="true">
        {state.pieces.map((piece) => (
          <PieceView
            key={piece.id}
            piece={piece}
            isHero={piece.id === state.heroId}
            isTarget={piece.id === targetId}
            hitKey={hits.includes(piece.id) ? hitKey : null}
          />
        ))}
      </g>

      <g className="hit-areas">
        {cells.map((p) => {
          const key = posKey(p)
          const piece = pieceAt(state, p)
          const role = roles.get(key)
          const actionable = interactive && (role !== undefined || piece?.side === 'player')
          return (
            <rect
              key={key}
              className={actionable ? 'cell-hit is-actionable' : 'cell-hit'}
              x={p.x * CELL}
              y={p.y * CELL}
              width={CELL}
              height={CELL}
              role="button"
              tabIndex={actionable ? 0 : -1}
              aria-disabled={!actionable}
              aria-label={describe(p, piece, role)}
              data-x={p.x}
              data-y={p.y}
              data-role={role}
              data-side={piece?.side}
              onClick={() => onCellClick(p)}
              onKeyDown={(event) => onKey(event, p)}
            />
          )
        })}
      </g>
    </svg>
  )
}

interface PieceViewProps {
  readonly piece: Piece
  readonly isHero: boolean
  readonly isTarget: boolean
  /** Non nul quand la pièce vient d'être touchée ; change à chaque coup pour relancer l'effet. */
  readonly hitKey: number | null
}

function PieceView({ piece, isHero, isTarget, hitKey }: PieceViewProps) {
  return (
    <g
      className={`piece piece--${piece.side}`}
      style={{ transform: `translate(${piece.pos.x * CELL}px, ${piece.pos.y * CELL}px)` }}
      data-piece={piece.id}
    >
      {hitKey !== null && <rect key={hitKey} className="hit-flash" x="4" y="4" width={CELL - 8} height={CELL - 8} rx="12" />}
      <g transform="translate(16 5) scale(0.68)">
        <PieceGlyph type={piece.type} />
      </g>
      {isHero && (
        <path className="badge-hero" d="M6 24 L8 9 L14 15 L18 6 L22 15 L28 9 L30 24 Z" />
      )}
      {piece.shieldActive && (
        <path className="badge-shield" d="M6 40 L16 36 L26 40 V50 C26 57 21 61 16 63 C11 61 6 57 6 50 Z" />
      )}
      {isTarget && (
        <g className="badge-target">
          <circle cx="18" cy="16" r="10" />
          <path d="M18 2 V10 M18 22 V30 M4 16 H12 M24 16 H32" />
        </g>
      )}
      <g className="badge-atk">
        <circle cx="84" cy="16" r="13" />
        <text x="84" y="22" textAnchor="middle">
          {piece.atk}
        </text>
      </g>
      <HpBar hp={piece.hp} maxHp={piece.maxHp} />
    </g>
  )
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  if (maxHp > 6) {
    return (
      <g className="hp-text">
        <rect x="22" y="76" width="56" height="17" rx="8" />
        <text x="50" y="89" textAnchor="middle">
          {hp}/{maxHp}
        </text>
      </g>
    )
  }
  const width = 60
  const gap = 3
  const segment = (width - gap * (maxHp - 1)) / maxHp
  return (
    <g>
      {Array.from({ length: maxHp }, (_, i) => (
        <rect
          key={i}
          className={i < hp ? 'hp-full' : 'hp-empty'}
          x={20 + i * (segment + gap)}
          y="80"
          width={segment}
          height="9"
          rx="2.5"
        />
      ))}
    </g>
  )
}
