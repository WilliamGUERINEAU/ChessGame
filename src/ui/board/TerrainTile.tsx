import type { Pos, Terrain } from '../../engine'

export const CELL = 100

/** Décor d'une case, dessiné dans son carré de CELL × CELL. */
export function TerrainTile({ pos, terrain }: { pos: Pos; terrain: Terrain }) {
  const x = pos.x * CELL
  const y = pos.y * CELL
  const square = (className: string) => (
    <rect className={className} x={x} y={y} width={CELL} height={CELL} />
  )
  const dark = (pos.x + pos.y) % 2 === 1

  switch (terrain) {
    case 'floor':
      return square(dark ? 'tile tile-floor-dark' : 'tile tile-floor-light')
    case 'forest':
      return (
        <g>
          {square(dark ? 'tile tile-forest-dark' : 'tile tile-forest')}
          {[
            [30, 46],
            [68, 34],
            [56, 74],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`} className="tree">
              <path d={`M${x + cx} ${y + cy - 16} L${x + cx + 12} ${y + cy + 6} L${x + cx - 12} ${y + cy + 6} Z`} />
              <rect x={x + cx - 2.5} y={y + cy + 6} width="5" height="7" />
            </g>
          ))}
        </g>
      )
    case 'water':
      return (
        <g>
          {square('tile tile-water')}
          {[36, 64].map((dy) => (
            <path
              key={dy}
              className="wave"
              d={`M${x + 14} ${y + dy} q 9 -8 18 0 t 18 0 t 18 0 t 18 0`}
            />
          ))}
        </g>
      )
    case 'wall':
      return (
        <g>
          {square('tile tile-wall')}
          <path
            className="brick"
            d={`M${x} ${y + 33} H${x + CELL} M${x} ${y + 66} H${x + CELL} M${x + 50} ${y} V${y + 33} M${x + 25} ${y + 33} V${y + 66} M${x + 75} ${y + 33} V${y + 66} M${x + 50} ${y + 66} V${y + CELL}`}
          />
        </g>
      )
    case 'ice':
      return (
        <g>
          {square('tile tile-ice')}
          <path className="shine" d={`M${x + 22} ${y + 58} L${x + 48} ${y + 32} M${x + 50} ${y + 76} L${x + 80} ${y + 46}`} />
        </g>
      )
  }
}
