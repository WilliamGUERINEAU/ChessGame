import { useTranslation } from 'react-i18next'
import { statsFor } from '../../engine'
import type { ArmyPiece } from '../../run/run'
import { PieceGlyph } from '../board/PieceGlyph'
import { powerNames } from '../powers'

export interface ArmyListProps {
  readonly army: readonly ArmyPiece[]
  readonly heroId: string
  readonly selectedId?: string | null
  /** Pièces sélectionnables (toutes par défaut quand `onSelect` est fourni). */
  readonly isEnabled?: (piece: ArmyPiece) => boolean
  readonly onSelect?: (pieceId: string) => void
}

/** L'armée du run : chaque pièce avec ses PV, son ATK et ses pouvoirs. */
export function ArmyList({ army, heroId, selectedId = null, isEnabled, onSelect }: ArmyListProps) {
  const { t } = useTranslation()
  return (
    <ul className="army-list">
      {army.map((piece) => {
        const { maxHp, atk } = statsFor(piece.type, piece.powers)
        const powers = powerNames(piece.powers, t)
        const content = (
          <>
            <svg viewBox="0 0 100 100" className="army-glyph piece--player" aria-hidden="true">
              <PieceGlyph type={piece.type} />
            </svg>
            <span className="army-text">
              <span className="army-name">
                {t(`pieces.${piece.type}`)}
                {piece.id === heroId && <span className="tag tag-hero">{t('game.hero')}</span>}
              </span>
              <span className="army-stats">
                {t('game.hp')} {maxHp} · {t('game.atk')} {atk}
              </span>
              <span className="army-powers">{powers.length > 0 ? powers.join(', ') : t('run.noPowers')}</span>
            </span>
          </>
        )
        if (!onSelect) {
          return (
            <li key={piece.id} className="army-item">
              {content}
            </li>
          )
        }
        const enabled = isEnabled ? isEnabled(piece) : true
        return (
          <li key={piece.id}>
            <button
              type="button"
              className={piece.id === selectedId ? 'army-item is-selected' : 'army-item'}
              aria-pressed={piece.id === selectedId}
              disabled={!enabled}
              onClick={() => onSelect(piece.id)}
            >
              {content}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
