import { normalizeCardName } from "./catalogue";
import { compileCardImplementation } from "./implementations/effect-compiler";
import type { PokemonCardMetadata, PrintedAbility } from "./types";

export type StrategicTag = "primary-attacker" | "secondary-attacker" | "draw" | "hand-refresh" | "pokemon-search" | "trainer-search" | "energy-search" | "energy-acceleration" | "energy-movement" | "switching" | "gust" | "healing" | "damage-counter-movement" | "poison" | "special-condition" | "damage-modifier" | "hp-modifier" | "prize-modifier" | "item-lock" | "retreat-lock" | "ability-lock" | "discard-recovery" | "evolution-support" | "bench-support" | "setup" | "finisher";

export interface AbilitySignatureRecord {
  id: string;
  name: string;
  normalizedText: string;
  abilityType: string;
  exactPrintingCount: number;
  gameplayVariantCount: number;
  cardNames: string[];
  cardIds: string[];
  simulationStatus: "complete" | "functional-reprint" | "unsupported";
  handlerId?: string;
  behaviourFamilyIds: string[];
  reviewedTags: StrategicTag[];
  inferredTags: StrategicTag[];
  referencedByDecks: string[];
}

const reviewedAbilities: ReadonlyArray<{ name: string; text: string; handlerId: string; tags: StrategicTag[] }> = [
  { name: "Fire Off", text: "As often as you like during your turn, you may move a Fire Energy from 1 of your Benched Pokémon to your Active Pokémon.", handlerId: "ability:fire-off", tags: ["energy-movement", "energy-acceleration"] },
  { name: "Elegant Heal", text: "Once during your turn, you may heal 20 damage from each of your Pokémon.", handlerId: "ability:elegant-heal", tags: ["healing"] },
  { name: "Subjugating Chains", text: "Once during your turn, switch a Benched Darkness Pokémon other than Pecharunt ex with your Active Pokémon. The new Active Pokémon is Poisoned.", handlerId: "ability:subjugating-chains", tags: ["switching", "poison"] },
  { name: "Adrena-Brain", text: "Once during your turn, if this Pokémon has Darkness Energy attached, move up to 3 damage counters from 1 of your Pokémon to 1 of your opponent's Pokémon.", handlerId: "ability:adrena-brain", tags: ["damage-counter-movement"] },
  { name: "Flip the Script", text: "Once during your turn, if one of your Pokémon was Knocked Out during your opponent's last turn, draw 3 cards.", handlerId: "ability:flip-the-script", tags: ["draw"] },
  { name: "Toxic Subjugation", text: "While Active, put 5 more damage counters on your opponent's Poisoned Pokémon during Pokémon Checkup.", handlerId: "passive:toxic-subjugation", tags: ["poison", "damage-modifier"] },
  { name: "Attract Customers", text: "Once during your turn while Active, look at the top 6 cards and put a Supporter you find there into your hand.", handlerId: "ability:attract-customers", tags: ["trainer-search"] },
  { name: "Oh No You Don't", text: "If this Pokémon is Knocked Out by damage from an opponent's attack while you have Pecharunt ex in play, the opponent takes 1 fewer Prize card.", handlerId: "passive:oh-no-you-dont", tags: ["prize-modifier"] },
];
const reviewedCardAbilities: Readonly<Record<string, { handlerId: string; tags: StrategicTag[] }>> = {
  "sv1-41": { handlerId: "ability:fire-off", tags: ["energy-movement", "energy-acceleration"] },
  "swsh12-16": { handlerId: "ability:elegant-heal", tags: ["healing"] },
  "sv6pt5-39": { handlerId: "ability:subjugating-chains", tags: ["switching", "poison"] },
  "sv6-95": { handlerId: "ability:adrena-brain", tags: ["damage-counter-movement"] },
  "sv6pt5-37": { handlerId: "passive:oh-no-you-dont", tags: ["prize-modifier"] },
  "me2pt5-142": { handlerId: "ability:flip-the-script", tags: ["draw"] },
  "svp-129": { handlerId: "passive:toxic-subjugation", tags: ["poison", "damage-modifier"] },
  "sv6-131": { handlerId: "ability:attract-customers", tags: ["trainer-search"] },
};

export function normalizeAbilityText(value: string): string { return normalizeCardName(value).replace(/\s*([.,;:!?])\s*/g, "$1 ").trim(); }
export function abilitySignature(ability: PrintedAbility): string { return JSON.stringify({ name: normalizeCardName(ability.name), type: normalizeCardName(ability.type), text: normalizeAbilityText(ability.text) }); }
function signatureId(value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `ability:${(hash >>> 0).toString(36)}`; }
const reviewedBySignature = new Map(reviewedAbilities.map((ability) => [abilitySignature({ name: ability.name, text: ability.text, type: "Ability" }), ability]));

export function reviewedAbility(signature: string): { handlerId: string; tags: StrategicTag[] } | undefined { const direct = reviewedBySignature.get(signature); if (direct) return direct; const parsed = JSON.parse(signature) as { name: string; text: string }; const match = reviewedAbilities.find((ability) => normalizeCardName(ability.name) === parsed.name && normalizeAbilityText(ability.text) === parsed.text); return match; }

export function inferStrategicTags(text: string): StrategicTag[] {
  const normalized = normalizeAbilityText(text); const tags = new Set<StrategicTag>();
  if (/draw \d|draw until|put .* into your hand/.test(normalized)) tags.add("draw");
  if (/search your deck.*pokemon|basic pokemon/.test(normalized)) tags.add("pokemon-search");
  if (/supporter|trainer card/.test(normalized) && /look at|search|put .* hand/.test(normalized)) tags.add("trainer-search");
  if (/energy.*attach|attach.*energy/.test(normalized)) tags.add("energy-acceleration");
  if (/move .*energy/.test(normalized)) tags.add("energy-movement");
  if (/switch/.test(normalized)) tags.add("switching");
  if (/heal/.test(normalized)) tags.add("healing");
  if (/damage counter/.test(normalized) && /move/.test(normalized)) tags.add("damage-counter-movement");
  if (/poison/.test(normalized)) tags.add("poison");
  if (/retreat cost|no retreat/.test(normalized)) tags.add("retreat-lock");
  return [...tags];
}

export function buildAbilitySignatureCatalogue(cards: readonly PokemonCardMetadata[], deckReferences: Readonly<Record<string, readonly string[]>> = {}): AbilitySignatureRecord[] {
  const groups = new Map<string, Array<{ card: PokemonCardMetadata; ability: PrintedAbility }>>();
  for (const card of cards) for (const ability of card.abilities ?? []) { const signature = abilitySignature(ability); groups.set(signature, [...(groups.get(signature) ?? []), { card, ability }]); }
  const variantsByName = new Map<string, number>();
  for (const entries of groups.values()) { const name = normalizeCardName(entries[0]!.ability.name); variantsByName.set(name, (variantsByName.get(name) ?? 0) + 1); }
  return [...groups.entries()].map(([signature, entries]) => {
    const reviewed = reviewedAbility(signature) ?? entries.map(({ card }) => reviewedCardAbilities[card.id]).find(Boolean); const implementations = entries.map(({ card }) => compileCardImplementation(card));
    const explicit = implementations.some((implementation) => implementation.implementationSource === "explicit");
    const inherited = implementations.some((implementation) => implementation.implementationSource === "functional-reprint");
    const cardIds = entries.map(({ card }) => card.id).sort();
    return { id: signatureId(signature), name: entries[0]!.ability.name, normalizedText: normalizeAbilityText(entries[0]!.ability.text), abilityType: entries[0]!.ability.type, exactPrintingCount: entries.length, gameplayVariantCount: variantsByName.get(normalizeCardName(entries[0]!.ability.name)) ?? 1, cardNames: [...new Set(entries.map(({ card }) => card.name))].sort(), cardIds, simulationStatus: reviewed && explicit ? "complete" : reviewed && inherited ? "functional-reprint" : reviewed ? "complete" : "unsupported", handlerId: reviewed?.handlerId, behaviourFamilyIds: [...new Set(implementations.flatMap((implementation) => implementation.behaviourFamilyId ?? []))].sort(), reviewedTags: reviewed?.tags ?? [], inferredTags: reviewed ? [] : inferStrategicTags(entries[0]!.ability.text), referencedByDecks: Object.entries(deckReferences).filter(([, ids]) => ids.some((id) => cardIds.includes(id))).map(([deck]) => deck).sort() } satisfies AbilitySignatureRecord;
  }).sort((a, b) => b.exactPrintingCount - a.exactPrintingCount || a.id.localeCompare(b.id));
}
