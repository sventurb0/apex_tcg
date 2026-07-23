import { describe, expect, it } from "vitest";
import { CANONICAL_BASIC_ENERGY_IDS, createCatalogueIndex, normalizeCardName } from "../../src/data/pokemon";
import { exportDeckList, manifestFromImport } from "../../src/features/deck-import/deck-io";
import { parseDeckList } from "../../src/features/deck-import/parser";
import { importDeckList } from "../../src/features/deck-import/resolver";
import { testCatalogueIndex } from "../fixtures/catalogue";
import { realCardFixtures, realCardIndex } from "../fixtures/realCards";

const acceptanceList = `Pokémon\n\n4 Fuecoco PAL 035\n2 Skeledirge ex PAL 037\n\nTrainer\n\n2 Switch SVI 194\n\nEnergy\n\n12 Basic Fire Energy`;

describe("catalogue-aware deck import", () => {
  it("parses quantity plus the full descriptor without guessing printing suffixes", () => {
    const parsed = parseDeckList("Energy\n12 Basic Fire Energy\n4 Double Turbo Energy");
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toMatchObject([
      { quantity: 12, descriptor: "Basic Fire Energy", section: "Energy" },
      { quantity: 4, descriptor: "Double Turbo Energy", section: "Energy" },
    ]);
  });

  it("recognises counted, colon, singular/plural, accented and unaccented headings", () => {
    const parsed = parseDeckList("Pokémon (16)\nTrainer (32)\nEnergy (12)\nPokemon: 6\n4x Fuecoco PAL 035\nTrainers:\n2x Switch SVI 194");
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]).toMatchObject({ descriptor: "Fuecoco PAL 035", section: "Pokémon" });
    expect(parsed.lines[1]).toMatchObject({ descriptor: "Switch SVI 194", section: "Trainer" });
  });

  it("auto-resolves ordinary Basic Energy without treating FIRE as a set code", () => {
    const parsed = parseDeckList("12 Basic Fire Energy");
    expect(parsed.lines[0]!.descriptor).toBe("Basic Fire Energy");
    const report = importDeckList("12 Fire Energy\n12 Basic Fire Energy", "custom", testCatalogueIndex);
    expect(report.unknown).toHaveLength(0);
    expect(report.ambiguous).toHaveLength(0);
    expect(report.resolved.map((line) => line.card.id)).toEqual([CANONICAL_BASIC_ENERGY_IDS.fire, CANONICAL_BASIC_ENERGY_IDS.fire]);
  });

  it("resolves public set codes, set IDs, parentheses, zero padding and slash totals to one exact card", () => {
    const list = "1 Fuecoco PAL 035\n1 Fuecoco PAL 35\n1 Fuecoco (PAL 035)\n1 Fuecoco sv2 35\n1 Fuecoco PAL 035/193";
    const report = importDeckList(list, "custom", testCatalogueIndex);
    expect(report.unknown).toHaveLength(0);
    expect(report.resolved.map((line) => line.card.id)).toEqual(Array(5).fill("sv2-35"));

    const trainerGallery = testCatalogueIndex.byId.get("swsh12tg-TG01")!;
    const tg = importDeckList(`1 ${trainerGallery.name} SIT TG01/TG30`, "custom", testCatalogueIndex);
    expect(tg.resolved[0]?.card.id).toBe("swsh12tg-TG01");
    const promo = testCatalogueIndex.byId.get("svp-129")!;
    const svp = importDeckList(`1 ${promo.name} SVP 129`, "custom", testCatalogueIndex);
    expect(svp.resolved[0]?.card.id).toBe("svp-129");
  });

  it("resolves Team Rocket's Energy exactly with straight or curly apostrophes", () => {
    expect(importDeckList("4 Team Rocket's Energy DRI 182", "custom", testCatalogueIndex).resolved[0]?.card.id).toBe("sv10-182");
    expect(importDeckList("4 Team Rocket’s Energy DRI 182", "custom", testCatalogueIndex).resolved[0]?.card.id).toBe("sv10-182");
  });

  it("normalises Unicode, whitespace, hyphens, Pokemon spelling and Nidoran gender aliases without removing rule-box suffixes", () => {
    expect(normalizeCardName("  PokÉmon   Catcher  ")).toBe("pokemon catcher");
    expect(normalizeCardName("Team Rocket’s Nidoran♂")).toBe(normalizeCardName("Team Rocket's Nidoran Male"));
    expect(normalizeCardName("Nidoran♀")).toBe(normalizeCardName("Nidoran F"));
    expect(normalizeCardName("Skeledirge ex")).not.toBe(normalizeCardName("Skeledirge"));
  });

  it("auto-resolves one functional variant and retains cosmetic printing choices", () => {
    const potion = realCardFixtures.find((card) => card.id === "sv1-188")!;
    const index = createCatalogueIndex([potion, { ...potion, id: "test-188", setId: "test", setName: "Regular Reprint", setCode: "TST", collectorNumber: "188", releaseDate: "2025/01/01" }]);
    const report = importDeckList("4 Potion", "custom", index);
    expect(report.ambiguous).toHaveLength(0);
    expect(report.resolved[0]?.equivalentPrintings).toHaveLength(2);
    expect(report.canSave).toBe(true);
  });

  it("collapses mechanically identical Switch wording and cosmetic reprints", () => {
    const report = importDeckList("4 Switch", "custom", testCatalogueIndex);
    expect(report.ambiguous).toHaveLength(0);
    expect(report.resolved[0]!.equivalentPrintings.length).toBeGreaterThan(10);
  });

  it("resolves a single name candidate automatically", () => {
    const report = importDeckList("4 Potion", "custom", realCardIndex);
    expect(report.resolved[0]?.card.id).toBe("sv1-188");
    expect(report.ambiguous).toHaveLength(0);
  });

  it("keeps genuinely different Gengar gameplay variants ambiguous", () => {
    const report = importDeckList("4 Gengar", "custom", testCatalogueIndex);
    expect(report.ambiguous).toHaveLength(1);
    expect(report.ambiguous[0]!.variants.length).toBeGreaterThan(1);
    expect(report.canSave).toBe(false);
  });

  it("rejects a mismatched card name for a real set and collector number", () => {
    const mismatch = importDeckList("4 Switch SVI 188", "custom", testCatalogueIndex);
    expect(mismatch.unknown).toHaveLength(1);
    expect(mismatch.unknown[0]?.reason).toContain("is Potion, not Switch");
  });

  it("separates identity, construction and simulation support and permits incomplete resolved decks", () => {
    const report = importDeckList(acceptanceList, "custom", testCatalogueIndex);
    expect(report.identity).toMatchObject({ parsedLines: 4, resolvedLines: 4, resolvedCopies: 20, unresolvedLines: 0, ambiguousLines: 0, canSave: true });
    expect(report.construction).toMatchObject({ currentSize: 20, targetSize: 60 });
    expect(report.construction.warnings).toContain("Deck size is 20 / 60.");
    expect(report.simulation.ready).toBe(true);
    expect(report.canSave).toBe(true);
    const deck = manifestFromImport(report, "Acceptance", "custom", "acceptance-deck");
    expect(deck.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(20);
  });

  it("blocks saving only when identity is unresolved or genuinely ambiguous", () => {
    expect(importDeckList(acceptanceList, "custom", testCatalogueIndex).canSave).toBe(true);
    expect(importDeckList("4 Definitely Not A Card", "custom", testCatalogueIndex).canSave).toBe(false);
    expect(importDeckList("4 Gengar", "custom", testCatalogueIndex).canSave).toBe(false);
  });

  it("preserves exact card IDs and quantities through import/export round trips", () => {
    const first = importDeckList(acceptanceList, "custom", testCatalogueIndex);
    const deck = manifestFromImport(first, "Round trip", "custom", "round-trip");
    const exported = exportDeckList(deck, testCatalogueIndex);
    const second = manifestFromImport(importDeckList(exported, "custom", testCatalogueIndex), "Round trip 2", "custom", "round-trip-2");
    const sort = (entries: typeof deck.entries) => [...entries].sort((a, b) => a.cardId.localeCompare(b.cardId));
    expect(sort(second.entries)).toEqual(sort(deck.entries));
  });
});
