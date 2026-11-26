/**
 * Moteur de règles : TypeScript pur, sans dépendance à l'interface.
 * Toutes les fonctions sont déterministes et ne modifient jamais leurs entrées.
 */
export { applyAction, IllegalActionError, type ActionResult, type GameEvent } from './apply'
export {
  boardCells,
  boardToAscii,
  isLastRow,
  isOnBoard,
  isStandable,
  parseBoard,
  promotionCells,
  terrainAt,
  TERRAIN_RULES,
  type Board,
  type Terrain,
  type TerrainRules,
} from './board/board'
export {
  attackDamage,
  damageTaken,
  landingOptions,
  survivedApproach,
  wouldKill,
  type SurvivedApproach,
} from './combat/combat'
export {
  DIRECTION_VECTORS,
  kingDistance,
  pos,
  posKey,
  samePos,
  type Direction,
  type Pos,
  type Vec,
} from './geometry'
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
export {
  canReceive,
  hasPower,
  powerCount,
  POWER_IDS,
  POWERS,
  statsFor,
  type PowerDefinition,
  type PowerId,
} from './powers/powers'
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
