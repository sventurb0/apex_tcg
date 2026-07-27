import type { CardDefinition } from "../../../engine/model/cards";
import type { PokemonCardMetadata } from "./types";

const explicitSpecialEnergyHandlers = new Set(["energy:prism", "energy:team-rocket", "energy:growing-grass", "energy:rocky-fighting", "energy:telepathic-psychic", "energy:mist", "energy:legacy", "energy:boomerang", "energy:enriching", "energy:ignition", "energy:neo-upper", "energy:spiky"]);

export interface SemanticReadinessResult {
  complete: boolean;
  unmatched: string[];
}

export function semanticReadiness(card: PokemonCardMetadata, runtime: CardDefinition | null, handlerId: string): SemanticReadinessResult {
  const unmatched: string[] = [];
  if (!runtime) return { complete: false, unmatched: ["runtime-definition"] };
  if (card.supertype === "Pokémon" && runtime.category === "pokemon") {
    if ((card.abilities?.length ?? 0) !== runtime.abilities.length) unmatched.push("ability-count");
    for (const [index, printed] of (card.attacks ?? []).entries()) {
      const attack = runtime.attacks[index];
      // Variable-damage attacks are executable through their registered damage
      // resolver even when they do not need a separate effect program. Treat
      // the resolver as the semantic implementation for the printed clause.
      if (printed.text?.trim() && !attack?.effectProgramId && attack?.damage.kind !== "formula") unmatched.push(`attack:${printed.name}`);
      if (/[+×x]|\d+\s*[-–]/u.test(printed.damage) && attack?.damage.kind !== "formula") unmatched.push(`damage:${printed.name}`);
    }
  }
  if (card.supertype === "Trainer" && card.trainerText?.trim() && runtime.category === "trainer" && !runtime.effectProgramId) unmatched.push("trainer-effect");
  if (card.supertype === "Energy" && card.energyText?.trim() && !card.subtypes.includes("Basic") && !explicitSpecialEnergyHandlers.has(handlerId)) unmatched.push("special-energy-effect");
  return { complete: unmatched.length === 0, unmatched };
}
