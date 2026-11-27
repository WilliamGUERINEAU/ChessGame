import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from '../../i18n'

/** Petit plateau en L : aperçu des plateaux irréguliers du jeu. */
const PREVIEW_CELLS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0],
  [0, 1], [1, 1],
  [0, 2], [1, 2], [2, 2], [3, 2],
  [0, 3], [1, 3], [2, 3], [3, 3],
]

export interface HomeProps {
  /** Niveau du run sauvegardé (à partir de 1), ou `null` s'il n'y en a pas. */
  readonly savedLevel: number | null
  readonly onContinue: () => void
  readonly onNewRun: () => void
  readonly onPractice: () => void
}

export function Home({ savedLevel, onContinue, onNewRun, onPractice }: HomeProps) {
  const { t, i18n } = useTranslation()

  return (
    <main className="home">
      <svg className="board-preview" viewBox="0 0 4 4" aria-hidden="true">
        {PREVIEW_CELLS.map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            className={(x + y) % 2 === 0 ? 'preview-light' : 'preview-dark'}
          />
        ))}
      </svg>
      <h1>{t('app.title')}</h1>
      <p className="tagline">{t('app.tagline')}</p>

      <nav className="menu">
        {savedLevel !== null && (
          <button type="button" className="button-primary" onClick={onContinue}>
            {t('menu.continue', { number: savedLevel })}
          </button>
        )}
        <button type="button" className={savedLevel !== null ? 'button-secondary' : 'button-primary'} onClick={onNewRun}>
          {t('menu.newRun')}
        </button>
        <button type="button" className="button-secondary" onClick={onPractice}>
          {t('menu.practice')}
        </button>
      </nav>

      <label className="language">
        {t('settings.language')}
        <select value={i18n.resolvedLanguage} onChange={(e) => setLanguage(e.target.value as Language)}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <p className="muted small">{t('menu.demoNotice')}</p>
    </main>
  )
}
