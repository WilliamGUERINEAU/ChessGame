import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createLevel,
  createRng,
  isStandable,
  legalActions,
  parseBoard,
  pieceActions,
  posKey,
  type PieceType,
  type PowerId,
} from '../engine'
import { chooseAction } from '../engine/ai/ai'
import { MAX_ARMY } from '../run/run'
import { DEMO_LEVELS, type LevelContent } from './levels'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'

/**
 * Partie IA contre IA : l'ennemi joue avec les réglages du niveau, le joueur est
 * simulé par une IA qui anticipe 4 demi-coups et vient au contact (un humain attentif fait mieux).
 */
function selfPlay(level: LevelContent, seed: number, maxPlies = 120) {
  let state = createLevel(level.definition)
  const rng = createRng(seed)
  const survive = level.definition.goal.kind === 'survive'
  for (let ply = 0; ply < maxPlies && state.status === 'ongoing'; ply++) {
    const enemy = state.sideToMove === 'enemy'
    const action = chooseAction(
      state,
      enemy
        ? { depth: level.aiDepth, aggression: level.aiAggression, boldness: level.aiBoldness, rng }
        : // En survie, le joueur simulé garde son héros en retrait.
          { depth: 4, rng, playerApproach: survive ? 0.3 : 2, heroApproach: survive ? 0 : 0.5 },
    )
    state = applyAction(state, action).state
  }
  return state
}

describe('niveaux de démonstration', () => {
  it('tous les Pions, alliés, ennemis ou en renfort, naissent avec Promotion', () => {
    for (const level of DEMO_LEVELS) {
      const units = [...level.definition.units, ...(level.definition.reinforcements ?? []).flatMap((wave) => wave.units)]
      for (const unit of units.filter((candidate) => candidate.type === 'pawn')) {
        expect(unit.powers, `${level.id} (${unit.at.x}, ${unit.at.y})`).toContain('promotion')
      }
    }
  })

  it('les renforts arrivent hors de la zone de déploiement, sur des cases praticables', () => {
    for (const level of DEMO_LEVELS) {
      const zone = new Set(level.deployment.map(posKey))
      const state = createLevel(level.definition)
      for (const { piece } of state.reinforcements) {
        expect(zone.has(posKey(piece.pos)), `${level.id} ${piece.id}`).toBe(false)
      }
    }
  })

  it('ont des identifiants uniques', () => {
    const ids = DEMO_LEVELS.map((level) => level.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : zone de déploiement assez grande pour une armée complète, praticable et libre d’ennemis',
    (_id, level) => {
      const board = parseBoard(level.definition.terrain)
      const enemyCells = level.definition.units.filter((unit) => unit.side === 'enemy').map((unit) => posKey(unit.at))
      expect(level.deployment.length).toBeGreaterThanOrEqual(MAX_ARMY)
      for (const cell of level.deployment) {
        expect(isStandable(board, cell), `case ${posKey(cell)}`).toBe(true)
        expect(enemyCells).not.toContain(posKey(cell))
      }
    },
  )

  /** Pièces « sondes » : les plus longues portées possibles au premier coup. */
  const PROBES: ReadonlyArray<readonly [PieceType, readonly PowerId[]]> = [
    ['queen', ['forester']],
    ['knight', []],
    ['king', ['reach']],
    ['pawn', ['reach', 'forester']],
  ]

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : aucune pièce placée dans la zone ne peut attaquer dès son premier coup',
    (_id, level) => {
      const enemies = level.definition.units.filter((unit) => unit.side === 'enemy')
      // Les murs sont décoratifs : la zone doit rester sûre même sans eux.
      const withoutWalls = level.definition.terrain.map((row) => row.replaceAll('#', '.'))
      for (const terrain of [level.definition.terrain, withoutWalls])
      for (const cell of level.deployment) {
        for (const [type, powers] of PROBES) {
          const state = createLevel({
            ...level.definition,
            terrain,
            units: [...enemies, { type, side: 'player', at: cell, powers }],
            hero: cell,
            goal: { kind: 'eliminate' },
          })
          const attacks = state.pieces
            .filter((piece) => piece.side === 'player')
            .flatMap((piece) => pieceActions(state, piece.id))
            .filter((action) => action.kind === 'attack')
          expect(attacks, `${type} en ${posKey(cell)}`).toEqual([])
        }
      }
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : l’armée d’entraînement est placée dans la zone de déploiement',
    (_id, level) => {
      const zone = level.deployment.map(posKey)
      for (const unit of level.definition.units.filter((u) => u.side === 'player')) {
        expect(zone, `${unit.type} en ${posKey(unit.at)}`).toContain(posKey(unit.at))
      }
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : se crée sans erreur et le joueur peut jouer',
    (_id, level) => {
      const state = createLevel(level.definition)
      expect(state.status).toBe('ongoing')
      expect(legalActions(state).some((action) => action.kind !== 'pass')).toBe(true)
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : a un nom et une description en français et en anglais',
    (id) => {
      for (const locale of [fr, en] as const) {
        const texts = (locale.levels as Record<string, { name?: string; description?: string }>)[id]
        expect(texts?.name, `levels.${id}.name`).toBeTruthy()
        expect(texts?.description, `levels.${id}.description`).toBeTruthy()
      }
    },
  )

  it.each(DEMO_LEVELS.map((level) => [level.id, level] as const))(
    '%s : est gagnable (au moins une victoire du joueur simulé sur 10 graines)',
    (_id, level) => {
      let won = false
      for (let seed = 1; seed <= 10 && !won; seed++) won = selfPlay(level, seed).status === 'won'
      expect(won).toBe(true)
    },
    30_000,
  )
})
