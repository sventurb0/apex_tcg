import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import {
  abilitySignature,
  buildAbilitySignatureCatalogue,
  compileCardImplementation,
  createCatalogueIndex,
  createImplementationResolver,
  gameplaySignature,
  toRuntimeCardDefinition,
  type PokemonCardCatalogue,
  type PokemonCardMetadata,
} from "../../src/data/pokemon";
import type { DeckManifest } from "../../src/data/decks/types";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { forceMain, freshSkeledirgeGame, inPlay, instance } from "../fixtures/skeledirgeRuntime";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
let index: ReturnType<typeof createCatalogueIndex>;
beforeAll(() => { index = createCatalogueIndex(catalogue.cards); });

function handler(cardId: string): string | undefined {
  const implementation = compileCardImplementation(index.byId.get(cardId)!);
  const value = implementation.handlers[0];
  return value?.kind === "custom" ? value.handlerId : value?.kind === "declarative" ? value.effectId : undefined;
}

describe("functional implementation families", () => {
  it("inherits the complete PAL 37 Skeledirge ex behaviour for exact printing PAL 233", () => {
    const canonical = index.byId.get("sv2-37")!;
    const alternate = index.byId.get("sv2-233")!;
    const implementation = compileCardImplementation(alternate);
    expect(implementation).toMatchObject({ status: "complete", implementationSource: "functional-reprint", canonicalCardId: "sv2-37", equivalentPrintingCount: 6 });
    expect(implementation.behaviourFamilyId).toBe(compileCardImplementation(canonical).behaviourFamilyId);
    expect(handler("sv2-233")).toBe("pokemon:skeledirge-ex");

    const canonicalRuntime = toRuntimeCardDefinition(canonical)!;
    const alternateRuntime = toRuntimeCardDefinition(alternate)!;
    expect(alternateRuntime.id).toBe("sv2-233");
    expect(alternateRuntime.name).toBe("Skeledirge ex");
    if (canonicalRuntime.category !== "pokemon" || alternateRuntime.category !== "pokemon") throw new Error("Expected Pokémon runtime definitions.");
    const executableAttacks = (runtime: typeof canonicalRuntime) => runtime.attacks.map((attack) => ({ name: attack.name, cost: attack.cost, damage: attack.damage, text: attack.text, effectProgramId: attack.effectProgramId }));
    expect(executableAttacks(alternateRuntime)).toEqual(executableAttacks(canonicalRuntime));
    expect({ hp: alternateRuntime.hp, prizeValue: alternateRuntime.prizeValue, stage: alternateRuntime.stage, retreatCost: alternateRuntime.retreatCost }).toEqual({ hp: canonicalRuntime.hp, prizeValue: canonicalRuntime.prizeValue, stage: canonicalRuntime.stage, retreatCost: canonicalRuntime.retreatCost });
  });

  it("keeps a Skeledirge deck simulation-ready when PAL 37 is replaced by PAL 233", () => {
    const source = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8")) as DeckManifest;
    const deck = { ...source, entries: source.entries.map((entry) => entry.cardId === "sv2-37" ? { ...entry, cardId: "sv2-233" } : entry) };
    expect(deck.entries.some((entry) => entry.cardId === "sv2-233")).toBe(true);
    expect(analyseDeck(deck, index)).toMatchObject({ total: 60, simulationReady: true, unsupported: [] });
  });

  it("uses PAL 233 Vitality Song and Burning Voice in a real game without rewriting its exact ID", () => {
    const run = (attackName: string, ownDamage: number) => {
      let state = forceMain(freshSkeledirgeGame());
      state.cardDefinitions["sv2-233"] = toRuntimeCardDefinition(index.byId.get("sv2-233")!)!;
      state.players["player-one"].active = inPlay("sv2-233", `pal-233-${attackName}`);
      state.players["player-one"].active.damage = ownDamage;
      state.players["player-one"].bench = [inPlay("sv2-35", "pal-233-bench")];
      state.players["player-one"].bench[0]!.damage = 20;
      state.players["player-two"].active = inPlay("sv2-37", "pal-037-defender");
      state.players["player-two"].bench = [inPlay("sv2-35", "defender-bench")];
      state.players["player-one"].active.attachedEnergy.push(...Array.from({ length: 3 }, (_, energy) => instance("sve-2", `${attackName}-energy-${energy}`)));
      const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "attack" && candidate.description.includes(attackName));
      if (!action) throw new Error(`PAL 233 could not use ${attackName}.`);
      state = applyAction(state, action);
      return state;
    };
    const vitality = run("Vitality Song", 60);
    expect(vitality.players["player-one"].active!.stack.at(-1)!.cardId).toBe("sv2-233");
    expect(vitality.players["player-one"].active!.damage).toBe(30);
    expect(vitality.players["player-one"].bench[0]!.damage).toBe(0);
    expect(vitality.players["player-two"].active!.damage).toBe(50);
    const burning = run("Burning Voice", 10);
    expect(burning.players["player-one"].active!.stack.at(-1)!.cardId).toBe("sv2-233");
    expect(burning.players["player-two"].active!.damage).toBe(260);
  });

  it.each([
    ["sv2-254", "sv4pt5-80", "trainer:iono"],
    ["sv6pt5-55", "sv8pt5-95", "tool:binding-mochi"],
    ["swsh9-185", "swsh9-144", "stadium:magma-basin"],
  ])("inherits reviewed Supporter, Tool, and Stadium handlers for %s", (alternateId, canonicalId, expectedHandler) => {
    expect(compileCardImplementation(index.byId.get(alternateId)!)).toMatchObject({ status: "complete", implementationSource: "functional-reprint", canonicalCardId: canonicalId });
    expect(handler(alternateId)).toBe(expectedHandler);
    expect(handler(alternateId)).toBe(handler(canonicalId));
  });

  it("does not merge same-name cards with different printed gameplay", () => {
    const canonical = index.byId.get("sv2-37")!;
    const different = index.byName.get("skeledirge ex")!.find((card) => gameplaySignature(card) !== gameplaySignature(canonical));
    expect(different).toBeDefined();
    expect(compileCardImplementation(different!).behaviourFamilyId).not.toBe(compileCardImplementation(canonical).behaviourFamilyId);
    expect(compileCardImplementation(different!).canonicalCardId).not.toBe("sv2-37");
  });

  it("safe-generates only fixed or blank attacks and rejects variable or effectful text", () => {
    const base = (id: string, attacks: PokemonCardMetadata["attacks"]): PokemonCardMetadata => ({ id, name: id, setId: "test", setName: "Test", setCode: "TST", collectorNumber: id, supertype: "Pokémon", subtypes: ["Basic"], hp: 80, types: ["Fire"], retreat: 1, attacks, legalities: {} });
    const safe = base("safe", [{ name: "Pause", cost: [], energy: 0, damage: "", text: "" }, { name: "Tackle", cost: ["Fire"], energy: 1, damage: "30", text: "" }]);
    const variable = base("variable", [{ name: "Risk", cost: ["Fire"], energy: 1, damage: "20+", text: "Flip a coin. If heads, this attack does 20 more damage." }]);
    expect(compileCardImplementation(safe)).toMatchObject({ status: "generated", implementationSource: "generated" });
    expect(compileCardImplementation(variable).status).toBe("unsupported");
  });

  it.each([
    ["plus damage", "20+", ""], ["minus damage", "50-", ""], ["multiplier damage", "20×", ""],
    ["coin flip", "20", "Flip a coin. If heads, this attack does 20 more damage."],
    ["search", "", "Search your deck for a Pokémon and put it into your hand."],
    ["draw", "", "Draw 2 cards."], ["healing", "", "Heal 30 damage from this Pokémon."],
    ["status", "10", "Your opponent's Active Pokémon is now Poisoned."],
    ["Bench damage", "10", "This attack also does 20 damage to 1 of your opponent's Benched Pokémon."],
    ["damage counters", "", "Put 3 damage counters on your opponent's Active Pokémon."],
    ["Energy movement", "", "Move an Energy from this Pokémon to 1 of your Benched Pokémon."],
    ["discard cost", "100", "Discard an Energy from this Pokémon."],
    ["turn lock", "30", "During your opponent's next turn, the Defending Pokémon can't attack."],
  ])("rejects unreviewed %s attack semantics", (label, damage, text) => {
    const card: PokemonCardMetadata = { id: `reject-${label}`, name: label, setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 80, types: ["Colorless"], retreat: 1, attacks: [{ name: "Unsafe", cost: ["Colorless"], energy: 1, damage, text }], legalities: {} };
    expect(compileCardImplementation(card).status).toBe("unsupported");
  });

  it("keys Ability coverage by exact normalized text, not Ability name alone", () => {
    const first = { name: "Shared Name", type: "Ability", text: "Once during your turn, draw 1 card." };
    const second = { ...first, text: "Once during your turn, draw 2 cards." };
    expect(abilitySignature(first)).not.toBe(abilitySignature(second));
    const cards: PokemonCardMetadata[] = [first, second].map((ability, position) => ({ id: `ability-${position}`, name: `Ability ${position}`, setId: "test", setName: "Test", setCode: "TST", collectorNumber: `${position}`, supertype: "Pokémon", subtypes: ["Basic"], hp: 60, types: ["Colorless"], retreat: 1, abilities: [ability], legalities: {} }));
    expect(buildAbilitySignatureCatalogue(cards)).toHaveLength(2);
  });

  it("builds the same catalogue-wide family index deterministically", () => {
    const first = createImplementationResolver(catalogue.cards).families();
    const second = createImplementationResolver(catalogue.cards).families();
    expect(second).toEqual(first);
    expect(first.find((family) => family.memberCardIds.includes("sv2-233"))).toMatchObject({ canonicalCardId: "sv2-37", handlerId: "pokemon:skeledirge-ex" });
  });
});
