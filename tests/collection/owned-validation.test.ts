import { describe, expect, it } from "vitest";
import { analyseAllocations } from "../../src/features/collection/collection-allocation";
import type { OwnedCollectionDocument } from "../../src/features/collection/types";

const collection = (entries: OwnedCollectionDocument["entries"], basicEnergyInventory: OwnedCollectionDocument["basicEnergyInventory"] = "exact"): OwnedCollectionDocument => ({ version: 1, generatedAt: "test", sourceFile: "test.csv", basicEnergyInventory, basicEnergyAssumption: "test", entries, diagnostics: { csvRows: entries.length, physicalCopies: entries.reduce((sum, entry) => sum + entry.quantity, 0), distinctOwnedProducts: entries.length, distinctCatalogueCardIds: entries.length, distinctCardNames: entries.length, unresolvedRows: 0, invalidRows: [], resolutionBreakdown: { exact: entries.length, "set-id-alias": 0, "functional-reprint-alias": 0 } } });

const entry = (cardId: string, quantity: number, name = cardId): OwnedCollectionDocument["entries"][number] => ({ ownedProductId: `product:${cardId}`, catalogueCardId: cardId, canonicalBehaviourCardId: cardId, resolutionType: "exact", productName: name, setName: "Test", sourceSetId: "test", cardNumber: "1", material: "card", rarity: "Common", condition: "NM", quantity, pricePerUnit: "0", totalCost: "0", sourceRow: 1, metadata: { id: cardId, name, setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Trainer", subtypes: ["Item"], retreat: 0, legalities: { standard: "Legal" } }, canonicalMetadata: { id: cardId, name, setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Trainer", subtypes: ["Item"], retreat: 0, legalities: { standard: "Legal" } }, implementation: { cardId, status: "complete", handlers: [], supportedMechanics: [], knownLimitations: [], tests: [] } });

describe("owned portfolio allocation", () => {
  it("uses count, not quantity, and reports shared shortages", () => {
    const document = collection([entry("trainer", 2)]);
    const issues = analyseAllocations(document, [{ deckId: "a", entries: [{ cardId: "trainer", count: 2 }] }, { deckId: "b", entries: [{ cardId: "trainer", count: 2 }] }]);
    expect(issues).toMatchObject([{ cardId: "trainer", required: 4, owned: 2, shortage: 2, deckIds: ["a", "b"] }]);
  });

  it("exempts Basic Energy only under the unlimited setting", () => {
    const unlimited = analyseAllocations(collection([], "unlimited"), [{ deckId: "a", entries: [{ cardId: "sve-2", count: 60 }] }]);
    const exact = analyseAllocations(collection([], "exact"), [{ deckId: "a", entries: [{ cardId: "sve-2", count: 60 }] }]);
    expect(unlimited).toEqual([]);
    expect(exact[0]).toMatchObject({ cardId: "sve-2", shortage: 60 });
  });
});
