import type { CardImplementation, PokemonCardMetadata } from "../types";
import { compileWave1Implementation } from "./wave-1-compiler";

function generated(card: PokemonCardMetadata, effectId: string, mechanics: string[]): CardImplementation {
  return { cardId: card.id, status: "generated", implementationSource: "generated", handlers: [{ kind: "declarative", effectId }], supportedMechanics: mechanics, knownLimitations: [], tests: ["tests/cards/effect-compiler.test.ts"] };
}

function unsupported(card: PokemonCardMetadata, limitations: string[], partial = false): CardImplementation {
  return { cardId: card.id, status: partial ? "partial" : "unsupported", implementationSource: partial ? "partial" : "unsupported", handlers: [], supportedMechanics: partial ? ["Printed numerical attack damage"] : [], knownLimitations: limitations, tests: [] };
}

export function compileSafeGeneratedImplementation(card: PokemonCardMetadata): CardImplementation {
  if (card.supertype === "Energy" && card.subtypes.includes("Basic")) return generated(card, "basic-energy", ["Provides its printed basic Energy type"]);
  if (card.supertype === "Energy") return unsupported(card, [card.energyText ?? "Special Energy behaviour is not compiled."]);
  if (card.supertype === "Trainer") {
    const text = card.rules?.[0] ?? card.trainerText ?? "";
    const heal = text.match(/^Heal (20|30) damage from 1 of your Pokémon\.?$/i);
    if (heal) return generated(card, `heal-${heal[1]}-selected-pokemon`, [`Heal exactly ${heal[1]} damage from a selected Pokémon`]);
    if (/^Switch your Active Pokémon with 1 of your Benched Pokémon\.?$/i.test(text)) return generated(card, "switch-active-with-bench", ["Choose a Benched Pokémon and switch it with the Active Pokémon"]);
    const reviewed = compileWave1Implementation(card); if (reviewed) return reviewed;
    return unsupported(card, [text || "No reusable Trainer template matches this printed text."]);
  }
  const attacks = card.attacks ?? [];
  const trivialAttacks = attacks.length > 0 && attacks.every((attack) => !attack.text.trim() && (attack.damage.trim() === "" || /^\d+$/.test(attack.damage.trim())));
  const onlyStandardPrizeRules = (card.rules ?? []).every((rule) => /Pokémon ex rule|Pokémon V rule|VMAX rule|VSTAR rule/i.test(rule));
  if (!card.abilities?.length && trivialAttacks && onlyStandardPrizeRules) return generated(card, "printed-damage-pokemon", ["One or more fixed/no-damage attacks with blank effect text", "Printed HP, type, evolution, costs, Weakness, Resistance, retreat and standard Prize value"]);
  const reviewed = compileWave1Implementation(card); if (reviewed) return reviewed;
  const missing = [
    ...(card.abilities?.map((ability) => `Ability ${ability.name}: ${ability.text}`) ?? []),
    ...attacks.filter((attack) => attack.text.trim() || (attack.damage.trim() !== "" && !/^\d+$/.test(attack.damage.trim()))).map((attack) => `Attack ${attack.name}: ${attack.text || attack.damage || "non-damage effect"}`),
    ...(onlyStandardPrizeRules ? [] : card.rules ?? []),
  ];
  return unsupported(card, missing.length ? missing : ["No safe reusable Pokémon effect template matches this card."], trivialAttacks);
}
