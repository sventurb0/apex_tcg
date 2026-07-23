export { createGame, type GameConfig } from "./rules/setup";
export { getLegalActions } from "./rules/legal-actions";
export { applyAction, GameRuleError } from "./rules/reducer";
export { getGameResult } from "./rules/win-conditions";
export { createPlayerObservation } from "./rules/observation";
export { applySpecialCondition, clearSpecialConditions, processPokemonCheckup } from "./rules/pokemon-checkup";
export type { GameAction, PlayerId } from "./model/actions";
export type { GameState, ReplayRecord } from "./model/game-state";
export type { GameResult } from "./model/results";
