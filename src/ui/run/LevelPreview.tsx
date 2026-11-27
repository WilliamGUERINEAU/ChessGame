import { useTranslation } from 'react-i18next'
import { boardCells, parseBoard, posKey, terrainAt, type Terrain } from '../../engine'
import type { LevelContent } from '../../content/levels'
import { ExitMark } from '../board/Board'
import { PieceGlyph } from '../board/PieceGlyph'
import { CELL, TerrainTile } from '../board/TerrainTile'
import { goalSummary } from '../game/goalText'

/**
 * Aperçu du niveau suivant : plateau, ennemis (renforts compris), zone de déploiement,
 * objectif et terrains. Le joueur choisit sa récompense en connaissance de cause.
 */
export function LevelPreview({ level }: { level: LevelContent }) {
  const { t } = useTranslation()
  const { definition } = level
  const board = parseBoard(definition.terrain)
  const cells = boardCells(board)
  const enemies = definition.units.filter((unit) => unit.side === 'enemy')
  const reinforcements = (definition.reinforcements ?? []).flatMap((wave) => wave.units).filter((u) => u.side === 'enemy')
  const terrains = [...new Set(cells.map((p) => terrainAt(board, p)).filter((x): x is Terrain => x !== null && x !== 'floor'))]
  const zone = new Set(level.deployment.map(posKey))
  const exits = definition.goal.kind === 'intercept' ? definition.goal.exits : []

  return (
    <section className="level-preview" aria-label={t('run.nextLevel')}>
      <h2>
        {t('run.nextLevel')} : {t(`levels.${level.id}.name`)}
      </h2>
      <div className="level-preview-body">
        <svg className="level-preview-board" viewBox={`0 0 ${board.width * CELL} ${board.height * CELL}`} aria-hidden="true">
          {cells.map((p) => (
            <TerrainTile key={posKey(p)} pos={p} terrain={terrainAt(board, p) ?? 'floor'} />
          ))}
          {cells
            .filter((p) => zone.has(posKey(p)))
            .map((p) => (
              <rect key={`zone-${posKey(p)}`} className="mark-zone" x={p.x * CELL} y={p.y * CELL} width={CELL} height={CELL} />
            ))}
          {exits.map((p) => (
            <ExitMark key={`exit-${posKey(p)}`} pos={p} />
          ))}
          {enemies.map((unit) => (
            <g key={posKey(unit.at)} className="piece--enemy" transform={`translate(${unit.at.x * CELL + 16} ${unit.at.y * CELL + 12}) scale(0.68)`}>
              <PieceGlyph type={unit.type} />
            </g>
          ))}
        </svg>
        <ul className="level-preview-facts">
          <li>{goalSummary(definition.goal, t)}</li>
          <li>{t('run.previewEnemies', { count: enemies.length })}</li>
          {reinforcements.length > 0 && <li>{t('run.previewReinforcements', { count: reinforcements.length })}</li>}
          <li>
            {terrains.length > 0
              ? t('run.previewTerrains', { terrains: terrains.map((terrain) => t(`terrain.${terrain}.name`)).join(', ') })
              : t('run.previewNoTerrain')}
          </li>
        </ul>
      </div>
    </section>
  )
}
