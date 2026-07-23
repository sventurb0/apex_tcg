import { applyAction, createGame, getLegalActions, type GameAction, type GameState, type PlayerId } from "../engine";
import type { CardInstance } from "../engine/model/cards";
import { fixtureCardList } from "./fixtures/cards";
import { getFixtureDeck } from "./fixtures/decks";

export function freshGame(options: { seed?: number; startingPlayer?: PlayerId; deckOne?: string; deckTwo?: string } = {}): GameState {
  return createGame({
    seed: options.seed ?? 42,
    playerOneDeck: getFixtureDeck(options.deckOne ?? "demo-cinder"),
    playerTwoDeck: getFixtureDeck(options.deckTwo ?? "demo-brook"),
    cards: fixtureCardList,
    startingPlayer: options.startingPlayer ?? "player-one",
  });
}

export function action(state: GameState, playerId: PlayerId, predicate: (candidate: GameAction) => boolean): GameAction {
  const found = getLegalActions(state, playerId).find(predicate);
  if (!found) throw new Error(`Expected legal action for ${playerId}. Available: ${getLegalActions(state, playerId).map((candidate) => candidate.description).join(", ")}`);
  return found;
}

export function applyWhere(state: GameState, playerId: PlayerId, predicate: (candidate: GameAction) => boolean): GameState {
  return applyAction(state, action(state, playerId, predicate));
}

export function setupGame(state: GameState, playerOneCardId?: string, playerTwoCardId?: string): GameState {
  if (playerOneCardId) moveCardToHand(state, "player-one", playerOneCardId);
  if (playerTwoCardId) moveCardToHand(state, "player-two", playerTwoCardId);
  state = applyWhere(state, "player-one", (candidate) => candidate.type === "select-active" && (!playerOneCardId || state.players["player-one"].hand.find((card) => card.instanceId === candidate.cardInstanceId)?.cardId === playerOneCardId));
  state = applyWhere(state, "player-one", (candidate) => candidate.type === "finish-setup");
  state = applyWhere(state, "player-two", (candidate) => candidate.type === "select-active" && (!playerTwoCardId || state.players["player-two"].hand.find((card) => card.instanceId === candidate.cardInstanceId)?.cardId === playerTwoCardId));
  state = applyWhere(state, "player-two", (candidate) => candidate.type === "finish-setup");
  while (state.pendingChoice?.type === "mulligan-draw") state = applyWhere(state, state.pendingChoice.playerId, (candidate) => candidate.type === "finish-setup");
  return state;
}

export function moveCardToHand(state: GameState, playerId: PlayerId, cardId: string): CardInstance {
  const player = state.players[playerId];
  const zones = [player.deck, player.prizes, player.discard];
  for (const zone of zones) {
    const index = zone.findIndex((card) => card.cardId === cardId);
    if (index >= 0) {
      const card = zone.splice(index, 1)[0]!;
      player.hand.push(card);
      return card;
    }
  }
  const inHand = player.hand.find((card) => card.cardId === cardId);
  if (inHand) return inHand;
  throw new Error(`Card ${cardId} is not available for ${playerId}.`);
}
