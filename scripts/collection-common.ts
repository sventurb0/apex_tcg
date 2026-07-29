import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckManifest } from "../src/data/decks/types";
import { importPortfolioCsv } from "../src/features/collection/import-portfolio";
import { buildOwnedCoverage, ownedCoverageSummary } from "../src/features/collection/collection-coverage";
import type { OwnedCollectionDocument } from "../src/features/collection/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";
import { generateCandidates, type ArchitectRequest, type FavouriteSelection } from "../src/features/deck-architect";

export const SOURCE_CSV = "src/data/collection/owned_collection_normalized_2026-07-27.csv";
export function loadCatalogue(): PokemonCardCatalogue { return JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue; }
export function loadCollection(): OwnedCollectionDocument { return JSON.parse(readFileSync("public/data/owned-collection.json", "utf8")) as OwnedCollectionDocument; }
export function importCurrentCollection(): OwnedCollectionDocument { return importPortfolioCsv(readFileSync(SOURCE_CSV, "utf8"), loadCatalogue()); }

export function runtimeCards(document: OwnedCollectionDocument, extraCardIds: readonly string[] = []): CardDefinition[] {
  const index = createCatalogueIndex(loadCatalogue().cards);
  const ids = [...new Set([...document.entries.map((entry) => entry.canonicalBehaviourCardId), ...extraCardIds, "sve-1", "sve-2", "sve-3", "sve-4", "sve-5", "sve-6", "sve-7", "sve-8"] )];
  return ids.map((id) => index.byId.get(id)).map((card) => card ? toRuntimeCardDefinition(card) : null).filter((card): card is CardDefinition => Boolean(card));
}
export function coverage(document: OwnedCollectionDocument) { return buildOwnedCoverage(document); }
export function coverageSummary(document: OwnedCollectionDocument) { return ownedCoverageSummary(coverage(document)); }

const targets: Array<{ id: string; name: string; favouriteNames: string[]; format: ArchitectRequest["format"] }> = [
  { id: "owned-alakazam", name: "Owned Alakazam Hand Engine", favouriteNames: ["Alakazam", "Kadabra", "Abra"], format: "expanded" },
  { id: "owned-okidogi-poison", name: "Owned Okidogi Poison", favouriteNames: ["Okidogi ex", "Pecharunt ex", "Munkidori"], format: "expanded" },
  { id: "owned-team-rocket-nidoking", name: "Owned Team Rocket Nidoking/Nidoqueen", favouriteNames: ["Team Rocket's Nidoking ex", "Nidoking ex", "Nidoqueen"], format: "expanded" },
  { id: "owned-team-rocket-muk", name: "Owned Team Rocket Muk Control", favouriteNames: ["Muk", "Arbok", "Weezing"], format: "expanded" },
  { id: "owned-skeledirge-armarouge", name: "Owned Skeledirge Armarouge", favouriteNames: ["Skeledirge ex", "Armarouge", "Charcadet"], format: "expanded" },
  { id: "owned-arcanine", name: "Owned Arcanine", favouriteNames: ["Arcanine", "Hisuian Arcanine", "Growlithe"], format: "expanded" },
  { id: "owned-swalot-poison", name: "Owned Swalot Poison", favouriteNames: ["Swalot", "Gulpin", "Binding Mochi"], format: "expanded" },
  { id: "owned-team-rocket-crobat-spidops", name: "Owned Team Rocket Crobat/Spidops", favouriteNames: ["Team Rocket's Crobat ex", "Team Rocket's Spidops", "Team Rocket's Koffing"], format: "expanded" },
];

function ownedQuantities(document: OwnedCollectionDocument): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const entry of document.entries) quantities.set(entry.canonicalBehaviourCardId, (quantities.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
  return quantities;
}

function favouritesForTarget(target: (typeof targets)[number], document: OwnedCollectionDocument): FavouriteSelection[] {
  const seen = new Set<string>();
  return target.favouriteNames.flatMap((name, index) => {
    const entry = document.entries.find((candidate) => candidate.metadata.name.toLocaleLowerCase() === name.toLocaleLowerCase() || candidate.metadata.name.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
    if (!entry || seen.has(entry.canonicalBehaviourCardId)) return [];
    seen.add(entry.canonicalBehaviourCardId);
    return [{ cardId: entry.canonicalBehaviourCardId, exactPrintingRequired: true, role: index === 0 ? "primary-attacker" : index === 1 ? "secondary-attacker" : "engine-core", minimumCount: 1, maximumCount: 4 } satisfies FavouriteSelection];
  });
}

/**
 * Build owned candidates through the real Deck Architect. There is no
 * collection-order filler: a candidate is retained only when every non-basic
 * entry is owned in sufficient quantity. If the architect cannot produce a
 * coherent owned list, the target is returned as a blocked manifest and the
 * acceptance report explains why.
 */
export function buildOwnedDecks(document: OwnedCollectionDocument): DeckManifest[] {
  const catalogue = loadCatalogue();
  const index = createCatalogueIndex(catalogue.cards);
  const quantities = ownedQuantities(document);
  const ownedIds = new Set([...quantities.keys(), "sve-1", "sve-2", "sve-3", "sve-4", "sve-5", "sve-6", "sve-7", "sve-8"]);
  const excludedCardIds = catalogue.cards.map((card) => card.id).filter((id) => !ownedIds.has(id));
  return targets.map((target) => {
    const favourites = favouritesForTarget(target, document);
    const request: ArchitectRequest = { favourites, format: target.format, mode: "simulation-ready", candidateCount: 10, seed: 1800 + targets.indexOf(target), profile: "balanced", allowSourceCopy: true, excludedCardIds };
    const generated = favourites.length ? generateCandidates(request, index).candidates : [];
    const candidate = generated.filter((item) => item.deck.entries.every((entry) => /^sve-\d+$/.test(entry.cardId) || (quantities.get(entry.cardId) ?? 0) >= entry.count)).sort((a, b) => b.score.total - a.score.total || a.id.localeCompare(b.id))[0];
    if (candidate) return { ...candidate.deck, id: target.id, name: target.name, architect: { seed: request.seed, selectedCardIds: favourites.map((favorite) => favorite.cardId), mode: request.mode, candidateScore: candidate.score.total, explanation: candidate.explanations } };
    return { id: target.id, name: target.name, description: `Blocked: Deck Architect could not produce a coherent owned-only candidate from the imported collection. Favourites: ${favourites.map((favorite) => favorite.cardId).join(", ") || "none resolved"}.`, format: target.format, source: "saved", entries: favourites.map((favorite) => ({ cardId: favorite.cardId, count: 1 })) };
  });
}
