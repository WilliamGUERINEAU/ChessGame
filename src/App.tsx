import { useEffect, useState } from 'react'
import { DEMO_LEVELS } from './content/levels'
import { GameScreen } from './ui/screens/GameScreen'
import { Home } from './ui/screens/Home'
import { LevelSelect } from './ui/screens/LevelSelect'

type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'levels' }
  | { readonly name: 'game'; readonly index: number; readonly attempt: number }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onNewRun={() => setScreen({ name: 'game', index: 0, attempt: 0 })}
          onChooseLevel={() => setScreen({ name: 'levels' })}
        />
      )
    case 'levels':
      return (
        <LevelSelect
          onBack={() => setScreen({ name: 'home' })}
          onPlay={(index) => setScreen({ name: 'game', index, attempt: 0 })}
        />
      )
    case 'game': {
      const level = DEMO_LEVELS[screen.index]
      return (
        // La clé remonte l'écran à chaque nouvel essai : le niveau repart de zéro.
        <GameScreen
          key={`${level.id}-${screen.attempt}`}
          level={level}
          levelNumber={screen.index + 1}
          attempt={screen.attempt}
          hasNext={screen.index + 1 < DEMO_LEVELS.length}
          onRestart={() => setScreen({ ...screen, attempt: screen.attempt + 1 })}
          onNext={() => setScreen({ name: 'game', index: screen.index + 1, attempt: 0 })}
          onLevels={() => setScreen({ name: 'levels' })}
        />
      )
    }
  }
}
