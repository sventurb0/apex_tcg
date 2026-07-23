import type { CardImplementation, PokemonCardMetadata } from "../types";
import { matchWave1Ability } from "./templates/abilities/wave-1";
import { matchWave1Attack } from "./templates/attacks/wave-1";
import { matchWave1Trainer } from "./templates/trainers/wave-1";

const standardRule = /Pokémon ex rule|Pokémon V rule|VMAX rule|VSTAR rule/i;
function complete(card: PokemonCardMetadata, mechanics: string[]): CardImplementation { return { cardId: card.id, status: "complete", implementationSource: "reviewed-template", handlers: [{ kind: "custom", handlerId: card.supertype === "Trainer" ? matchWave1Trainer(card)!.programId : "template:pokemon-wave-1" }], supportedMechanics: mechanics, knownLimitations: [], tests: ["tests/cards/wave-1-templates.test.ts"] }; }
export function compileWave1Implementation(card: PokemonCardMetadata): CardImplementation | undefined {
  const trainer = matchWave1Trainer(card); if (trainer) return complete(card, [trainer.supportedMechanic]);
  if (card.supertype !== "Pokémon" || !(card.attacks?.length || card.abilities?.length)) return undefined;
  if (!(card.rules ?? []).every((rule) => standardRule.test(rule))) return undefined;
  const abilities = (card.abilities ?? []).map(matchWave1Ability); if (abilities.some((match) => !match)) return undefined;
  const attacks = (card.attacks ?? []).map((attack) => !attack.text.trim() && (attack.damage.trim() === "" || /^\d+$/.test(attack.damage.trim())) ? { supportedMechanic: "Printed fixed/no-damage attack" } : matchWave1Attack(attack)); if (attacks.some((match) => !match)) return undefined;
  return complete(card, [...abilities, ...attacks].flatMap((match) => match?.supportedMechanic ?? []));
}
