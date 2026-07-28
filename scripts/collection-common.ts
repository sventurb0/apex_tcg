import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckManifest } from "../src/data/decks/types";
import { importPortfolioCsv } from "../src/features/collection/import-portfolio";
import { buildOwnedCoverage, ownedCoverageSummary } from "../src/features/collection/collection-coverage";
import type { OwnedCollectionDocument } from "../src/features/collection/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

export const SOURCE_CSV = "src/data/collection/owned_collection_normalized_2026-07-27.csv";
export function loadCatalogue(): PokemonCardCatalogue { return JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue; }
export function loadCollection(): OwnedCollectionDocument { return JSON.parse(readFileSync("public/data/owned-collection.json", "utf8")) as OwnedCollectionDocument; }
export function importCurrentCollection(): OwnedCollectionDocument { return importPortfolioCsv(readFileSync(SOURCE_CSV, "utf8"), loadCatalogue()); }
export function runtimeCards(document: OwnedCollectionDocument, extraCardIds: readonly string[] = []): CardDefinition[] { const index = createCatalogueIndex(loadCatalogue().cards); const ids = [...new Set([...document.entries.map((entry) => entry.canonicalBehaviourCardId), ...extraCardIds, "sve-1", "sve-2", "sve-3", "sve-4", "sve-5", "sve-6", "sve-7", "sve-8"])]; return ids.map((id) => index.byId.get(id)).map((card) => card ? toRuntimeCardDefinition(card) : null).filter((card): card is CardDefinition => Boolean(card)); }
export function coverage(document: OwnedCollectionDocument) { return buildOwnedCoverage(document); }
export function coverageSummary(document: OwnedCollectionDocument) { return ownedCoverageSummary(coverage(document)); }

const targets: Array<{ id: string; name: string; terms: string[] }> = [
  { id: "owned-alakazam", name: "Owned Alakazam Hand Engine", terms: ["Abra", "Kadabra", "Alakazam", "Academy at Night", "Ciphermaniac"] },
  { id: "owned-okidogi-poison", name: "Owned Okidogi Poison", terms: ["Okidogi", "Pecharunt", "Munkidori", "Binding Mochi", "Gulpin", "Swalot"] },
  { id: "owned-team-rocket-nidoking", name: "Owned Team Rocket Nidoking/Nidoqueen", terms: ["Nidoran", "Nidorino", "Nidoking", "Nidorina", "Nidoqueen", "Team Rocket's Energy"] },
  { id: "owned-team-rocket-muk", name: "Owned Team Rocket Muk Control", terms: ["Grimer", "Muk", "Ekans", "Arbok", "Koffing", "Weezing", "Spidops"] },
  { id: "owned-skeledirge-armarouge", name: "Owned Skeledirge Armarouge", terms: ["Fuecoco", "Crocalor", "Skeledirge", "Charcadet", "Armarouge", "Magma Basin"] },
  { id: "owned-arcanine", name: "Owned Arcanine", terms: ["Growlithe", "Arcanine", "Fire Energy", "Magma Basin"] },
];

function basicEnergyFor(document: OwnedCollectionDocument, type: string): string { const map: Record<string, string> = { Grass: "sve-1", Fire: "sve-2", Water: "sve-3", Lightning: "sve-4", Psychic: "sve-5", Fighting: "sve-6", Darkness: "sve-7", Metal: "sve-8" }; return map[type] ?? "sve-6"; }
export function buildOwnedDecks(document: OwnedCollectionDocument): DeckManifest[] {
  const entries = [...new Map(document.entries.map((entry) => [entry.canonicalBehaviourCardId, entry])).values()];
  return targets.map((target) => { const selected = entries.filter((entry) => target.terms.some((term) => entry.metadata.name.toLocaleLowerCase().includes(term.toLocaleLowerCase()))); const deckEntries: Array<{ cardId: string; count: number }> = []; let total = 0;
    for (const entry of selected) { const count = Math.min(entry.quantity, 4, 60 - total); if (count > 0) { deckEntries.push({ cardId: entry.canonicalBehaviourCardId, count }); total += count; } }
    const preferredType = selected.find((entry) => entry.metadata.types?.[0])?.metadata.types?.[0] ?? "Colorless";
    if (preferredType !== "Colorless") { const basic = basicEnergyFor(document, preferredType); const count = Math.min(12, 60 - total); deckEntries.push({ cardId: basic, count }); total += count; }
    for (const entry of entries) { if (total >= 60) break; if (deckEntries.some((item) => item.cardId === entry.canonicalBehaviourCardId)) continue; const count = Math.min(entry.quantity, 4, 60 - total); if (count > 0) { deckEntries.push({ cardId: entry.canonicalBehaviourCardId, count }); total += count; } }
    if (total < 60) deckEntries.push({ cardId: basicEnergyFor(document, preferredType), count: 60 - total });
    return { id: target.id, name: target.name, description: "Collection-aware owned-only candidate. Basic Energy uses the configured Unlimited assumption.", entries: deckEntries, available: true, tags: ["owned-only", "collection-architect"] };
  });
}
