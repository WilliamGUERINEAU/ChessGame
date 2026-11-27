import {
  pieceActions,
  pieceAt,
  posKey,
  previewAttack,
  samePos,
  threatenedCells,
  type Action,
  type AttackPreview,
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
  /** Pièce ennemie observée : on montre sa portée et sa fiche. */
  | { readonly kind: 'inspect'; readonly pieceId: string }
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
  if (clicked?.side === 'enemy') {
    const again = selection.kind === 'inspect' && selection.pieceId === clicked.id
    return { kind: 'select', selection: again ? NO_SELECTION : { kind: 'inspect', pieceId: clicked.id } }
  }
  return { kind: 'select', selection: NO_SELECTION }
}

/** Résultat prévu d'une attaque sur une case. */
export interface TargetPreview {
  readonly pos: Pos
  readonly preview: AttackPreview
}

export interface Highlights {
  readonly moves: readonly Pos[]
  readonly attacks: readonly Pos[]
  readonly landings: readonly Pos[]
  /** Cases menacées par l'ennemi (pièce observée ou bouton « Menaces »). */
  readonly threats: readonly Pos[]
  /** Résultat prévu de chaque attaque possible. */
  readonly previews: readonly TargetPreview[]
}

export const NO_HIGHLIGHTS: Highlights = { moves: [], attacks: [], landings: [], threats: [], previews: [] }

/** Cases à mettre en évidence pour la sélection courante. */
export function highlightsFor(state: GameState, selection: Selection): Highlights {
  if (selection.kind === 'none') return NO_HIGHLIGHTS
  if (selection.kind === 'inspect') {
    const piece = state.pieces.find((candidate) => candidate.id === selection.pieceId)
    return { ...NO_HIGHLIGHTS, threats: piece ? threatenedCells(state, piece) : [] }
  }
  if (selection.kind === 'landing') {
    const previews = previewsFor(
      state,
      selection.options.map((landing): Action => ({ kind: 'attack', pieceId: selection.pieceId, target: selection.target, landing })),
    )
    return { ...NO_HIGHLIGHTS, attacks: [selection.target], landings: selection.options, previews }
  }
  const actions = pieceActions(state, selection.pieceId)
  return {
    ...NO_HIGHLIGHTS,
    moves: actions.flatMap((action) => (action.kind === 'move' ? [action.to] : [])),
    attacks: previewsFor(state, actions).map((entry) => entry.pos),
    previews: previewsFor(state, actions),
  }
}

/** Cases menacées par toutes les pièces ennemies. */
export function enemyThreats(state: GameState): Pos[] {
  const cells = new Map<string, Pos>()
  for (const piece of state.pieces) {
    if (piece.side !== 'enemy') continue
    for (const p of threatenedCells(state, piece)) cells.set(posKey(p), p)
  }
  return [...cells.values()]
}

/** Un aperçu par cible (la première case d'atterrissage sert d'exemple : le résultat est le même). */
function previewsFor(state: GameState, actions: readonly Action[]): TargetPreview[] {
  const byTarget = new Map<string, TargetPreview>()
  for (const action of actions) {
    if (action.kind !== 'attack' || byTarget.has(posKey(action.target))) continue
    byTarget.set(posKey(action.target), { pos: action.target, preview: previewAttack(state, action) })
  }
  return [...byTarget.values()]
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
      readonly kind: 'iceSlide' | 'shieldBlock' | 'promote' | 'push' | 'momentum' | 'reinforce'
      readonly piece: PieceLabel
    }
  | { readonly id: number; readonly kind: 'heal'; readonly piece: PieceLabel; readonly amount: number }
  | { readonly id: number; readonly kind: 'pass'; readonly side: Side }

/** Entrées de journal pour les événements d'une action (les simples déplacements sont omis). */
export function logEntriesFor(before: GameState, events: readonly GameEvent[], firstId: number): LogEntry[] {
  const label = (id: string): PieceLabel => {
    const piece =
      before.pieces.find((candidate) => candidate.id === id) ??
      before.reinforcements.find((candidate) => candidate.piece.id === id)?.piece
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
      case 'reinforce':
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
