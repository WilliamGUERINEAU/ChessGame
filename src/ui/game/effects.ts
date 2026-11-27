import type { GameEvent, GameState, Piece, PieceType, Pos, Side } from '../../engine'

/** Pièce capturée pendant la dernière action, dessinée le temps de disparaître. */
export interface Ghost {
  readonly piece: Piece
}

/** Nombre flottant au-dessus d'une case : dégâts (−2), soin (+1) ou coup bloqué (0). */
export interface FloatText {
  readonly pos: Pos
  readonly text: string
  readonly kind: 'damage' | 'heal' | 'block'
}

/** Son à jouer pour une action, du plus marquant au plus discret. */
export type SoundCue = 'win' | 'lose' | 'capture' | 'hit' | 'promote' | 'reinforce' | 'move' | null

export interface ActionEffects {
  readonly ghosts: readonly Ghost[]
  readonly floats: readonly FloatText[]
  readonly sound: SoundCue
  /** Défaite : la pièce qui a porté le coup fatal au héros, ou qui a atteint une sortie. */
  readonly fatal: { readonly type: PieceType; readonly side: Side } | null
}

/** Effets visuels et sonores d'une action, d'après ses événements. */
export function effectsFor(before: GameState, after: GameState, events: readonly GameEvent[]): ActionEffects {
  const posOf = (id: string): Pos | undefined =>
    after.pieces.find((piece) => piece.id === id)?.pos ?? before.pieces.find((piece) => piece.id === id)?.pos
  const ghosts: Ghost[] = []
  const floats: FloatText[] = []
  for (const event of events) {
    switch (event.type) {
      case 'capture': {
        const piece = before.pieces.find((candidate) => candidate.id === event.pieceId)
        if (piece) ghosts.push({ piece })
        break
      }
      case 'attack':
      case 'riposte':
      case 'sweep':
      case 'crush': {
        const pos = posOf(event.targetId)
        if (pos && event.damage > 0) floats.push({ pos, text: `−${event.damage}`, kind: 'damage' })
        break
      }
      case 'shieldBlock': {
        const pos = posOf(event.pieceId)
        if (pos) floats.push({ pos, text: '0', kind: 'block' })
        break
      }
      case 'heal': {
        const pos = posOf(event.pieceId)
        if (pos) floats.push({ pos, text: `+${event.amount}`, kind: 'heal' })
        break
      }
      default:
        break
    }
  }
  return { ghosts, floats, sound: soundFor(events), fatal: fatalFor(before, after, events) }
}

function fatalFor(before: GameState, after: GameState, events: readonly GameEvent[]): ActionEffects['fatal'] {
  const label = (id: string) => {
    const piece = after.pieces.find((candidate) => candidate.id === id) ?? before.pieces.find((candidate) => candidate.id === id)
    return piece ? { type: piece.type, side: piece.side } : null
  }
  if (after.endReason === 'heroDied') {
    const blow = events.find((event) => event.type === 'capture' && event.pieceId === before.heroId)
    return blow && blow.type === 'capture' ? label(blow.byId) : null
  }
  if (after.endReason === 'escaped' && after.goal.kind === 'intercept') {
    const exits = after.goal.exits
    const runner = after.pieces.find(
      (piece) => piece.side === 'enemy' && exits.some((exit) => exit.x === piece.pos.x && exit.y === piece.pos.y),
    )
    return runner ? { type: runner.type, side: runner.side } : null
  }
  return null
}

function soundFor(events: readonly GameEvent[]): SoundCue {
  const has = (type: GameEvent['type']) => events.some((event) => event.type === type)
  const end = events.find((event) => event.type === 'end')
  if (end && end.type === 'end') return end.status === 'won' ? 'win' : 'lose'
  if (has('capture')) return 'capture'
  if (has('attack') || has('riposte') || has('sweep') || has('crush') || has('shieldBlock')) return 'hit'
  if (has('promote')) return 'promote'
  if (has('reinforce')) return 'reinforce'
  if (has('move') || has('iceSlide')) return 'move'
  return null
}
