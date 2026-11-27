import {
  pieceActions,
  pieceAt,
  posKey,
  samePos,
  type Action,
  type GameEvent,
  type GameState,
  type PieceType,
  type Pos,
  type Side,
} from '../../engine'

/** Ce que le joueur a sélectionné sur le plateau. */
export type Selection =
  | { readonly kind: 'none' }
  | { readonly kind: 'piece'; readonly pieceId: string }
  /** Attaque choisie dont la cible survit : reste à choisir la case d'atterrissage. */
  | {
      readonly kind: 'landing'
      readonly pieceId: string
      readonly target: Pos
      readonly options: readonly Pos[]
    }

export const NO_SELECTION: Selection = { kind: 'none' }

export type ClickResult =
  | { readonly kind: 'select'; readonly selection: Selection }
  | { readonly kind: 'play'; readonly action: Action }

/** Ce que déclenche un clic sur une case pendant le tour du joueur. */
export function interpretClick(state: GameState, selection: Selection, pos: Pos): ClickResult {
  if (state.status !== 'ongoing' || state.sideToMove !== 'player') {
    return { kind: 'select', selection: NO_SELECTION }
  }

  if (selection.kind === 'landing') {
    if (selection.options.some((option) => samePos(option, pos))) {
      return {
        kind: 'play',
        action: { kind: 'attack', pieceId: selection.pieceId, target: selection.target, landing: pos },
      }
    }
    // Tout autre clic annule le choix d'atterrissage, sans perdre la pièce sélectionnée.
    return { kind: 'select', selection: { kind: 'piece', pieceId: selection.pieceId } }
  }

  const clicked = pieceAt(state, pos)
  if (selection.kind === 'piece') {
    const actions = pieceActions(state, selection.pieceId)
    const move = actions.find((action) => action.kind === 'move' && samePos(action.to, pos))
    if (move) return { kind: 'play', action: move }

    const attacks = actions.filter((action) => action.kind === 'attack' && samePos(action.target, pos))
    if (attacks.length === 1) return { kind: 'play', action: attacks[0] }
    if (attacks.length > 1) {
      const options = attacks.flatMap((action) =>
        action.kind === 'attack' && action.landing ? [action.landing] : [],
      )
      return { kind: 'select', selection: { kind: 'landing', pieceId: selection.pieceId, target: pos, options } }
    }
    if (clicked?.id === selection.pieceId) return { kind: 'select', selection: NO_SELECTION }
  }

  if (clicked?.side === 'player') {
    return { kind: 'select', selection: { kind: 'piece', pieceId: clicked.id } }
  }
  return { kind: 'select', selection: NO_SELECTION }
}

export interface Highlights {
  readonly moves: readonly Pos[]
  readonly attacks: readonly Pos[]
  readonly landings: readonly Pos[]
}

/** Cases à mettre en évidence pour la sélection courante. */
export function highlightsFor(state: GameState, selection: Selection): Highlights {
  if (selection.kind === 'none') return { moves: [], attacks: [], landings: [] }
  if (selection.kind === 'landing') {
    return { moves: [], attacks: [selection.target], landings: selection.options }
  }
  const actions = pieceActions(state, selection.pieceId)
  const attacks = new Map<string, Pos>()
  for (const action of actions) if (action.kind === 'attack') attacks.set(posKey(action.target), action.target)
  return {
    moves: actions.flatMap((action) => (action.kind === 'move' ? [action.to] : [])),
    attacks: [...attacks.values()],
    landings: [],
  }
}

/** Pièce nommée dans le journal (type et camp, figés au moment de l'événement). */
export interface PieceLabel {
  readonly type: PieceType
  readonly side: Side
}

export type LogEntry =
  | {
      readonly id: number
      readonly kind: 'attack' | 'riposte' | 'sweep'
      readonly attacker: PieceLabel
      readonly target: PieceLabel
      readonly damage: number
    }
  | { readonly id: number; readonly kind: 'crush'; readonly target: PieceLabel; readonly damage: number }
  | { readonly id: number; readonly kind: 'capture'; readonly target: PieceLabel }
  | {
      readonly id: number
      readonly kind: 'iceSlide' | 'shieldBlock' | 'promote' | 'push' | 'momentum'
      readonly piece: PieceLabel
    }
  | { readonly id: number; readonly kind: 'heal'; readonly piece: PieceLabel; readonly amount: number }
  | { readonly id: number; readonly kind: 'pass'; readonly side: Side }

/** Entrées de journal pour les événements d'une action (les simples déplacements sont omis). */
export function logEntriesFor(before: GameState, events: readonly GameEvent[], firstId: number): LogEntry[] {
  const label = (id: string): PieceLabel => {
    const piece = before.pieces.find((candidate) => candidate.id === id)
    return piece ? { type: piece.type, side: piece.side } : { type: 'pawn', side: 'enemy' }
  }
  const entries: LogEntry[] = []
  for (const event of events) {
    const id = firstId + entries.length
    switch (event.type) {
      case 'attack':
      case 'riposte':
      case 'sweep':
        entries.push({
          id,
          kind: event.type,
          attacker: label(event.pieceId),
          target: label(event.targetId),
          damage: event.damage,
        })
        break
      case 'crush':
        entries.push({ id, kind: 'crush', target: label(event.targetId), damage: event.damage })
        break
      case 'shieldBlock':
      case 'promote':
      case 'push':
      case 'momentum':
        entries.push({ id, kind: event.type, piece: label(event.pieceId) })
        break
      case 'heal':
        entries.push({ id, kind: 'heal', piece: label(event.pieceId), amount: event.amount })
        break
      case 'capture':
        entries.push({ id, kind: 'capture', target: label(event.pieceId) })
        break
      case 'iceSlide':
        // Une glissade de plusieurs cases n'est notée qu'une fois.
        if (!entries.some((entry) => entry.kind === 'iceSlide')) {
          entries.push({ id, kind: 'iceSlide', piece: label(event.pieceId) })
        }
        break
      case 'pass':
        entries.push({ id, kind: 'pass', side: event.side })
        break
      default:
        break
    }
  }
  return entries
}

/** Départ et arrivée (après glissade) de la pièce qui s'est déplacée, s'il y en a une. */
export function lastMoveOf(events: readonly GameEvent[]): { from: Pos; to: Pos } | null {
  let from: Pos | null = null
  let to: Pos | null = null
  for (const event of events) {
    if (event.type === 'move' || event.type === 'iceSlide') {
      from ??= event.from
      to = event.to
    }
  }
  return from && to ? { from, to } : null
}
