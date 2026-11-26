import { useEffect, useMemo, useState } from 'react'
import { DEMO_LEVELS } from '../../content/levels'
import type { ClassId } from '../../run/classes'
import { autoDeploy, battleDefinition, playerForward, type Placement } from '../../run/deploy'
import { applyReward, beginBattle, finishBattle, startRun, type RunState } from '../../run/run'
import type { BattleSetup } from '../game/useGame'
import { AbandonDialog, GameScreen } from '../screens/GameScreen'
import { DeployScreen } from './DeployScreen'
import { RewardScreen } from './RewardScreen'
import { RunSummary } from './RunSummary'

export interface RunFlowProps {
  readonly classId: ClassId
  readonly seed: number
  /** Retour à l'accueil (run abandonné ou terminé). */
  readonly onExit: () => void
  readonly onNewRun: () => void
}

const LEVELS = DEMO_LEVELS

function defaultPlacement(run: RunState): Placement {
  const level = LEVELS[run.levelIndex]
  return autoDeploy(run.army, run.heroId, level.deployment, playerForward(level))
}

/** Déroulement d'un run : déploiement → combat → récompense → … → bilan. */
export function RunFlow({ classId, seed, onExit, onNewRun }: RunFlowProps) {
  const [run, setRun] = useState(() => startRun(classId, seed, LEVELS.length))
  const [placement, setPlacement] = useState(() => defaultPlacement(run))
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const level = LEVELS[Math.min(run.levelIndex, LEVELS.length - 1)]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [run.phase, run.levelIndex])

  // Le combat est construit au lancement : useGame ne lit sa définition qu'une fois.
  const setup: BattleSetup = useMemo(
    () => ({
      definition: battleDefinition(level, run, placement),
      aiDepth: level.aiDepth,
      aiAggression: level.aiAggression,
      seedKey: `run:${seed}:${run.levelIndex}`,
    }),
    [level, run, placement, seed],
  )

  const abandon = confirmAbandon && (
    <AbandonDialog onConfirm={onExit} onCancel={() => setConfirmAbandon(false)} />
  )

  switch (run.phase) {
    case 'deploy':
      return (
        <>
          <DeployScreen
            level={level}
            run={run}
            placement={placement}
            onPlacementChange={setPlacement}
            onStart={() => setRun(beginBattle(run))}
            onAbandon={() => setConfirmAbandon(true)}
          />
          {abandon}
        </>
      )
    case 'battle':
      return (
        <GameScreen
          key={`battle-${run.levelIndex}`}
          levelId={level.id}
          levelNumber={run.levelIndex + 1}
          setup={setup}
          mode={{
            kind: 'run',
            levelCount: run.levelCount,
            isLastLevel: run.levelIndex + 1 >= run.levelCount,
            onFinished: (state) => setRun(finishBattle(run, state)),
            onAbandon: onExit,
          }}
        />
      )
    case 'reward':
      return (
        <>
          <RewardScreen
            run={run}
            onConfirm={(option, targetId) => {
              const next = applyReward(run, option, targetId)
              setRun(next)
              setPlacement(defaultPlacement(next))
            }}
            onAbandon={() => setConfirmAbandon(true)}
          />
          {abandon}
        </>
      )
    case 'won':
    case 'lost':
      return <RunSummary run={run} onNewRun={onNewRun} onMenu={onExit} />
  }
}
