import { useEffect, useState } from 'react'
import { DEMO_LEVELS } from './content/levels'
import type { ClassId } from './run/classes'
import { ClassSelect } from './ui/run/ClassSelect'
import { RunFlow } from './ui/run/RunFlow'
import { GameScreen } from './ui/screens/GameScreen'
import { Home } from './ui/screens/Home'
import { LevelSelect } from './ui/screens/LevelSelect'

type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'classSelect' }
  | { readonly name: 'run'; readonly classId: ClassId; readonly seed: number }
  | { readonly name: 'practice' }
  | { readonly name: 'practiceGame'; readonly index: number; readonly attempt: number }

/** Graine d'un nouveau run (le hasard du run en dépend entièrement). */
const newSeed = () => Math.floor(Math.random() * 2 ** 32)

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  const home = () => setScreen({ name: 'home' })

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onNewRun={() => setScreen({ name: 'classSelect' })}
          onPractice={() => setScreen({ name: 'practice' })}
        />
      )
    case 'classSelect':
      return (
        <ClassSelect
          onBack={home}
          onChoose={(classId) => setScreen({ name: 'run', classId, seed: newSeed() })}
        />
      )
    case 'run':
      return (
        <RunFlow
          // Une nouvelle graine remonte le run de zéro.
          key={screen.seed}
          classId={screen.classId}
          seed={screen.seed}
          onExit={home}
          onNewRun={() => setScreen({ name: 'classSelect' })}
        />
      )
    case 'practice':
      return (
        <LevelSelect onBack={home} onPlay={(index) => setScreen({ name: 'practiceGame', index, attempt: 0 })} />
      )
    case 'practiceGame': {
      const level = DEMO_LEVELS[screen.index]
      return (
        // La clé remonte l'écran à chaque nouvel essai : le niveau repart de zéro.
        <GameScreen
          key={`${level.id}-${screen.attempt}`}
          levelId={level.id}
          levelNumber={screen.index + 1}
          setup={{
            definition: level.definition,
            aiDepth: level.aiDepth,
            aiAggression: level.aiAggression,
            aiBoldness: level.aiBoldness,
            seedKey: `${level.id}:${screen.attempt}`,
          }}
          mode={{
            kind: 'practice',
            hasNext: screen.index + 1 < DEMO_LEVELS.length,
            onRestart: () => setScreen({ ...screen, attempt: screen.attempt + 1 }),
            onNext: () => setScreen({ name: 'practiceGame', index: screen.index + 1, attempt: 0 }),
            onLevels: () => setScreen({ name: 'practice' }),
          }}
        />
      )
    }
  }
}
