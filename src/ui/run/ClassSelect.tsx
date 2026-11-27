import { useTranslation } from 'react-i18next'
import { statsFor, type PieceType } from '../../engine'
import { CLASS_IDS, CLASSES, type ClassId } from '../../run/classes'
import { isClassUnlocked, loadProfile } from '../../run/profile'
import { PieceGlyph } from '../board/PieceGlyph'
import { powerNames } from '../powers'

export interface ClassSelectProps {
  readonly onBack: () => void
  readonly onChoose: (classId: ClassId) => void
}

export function ClassSelect({ onBack, onChoose }: ClassSelectProps) {
  const { t } = useTranslation()
  const profile = loadProfile()

  const armySummary = (types: readonly PieceType[]) =>
    [...new Set(types)]
      .map((type) => {
        const count = types.filter((candidate) => candidate === type).length
        return count > 1 ? `${t(`pieces.${type}`)} ×${count}` : t(`pieces.${type}`)
      })
      .join(', ')

  return (
    <main className="levels">
      <header className="levels-header">
        <button type="button" className="button-ghost" onClick={onBack}>
          ← {t('menu.back')}
        </button>
        <h1>{t('classes.title')}</h1>
      </header>
      <p className="muted">{t('classes.subtitle')}</p>
      <ul className="class-list">
        {CLASS_IDS.map((classId) => {
          const definition = CLASSES[classId]
          const hero = definition.hero
          const stats = statsFor(hero.type, hero.powers)
          const heroPowers = powerNames(
            hero.powers.filter((power) => power !== 'vigor' && power !== 'strength'),
            t,
          )
          const available = isClassUnlocked(profile, classId)
          return (
            <li key={classId}>
              <button
                type="button"
                className={available ? 'class-card' : 'class-card is-locked'}
                disabled={!available}
                onClick={() => onChoose(classId)}
              >
                <svg viewBox="0 0 100 100" className="class-glyph piece--player" aria-hidden="true">
                  <PieceGlyph type={hero.type} />
                </svg>
                <span className="class-text">
                  <span className="class-name">{t(`classes.${classId}.name`)}</span>
                  <span className="class-description">{t(`classes.${classId}.description`)}</span>
                  <span className="class-line">
                    <strong>{t('game.hero')} :</strong> {t(`pieces.${hero.type}`)} · {t('game.hp')} {stats.maxHp} ·{' '}
                    {t('game.atk')} {stats.atk} · {heroPowers.join(', ')}
                  </span>
                  <span className="class-line">
                    <strong>{t('classes.army')} :</strong> {armySummary(definition.army)}
                  </span>
                  {!available && <span className="class-lock">🔒 {t(`unlock.condition.${classId}`)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
