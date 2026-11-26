import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from './i18n'
import './App.css'

/** Petit plateau en L : aperçu des plateaux irréguliers du jeu. */
const PREVIEW_CELLS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0],
  [0, 1], [1, 1],
  [0, 2], [1, 2], [2, 2], [3, 2],
  [0, 3], [1, 3], [2, 3], [3, 3],
]

function BoardPreview() {
  return (
    <svg className="board-preview" viewBox="0 0 4 4" aria-hidden="true">
      {PREVIEW_CELLS.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          className={(x + y) % 2 === 0 ? 'cell-light' : 'cell-dark'}
        />
      ))}
    </svg>
  )
}

export default function App() {
  const { t, i18n } = useTranslation()

  return (
    <main className="home">
      <BoardPreview />
      <h1>{t('app.title')}</h1>
      <p className="tagline">{t('app.tagline')}</p>

      <nav className="menu">
        <button type="button" disabled title={t('menu.comingSoon')}>
          {t('menu.newRun')}
        </button>
      </nav>

      <label className="language">
        {t('settings.language')}
        <select
          value={i18n.resolvedLanguage}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
    </main>
  )
}
