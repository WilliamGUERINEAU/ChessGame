import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEMO_LEVELS } from '../../content/levels'
import type { ClassId } from '../../run/classes'
import { autoDeploy, battleDefinition, playerForward, type Placement } from '../../run/deploy'
import { applyReward, beginBattle, finishBattle, startRun, type RunState } from '../../run/run'
import { clearRun, saveRun, type SavedRun } from '../../run/save'
import type { GameState } from '../../engine'
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
  /** Run sauvegardé à reprendre (sinon un nouveau run commence). */
  readonly resume?: SavedRun
}

const LEVELS = DEMO_LEVELS

function defaultPlacement(run: RunState): Placement {
  const level = LEVELS[run.levelIndex]
  return autoDeploy(run.army, run.heroId, level.deployment, playerForward(level))
}

/** Déroulement d'un run : déploiement → combat → récompense → … → bilan. */
export function RunFlow({ classId, seed, onExit, onNewRun, resume }: RunFlowProps) {
  const [run, setRun] = useState(() => resume?.run ?? startRun(classId, seed, LEVELS.length))
  const [placement, setPlacement] = useState(() => resume?.placement ?? defaultPlacement(run))
  const [battle, setBattle] = useState<SavedRun['battle']>(() => resume?.battle ?? null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)

  // Sauvegarde automatique ; un run terminé n'est plus à reprendre.
  useEffect(() => {
    if (run.phase === 'won' || run.phase === 'lost') clearRun()
    else saveRun({ version: 1, run, placement, battle: run.phase === 'battle' ? battle : null })
  }, [run, placement, battle])

  const onProgress = useCallback((state: GameState, plies: number) => {
    // Même un combat terminé est sauvegardé : recharger la page ne permet pas d'annuler une défaite.
    setBattle({ state, plies })
  }, [])

  const abandonRun = () => {
    clearRun()
    onExit()
  }
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
      aiBoldness: level.aiBoldness,
      seedKey: `run:${seed}:${run.levelIndex}`,
      // Reprise : seulement pour le combat sauvegardé de ce niveau.
      ...(resume?.battle && resume.run.levelIndex === run.levelIndex && resume.run.phase === 'battle'
        ? { resume: resume.battle }
        : {}),
    }),
    [level, run, placement, seed, resume],
  )

  const abandon = confirmAbandon && (
    <AbandonDialog onConfirm={abandonRun} onCancel={() => setConfirmAbandon(false)} />
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
            onStart={() => {
              setBattle(null)
              setRun(beginBattle(run))
            }}
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
            onFinished: (state) => {
              setBattle(null)
              setRun(finishBattle(run, state))
            },
            onAbandon: abandonRun,
            onProgress,
          }}
        />
      )
    case 'reward':
      return (
        <>
          <RewardScreen
            run={run}
            nextLevel={LEVELS[Math.min(run.levelIndex + 1, LEVELS.length - 1)]}
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
