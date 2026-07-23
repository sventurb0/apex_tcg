import type { CardDefinition, CardTrait, PokemonInPlay } from "../model/cards";
import type { GameState, PlayerState } from "../model/game-state";
import { pokemonTargets, topCard } from "./helpers";

export function hasCardTrait(card: CardDefinition, trait: CardTrait): boolean { return Boolean(card.traits?.includes(trait)); }
export function pokemonHasTrait(state: GameState, pokemon: PokemonInPlay, trait: CardTrait): boolean { return hasCardTrait(topCard(state, pokemon), trait); }
export function allPokemonHaveTrait(state: GameState, player: PlayerState, trait: CardTrait): boolean { const targets = pokemonTargets(player); return targets.length > 0 && targets.every((pokemon) => pokemonHasTrait(state, pokemon, trait)); }
export function isBasicTeamRocketPokemon(state: GameState, pokemon: PokemonInPlay): boolean { const card = topCard(state, pokemon); return card.stage === "basic" && hasCardTrait(card, "team-rocket"); }
