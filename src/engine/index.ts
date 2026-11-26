/**
 * Moteur de règles : TypeScript pur, sans dépendance à l'interface.
 * Toutes les fonctions sont déterministes et ne modifient jamais leurs entrées.
 */
export { applyAction, IllegalActionError, type ActionResult, type GameEvent } from './apply'
export {
  boardCells,
  boardToAscii,
  isOnBoard,
  isStandable,
  parseBoard,
  terrainAt,
  TERRAIN_RULES,
  type Board,
  type Terrain,
  type TerrainRules,
} from './board/board'
export {
  attackDamage,
  landingOptions,
  survivedApproach,
  wouldKill,
  type SurvivedApproach,
} from './combat/combat'
export { pos, posKey, samePos, type Direction, type Pos, type Vec } from './geometry'
export {
  evaluateOutcome,
  type EndReason,
  type Goal,
  type GoalDefinition,
  type Outcome,
  type Status,
} from './goals/goals'
export { legalActions, pieceActions, sameAction, type Action } from './moves'
export {
  opponent,
  PIECE_LETTERS,
  PIECES,
  type Movement,
  type Piece,
  type PieceDefinition,
  type PieceType,
  type Side,
} from './pieces/pieces'
export { createRng, seedFromString, type Rng } from './rng'
export {
  createLevel,
  findPiece,
  pieceAt,
  piecesOf,
  unitsFromAscii,
  type GameState,
  type LevelDefinition,
  type UnitSpec,
} from './state'
