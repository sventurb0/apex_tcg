import type { GameState } from "../model/game-state";
import type { GameResult } from "../model/results";

export function getGameResult(state: GameState): GameResult | null {
  return state.result;
}
