import type { GameAction, PlayerId } from "./actions";
import type { CardInstance, PokemonInPlay } from "./cards";
import type { GamePhase } from "./game-state";

export interface ObservedPlayer {
  id: PlayerId;
  deckId: string;
  deckCount: number;
  hand: CardInstance[] | { count: number };
  prizeCount: number;
  discard: CardInstance[];
  active: PokemonInPlay | null;
  bench: PokemonInPlay[];
  energyAttachedThisTurn: boolean;
  supporterPlayedThisTurn: boolean;
}

export interface PlayerObservation {
  viewerId: PlayerId;
  activePlayerId: PlayerId;
  turn: number;
  phase: GamePhase;
  self: ObservedPlayer;
  opponent: ObservedPlayer;
  legalActions: GameAction[];
}
