import { describe, expect, it } from 'vitest'
import { applyAction } from './apply'
import { legalActions, pieceActions } from './moves'
import { attackKeys, idAt, moveKeys, testLevel } from './testing'

describe('glissades (Tour, Fou, Dame)', () => {
  it('ne traversent pas le vide d’un plateau irrégulier', () => {
    const state = testLevel({ terrain: ['.. ..'], units: ['R...p'] })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual([])
  })

  it('s’arrêtent en entrant dans une forêt', () => {
    const state = testLevel({ terrain: ['.f..'], units: ['R..p'] })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual([])
  })

  it('peuvent attaquer une pièce qui se tient dans une forêt', () => {
    const state = testLevel({ terrain: ['..f.'], units: ['R.p.'] })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual(['2,0'])
  })

  it('sortent librement d’une forêt', () => {
    const state = testLevel({ terrain: ['f...'], units: ['R..p'] })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0', '2,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual(['3,0'])
  })

  it.each([
    ['l’eau', '.~..'],
    ['un mur', '.#..'],
  ])('sont bloquées par %s', (_label, row) => {
    const state = testLevel({ terrain: [row], units: ['R..p'] })
    expect(pieceActions(state, idAt(state, 0, 0))).toEqual([])
  })

  it('traversent la glace', () => {
    const state = testLevel({ terrain: ['.ii.'], units: ['R..p'] })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,0', '2,0'])
    expect(attackKeys(state, idAt(state, 0, 0))).toEqual(['3,0'])
  })

  it('s’arrêtent devant une pièce alliée et sur une pièce adverse', () => {
    const state = testLevel({
      terrain: ['....', '....'],
      units: ['R.P.', '.p..'],
    })
    const rook = idAt(state, 0, 0)
    expect(moveKeys(state, rook)).toEqual(['0,1', '1,0'])
    expect(attackKeys(state, rook)).toEqual([])
    const blocked = testLevel({ terrain: ['....'], units: ['R.pp'] })
    expect(attackKeys(blocked, idAt(blocked, 0, 0))).toEqual(['2,0'])
  })

  it('le mur bloque le Fou en diagonale', () => {
    const state = testLevel({
      terrain: ['.....', '.....', '..#..', '.....', '.....'],
      units: ['B...p'],
    })
    expect(moveKeys(state, idAt(state, 0, 0))).toEqual(['1,1'])
  })

  it('la Dame cumule les lignes de la Tour et du Fou', () => {
    const state = testLevel({ terrain: ['...', '...', '...'], units: ['...', '.Q.', '..p'] })
    const queen = idAt(state, 1, 1)
    expect(moveKeys(state, queen)).toEqual(['0,0', '0,1', '0,2', '1,0', '1,2', '2,0', '2,1'])
    expect(attackKeys(state, queen)).toEqual(['2,2'])
  })
})

describe('Roi', () => {
  it('se déplace d’une case dans les 8 directions, hors obstacles', () => {
    const state = testLevel({
      terrain: ['.~.', '#..', '.. '],
      units: ['...', '.KP', 'p..'],
    })
    const king = idAt(state, 1, 1)
    expect(moveKeys(state, king)).toEqual(['0,0', '1,2', '2,0'])
    expect(attackKeys(state, king)).toEqual(['0,2'])
  })
})

describe('Cavalier', () => {
  it('saute par-dessus l’eau, les murs et les pièces, mais n’y atterrit pas', () => {
    const state = testLevel({
      terrain: ['.....', '.~#~~', '.#.#.', ' ~#~.', '.....'],
      units: ['.P.p.', '', '..N'],
    })
    const knight = idAt(state, 2, 2)
    expect(moveKeys(state, knight)).toEqual(['0,1', '1,4', '3,4', '4,3'])
    expect(attackKeys(state, knight)).toEqual(['3,0'])
  })
})

describe('Pion', () => {
  const column = ['...', '...', '...', '...', '...']

  it('avance d’une case, ou de deux à son premier coup', () => {
    const state = testLevel({ terrain: column, units: ['..k', '', '', '', '.P.'] })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual(['1,2', '1,3'])
  })

  it('perd le double pas après avoir joué', () => {
    let state = testLevel({ terrain: column, units: ['..k', '', '', '', '.P.'] })
    const pawn = idAt(state, 1, 4)
    state = applyAction(state, { kind: 'move', pieceId: pawn, to: { x: 1, y: 3 } }).state
    state = applyAction(state, { kind: 'move', pieceId: idAt(state, 2, 0), to: { x: 2, y: 1 } }).state
    expect(moveKeys(state, pawn)).toEqual(['1,2'])
  })

  it('n’avance pas sur une pièce et n’attaque pas tout droit', () => {
    const state = testLevel({ terrain: column, units: ['', '', '', '.p.', '.P.'] })
    expect(pieceActions(state, idAt(state, 1, 4))).toEqual([])
  })

  it('ne fait qu’un pas si la deuxième case est occupée', () => {
    const state = testLevel({ terrain: column, units: ['', '', '.p.', '', '.P.'] })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual(['1,3'])
  })

  it('est arrêté par la forêt pendant son double pas', () => {
    const state = testLevel({ terrain: ['...', '...', '...', '.f.', '...'], units: ['..k', '', '', '', '.P.'] })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual(['1,3'])
  })

  it('peut faire son double pas à travers la glace', () => {
    const state = testLevel({ terrain: ['...', '...', '...', '.i.', '...'], units: ['..k', '', '', '', '.P.'] })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual(['1,2', '1,3'])
  })

  it('ne peut pas avancer dans l’eau, même en double pas', () => {
    const state = testLevel({ terrain: ['...', '...', '...', '.~.', '...'], units: ['..k', '', '', '', '.P.'] })
    expect(moveKeys(state, idAt(state, 1, 4))).toEqual([])
  })

  it('attaque en diagonale vers l’avant, uniquement des pièces adverses', () => {
    const state = testLevel({ terrain: column, units: ['', '', '', 'p.P', '.P.'] })
    const pawn = idAt(state, 1, 4)
    expect(attackKeys(state, pawn)).toEqual(['0,3'])
    expect(moveKeys(state, pawn)).toEqual(['1,2', '1,3'])
  })

  it('suit la direction « avant » de son camp', () => {
    const state = testLevel({
      terrain: ['...', '...', '...'],
      units: ['.p.', 'P..', '.p.'],
      forward: { player: 'right', enemy: 'left' },
    })
    const pawn = idAt(state, 0, 1)
    expect(moveKeys(state, pawn)).toEqual(['1,1', '2,1'])
    expect(attackKeys(state, pawn)).toEqual(['1,0', '1,2'])
  })

  it('le pion ennemi avance dans sa propre direction', () => {
    let state = testLevel({ terrain: column, units: ['.p.', '', '', '', 'K..'] })
    state = applyAction(state, { kind: 'move', pieceId: idAt(state, 0, 4), to: { x: 0, y: 3 } }).state
    expect(moveKeys(state, idAt(state, 1, 0))).toEqual(['1,1', '1,2'])
  })
})

describe('legalActions', () => {
  it('ne propose que les pièces du camp qui joue', () => {
    const state = testLevel({ terrain: ['...', '...'], units: ['K..', '..k'] })
    const ids = new Set(
      legalActions(state).flatMap((action) => (action.kind === 'pass' ? [] : [action.pieceId])),
    )
    expect([...ids]).toEqual([idAt(state, 0, 0)])
  })

  it('propose de passer quand le camp est bloqué', () => {
    const state = testLevel({ terrain: ['.~.'], units: ['R.k'] })
    expect(legalActions(state)).toEqual([{ kind: 'pass' }])
  })
})
