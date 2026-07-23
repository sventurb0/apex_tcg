import type { PlayerId } from "../model/actions";
import type { CardDefinition, CardInstance, PokemonCard, PokemonInPlay } from "../model/cards";
import type { GameState, PlayerState } from "../model/game-state";

export function otherPlayer(playerId: PlayerId): PlayerId {
  return playerId === "player-one" ? "player-two" : "player-one";
}

export function cardFor(state: GameState, instance: CardInstance): CardDefinition {
  const card = state.cardDefinitions[instance.cardId];
  if (!card) throw new Error(`Missing card definition: ${instance.cardId}`);
  return card;
}

export function topCard(state: GameState, pokemon: PokemonInPlay): PokemonCard {
  const instance = pokemon.stack.at(-1);
  if (!instance) throw new Error("A Pokémon in play has an empty evolution stack.");
  const card = cardFor(state, instance);
  if (card.category !== "pokemon") throw new Error(`${card.name} is not a Pokémon.`);
  return card;
}

export function playId(pokemon: PokemonInPlay): string {
  const card = pokemon.stack.at(-1);
  if (!card) throw new Error("A Pokémon in play has an empty stack.");
  return card.instanceId;
}

export function pokemonTargets(player: PlayerState): PokemonInPlay[] {
  return player.active ? [player.active, ...player.bench] : [...player.bench];
}

export function removeFromHand(player: PlayerState, instanceId: string): CardInstance {
  const index = player.hand.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) throw new Error(`Card ${instanceId} is not in hand.`);
  return player.hand.splice(index, 1)[0]!;
}

export function removeFromDeck(player: PlayerState, instanceId: string): CardInstance {
  const index = player.deck.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) throw new Error(`Card ${instanceId} is not in the deck.`);
  return player.deck.splice(index, 1)[0]!;
}

export function findPokemon(player: PlayerState, targetId: string): PokemonInPlay | undefined {
  return pokemonTargets(player).find((pokemon) => playId(pokemon) === targetId);
}

export function cloneGameState(state: GameState): GameState {
  return structuredClone(state) as GameState;
}
