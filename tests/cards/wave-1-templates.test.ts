import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import type { CardDefinition } from "../../engine/model/cards";
import {
  compileCardImplementation,
  createCatalogueIndex,
  implementationResolver,
  toRuntimeCardDefinition,
  type PokemonCardCatalogue,
  type PokemonCardMetadata,
  type PrintedAbility,
  type PrintedAttack,
} from "../../src/data/pokemon";
import { matchWave1Ability } from "../../src/data/pokemon/implementations/templates/abilities/wave-1";
import { matchWave1Attack } from "../../src/data/pokemon/implementations/templates/attacks/wave-1";
import { matchWave1Trainer } from "../../src/data/pokemon/implementations/templates/trainers/wave-1";
import { forceMain, freshSkeledirgeGame, inPlay, instance } from "../fixtures/skeledirgeRuntime";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
let index: ReturnType<typeof createCatalogueIndex>;
beforeAll(() => { index = createCatalogueIndex(catalogue.cards); });

function runtime(cardId: string): CardDefinition { const value = toRuntimeCardDefinition(index.byId.get(cardId)!); if (!value) throw new Error(`Missing runtime definition for ${cardId}.`); return value; }
function energy(type: "fire" | "psychic" = "fire"): CardDefinition { return { id: `test-${type}-energy`, name: `${type} Energy`, category: "energy", energyType: type, basic: true, implementationStatus: "complete" }; }
function trainer(text: string): PokemonCardMetadata { return { id: `trainer-${text}`, name: "Test Trainer", setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Trainer", subtypes: ["Supporter"], retreat: 0, rules: [text, "You may play only 1 Supporter card during your turn."], legalities: {} }; }
function ability(text: string): PrintedAbility { return { name: "Reviewed Test", type: "Ability", text }; }

describe("Wave 1 reviewed templates", () => {
  it("matches complete exact text and rejects ignored extra clauses", () => {
    const ability: PrintedAbility = { name: "Test Draw", type: "Ability", text: "Once during your turn, you may draw 1 card." };
    const attack: PrintedAttack = { name: "Poison", cost: [], energy: 0, damage: "", text: "Your opponent's Active Pokémon is now Poisoned." };
    expect(matchWave1Ability(ability)?.programId).toBe("template:ability:draw-fixed:1");
    expect(matchWave1Ability({ ...ability, text: `${ability.text} Then, heal 10 damage.` })).toBeUndefined();
    expect(matchWave1Attack(attack)?.programId).toBe("template:attack:condition:poisoned");
    expect(matchWave1Attack({ ...attack, text: `${attack.text} Draw a card.` })).toBeUndefined();
    expect(matchWave1Trainer(trainer("Draw 3 cards."))?.programId).toBe("template:trainer:draw-fixed:3");
    expect(matchWave1Trainer(trainer("Draw 3 cards. Then, heal 10 damage."))).toBeUndefined();
    expect(compileCardImplementation(trainer("Draw 3 cards. Then, heal 10 damage.")).status).toBe("unsupported");
  });

  it.each([
    ["Draw 3 cards.", "trainer-draw-fixed"],
    ["Discard your hand and draw 7 cards.", "trainer-discard-hand-draw"],
    ["Shuffle your hand into your deck. Then, draw 5 cards.", "trainer-shuffle-hand-draw"],
    ["Draw cards until you have 6 cards in your hand.", "trainer-draw-to"],
    ["Each player shuffles their hand into their deck and draws 4 cards.", "trainer-both-shuffle-draw"],
    ["Switch your Active Pokémon with 1 of your Benched Pokémon.", "trainer-switch-active"],
    ["Switch 1 of your opponent's Benched Pokémon with their Active Pokémon.", "trainer-gust-opponent"],
    ["Move a Basic Energy card attached to 1 of your Pokémon to another of your Pokémon.", "trainer-move-basic-energy"],
    ["Put 2 Basic Energy cards from your discard pile into your hand.", "trainer-recover-basic-energy"],
    ["Heal 30 damage from 1 of your Pokémon.", "trainer-heal-selected"],
    ["Heal 20 damage from each of your Pokémon.", "trainer-heal-each-own"],
    ["Heal 60 damage and remove all Special Conditions from 1 of your Pokémon.", "trainer-heal-selected-clear-conditions"],
    ["Heal 70 damage from your Active Pokémon.", "trainer-heal-active"],
    ["Remove all Special Conditions from your Active Pokémon.", "trainer-clear-active-conditions"],
    ["Search your deck for up to 2 Basic Pokémon, reveal them, and put them into your hand. Then, shuffle your deck.", "trainer-search-deck-to-hand"],
    ["Search your deck for up to 2 Basic Pokémon and put them onto your Bench. Then, shuffle your deck.", "trainer-search-basic-to-bench"],
  ])("matches and fully consumes reviewed Trainer text: %s", (text, templateId) => {
    expect(matchWave1Trainer(trainer(text))?.templateId).toBe(templateId);
    expect(matchWave1Trainer(trainer(`${text} Draw a card.`))).toBeUndefined();
  });

  it.each([
    ["Once during your turn, you may draw 1 card.", "ability-once-draw-fixed"],
    ["Once during your turn (before your attack), you may draw cards until you have 3 cards in your hand.", "ability-once-draw-to"],
    ["Once during your turn, if this Pokémon is in the Active Spot, you may draw a card.", "ability-active-draw-fixed"],
    ["Once during your turn, you may discard your hand and draw 3 cards.", "ability-discard-hand-draw"],
    ["Once during your turn, you may discard a card from your hand. If you do, draw 2 cards.", "ability-discard-one-draw"],
    ["Once during your turn, you may heal 20 damage from this Pokémon.", "ability-heal-self"],
    ["Once during your turn, you may heal 30 damage from each of your Pokémon.", "ability-heal-each-own"],
    ["Once during your turn, you may heal 20 damage from your Active Pokémon.", "ability-heal-active"],
    ["Once during your turn, if this Pokémon is in the Active Spot, you may heal 60 damage from 1 of your Pokémon.", "ability-active-heal-selected"],
    ["Once during your turn, you may switch your Active Pokémon with 1 of your Benched Pokémon.", "ability-switch-active"],
    ["Once during your turn (before your attack), if this Pokémon is on your Bench, you may switch it with your Active Pokémon.", "ability-switch-self-active"],
    ["Once during your turn, you may put 2 damage counters on 1 of your opponent's Pokémon.", "ability-place-opponent-damage-counters"],
    ["Once during your turn, if this Pokémon is in the Active Spot, you may make your opponent's Active Pokémon Poisoned.", "ability-active-apply-condition"],
    ["Once during your turn, you may search your deck for a Supporter card, reveal it, and put it into your hand. Then, shuffle your deck.", "ability-search-deck-to-hand"],
    ["Once during your turn, you may search your deck for up to 2 Basic Pokémon and put them onto your Bench. Then, shuffle your deck.", "ability-search-basic-to-bench"],
  ])("matches and fully consumes reviewed Ability text: %s", (text, templateId) => {
    expect(matchWave1Ability(ability(text))?.templateId).toBe(templateId);
    expect(matchWave1Ability(ability(`${text} Draw a card.`))).toBeUndefined();
  });

  it("executes a real Barry printing and inherits the reviewed handler across its full-art reprint", () => {
    const regular = index.byId.get("swsh9-130")!, alternate = index.byId.get("swsh9-167")!;
    expect(compileCardImplementation(regular)).toMatchObject({ status: "complete", implementationSource: "reviewed-template" });
    expect(compileCardImplementation(alternate)).toMatchObject({ status: "complete", implementationSource: "functional-reprint", canonicalCardId: "swsh9-130" });
    expect(implementationResolver()?.familyFor(regular.id)?.id).toBe(implementationResolver()?.familyFor(alternate.id)?.id);
    let state = forceMain(freshSkeledirgeGame()); state.cardDefinitions[regular.id] = runtime(regular.id); state.players["player-one"].hand = [instance(regular.id, "barry")]; state.players["player-one"].deck = Array.from({ length: 5 }, (_, value) => instance("sve-2", `barry-draw-${value}`));
    const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "play-trainer"); if (!action) throw new Error("Barry was not playable."); state = applyAction(state, action);
    expect(state.players["player-one"].hand).toHaveLength(3);
  });

  it("executes draw-to-hand-size once per turn from a real Beautifly Ability", () => {
    let state = forceMain(freshSkeledirgeGame()); state.cardDefinitions["swsh11-8"] = runtime("swsh11-8"); state.players["player-one"].bench = [inPlay("swsh11-8", "beautifly")]; state.players["player-one"].hand = [instance("sve-2", "kept")]; state.players["player-one"].deck = Array.from({ length: 10 }, (_, value) => instance("sve-2", `beautifly-draw-${value}`));
    const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "use-ability"); if (!action) throw new Error("Stoked Straw was not offered."); state = applyAction(state, action);
    expect(state.players["player-one"].hand).toHaveLength(6);
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "use-ability")).toBe(false);
  });

  it("applies a Special Condition only after a surviving target takes damage", () => {
    let state = forceMain(freshSkeledirgeGame()); state.cardDefinitions["swsh10-67"] = runtime("swsh10-67"); state.cardDefinitions["test-psychic-energy"] = energy("psychic"); state.players["player-one"].active = inPlay("swsh10-67", "azelf"); state.players["player-one"].active!.attachedEnergy = [instance("test-psychic-energy", "azelf-energy")]; state.players["player-two"].active = inPlay("sv2-37", "condition-target");
    const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "attack"); if (!action) throw new Error("Mind Bend was not offered."); state = applyAction(state, action);
    expect(state.players["player-two"].active!.damage).toBe(30);
    expect(state.players["player-two"].active!.specialConditions).toContain("confused");
  });

  it("resolves recoil before the shared Knock Out checkpoint", () => {
    const card = runtime("swsh8-33"); if (card.category !== "pokemon") throw new Error("Expected Arcanine Pokémon.");
    let state = forceMain(freshSkeledirgeGame()); state.cardDefinitions[card.id] = card; state.players["player-one"].active = inPlay(card.id, "arcanine"); state.players["player-one"].bench = [inPlay("sv2-35", "recoil-backup")]; state.players["player-one"].active!.damage = card.hp - 20; state.players["player-one"].active!.attachedEnergy = Array.from({ length: 3 }, (_, value) => instance("sve-2", `recoil-energy-${value}`)); state.players["player-two"].active = inPlay("sv2-37", "recoil-target");
    const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "attack" && candidate.description.includes("Heat Tackle")); if (!action) throw new Error("Heat Tackle was not offered."); state = applyAction(state, action);
    expect(state.events.some((event) => event.type === "damage-dealt" && event.detail === "recoil" && event.amount === 30)).toBe(true);
    expect(state.events.some((event) => event.type === "pokemon-knocked-out" && event.targetPlayerId === "player-one")).toBe(true);
  });

  it("keeps exact IDs and executable attack programs across an alternate-art family", () => {
    const regular = runtime("sv4-145"), alternate = runtime("sv4-211"); if (regular.category !== "pokemon" || alternate.category !== "pokemon") throw new Error("Expected Aipom Pokémon.");
    expect(alternate.id).toBe("sv4-211");
    expect(alternate.attacks.map((attack) => attack.effectProgramId)).toEqual(regular.attacks.map((attack) => attack.effectProgramId));
    expect(compileCardImplementation(index.byId.get("sv4-211")!)).toMatchObject({ status: "complete", implementationSource: "functional-reprint" });
  });
});
