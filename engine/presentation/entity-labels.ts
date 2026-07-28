import type { PlayerId } from "../model/actions";
import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { GameState } from "../model/game-state";
import { cardFor, otherPlayer, playId, pokemonTargets, topCard } from "../rules/helpers";

function ownerLabel(viewerId: PlayerId, ownerId: PlayerId): string {
  return viewerId === ownerId ? "Your" : "Opponent's";
}

function pokemonLocation(state: GameState, ownerId: PlayerId, pokemon: PokemonInPlay): string {
  const player = state.players[ownerId];
  if (player.active === pokemon) return "Active";
  const index = player.bench.indexOf(pokemon);
  return index >= 0 ? `Bench ${index + 1}` : "In play";
}

export function findPokemonOwner(state: GameState, targetId: string): { ownerId: PlayerId; pokemon: PokemonInPlay } | undefined {
  for (const ownerId of ["player-one", "player-two"] as const) {
    const pokemon = pokemonTargets(state.players[ownerId]).find((candidate) => playId(candidate) === targetId);
    if (pokemon) return { ownerId, pokemon };
  }
  return undefined;
}

export function describePokemonTarget(state: GameState, viewerId: PlayerId, targetId: string): string {
  const found = findPokemonOwner(state, targetId);
  if (!found) return "Pokémon";
  const card = topCard(state, found.pokemon);
  const owner = ownerLabel(viewerId, found.ownerId);
  const location = pokemonLocation(state, found.ownerId, found.pokemon);
  const damage = found.pokemon.damage > 0 ? ` — ${found.pokemon.damage} damage` : "";
  return `${owner} ${location} ${card.name}${damage}`;
}

export function describeCardInstance(state: GameState, viewerId: PlayerId, instanceId: string): string {
  for (const ownerId of ["player-one", "player-two"] as const) {
    const player = state.players[ownerId];
    const zones: Array<[string, CardInstance[]]> = [
      ["Hand", player.hand],
      ["Deck", player.deck],
      ["Discard", player.discard],
      ["Prizes", player.prizes],
    ];
    for (const [zone, cards] of zones) {
      const instance = cards.find((card) => card.instanceId === instanceId);
      if (!instance) continue;
      const isHidden = ownerId !== viewerId && (zone === "Hand" || zone === "Deck" || zone === "Prizes");
      return isHidden ? `${ownerLabel(viewerId, ownerId)} ${zone} card` : `${ownerLabel(viewerId, ownerId)} ${zone} ${cardFor(state, instance).name}`;
    }
    for (const pokemon of pokemonTargets(player)) {
      const attached = pokemon.attachedEnergy.find((card) => card.instanceId === instanceId);
      if (attached) return `${ownerLabel(viewerId, ownerId)} ${pokemonLocation(state, ownerId, pokemon)} attached ${cardFor(state, attached).name}`;
      if (pokemon.tool?.instanceId === instanceId) return `${ownerLabel(viewerId, ownerId)} ${pokemonLocation(state, ownerId, pokemon)} Tool ${cardFor(state, pokemon.tool).name}`;
      const stackCard = pokemon.stack.find((card) => card.instanceId === instanceId);
      if (stackCard) return `${ownerLabel(viewerId, ownerId)} ${pokemonLocation(state, ownerId, pokemon)} ${cardFor(state, stackCard).name}`;
    }
  }
  return "Card";
}

export function describeChoiceOption(state: GameState, viewerId: PlayerId, id: string, kind: "card" | "pokemon" | "mode"): string {
  if (kind === "pokemon") return describePokemonTarget(state, viewerId, id);
  if (kind === "card") return describeCardInstance(state, viewerId, id);
  return id;
}

export function describePlayer(viewerId: PlayerId, playerId: PlayerId): string {
  return viewerId === playerId ? "You" : "Your opponent";
}

export function opponentId(playerId: PlayerId): PlayerId { return otherPlayer(playerId); }
