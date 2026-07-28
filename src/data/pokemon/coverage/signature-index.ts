import { inferStrategicTags, normalizeAbilityText, type StrategicTag } from "../ability-coverage";
import { normalizeCardName } from "../catalogue";
import { compileCardImplementation } from "../implementations/effect-compiler";
import type { PokemonCardMetadata, PrintedAbility, PrintedAttack, SimulationSupport } from "../types";
import { matchWave1Ability } from "../implementations/templates/abilities/wave-1";
import { matchWave1Attack } from "../implementations/templates/attacks/wave-1";
import { matchWave1Trainer } from "../implementations/templates/trainers/wave-1";
import type { CoverageComplexity, CoverageEffectKind, CoverageSignature, CoverageSignatureIndex, SignatureSupport } from "./types";

export const FAVOURITE_POKEMON = ["Swalot", "Skeledirge", "Alolan Muk", "Charizard", "Arcanine", "Bellibolt", "Corviknight", "Gengar", "Alolan Marowak", "Annihilape", "Hawlucha", "Alolan Raichu", "Nihilego", "Alakazam", "Machamp", "Dragonite", "Gyarados"] as const;

const reminder = /^(you may play (?:any number of|as many) item cards|you may play only 1 supporter card|you may play only 1 stadium card|attach a pokemon tool to 1 of your pokemon|the attacks of the pokemon this card is attached to)/i;
function stableId(kind: CoverageEffectKind, value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `${kind}:${(hash >>> 0).toString(36)}`; }
export function normalizeEffectText(value: string): string { return normalizeAbilityText(value).replace(/\s+/g, " ").trim(); }
function cardEffectText(card: PokemonCardMetadata): string {
  const rules = (card.rules ?? []).map(normalizeEffectText).filter((rule) => rule && !reminder.test(rule));
  if (rules.length) return rules.join(" | ");
  const raw = card.supertype === "Trainer" ? card.trainerText ?? "" : card.energyText ?? "";
  return normalizeEffectText(raw).split(/(?<=[.!?])\s+/u).filter((sentence) => sentence && !reminder.test(sentence)).join(" ");
}
export function attackEffectSignature(attack: PrintedAttack): string { return JSON.stringify({ name: normalizeCardName(attack.name), damage: attack.damage.trim(), text: normalizeEffectText(attack.text), cost: attack.cost.map((value) => normalizeCardName(value)) }); }
export function trainerEnergyEffectSignature(card: PokemonCardMetadata): string { return JSON.stringify({ kind: card.supertype === "Energy" ? "energy" : "trainer", subtypes: card.subtypes.map(normalizeCardName).sort(), text: cardEffectText(card) }); }
function abilityEffectSignature(ability: PrintedAbility): string { return JSON.stringify({ name: normalizeCardName(ability.name), type: normalizeCardName(ability.type), text: normalizeEffectText(ability.text) }); }

function proposedTemplate(kind: CoverageEffectKind, text: string, damage = ""): string | undefined {
  if (kind === "ability") {
    if (/^once during your turn,? you may draw (\d+) cards?\.?$/i.test(text)) return "ability:once-per-turn-draw-fixed";
    if (/^once during your turn,? you may draw cards until you have (\d+) cards? in your hand\.?$/i.test(text)) return "ability:once-per-turn-draw-to-hand-size";
    if (/^this pokemon has no retreat cost\.?$/i.test(text)) return "ability:free-retreat-passive";
    if (/^prevent all effects of attacks, including damage, done to this pokemon by your opponent's pokemon with abilities\.?$/i.test(text)) return "ability:prevent-attacks-from-exact-source";
  }
  if (kind === "attack") {
    if (!text && (/^\d+$/.test(damage) || damage === "")) return "attack:printed-fixed-or-no-damage";
    if (/^your opponent's active pokemon is now (poisoned|burned|confused|asleep|paralyzed)\.?$/i.test(text)) return "attack:apply-special-condition";
    if (/^heal (\d+) damage from this pokemon\.?$/i.test(text)) return "attack:heal-self-fixed";
    if (/^this pokemon also does (\d+) damage to itself\.?$/i.test(text)) return "attack:recoil-fixed";
    if (/^flip (\d+) coins?\. this attack does (\d+) damage for each heads\.?$/i.test(text)) return "attack:coin-flip-multiplier";
  }
  if (kind === "trainer") {
    if (/^draw (\d+) cards?\.?$/i.test(text)) return "trainer:draw-fixed";
    if (/^(?:switch your active pokemon with 1 of your benched pokemon|switch 1 of your active pokemon with 1 of your benched pokemon)\.?$/i.test(text)) return "trainer:switch-active-with-bench";
    if (/^heal (\d+) damage from 1 of your pokemon\.?$/i.test(text)) return "trainer:heal-selected-fixed";
    if (/^search your deck for a basic pokemon, reveal it, and put it into your hand\. then, shuffle your deck\.?$/i.test(text)) return "trainer:search-basic-pokemon-to-hand";
  }
  if (kind === "energy" && /^this card provides colorless energy\.?$/i.test(text)) return "energy:single-colorless";
  return undefined;
}

function complexityFor(text: string, template?: string): CoverageComplexity {
  if (template?.includes("printed-fixed") || template?.includes("draw-fixed") || template?.includes("heal-") || template?.includes("switch-") || template?.includes("single-colorless")) return "low";
  if (template) return "medium";
  const clauses = text.split(/[.;]|\bthen\b|\bif\b/iu).filter((value) => value.trim()).length;
  if (/copy|choose 1 of your opponent|for each different type|until the end|during your opponent's next turn|as long as|whenever/i.test(text) || clauses >= 4) return "high";
  return clauses <= 1 && text.length < 120 ? "low" : "medium";
}
function tagsFor(kind: CoverageEffectKind, text: string, damage: string): StrategicTag[] {
  const tags = new Set(inferStrategicTags(text));
  if (kind === "attack" && (damage || /damage/.test(text))) tags.add("primary-attacker");
  if (/switch your opponent|benched pokemon.*active spot|gust/i.test(text)) tags.add("gust");
  if (/recover|discard pile.*hand|put .*discard pile.*deck/i.test(text)) tags.add("discard-recovery");
  if (/search your deck/.test(text)) tags.add(/energy/.test(text) ? "energy-search" : /pokemon/.test(text) ? "pokemon-search" : "trainer-search");
  if (/cannot play any item|item cards.*can't be played|item lock/i.test(text)) tags.add("item-lock");
  if (/can't retreat|cannot retreat/.test(text)) tags.add("retreat-lock");
  if (/more damage|damage is .* more/.test(text)) tags.add("damage-modifier");
  if (/maximum hp|more hp/.test(text)) tags.add("hp-modifier");
  return [...tags].sort();
}

interface Occurrence { card: PokemonCardMetadata; displayName: string; normalizedText: string; signature: string; printedDamage?: string; costShape?: string[]; implementedTemplateId?: string; }
function supportFor(statuses: SimulationSupport[]): SignatureSupport { const ready = statuses.filter((status) => status === "complete" || status === "generated").length; return ready === statuses.length ? "complete" : ready ? "partial" : statuses.some((status) => status === "partial") ? "partial" : "unsupported"; }
function buildGroups(kind: CoverageEffectKind, occurrences: Occurrence[], deckReferences: Readonly<Record<string, readonly string[]>>): CoverageSignature[] {
  const groups = new Map<string, Occurrence[]>(); for (const occurrence of occurrences) groups.set(occurrence.signature, [...(groups.get(occurrence.signature) ?? []), occurrence]);
  return [...groups.entries()].map(([signature, entries]) => {
    const cards = entries.map((entry) => entry.card); const implementations = cards.map(compileCardImplementation); const statuses = implementations.map((implementation) => implementation.status); const sourceStatuses = statuses.reduce<Partial<Record<SimulationSupport, number>>>((counts, status) => ({ ...counts, [status]: (counts[status] ?? 0) + 1 }), {}); const cardIds = [...new Set(cards.map((card) => card.id))].sort(); const normalizedText = entries[0]!.normalizedText; const template = proposedTemplate(kind, normalizedText, entries[0]!.printedDamage); const implementedTemplateId = entries.every((entry) => entry.implementedTemplateId === entries[0]!.implementedTemplateId) ? entries[0]!.implementedTemplateId : undefined;
    const favouriteNames = FAVOURITE_POKEMON.filter((name) => cards.some((card) => normalizeCardName(card.name) === normalizeCardName(name)));
    return { id: stableId(kind, signature), kind, displayName: entries[0]!.displayName, normalizedText, printedDamage: entries[0]!.printedDamage, costShape: entries[0]!.costShape, exactOccurrenceCount: entries.length, cardIds, cardNames: [...new Set(cards.map((card) => card.name))].sort(), functionalFamilyCount: new Set(implementations.flatMap((implementation) => implementation.behaviourFamilyId ?? [])).size, functionalReprintCount: implementations.filter((implementation) => implementation.implementationSource === "functional-reprint").length, standardLegalPrintings: cards.filter((card) => card.legalities.standard === "Legal").length, support: implementedTemplateId ? "complete" : supportFor(statuses), sourceStatuses, completeCardIds: [...new Set(cards.filter((_, index) => ["complete", "generated"].includes(statuses[index]!)).map((card) => card.id))].sort(), unsupportedCardIds: [...new Set(cards.filter((_, index) => !["complete", "generated"].includes(statuses[index]!)).map((card) => card.id))].sort(), strategicTags: tagsFor(kind, normalizedText, entries[0]!.printedDamage ?? ""), referencedByDecks: Object.entries(deckReferences).filter(([, ids]) => ids.some((id) => cardIds.includes(id))).map(([name]) => name).sort(), favouriteNames, complexity: complexityFor(normalizedText, template), proposedTemplate: template, implementedTemplateId } satisfies CoverageSignature;
  }).sort((a, b) => b.exactOccurrenceCount - a.exactOccurrenceCount || a.id.localeCompare(b.id));
}

export function buildCoverageSignatureIndex(cards: readonly PokemonCardMetadata[], deckReferences: Readonly<Record<string, readonly string[]>> = {}): CoverageSignatureIndex {
  const abilities: Occurrence[] = [], attacks: Occurrence[] = [], trainerEffects: Occurrence[] = [], energyEffects: Occurrence[] = [];
  for (const card of cards) {
    for (const ability of card.abilities ?? []) { const normalizedText = normalizeEffectText(ability.text); abilities.push({ card, displayName: ability.name, normalizedText, signature: abilityEffectSignature(ability), implementedTemplateId: matchWave1Ability(ability)?.templateId }); }
    for (const attack of card.attacks ?? []) { const normalizedText = normalizeEffectText(attack.text); const trivial = !attack.text.trim() && (attack.damage.trim() === "" || /^\d+$/.test(attack.damage.trim())); attacks.push({ card, displayName: attack.name, normalizedText, signature: attackEffectSignature(attack), printedDamage: attack.damage.trim(), costShape: attack.cost.map((value) => normalizeCardName(value)), implementedTemplateId: trivial ? "attack-printed-fixed-or-no-damage" : matchWave1Attack(attack)?.templateId }); }
    if (card.supertype === "Trainer" || (card.supertype === "Energy" && !card.subtypes.includes("Basic"))) { const normalizedText = cardEffectText(card); const occurrence = { card, displayName: card.name, normalizedText, signature: trainerEnergyEffectSignature(card), implementedTemplateId: card.supertype === "Trainer" ? matchWave1Trainer(card)?.templateId : undefined }; (card.supertype === "Trainer" ? trainerEffects : energyEffects).push(occurrence); }
  }
  return { abilities: buildGroups("ability", abilities, deckReferences), attacks: buildGroups("attack", attacks, deckReferences), trainerEffects: buildGroups("trainer", trainerEffects, deckReferences), energyEffects: buildGroups("energy", energyEffects, deckReferences) };
}
