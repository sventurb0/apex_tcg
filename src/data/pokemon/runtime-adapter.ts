import type { AbilityDefinition, AttackDamage, AttackDefinition, CardDefinition, CardTrait, CardType, PokemonStage, TrainerSubtype } from "../../../engine/model/cards";
import { compileCardImplementation } from "./implementations/effect-compiler";
import { matchWave1Ability } from "./implementations/templates/abilities/wave-1";
import { matchWave1Attack } from "./implementations/templates/attacks/wave-1";
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
  "pokemon:team-rocket-spidops": { "Rocket Rush": "attack:rocket-rush" },
  "pokemon:team-rocket-mewtwo-ex": { "Erasure Ball": "attack:erasure-ball" },
  "pokemon:team-rocket-articuno": { "Dark Frost": "attack:dark-frost" },
  "pokemon:team-rocket-mimikyu": { "Gemstone Mimicry": "attack:gemstone-mimicry" },
  "pokemon:lillies-clefairy-ex": { "Full Moon Rondo": "attack:full-moon-rondo" },
  "pokemon:drakloak": { "Dragon Headbutt": "attack:dragon-headbutt" },
  "pokemon:dragapult-ex": { "Jet Headbutt": "attack:jet-headbutt", "Phantom Dive": "attack:phantom-dive" },
  "pokemon:meowth-ex": { "Tuck Tail": "attack:meowth-tuck-tail" },
  "pokemon:ns-zoroark-ex": { "Night Joker": "attack:night-joker" },
  "pokemon:ns-zekrom": { "Rampaging Thunder": "attack:ns-zekrom-rampage" },
  "pokemon:yveltal": { "Clutch": "attack:yveltal-clutch" },
  "pokemon:teal-mask-ogerpon-ex": {}, "pokemon:chikorita": {}, "pokemon:bayleef": {},
  "pokemon:mega-kangaskhan-ex": { "Rapid-Fire Combo": "attack:rapid-fire-combo" }, "pokemon:latias-ex": { "Eon Blade": "attack:eon-blade" }, "pokemon:chien-pao": { "Icicle Loop": "attack:icicle-loop" }, "pokemon:passimian": {}, "pokemon:raging-bolt-ex": { "Burst Roar": "attack:burst-roar", "Bellowing Thunder": "attack:bellowing-thunder" }, "pokemon:wellspring-mask-ogerpon-ex": { "Sob": "attack:sob", "Torrential Pump": "attack:torrential-pump" },
  "pokemon:meganium": {}, "pokemon:applin": {}, "pokemon:dipplin": {}, "pokemon:hydrapple-ex": {}, "pokemon:celebi": {},
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
  "pokemon:meowth-ex": [{ id: "last-ditch-catch", name: "Last-Ditch Catch", text: "Once during your turn, when you play this Pokémon from your hand onto your Bench, you may search your deck for a Supporter.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:last-ditch-catch", targeting: { sourceMayBeActive: false, sourceMayBeBenched: true }, triggerOn: "pokemon-benched" }],
  "pokemon:mega-kangaskhan-ex": [{ id: "run-errand", name: "Run Errand", text: "Once during your turn, if this Pokémon is in the Active Spot, draw 2 cards.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:run-errand", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:latias-ex": [{ id: "skyliner", name: "Skyliner", text: "Your Basic Pokémon in play have no Retreat Cost.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:skyliner", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:chien-pao": [{ id: "snow-sink", name: "Snow Sink", text: "When you play this Pokémon from your hand onto your Bench during your turn, you may discard a Stadium in play.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:snow-sink", targeting: { sourceMayBeActive: false, sourceMayBeBenched: true }, triggerOn: "pokemon-benched" }],
  "pokemon:team-rocket-spidops": [{ id: "charging-up", name: "Charging Up", text: "Once during your turn, you may attach a Basic Energy card from your discard pile to this Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:charging-up", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:team-rocket-mewtwo-ex": [{ id: "power-saver", name: "Power Saver", text: "This Pokémon can't attack unless you have 4 or more Team Rocket's Pokémon in play.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:power-saver", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:team-rocket-articuno": [{ id: "repelling-veil", name: "Repelling Veil", text: "Prevent all effects of attacks used by your opponent's Pokémon done to your Basic Team Rocket's Pokémon. (Existing effects are not removed. Damage is not an effect.)", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:repelling-veil", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:lillies-clefairy-ex": [{ id: "fairy-zone", name: "Fairy Zone", text: "The Weakness of each of your opponent's Dragon Pokémon in play is now Psychic. (Apply Weakness as ×2.)", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:fairy-zone", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:drakloak": [{ id: "recon-directive", name: "Recon Directive", text: "Once during your turn, you may look at the top 2 cards of your deck and put 1 of them into your hand. Put the other card on the bottom of your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:recon-directive", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:ns-zoroark-ex": [{ id: "trade", name: "Trade", text: "Once during your turn, discard a card from your hand to draw 2 cards.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:ns-trade", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:teal-mask-ogerpon-ex": [{ id: "teal-dance", name: "Teal Dance", text: "Once during your turn, attach a Basic Grass Energy from your hand to this Pokémon, then draw a card.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:teal-dance", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:meganium": [{ id: "wild-growth", name: "Wild Growth", text: "Each Basic Grass Energy attached to all of your Pokémon provides GrassGrass Energy.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:wild-growth", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:hydrapple-ex": [{ id: "ripening-charge", name: "Ripening Charge", text: "Once during your turn, attach a Basic Grass Energy from your hand to 1 of your Pokémon and heal 30 from it.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:ripening-charge", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
};

function implementationHandler(implementation: CardImplementation): string { const handler = implementation.handlers[0]; return handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : ""; }
function abilitiesFor(card: PokemonCardMetadata, handlerId: string): AbilityDefinition[] { if (handlerId !== "template:pokemon-wave-1") return (abilityPrograms[handlerId] ?? []).map((ability) => ({ ...ability, id: `${card.id}-${ability.id}` })); return (card.abilities ?? []).flatMap((ability, index) => { const match = matchWave1Ability(ability); if (!match) return []; return [{ id: `${card.id}-ability-${index}`, name: ability.name, text: ability.text, category: "activated" as const, usageLimit: match.usageLimit ?? "once-per-turn-per-pokemon" as const, effectProgramId: match.programId, targeting: { sourceMayBeActive: !match.sourceBenchedOnly, sourceMayBeBenched: !match.sourceActiveOnly } }]; }); }
function traitsFor(metadata: PokemonCardMetadata, handlerId: string): CardTrait[] { const traits: CardTrait[] = []; if (/^(pokemon|trainer|stadium|energy):team-rocket/.test(handlerId)) traits.push("team-rocket"); if (metadata.subtypes.some((subtype) => /^ex$|^Pokémon ex$/i.test(subtype))) traits.push("pokemon-ex"); if (metadata.subtypes.includes("Radiant")) traits.push("radiant"); if (metadata.subtypes.some((subtype) => /^Tera$/i.test(subtype)) || metadata.rules?.some((rule) => /^Tera:/i.test(rule))) traits.push("tera"); if (metadata.subtypes.some((subtype) => /ACE SPEC/i.test(subtype)) || metadata.rules?.some((rule) => /ACE SPEC/i.test(rule))) traits.push("ace-spec"); return traits; }

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
  if (handlerId === "pokemon:team-rocket-spidops" && name === "Rocket Rush" && printed === "30×") return { kind: "formula", printed, resolverId: "rocket-rush-damage" };
  if (handlerId === "pokemon:team-rocket-mewtwo-ex" && name === "Erasure Ball" && printed === "160+") return { kind: "formula", printed, resolverId: "erasure-ball-damage" };
  if (handlerId === "pokemon:team-rocket-articuno" && name === "Dark Frost" && printed === "60+") return { kind: "formula", printed, resolverId: "dark-frost-damage" };
  if (handlerId === "pokemon:lillies-clefairy-ex" && name === "Full Moon Rondo" && printed === "20+") return { kind: "formula", printed, resolverId: "full-moon-rondo-damage" };
  if (handlerId === "pokemon:team-rocket-mimikyu" && name === "Gemstone Mimicry") return { kind: "none", printed };
  if (handlerId === "pokemon:teal-mask-ogerpon-ex" && name === "Myriad Leaf Shower") return { kind: "formula", printed, resolverId: "teal-leaf-shower-damage" };
  if (handlerId === "pokemon:hydrapple-ex" && name === "Syrup Storm") return { kind: "formula", printed, resolverId: "syrup-storm-damage" };
  if (handlerId === "pokemon:dipplin" && name === "Do the Wave") return { kind: "formula", printed, resolverId: "dipplin-wave-damage" };
  if (handlerId === "pokemon:applin" && name === "Tumbling Attack") return { kind: "formula", printed, resolverId: "applin-tumbling-damage" };
  if (handlerId === "pokemon:mega-kangaskhan-ex" && name === "Rapid-Fire Combo") return { kind: "formula", printed, resolverId: "rapid-fire-combo-damage" };
  if (handlerId === "pokemon:passimian" && name === "Coordinated Throwing") return { kind: "formula", printed, resolverId: "passimian-basic-damage" };
  if (handlerId === "pokemon:raging-bolt-ex" && name === "Bellowing Thunder") return { kind: "formula", printed, resolverId: "raging-bolt-damage" };
  return null;
}

function attacks(card: PokemonCardMetadata, handlerId: string): AttackDefinition[] | null {
  const mapped: Array<AttackDefinition | null> = (card.attacks ?? []).map((attack, index) => {
    const damage = damageFor(handlerId, attack.name, attack.damage);
    const templateProgram = handlerId === "template:pokemon-wave-1" ? matchWave1Attack(attack)?.programId : undefined; const effectProgramId = attackPrograms[handlerId]?.[attack.name] ?? templateProgram;
    return damage ? { id: `${card.id}-attack-${index}`, name: attack.name, cost: attack.cost.reduce<Partial<Record<CardType, number>>>((cost, type) => { if (type === "Free") return cost; const key = typeMap[type]; cost[key] = (cost[key] ?? 0) + 1; return cost; }, {}), damage, ...(attack.text ? { text: attack.text } : {}), ...(effectProgramId ? { effectProgramId } : {}) } : null;
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
    const isMega = metadata.subtypes.some((subtype) => /^MEGA$/i.test(subtype)) || metadata.rules?.some((rule) => /Mega Evolution Pokémon ex Rule/i.test(rule)) === true;
    const prizeValue = isMega && metadata.subtypes.some((subtype) => /ex|EX/i.test(subtype)) ? 3 : metadata.subtypes.some((subtype) => /VMAX/i.test(subtype)) ? 3 : metadata.subtypes.some((subtype) => /ex|EX|VSTAR|Pokémon V/i.test(subtype)) ? 2 : 1;
    const hasRuleBox = metadata.subtypes.some((subtype) => /\b(ex|EX|V|VMAX|VSTAR|Radiant|BREAK|GX)\b/.test(subtype)) || Boolean(metadata.ruleBoxText?.length);
    const isPokemonEx = metadata.subtypes.some((subtype) => /^Pokémon ex$/i.test(subtype) || /^ex$/i.test(subtype));
    const runtimeAbilities = abilitiesFor(metadata, handlerId);
    return { id: metadata.id, name: metadata.name, category: "pokemon", pokemonType: typeMap[metadata.types[0]], stage, evolvesFrom: metadata.evolvesFrom, hp: metadata.hp, ruleBox: prizeValue > 1 ? "multi-prize" : "single-prize", hasRuleBox, isPokemonEx, isMega, prizeValue, traits, abilities: runtimeAbilities, attacks: runtimeAttacks, weakness: metadata.weaknesses?.[0] ? { type: typeMap[metadata.weaknesses[0].type], multiplier } : undefined, resistance: metadata.resistances?.[0] ? { type: typeMap[metadata.resistances[0].type], amount: resistance } : undefined, retreatCost: metadata.retreat, regulationMark: metadata.regulationMark, implementationStatus: implementation.status };
  }
  if (metadata.supertype === "Trainer") {
    const subtype = trainerSubtype(metadata); if (!subtype) return null;
    const effectProgramId = handlerId;
    if (!effectProgramId) return null;
    return { id: metadata.id, name: metadata.name, category: "trainer", subtype, text: metadata.trainerText ?? "", effectProgramId, traits, canPlayGoingFirstFirstTurn: handlerId === "trainer:team-rocket-proton", implementationStatus: implementation.status };
  }
  return null;
}
