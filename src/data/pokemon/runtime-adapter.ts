import type { AbilityDefinition, AttackDamage, AttackDefinition, CardDefinition, CardTrait, CardType, PokemonStage, TrainerSubtype } from "../../../engine/model/cards";
import { compileCardImplementation } from "./implementations/effect-compiler";
import type { CardImplementation, PokemonCardMetadata, PokemonType } from "./types";

const typeMap: Record<PokemonType, CardType> = { Grass: "grass", Fire: "fire", Water: "water", Lightning: "lightning", Psychic: "psychic", Fighting: "fighting", Darkness: "darkness", Metal: "metal", Dragon: "dragon", Colorless: "colorless", Fairy: "fairy" };

const attackPrograms: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "pokemon:armarouge": { "Flame Cannon": "attack:flame-cannon" },
  "pokemon:charcadet": { "Fiery Fighting Spirit": "attack:fiery-fighting-spirit" },
  "pokemon:fuecoco": { "Spacing Out": "attack:spacing-out" },
  "pokemon:radiant-tsareena": { "Aroma Shot": "attack:aroma-shot" },
  "pokemon:skeledirge-ex": { "Vitality Song": "attack:vitality-song", "Burning Voice": "attack:burning-voice" },
  "pokemon:smeargle": { "Colorful Palette": "attack:colorful-palette" },
  "pokemon:okidogi-ex": { "Poisonous Musculature": "attack:poisonous-musculature", "Chain-Crazed": "attack:chain-crazed" },
  "pokemon:munkidori": { "Mind Bend": "attack:mind-bend" },
  "pokemon:munkidori-ex": { "Dirty Headbutt": "attack:dirty-headbutt" },
  "pokemon:fezandipiti-ex": { "Cruel Arrow": "attack:cruel-arrow" },
  "pokemon:pecharunt": { "Poison Chain": "attack:poison-chain" },
  "pokemon:budew": { "Itchy Pollen": "attack:itchy-pollen" },
  "pokemon:team-rocket-nidoking-ex": { "Tainted Horn": "attack:tainted-horn" },
};

const abilityPrograms: Readonly<Record<string, AbilityDefinition[]>> = {
  "pokemon:armarouge": [{ id: "fire-off", name: "Fire Off", text: "As often as you like during your turn, you may move a Fire Energy from 1 of your Benched Pokémon to your Active Pokémon.", category: "activated", usageLimit: "unrestricted", effectProgramId: "ability:fire-off", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "attached-energy" } }],
  "pokemon:radiant-tsareena": [{ id: "elegant-heal", name: "Elegant Heal", text: "Once during your turn, you may heal 20 damage from each of your Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:elegant-heal", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-pokemon" } }],
  "pokemon:pecharunt-ex": [{ id: "subjugating-chains", name: "Subjugating Chains", text: "Once during your turn, switch a Benched Darkness Pokémon other than Pecharunt ex with your Active Pokémon. The new Active Pokémon is Poisoned.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:subjugating-chains", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-benched-pokemon" } }],
  "pokemon:munkidori": [{ id: "adrena-brain", name: "Adrena-Brain", text: "Once during your turn, if this Pokémon has Darkness Energy attached, move up to 3 damage counters from 1 of your Pokémon to 1 of your opponent's Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:adrena-brain", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-pokemon" } }],
  "pokemon:munkidori-ex": [{ id: "oh-no-you-dont", name: "Oh No You Don't", text: "If this Pokémon is Knocked Out by damage from an opponent's attack while you have Pecharunt ex in play, the opponent takes 1 fewer Prize card.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:oh-no-you-dont", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:fezandipiti-ex": [{ id: "flip-the-script", name: "Flip the Script", text: "Once during your turn, if one of your Pokémon was Knocked Out during your opponent's last turn, draw 3 cards.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:flip-the-script", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:pecharunt": [{ id: "toxic-subjugation", name: "Toxic Subjugation", text: "While Active, put 5 more damage counters on your opponent's Poisoned Pokémon during Pokémon Checkup.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:toxic-subjugation", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:tatsugiri": [{ id: "attract-customers", name: "Attract Customers", text: "Once during your turn while Active, look at the top 6 cards and put a Supporter you find there into your hand.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:attract-customers", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
};

function implementationHandler(implementation: CardImplementation): string { const handler = implementation.handlers[0]; return handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : ""; }
function traitsFor(metadata: PokemonCardMetadata, handlerId: string): CardTrait[] { const traits: CardTrait[] = []; if (/^(pokemon|trainer|stadium|energy):team-rocket/.test(handlerId)) traits.push("team-rocket"); if (metadata.subtypes.some((subtype) => /^ex$|^Pokémon ex$/i.test(subtype))) traits.push("pokemon-ex"); if (metadata.subtypes.includes("Radiant")) traits.push("radiant"); if (metadata.subtypes.some((subtype) => /ACE SPEC/i.test(subtype)) || metadata.rules?.some((rule) => /ACE SPEC/i.test(rule))) traits.push("ace-spec"); return traits; }

function damageFor(handlerId: string, name: string, printed: string): AttackDamage | null {
  // Cruel Arrow's 100 is written in its effect text rather than the printed
  // damage column. Representing it as attack damage keeps KO cause, Active
  // modifiers, and Bench Weakness/Resistance handling in the shared pipeline.
  if (handlerId === "pokemon:fezandipiti-ex" && name === "Cruel Arrow") return { kind: "fixed", amount: 100, printed };
  if (!printed) return { kind: "none", printed };
  if (/^\d+$/.test(printed)) return { kind: "fixed", amount: Number(printed), printed };
  if (handlerId === "pokemon:skeledirge-ex" && name === "Burning Voice" && printed === "270-") return { kind: "formula", printed, resolverId: "burning-voice-damage" };
  if (handlerId === "pokemon:okidogi-ex" && name === "Chain-Crazed" && printed === "130+") return { kind: "formula", printed, resolverId: "chain-crazed-damage" };
  if (handlerId === "pokemon:pecharunt-ex" && name === "Irritated Outburst" && printed === "60×") return { kind: "formula", printed, resolverId: "irritated-outburst-damage" };
  if (handlerId === "pokemon:team-rocket-nidorino" && name === "Horn Rend" && printed === "60+") return { kind: "formula", printed, resolverId: "horn-rend-damage" };
  return null;
}

function attacks(card: PokemonCardMetadata, handlerId: string): AttackDefinition[] | null {
  const mapped: Array<AttackDefinition | null> = (card.attacks ?? []).map((attack, index) => {
    const damage = damageFor(handlerId, attack.name, attack.damage);
    return damage ? { id: `${card.id}-attack-${index}`, name: attack.name, cost: attack.cost.reduce<Partial<Record<CardType, number>>>((cost, type) => { if (type === "Free") return cost; const key = typeMap[type]; cost[key] = (cost[key] ?? 0) + 1; return cost; }, {}), damage, ...(attack.text ? { text: attack.text } : {}), ...(attackPrograms[handlerId]?.[attack.name] ? { effectProgramId: attackPrograms[handlerId]![attack.name] } : {}) } : null;
  });
  return mapped.every((attack): attack is AttackDefinition => Boolean(attack)) ? mapped : null;
}

function trainerSubtype(card: PokemonCardMetadata): TrainerSubtype | null {
  const subtype = card.subtypes[0]?.toLocaleLowerCase("en-US") ?? "item";
  if (subtype.includes("tool")) return "tool";
  return (["item", "supporter", "stadium"] as const).find((value) => subtype === value) ?? null;
}

export function toRuntimeCardDefinition(metadata: PokemonCardMetadata): CardDefinition | null {
  const implementation = compileCardImplementation(metadata);
  if (!["complete", "generated"].includes(implementation.status)) return null;
  const handlerId = implementationHandler(implementation); const traits = traitsFor(metadata, handlerId);
  if (handlerId === "energy:team-rocket") return { id: metadata.id, name: metadata.name, category: "energy", energyType: "darkness", basic: false, traits, supplyOptions: [{ darkness: 2 }, { psychic: 2 }, { darkness: 1, psychic: 1 }], attachOnlyToTrait: "team-rocket", implementationStatus: implementation.status };
  if (metadata.supertype === "Energy" && metadata.subtypes.includes("Basic") && metadata.types?.[0]) return { id: metadata.id, name: metadata.name, category: "energy", energyType: typeMap[metadata.types[0]], basic: true, traits, implementationStatus: implementation.status };
  if (metadata.supertype === "Pokémon" && metadata.types?.[0] && metadata.hp) {
    const runtimeAttacks = attacks(metadata, handlerId); if (!runtimeAttacks) return null;
    const stage: PokemonStage = metadata.subtypes.includes("Basic") ? "basic" : metadata.subtypes.includes("Stage 2") ? "stage2" : "stage1";
    const multiplier = Number(metadata.weaknesses?.[0]?.value.replace(/[^0-9.]/g, "")) || 2;
    const resistance = Number(metadata.resistances?.[0]?.value.replace(/[^0-9]/g, "")) || 0;
    const prizeValue = metadata.subtypes.some((subtype) => /VMAX/i.test(subtype)) ? 3 : metadata.subtypes.some((subtype) => /ex|EX|VSTAR|Pokémon V/i.test(subtype)) ? 2 : 1;
    const hasRuleBox = metadata.subtypes.some((subtype) => /\b(ex|EX|V|VMAX|VSTAR|Radiant|BREAK|GX)\b/.test(subtype)) || Boolean(metadata.ruleBoxText?.length);
    const isPokemonEx = metadata.subtypes.some((subtype) => /^Pokémon ex$/i.test(subtype) || /^ex$/i.test(subtype));
    const runtimeAbilities = (abilityPrograms[handlerId] ?? []).map((ability) => ({ ...ability, id: `${metadata.id}-${ability.id}` }));
    return { id: metadata.id, name: metadata.name, category: "pokemon", pokemonType: typeMap[metadata.types[0]], stage, evolvesFrom: metadata.evolvesFrom, hp: metadata.hp, ruleBox: prizeValue > 1 ? "multi-prize" : "single-prize", hasRuleBox, isPokemonEx, prizeValue, traits, abilities: runtimeAbilities, attacks: runtimeAttacks, weakness: metadata.weaknesses?.[0] ? { type: typeMap[metadata.weaknesses[0].type], multiplier } : undefined, resistance: metadata.resistances?.[0] ? { type: typeMap[metadata.resistances[0].type], amount: resistance } : undefined, retreatCost: metadata.retreat, regulationMark: metadata.regulationMark, implementationStatus: implementation.status };
  }
  if (metadata.supertype === "Trainer") {
    const subtype = trainerSubtype(metadata); if (!subtype) return null;
    const effectProgramId = handlerId;
    if (!effectProgramId) return null;
    return { id: metadata.id, name: metadata.name, category: "trainer", subtype, text: metadata.trainerText ?? "", effectProgramId, traits, canPlayGoingFirstFirstTurn: handlerId === "trainer:team-rocket-proton", implementationStatus: implementation.status };
  }
  return null;
}
