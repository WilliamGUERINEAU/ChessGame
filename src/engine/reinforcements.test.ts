import { describe, expect, it } from 'vitest'
import { applyAction } from './apply'
import type { Action } from './moves'
import type { Side } from './pieces/pieces'
import { createLevel, findPiece, type LevelDefinition, type UnitSpec } from './state'

const unit = (type: UnitSpec['type'], side: Side, x: number, y: number, id?: string): UnitSpec => ({
  type,
  side,
  at: { x, y },
  ...(id ? { id } : {}),
})
const move = (pieceId: string, x: number, y: number): Action => ({ kind: 'move', pieceId, to: { x, y } })

function level(units: UnitSpec[], extra: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    terrain: ['.....', '.....', '.....'],
    units,
    hero: { x: 0, y: 2 },
    forward: { player: 'up', enemy: 'down' },
    goal: { kind: 'eliminate' },
    reinforcements: [{ round: 2, units: [unit('rook', 'enemy', 4, 0, 'reinforcement')] }],
    ...extra,
  }
}

describe('Renforts', () => {
  it('arrivent au début du tour prévu, pas avant', () => {
    const waves = [
      { round: 3, units: [unit('bishop', 'enemy', 4, 2, 'later')] },
      { round: 2, units: [unit('rook', 'enemy', 4, 0, 'reinforcement')] },
    ]
    let state = createLevel(
      level([unit('king', 'player', 0, 2, 'hero'), unit('knight', 'enemy', 2, 0, 'n')], { reinforcements: waves }),
    )
    expect(findPiece(state, 'reinforcement')).toBeUndefined()
    state = applyAction(state, move('hero', 0, 1)).state
    expect(findPiece(state, 'reinforcement')).toBeUndefined()
    const { state: after, events } = applyAction(state, move('n', 3, 2))
    expect(after.round).toBe(2)
    expect(events).toContainEqual({ type: 'reinforce', pieceId: 'reinforcement', at: { x: 4, y: 0 } })
    expect(findPiece(after, 'reinforcement')).toMatchObject({ side: 'enemy', type: 'rook', pos: { x: 4, y: 0 } })
    // La vague du tour 3 attend encore.
    expect(findPiece(after, 'later')).toBeUndefined()
    expect(after.reinforcements.map((r) => r.piece.id)).toEqual(['later'])
  })

  it('attendent que leur case se libère', () => {
    let state = createLevel(
      level([unit('king', 'player', 0, 2, 'hero'), unit('rook', 'player', 4, 0, 'R'), unit('knight', 'enemy', 2, 2, 'n')]),
    )
    state = applyAction(state, move('hero', 0, 1)).state
    state = applyAction(state, move('n', 1, 0)).state
    expect(state.round).toBe(2)
    expect(findPiece(state, 'reinforcement')).toBeUndefined()
    expect(state.reinforcements).toHaveLength(1)

    state = applyAction(state, move('R', 4, 2)).state
    state = applyAction(state, move('n', 3, 1)).state
    expect(state.round).toBe(3)
    expect(findPiece(state, 'reinforcement')?.pos).toEqual({ x: 4, y: 0 })
  })

  it('comptent comme des ennemis restants : pas de victoire tant qu’ils sont attendus', () => {
    let state = createLevel(
      level([unit('king', 'player', 0, 2, 'hero'), unit('rook', 'player', 0, 0, 'R'), unit('pawn', 'enemy', 3, 0, 'p')]),
    )
    state = applyAction(state, { kind: 'attack', pieceId: 'R', target: { x: 3, y: 0 } }).state
    expect(findPiece(state, 'p')).toBeUndefined()
    expect(state.status).toBe('ongoing')
    // L'ennemi, sans pièce, passe : les renforts arrivent.
    state = applyAction(state, { kind: 'pass' }).state
    expect(state.status).toBe('ongoing')
    expect(findPiece(state, 'reinforcement')).toBeDefined()
  })

  it('sont validés à la création du niveau', () => {
    const base = [unit('king', 'player', 0, 2, 'hero'), unit('pawn', 'enemy', 3, 0)]
    const wave = (round: number, units: UnitSpec[]) => level(base, { reinforcements: [{ round, units }] })
    expect(() => createLevel(wave(1, [unit('rook', 'enemy', 4, 0)]))).toThrow(/Tour de renforts/)
    expect(() => createLevel(wave(2, [unit('rook', 'enemy', 9, 0)]))).toThrow(/case impossible/)
    expect(() => createLevel(wave(2, [unit('rook', 'enemy', 4, 0, 'hero')]))).toThrow(/en double/)
    // Sans identifiant, les renforts reçoivent les suivants de la série ennemie.
    expect(createLevel(wave(2, [unit('rook', 'enemy', 4, 0)])).reinforcements[0].piece.id).toBe('e2')
  })
})
