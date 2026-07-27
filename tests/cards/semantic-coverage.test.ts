import { describe, expect, it } from "vitest";
import { buildCardSemanticCoverage } from "../../src/data/pokemon/semantic-coverage";
import { MissingEffectProgramError } from "../../engine/effects/errors";
import type { CardDefinition } from "../../engine/model/cards";
import type { CardImplementation, PokemonCardMetadata } from "../../src/data/pokemon/types";

const implementation: CardImplementation = { cardId: "test-card", status: "complete", handlers: [{ kind: "custom", handlerId: "pokemon:test" }], supportedMechanics: [], knownLimitations: [], tests: ["semantic-coverage.test.ts"], choiceSemantics: "exact" };
const card: PokemonCardMetadata = { id: "test-card", name: "Testmon", setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 100, types: ["Psychic"], attacks: [{ name: "Text Attack", cost: ["Psychic"], energy: 1, damage: "30", text: "Draw 1 card." }], retreat: 1, legalities: {} };
const runtime: CardDefinition = { id: "test-card", name: "Testmon", category: "pokemon", pokemonType: "psychic", stage: "basic", hp: 100, ruleBox: "single-prize", hasRuleBox: false, isPokemonEx: false, isMega: false, prizeValue: 1, traits: [], abilities: [], attacks: [{ id: "test-attack", name: "Text Attack", cost: { psychic: 1 }, damage: { kind: "fixed", amount: 30, printed: "30" }, text: "Draw 1 card.", effectProgramId: "attack:draw-one" }], retreatCost: 1, implementationStatus: "complete" };

describe("strict semantic coverage", () => {
  it("binds a printed attack clause to its executable program", () => {
    const coverage = buildCardSemanticCoverage(card, runtime, implementation, new Set(["attack:draw-one"]));
    expect(coverage.unmatchedPrintedClauses).toEqual([]);
    expect(coverage.complete).toBe(true);
  });

  it("rejects an orphan runtime handler", () => {
    const coverage = buildCardSemanticCoverage(card, { ...runtime, attacks: [{ ...runtime.attacks[0]!, effectProgramId: "attack:missing" }] }, implementation, new Set());
    expect(coverage.orphanRuntimeHandlers[0]?.programId).toBe("attack:missing");
    expect(coverage.complete).toBe(false);
  });

  it("represents unknown executable programs as explicit failures", () => {
    expect(() => { throw new MissingEffectProgramError("attack:missing", "test-card"); }).toThrow(/Missing effect program/);
  });
});
