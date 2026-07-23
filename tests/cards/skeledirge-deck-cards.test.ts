import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import type { GameAction, PlayerId } from "../../engine/model/actions";
import type { PokemonCard } from "../../engine/model/cards";
import { resolveBaseDamage } from "../../engine/rules/combat";
import { nextRandom } from "../../engine/random/seeded-rng";
import { compileCardImplementation, toRuntimeCardDefinition } from "../../src/data/pokemon";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { forceMain, freshSkeledirgeGame, inPlay, instance, skeledirgeIndex, skeledirgeManifest, skeledirgeRuntimeCards } from "../fixtures/skeledirgeRuntime";

function choose(state: ReturnType<typeof freshSkeledirgeGame>, playerId: PlayerId, predicate: (action: GameAction) => boolean) { const action = getLegalActions(state, playerId).find(predicate); if (!action) throw new Error(`Missing action: ${getLegalActions(state, playerId).map((item) => item.description).join(", ")}`); return applyAction(state, action); }
function readyBoard(active = "sv2-35", opponent = "sv2-35") { const state = forceMain(freshSkeledirgeGame()); state.players["player-one"].active = inPlay(active, "p1-active"); state.players["player-one"].bench = []; state.players["player-two"].active = inPlay(opponent, "p2-active"); state.players["player-two"].bench = [inPlay("sv2-35", "p2-bench")]; return state; }
function addFire(pokemon: ReturnType<typeof inPlay>, count: number, prefix = "energy") { pokemon.attachedEnergy.push(...Array.from({ length: count }, (_, index) => instance("sve-2", `${prefix}-${index}`))); }
function playTrainer(state: ReturnType<typeof freshSkeledirgeGame>, cardId: string) { const card = instance(cardId, `hand-${state.actionHistory.length}`); state.players["player-one"].hand.push(card); return choose(state, "player-one", (action) => action.type === "play-trainer" && action.cardInstanceId === card.instanceId); }

describe("Skeledirge exact-printing runtime support", () => {
  it("resolves all 20 exact printings, all 60 copies, and marks the deck simulation-ready", () => {
    expect(skeledirgeManifest.entries).toHaveLength(20);
    expect(skeledirgeManifest.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(60);
    expect(skeledirgeRuntimeCards).toHaveLength(20);
    for (const entry of skeledirgeManifest.entries) { const metadata = skeledirgeIndex.byId.get(entry.cardId)!; expect(compileCardImplementation(metadata).status).toBe("complete"); expect(toRuntimeCardDefinition(metadata)).not.toBeNull(); }
    expect(analyseDeck(skeledirgeManifest, skeledirgeIndex)).toMatchObject({ simulationReady: true, unsupported: [] });
  });

  it("maps only exact executable Abilities and removes the universal heal placeholder", () => {
    expect((skeledirgeRuntimeCards.find((card) => card.id === "sv2-37") as { abilities: unknown[] }).abilities).toEqual([]);
    expect((skeledirgeRuntimeCards.find((card) => card.id === "sv1-41") as { abilities: unknown[] }).abilities).toHaveLength(1);
    const state = readyBoard("sv2-37"); state.players["player-one"].active!.damage = 40;
    expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability")).toBe(false);
    expect(state.players["player-one"].active!.damage).toBe(40);
  });

  it("preserves exact fixed/no-damage attacks and applies Flame Cannon Burn only to a surviving defender", () => {
    const pokemon = (id: string) => skeledirgeRuntimeCards.find((card) => card.id === id && card.category === "pokemon") as PokemonCard;
    expect(pokemon("sv1-37").attacks.map((attack) => [attack.name, attack.damage.printed])).toEqual([["Bite", "50"], ["Rolling Tackle", "100"]]); expect(pokemon("sv2-35").attacks.map((attack) => attack.damage.kind)).toEqual(["none", "fixed"]); expect(pokemon("swsh12-137").attacks.find((attack) => attack.name === "Ram")?.damage).toMatchObject({ kind: "fixed", amount: 30 });
    let state = readyBoard("sv1-41", "sv2-37"); addFire(state.players["player-one"].active!, 3); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Flame Cannon")); expect(state.players["player-two"].active!.damage).toBeGreaterThanOrEqual(90); expect(state.events.some((event) => event.type === "special-condition-applied" && event.detail === "burned")).toBe(true);
  });

  it("takes two Prizes for an exact Skeledirge ex Knock Out and does not Burn a knocked-out target", () => {
    let state = readyBoard("sv1-41", "sv2-37"); addFire(state.players["player-one"].active!, 3); state.players["player-two"].active!.damage = 250; state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Flame Cannon")); expect(state.pendingChoice).toMatchObject({ type: "choose-prize", claims: [{ remaining: 2 }] }); expect(state.events.some((event) => event.type === "special-condition-applied")).toBe(false);
  });

  it("executes Fire Off repeatedly, preserves Energy instances, and rejects non-Fire or Active sources", () => {
    let state = readyBoard(); const armarouge = inPlay("sv1-41", "armarouge"); const donor = inPlay("sv4-26", "donor"); addFire(donor, 2, "movable");
    state.cardDefinitions["test-water"] = { id: "test-water", name: "Water", category: "energy", energyType: "water", basic: true, implementationStatus: "complete" }; donor.attachedEnergy.push(instance("test-water", "not-fire")); state.players["player-one"].bench = [armarouge, donor];
    const first = getLegalActions(state, "player-one").filter((action) => action.type === "use-ability"); expect(first).toHaveLength(2); const firstId = first[0]!.cardInstanceId!; state = applyAction(state, first[0]!);
    expect(state.players["player-one"].active!.attachedEnergy.some((energy) => energy.instanceId === firstId)).toBe(true);
    const second = getLegalActions(state, "player-one").find((action) => action.type === "use-ability")!; state = applyAction(state, second);
    expect(state.players["player-one"].active!.attachedEnergy).toHaveLength(2); expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability")).toBe(false);
  });

  it("attaches Charcadet's searched Basic Fire Energy and shuffles deterministically", () => {
    let state = readyBoard("sv4-26"); addFire(state.players["player-one"].active!, 1); state.players["player-one"].deck = [instance("sve-2", "searched"), instance("sv1-175", "other-a"), instance("sv2-35", "other-b")]; const before = state.rngState;
    state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Fiery Fighting Spirit")); expect(state.pendingChoice?.type).toBe("effect-choice");
    state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice");
    expect(state.players["player-one"].active!.attachedEnergy.some((energy) => energy.instanceId === "searched-sve-2")).toBe(true); expect(state.rngState).not.toBe(before);
  });

  it("resolves Fuecoco's seeded heads heal and tails no-op repeatably", () => {
    const headsSeed = Array.from({ length: 100 }, (_, index) => index + 1).find((seed) => nextRandom(seed).value < .5)!; const tailsSeed = Array.from({ length: 100 }, (_, index) => index + 1).find((seed) => nextRandom(seed).value >= .5)!;
    const run = (seed: number) => { let state = readyBoard(); state.rngState = seed; state.players["player-one"].active!.damage = 50; addFire(state.players["player-one"].active!, 1); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Spacing Out")); return state; };
    expect(run(headsSeed).players["player-one"].active!.damage).toBe(20); expect(run(tailsSeed).players["player-one"].active!.damage).toBe(50); expect(run(headsSeed).events).toEqual(run(headsSeed).events);
  });

  it("uses Elegant Heal once per turn on all own damaged Pokémon and Aroma Shot clears conditions", () => {
    let state = readyBoard("swsh12-16"); const bench = inPlay("sv2-35", "healed-bench"); state.players["player-one"].bench = [bench]; state.players["player-one"].active!.damage = 40; bench.damage = 10; state.players["player-two"].active!.damage = 30;
    state = choose(state, "player-one", (action) => action.type === "use-ability"); expect(state.players["player-one"].active!.damage).toBe(20); expect(state.players["player-one"].bench[0]!.damage).toBe(0); expect(state.players["player-two"].active!.damage).toBe(30); expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability")).toBe(false);
    state.cardDefinitions["test-grass"] = { id: "test-grass", name: "Grass", category: "energy", energyType: "grass", basic: true, implementationStatus: "complete" }; state.players["player-one"].active!.attachedEnergy.push(instance("test-grass", "aroma-grass")); addFire(state.players["player-one"].active!, 2); state.players["player-one"].active!.specialConditions = ["poisoned", "burned"]; state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Aroma Shot")); expect(state.players["player-one"].active!.specialConditions).toEqual([]);
  });

  it("calculates Burning Voice from damage counters with a zero lower bound and Vitality Song heals the team", () => {
    const skeledirge = inPlay("sv2-37", "formula"); const damage = (skeledirgeRuntimeCards.find((card) => card.id === "sv2-37") as { attacks: Array<{ name: string; damage: Parameters<typeof resolveBaseDamage>[0] }> }).attacks.find((attack) => attack.name === "Burning Voice")!.damage;
    expect(resolveBaseDamage(damage, skeledirge)).toBe(270); skeledirge.damage = 10; expect(resolveBaseDamage(damage, skeledirge)).toBe(260); skeledirge.damage = 50; expect(resolveBaseDamage(damage, skeledirge)).toBe(220); skeledirge.damage = 400; expect(resolveBaseDamage(damage, skeledirge)).toBe(0);
    let state = readyBoard("sv2-37"); const bench = inPlay("sv2-35", "vitality-bench"); state.players["player-one"].bench = [bench]; state.players["player-one"].active!.damage = 70; bench.damage = 20; addFire(state.players["player-one"].active!, 1); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Vitality Song")); expect(state.players["player-two"].active!.damage).toBe(50); expect(state.players["player-one"].active!.damage).toBe(40); expect(state.players["player-one"].bench[0]!.damage).toBe(0);
  });

  it("handles Smeargle's top-five multi-Energy selection, one target, and unselected shuffle", () => {
    let state = readyBoard("swsh12-137"); const target = inPlay("sv2-35", "palette-target"); state.players["player-one"].bench = [target]; addFire(state.players["player-one"].active!, 1); state.players["player-one"].deck = [instance("sve-2", "palette-a"), instance("sv1-175", "palette-other"), instance("sve-2", "palette-b"), instance("sv2-35", "palette-pokemon")];
    state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Colorful Palette")); while (getLegalActions(state, "player-one").some((action) => action.type === "select-card")) state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); state = choose(state, "player-one", (action) => action.type === "select-pokemon" && action.description.includes("Fuecoco")); state = choose(state, "player-one", (action) => action.type === "confirm-choice");
    expect(state.players["player-one"].bench[0]!.attachedEnergy).toHaveLength(2); expect(state.players["player-one"].deck.map((card) => card.cardId)).toContain("sv1-175");
  });

  it("executes recovery, search, draw, bottom-deck, and exact-cost Trainer programs", () => {
    let state = readyBoard(); state.players["player-one"].discard.push(instance("sve-2", "retrieval-a"), instance("sve-2", "retrieval-b")); state = playTrainer(state, "swsh12pt5-127"); while (getLegalActions(state, "player-one").some((action) => action.type === "select-card")) state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].hand.filter((card) => card.instanceId.startsWith("retrieval-")).length).toBe(2);
    state.players["player-one"].deck = [instance("sv2-35", "great-hit"), instance("sve-2", "great-miss")]; state = playTrainer(state, "swsh35-52"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].hand.some((card) => card.instanceId === "great-hit-sv2-35")).toBe(true);
    state.players["player-one"].hand = [instance("sve-2", "ultra-cost-a"), instance("sv1-175", "ultra-cost-b"), instance("sv4pt5-91", "ultra")]; state.players["player-one"].deck = [instance("sv2-37", "ultra-result")]; state = choose(state, "player-one", (action) => action.type === "play-trainer" && action.cardInstanceId === "ultra-sv4pt5-91"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].discard.filter((card) => card.instanceId.startsWith("ultra-cost")).length).toBe(2); expect(state.players["player-one"].hand.some((card) => card.instanceId === "ultra-result-sv2-37")).toBe(true);
  });

  it("does not offer Ultra Ball without two other cards and permits empty optional searches", () => {
    let state = readyBoard(); state.players["player-one"].hand = [instance("sv4pt5-91", "unpayable-ultra"), instance("sve-2", "only-other")]; expect(getLegalActions(state, "player-one").some((action) => action.type === "play-trainer" && action.cardInstanceId === "unpayable-ultra-sv4pt5-91")).toBe(false);
    state.players["player-one"].hand = [instance("swsh12pt5-127", "empty-retrieval")]; state.players["player-one"].discard = []; state = choose(state, "player-one", (action) => action.type === "play-trainer"); expect(state.pendingChoice).toMatchObject({ type: "effect-choice", min: 0, max: 0 }); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.pendingChoice).toBeNull();
  });

  it("executes Nest Ball, Professor's Research, Youngster, Iono, Jacq, and Klara destinations", () => {
    let state = readyBoard(); state.players["player-one"].deck = [instance("sv2-35", "nest-target"), instance("sve-2", "draw-a"), instance("sv1-37", "jacq-target")]; state = playTrainer(state, "sv4pt5-84"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].bench.some((pokemon) => pokemon.stack[0]!.instanceId === "nest-target-sv2-35")).toBe(true);
    state.players["player-one"].deck = Array.from({ length: 10 }, (_, index) => instance("sve-2", `research-${index}`)); state.players["player-one"].hand = [instance("sve-2", "discarded"), instance("sv1-189", "research-card")]; state = choose(state, "player-one", (action) => action.type === "play-trainer"); expect(state.players["player-one"].hand).toHaveLength(7); expect(state.players["player-one"].discard.some((card) => card.instanceId === "discarded-sve-2")).toBe(true);
    state.players["player-one"].supporterPlayedThisTurn = false; state.players["player-one"].discard.push(instance("sv2-35", "klara-pokemon"), instance("sve-2", "klara-energy")); state.players["player-one"].hand.push(instance("swsh6-145", "klara")); state = choose(state, "player-one", (action) => action.type === "play-trainer" && action.cardInstanceId === "klara-swsh6-145"); state = choose(state, "player-one", (action) => action.type === "select-effect-mode" && action.mode === "both"); state = choose(state, "player-one", (action) => action.type === "select-card" && action.selectionId === "klara-pokemon-sv2-35"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); state = choose(state, "player-one", (action) => action.type === "select-card" && action.selectionId === "klara-energy-sve-2"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].hand.some((card) => card.instanceId === "klara-pokemon-sv2-35")).toBe(true); expect(state.players["player-one"].hand.some((card) => card.instanceId === "klara-energy-sve-2")).toBe(true);
  });

  it("keeps Youngster shuffling distinct from Iono bottom-decking and searches Jacq evolutions", () => {
    let state = readyBoard(); state.players["player-one"].hand = [instance("sv1-198", "youngster"), instance("sve-2", "youngster-hand-a"), instance("sv2-35", "youngster-hand-b")]; state.players["player-one"].deck = Array.from({ length: 8 }, (_, index) => instance("sve-2", `youngster-deck-${index}`)); const rngBefore = state.rngState; state = choose(state, "player-one", (action) => action.type === "play-trainer"); expect(state.players["player-one"].hand).toHaveLength(5); expect(state.rngState).not.toBe(rngBefore); expect(state.players["player-one"].deck.some((card) => card.instanceId.startsWith("youngster-hand"))).toBe(true);
    state = readyBoard(); state.players["player-one"].prizes = [instance("sve-2", "p1-prize-a"), instance("sve-2", "p1-prize-b")]; state.players["player-two"].prizes = [instance("sve-2", "p2-prize-a"), instance("sve-2", "p2-prize-b"), instance("sve-2", "p2-prize-c")]; state.players["player-one"].hand = [instance("sv4pt5-80", "iono"), instance("sv2-35", "p1-bottom")]; state.players["player-two"].hand = [instance("sv4-26", "p2-bottom")]; state.players["player-one"].deck = Array.from({ length: 6 }, (_, index) => instance("sve-2", `iono-p1-${index}`)); state.players["player-two"].deck = Array.from({ length: 6 }, (_, index) => instance("sve-2", `iono-p2-${index}`)); state = choose(state, "player-one", (action) => action.type === "play-trainer"); expect(state.players["player-one"].hand).toHaveLength(2); expect(state.players["player-two"].hand).toHaveLength(3); expect(state.players["player-one"].deck.at(-1)!.instanceId).toBe("p1-bottom-sv2-35"); expect(state.players["player-two"].deck.at(-1)!.instanceId).toBe("p2-bottom-sv4-26");
    state = readyBoard(); state.players["player-one"].deck = [instance("sv1-37", "jacq-a"), instance("sv2-37", "jacq-b"), instance("sv2-35", "jacq-basic")]; state = playTrainer(state, "sv1-175"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].hand.filter((card) => card.instanceId.startsWith("jacq-")).map((card) => card.cardId).sort()).toEqual(["sv1-37", "sv2-37"]);
  });

  it("resolves Escape Rope ownership in opponent-first order and Magma Basin self-Knock-Outs", () => {
    let state = readyBoard(); state.players["player-one"].bench = [inPlay("sv4-26", "rope-own")]; state.players["player-two"].bench = [inPlay("sv2-35", "rope-opponent")]; state = playTrainer(state, "swsh5-125"); expect(state.pendingChoice).toMatchObject({ type: "effect-choice", playerId: "player-two" }); state = choose(state, "player-two", (action) => action.type === "select-pokemon"); state = choose(state, "player-two", (action) => action.type === "confirm-choice"); expect(state.pendingChoice).toMatchObject({ type: "effect-choice", playerId: "player-one" }); state = choose(state, "player-one", (action) => action.type === "select-pokemon"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].active!.stack[0]!.instanceId).toContain("rope-own"); expect(state.players["player-two"].active!.stack[0]!.instanceId).toContain("rope-opponent");
    state = readyBoard(); const target = inPlay("sv4-26", "basin-target"); target.damage = 60; state.players["player-one"].bench = [target, inPlay("sv2-35", "survivor")]; state.stadium = instance("swsh9-144", "stadium"); state.players["player-one"].discard.push(instance("sve-2", "basin-energy")); state = choose(state, "player-one", (action) => action.type === "use-stadium"); expect(state.players["player-one"].bench.some((pokemon) => playIdForTest(pokemon) === "basin-target-sv4-26")).toBe(false); expect(state.pendingChoice?.type).toBe("choose-prize"); expect(state.players["player-one"].stadiumAbilityUsedThisTurn).toBe(true);
  });
});

function playIdForTest(pokemon: ReturnType<typeof inPlay>): string { return pokemon.stack.at(-1)!.instanceId; }
