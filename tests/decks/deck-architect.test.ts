import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { compileCardImplementation, createCatalogueIndex, type PokemonCardCatalogue, type PokemonCardMetadata } from "../../src/data/pokemon";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { candidateManifest, createImplementationBacklog, exportArchitectCandidate, generateCandidates, rankCandidates, runQuickGauntlet, validateArchitectCandidate, type ArchitectRequest } from "../../src/features/deck-architect";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
let index: ReturnType<typeof createCatalogueIndex>;
beforeEach(() => { index = createCatalogueIndex(catalogue.cards); });
const request = (favourites: ArchitectRequest["favourites"], candidateCount: 3 | 5 | 10 = 3, mode: ArchitectRequest["mode"] = "simulation-ready", seed = 42): ArchitectRequest => ({ favourites, candidateCount, mode, seed, format: "standard" });

describe("Deck Architect candidate generation", () => {
  it("preserves exact PAL 233, inserts its evolution line, and emits deterministic legal 60-card candidates", () => {
    const input = request([{ cardId: "sv2-233", exactPrintingRequired: true }]);
    const first = generateCandidates(input, index);
    const second = generateCandidates(input, index);
    expect(first.rejected).toEqual([]);
    expect(first.candidates).toHaveLength(3);
    expect(first.candidates.map((candidate) => candidate.fingerprint)).toEqual(second.candidates.map((candidate) => candidate.fingerprint));
    for (const candidate of first.candidates) {
      expect(candidate.deck.entries.find((entry) => entry.cardId === "sv2-233")?.count).toBe(2);
      expect(candidate.deck.entries.some((entry) => index.byId.get(entry.cardId)?.name === "Crocalor")).toBe(true);
      expect(candidate.deck.entries.some((entry) => index.byId.get(entry.cardId)?.name === "Fuecoco")).toBe(true);
      expect(validateArchitectCandidate(candidate.deck, index, "simulation-ready")).toMatchObject({ valid: true, analysis: { total: 60, simulationReady: true, unsupported: [] } });
    }
    const manifest = candidateManifest(first.candidates[0]!, input);
    expect(manifest.architect).toMatchObject({ seed: 42, selectedCardIds: ["sv2-233"], mode: "simulation-ready" });
    expect(JSON.parse(exportArchitectCandidate(first.candidates[0]!, input))).toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ cardId: "sv2-233" })]), architect: { seed: 42, selectedCardIds: ["sv2-233"] } });
  });

  it("keeps multiple exact favourites and explains reviewed Okidogi/Pecharunt synergy", () => {
    const result = generateCandidates(request([{ cardId: "sv6pt5-36", exactPrintingRequired: true }, { cardId: "sv6pt5-39", exactPrintingRequired: true }]), index);
    expect(result.candidates).toHaveLength(3);
    for (const candidate of result.candidates) {
      expect(candidate.deck.entries.find((entry) => entry.cardId === "sv6pt5-36")?.count).toBe(3);
      expect(candidate.deck.entries.find((entry) => entry.cardId === "sv6pt5-39")?.count).toBe(2);
      expect(candidate.explanations.join(" ")).toMatch(/Subjugating Chains.*Chain-Crazed/i);
      expect(analyseDeck(candidate.deck, index).simulationReady).toBe(true);
    }
  });

  it("produces ten distinct legal choices for both reviewed engines", () => {
    const favourites = [
      [{ cardId: "sv2-233", exactPrintingRequired: true }],
      [{ cardId: "sv6pt5-36", exactPrintingRequired: true }, { cardId: "sv6pt5-39", exactPrintingRequired: true }],
    ] satisfies ArchitectRequest["favourites"][];
    for (const selected of favourites) {
      const candidates = generateCandidates(request(selected, 10), index).candidates;
      expect(candidates).toHaveLength(10);
      expect(new Set(candidates.map((candidate) => candidate.fingerprint)).size).toBe(10);
      expect(candidates.every((candidate) => candidate.deck.entries.reduce((sum, entry) => sum + entry.count, 0) === 60 && candidate.simulationReady)).toBe(true);
    }
  });

  it("ranks candidates deterministically and dispatches a balanced gauntlet with setup and usage metrics", async () => {
    const candidates = generateCandidates(request([{ cardId: "sv2-233", exactPrintingRequired: true }]), index).candidates;
    const ranked = rankCandidates(candidates);
    expect(ranked.map((candidate) => candidate.score.total)).toEqual([...ranked].map((candidate) => candidate.score.total).sort((a, b) => b - a));
    const opponent = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8"));
    const summary = await runQuickGauntlet(ranked[0]!, [opponent], index, 2);
    expect(summary).toMatchObject({ games: 2, unresolved: 0, averageMulligans: expect.any(Number), setupFailurePercentage: expect.any(Number), mainAttackerReadinessPercentage: expect.any(Number), commonLossReasons: expect.any(Object), cardUsage: expect.any(Object), abilityUsage: expect.any(Object), attackUsage: expect.any(Object) });
    expect(summary.goingFirstWinRate).toBeGreaterThanOrEqual(0);
    expect(summary.goingSecondWinRate).toBeGreaterThanOrEqual(0);
  });

  it("blocks unsupported Ability favourites in simulation-ready mode but creates a creative backlog", () => {
    const unsupported = catalogue.cards.find((card) => card.supertype === "Pokémon" && card.subtypes.includes("Basic") && card.legalities.standard === "Legal" && card.abilities?.length && compileCardImplementation(card).status === "unsupported");
    expect(unsupported).toBeDefined();
    const favourite = [{ cardId: unsupported!.id, exactPrintingRequired: true }];
    const blocked = generateCandidates(request(favourite), index);
    expect(blocked.candidates).toEqual([]);
    expect(blocked.rejected[0]).toMatchObject({ cardId: unsupported!.id });
    const creative = generateCandidates(request(favourite, 3, "creative"), index);
    expect(creative.candidates.length).toBeGreaterThan(0);
    expect(creative.candidates[0]!.simulationReady).toBe(false);
    const backlog = createImplementationBacklog(creative.candidates, index);
    expect(backlog.items[0]).toMatchObject({ cardId: unsupported!.id });
    expect(backlog.markdown).toContain(unsupported!.id);
  });

  it("accepts a safely generated fixed/no-text Basic attacker in simulation-ready mode", () => {
    const generated: PokemonCardMetadata = { id: "architect-test-fixed", name: "Architect Test", setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 100, types: ["Darkness"], retreat: 1, attacks: [{ name: "Wait", cost: [], energy: 0, damage: "", text: "" }, { name: "Strike", cost: ["Darkness"], energy: 1, damage: "50", text: "" }], legalities: { standard: "Legal" } };
    index = createCatalogueIndex([generated, ...catalogue.cards]);
    expect(compileCardImplementation(generated).status).toBe("generated");
    const result = generateCandidates(request([{ cardId: generated.id, exactPrintingRequired: true }]), index);
    expect(result.rejected).toEqual([]);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]).toMatchObject({ simulationReady: true, deck: { entries: expect.arrayContaining([expect.objectContaining({ cardId: generated.id })]) } });
  });
});
