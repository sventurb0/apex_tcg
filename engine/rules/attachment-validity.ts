import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { GameState } from "../model/game-state";
import { cardFor, playId, pokemonTargets, topCard } from "./helpers";
import { emitEvent } from "./events";
import { hasCardTrait } from "./traits";

export function canAttachEnergyToPokemon(state: GameState, energy: CardInstance, pokemon: PokemonInPlay): boolean { const definition = cardFor(state, energy); return definition.category === "energy" && (!definition.attachOnlyToTrait || hasCardTrait(topCard(state, pokemon), definition.attachOnlyToTrait)); }

export function enforceAttachmentValidity(state: GameState): void {
  for (const player of Object.values(state.players)) for (const pokemon of pokemonTargets(player)) for (let index = pokemon.attachedEnergy.length - 1; index >= 0; index -= 1) { const energy = pokemon.attachedEnergy[index]!; if (canAttachEnergyToPokemon(state, energy, pokemon)) continue; pokemon.attachedEnergy.splice(index, 1); player.discard.push(energy); emitEvent(state, "energy-discarded-invalid", player.id, { sourceCardId: energy.cardId, sourceInstanceId: energy.instanceId, targetId: playId(pokemon), detail: "Attachment restriction no longer satisfied" }); }
}
