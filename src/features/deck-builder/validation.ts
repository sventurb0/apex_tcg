import type { DeckManifest } from "../../data/decks/types";
import { compileCardImplementation } from "../../data/pokemon";
import type { CatalogueIndex, PokemonCardMetadata } from "../../data/pokemon";

export interface BuilderIssue { severity: "error" | "warning"; message: string; }
export interface DeckAnalysis { total: number; pokemon: number; trainers: number; energy: number; issues: BuilderIssue[]; unsupported: PokemonCardMetadata[]; simulationReady: boolean; }

export function analyseDeck(deck: DeckManifest, index: CatalogueIndex): DeckAnalysis {
  const issues: BuilderIssue[] = [];
  let pokemon = 0, trainers = 0, energy = 0, radiantPokemon = 0, aceSpecCards = 0;
  const names = new Map<string, number>();
  const cards: PokemonCardMetadata[] = [];
  for (const entry of deck.entries) {
    const card = index.byId.get(entry.cardId);
    if (!card) { issues.push({ severity: "error", message: `Missing catalogue record: ${entry.cardId}.` }); continue; }
    cards.push(card);
    names.set(card.name, (names.get(card.name) ?? 0) + entry.count);
    if (card.supertype === "Pokémon") { pokemon += entry.count; if (card.subtypes.includes("Radiant")) radiantPokemon += entry.count; }
    else if (card.supertype === "Trainer") trainers += entry.count;
    else energy += entry.count;
    if (card.subtypes.some((subtype) => /ACE SPEC/i.test(subtype)) || card.rules?.some((rule) => /ACE SPEC/i.test(rule))) aceSpecCards += entry.count;
    if (deck.format === "standard" && card.legalities.standard !== "Legal") issues.push({ severity: "warning", message: `${card.name} (${card.setCode} ${card.collectorNumber}) is not Standard legal in the source dataset.` });
    if (deck.format === "expanded" && card.legalities.expanded !== "Legal") issues.push({ severity: "warning", message: `${card.name} (${card.setCode} ${card.collectorNumber}) is not Expanded legal in the source dataset.` });
  }
  const total = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total !== 60) issues.push({ severity: "error", message: `Deck contains ${total} cards; constructed decks normally contain exactly 60.` });
  for (const [name, count] of names) {
    const basicEnergy = cards.some((card) => card.name === name && card.supertype === "Energy" && card.subtypes.includes("Basic"));
    if (count > 4 && !basicEnergy) issues.push({ severity: "error", message: `${name} has ${count} copies; the normal limit is four cards with the same name.` });
  }
  if (!deck.entries.some((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" && card.subtypes.includes("Basic"); })) issues.push({ severity: "error", message: "Add at least one Basic Pokémon." });
  if (radiantPokemon > 1) issues.push({ severity: "error", message: `Deck contains ${radiantPokemon} Radiant Pokémon; only one Radiant Pokémon is allowed in total.` });
  if (aceSpecCards > 1) issues.push({ severity: "error", message: `Deck contains ${aceSpecCards} ACE SPEC cards; only one ACE SPEC card is allowed in total.` });
  for (const card of cards.filter((candidate) => candidate.supertype === "Pokémon" && candidate.evolvesFrom)) {
    if (!cards.some((candidate) => candidate.name === card.evolvesFrom)) issues.push({ severity: "warning", message: `${card.name} evolves from ${card.evolvesFrom}, which is not in this deck.` });
  }
  const unsupported = [...new Map(cards.filter((card) => !["complete", "generated"].includes(compileCardImplementation(card).status)).map((card) => [card.id, card])).values()];
  return { total, pokemon, trainers, energy, issues, unsupported, simulationReady: total === 60 && !issues.some((issue) => issue.severity === "error") && unsupported.length === 0 };
}
