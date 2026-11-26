import type { PieceType } from '../../engine'

/** Socle commun à toutes les pièces. */
const base = <rect x="22" y="80" width="56" height="10" rx="3" />

/**
 * Pièces vectorielles dessinées dans un carré de 100 × 100. Les couleurs viennent
 * du CSS (classe du groupe parent), pour suivre le camp et le thème.
 */
export function PieceGlyph({ type }: { type: PieceType }) {
  switch (type) {
    case 'pawn':
      return (
        <g className="glyph">
          <circle cx="50" cy="30" r="13" />
          <path d="M36 80 L42 50 Q50 44 58 50 L64 80 Z" />
          {base}
        </g>
      )
    case 'rook':
      return (
        <g className="glyph">
          <path d="M28 18 h10 v8 h7 v-8 h10 v8 h7 v-8 h10 v20 h-44 z" />
          <path d="M33 38 h34 l3 42 h-40 z" />
          {base}
        </g>
      )
    case 'bishop':
      return (
        <g className="glyph">
          <circle cx="50" cy="13" r="5" />
          <path d="M50 18 C66 30 66 48 58 58 L42 58 C34 48 34 30 50 18 Z" />
          <path d="M40 80 L44 58 L56 58 L60 80 Z" />
          <path className="glyph-line" d="M46 32 L56 42" />
          {base}
        </g>
      )
    case 'knight':
      return (
        <g className="glyph">
          <path d="M32 80 L36 62 C28 58 24 50 30 43 L45 30 L47 16 L55 24 C68 28 74 44 70 60 L68 80 Z" />
          <circle className="glyph-eye" cx="44" cy="38" r="3.5" />
          {base}
        </g>
      )
    case 'queen':
      return (
        <g className="glyph">
          <circle cx="30" cy="22" r="5" />
          <circle cx="50" cy="14" r="5" />
          <circle cx="70" cy="22" r="5" />
          <path d="M28 46 L30 27 L41 40 L50 19 L59 40 L70 27 L72 46 Z" />
          <path d="M33 46 h34 l3 34 h-40 z" />
          {base}
        </g>
      )
    case 'king':
      return (
        <g className="glyph">
          <path d="M46 6 h8 v8 h8 v8 h-8 v10 h-8 v-10 h-8 v-8 h8 z" />
          <path d="M30 50 C28 36 38 30 50 30 C62 30 72 36 70 50 Z" />
          <path d="M33 50 h34 l3 30 h-40 z" />
          {base}
        </g>
      )
  }
}
