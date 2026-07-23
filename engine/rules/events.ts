import type { PlayerId } from "../model/actions";
import type { GameEvent, GameEventType, GameState } from "../model/game-state";

export function emitEvent(state: GameState, type: GameEventType, playerId: PlayerId, details: Omit<GameEvent, "index" | "turn" | "type" | "playerId"> = {}): void {
  state.events.push({ index: state.events.length, turn: state.turn, type, playerId, ...details });
}
