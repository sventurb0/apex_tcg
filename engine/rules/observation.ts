import type { PlayerId } from "../model/actions";
import type { PlayerObservation, ObservedPlayer } from "../model/observation";
import type { GameState, PlayerState } from "../model/game-state";
import { otherPlayer } from "./helpers";
import { getLegalActions } from "./legal-actions";

function observePlayer(player: PlayerState, revealHand: boolean, revealPokemon: boolean): ObservedPlayer {
  return {
    id: player.id,
    deckId: player.deckId,
    deckCount: player.deck.length,
    hand: revealHand ? structuredClone(player.hand) : { count: player.hand.length },
    prizeCount: player.prizes.length,
    discard: structuredClone(player.discard),
    active: revealPokemon ? structuredClone(player.active) : null,
    bench: revealPokemon ? structuredClone(player.bench) : [],
    energyAttachedThisTurn: player.energyAttachedThisTurn,
    supporterPlayedThisTurn: player.supporterPlayedThisTurn,
  };
}

export function createPlayerObservation(state: GameState, playerId: PlayerId): PlayerObservation {
  return {
    viewerId: playerId,
    activePlayerId: state.activePlayerId,
    turn: state.turn,
    phase: state.phase,
    self: observePlayer(state.players[playerId], true, true),
    opponent: observePlayer(state.players[otherPlayer(playerId)], false, state.phase !== "setup"),
    legalActions: getLegalActions(state, playerId),
  };
}
