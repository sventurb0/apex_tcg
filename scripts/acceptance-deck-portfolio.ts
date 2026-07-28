import { readFileSync, writeFileSync } from "node:fs";
import { analyseAllocations, maximumCompatibleDeckSubset, type DeckAllocation } from "../src/features/collection/collection-allocation";
import { buildOwnedDecks, loadCollection } from "./collection-common";

const document = loadCollection();
const decks = buildOwnedDecks(document);
const allocations: DeckAllocation[] = decks.map((deck) => ({ deckId: deck.id, entries: deck.entries.map((entry) => ({ cardId: entry.cardId, count: entry.count })) }));
const acceptance = JSON.parse(readFileSync("public/data/owned-deck-acceptance.json", "utf8")) as { decks: Array<{ id: string; validation: { simulationReady: boolean } }> };
const buildableIds = new Set(acceptance.decks.filter((deck) => deck.validation.simulationReady).map((deck) => deck.id));
const individualBuildable = allocations.filter((deck) => buildableIds.has(deck.deckId) && analyseAllocations(document, [deck]).length === 0);
const portfolio = maximumCompatibleDeckSubset(document, individualBuildable);
const result = { selectedDecks: decks.length, individualDecksBuildable: individualBuildable.length, maximumSimultaneousDecks: portfolio.selected.length, conflicts: analyseAllocations(document, allocations), selected: portfolio.selected.map((deck) => deck.deckId), rejected: portfolio.rejected.map((deck) => deck.deckId), totalShortage: analyseAllocations(document, allocations).reduce((sum, issue) => sum + issue.shortage, 0), basicEnergyInventory: document.basicEnergyInventory, schema: "AllocatedDeckEntry { cardId, count }" };
writeFileSync("public/data/owned-portfolio-optimisation.json", `${JSON.stringify(result, null, 2)}\n`);
writeFileSync("COLLECTION_ARCHITECT.md", `# Collection Architect\n\n- Individual decks buildable: ${result.individualDecksBuildable} / ${result.selectedDecks}\n- Maximum simultaneous assembled decks: ${result.maximumSimultaneousDecks} / ${result.selectedDecks}\n- Portfolio conflicts: ${result.conflicts.length}\n- Basic Energy inventory: ${result.basicEnergyInventory}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.individualDecksBuildable !== 6) process.exitCode = 1;
