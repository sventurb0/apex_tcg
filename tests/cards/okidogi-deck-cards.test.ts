import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import type { GameAction, PlayerId } from "../../engine/model/actions";
import type { PokemonCard } from "../../engine/model/cards";
import { processPokemonCheckup } from "../../engine/rules/pokemon-checkup";
import { nextRandom } from "../../engine/random/seeded-rng";
import { compileCardImplementation, toRuntimeCardDefinition } from "../../src/data/pokemon";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { forceOkidogiMain, freshOkidogiGame, okidogiIndex, okidogiManifest, okidogiRuntimeCards, okInPlay, okInstance } from "../fixtures/okidogiRuntime";

function choose(state: ReturnType<typeof freshOkidogiGame>, playerId: PlayerId, predicate: (action: GameAction) => boolean) { const selected = getLegalActions(state, playerId).find(predicate); if (!selected) throw new Error(`Missing action: ${getLegalActions(state, playerId).map((action) => action.description).join(", ")}`); return applyAction(state, selected); }
function ready(active = "sv6pt5-36", opponent = "sv6pt5-36") { const state = forceOkidogiMain(freshOkidogiGame()); state.players["player-one"].active = okInPlay(active, "p1-active"); state.players["player-one"].bench = []; state.players["player-two"].active = okInPlay(opponent, "p2-active"); state.players["player-two"].bench = []; return state; }
function addDarkness(pokemon: ReturnType<typeof okInPlay>, count: number, prefix = "dark") { pokemon.attachedEnergy.push(...Array.from({ length: count }, (_, index) => okInstance("sve-7", `${prefix}-${index}`))); }

describe("Okidogi ex Poison exact-printing runtime support", () => {
  it("resolves 23/23 exact printings, all 60 copies, and validates the exact category totals", () => {
    expect(okidogiManifest.entries).toHaveLength(23); expect(okidogiManifest.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(60); expect(okidogiRuntimeCards).toHaveLength(23);
    for (const entry of okidogiManifest.entries) { const metadata = okidogiIndex.byId.get(entry.cardId)!; expect(compileCardImplementation(metadata).status).toBe("complete"); expect(toRuntimeCardDefinition(metadata)).not.toBeNull(); }
    expect(analyseDeck(okidogiManifest, okidogiIndex)).toMatchObject({ pokemon: 12, trainers: 37, energy: 11, simulationReady: true, unsupported: [] });
  });

  it("calculates Chain-Crazed at 130, 260 Poisoned, and 300 with Binding Mochi before Weakness", () => {
    const run = (poisoned: boolean, tool: boolean) => { let state = ready(); addDarkness(state.players["player-one"].active!, 3); if (poisoned) state.players["player-one"].active!.specialConditions.push("poisoned"); if (tool) state.players["player-one"].active!.tool = okInstance("sv8pt5-95", "mochi"); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Chain-Crazed")); return [...state.events].reverse().find((event) => event.type === "damage-dealt")?.amount; };
    expect(run(false, false)).toBe(130); expect(run(true, false)).toBe(260); expect(run(true, true)).toBe(300);
  });

  it("executes Poisonous Musculature without consuming the manual attachment", () => {
    let state = ready(); addDarkness(state.players["player-one"].active!, 1); state.players["player-one"].deck = [okInstance("sve-7", "search-a"), okInstance("sve-7", "search-b"), okInstance("sv6-95", "other")]; state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Poisonous Musculature")); while (getLegalActions(state, "player-one").some((action) => action.type === "select-card")) state = choose(state, "player-one", (action) => action.type === "select-card"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); expect(state.players["player-one"].active!.attachedEnergy).toHaveLength(3); expect(state.players["player-one"].active!.specialConditions).toContain("poisoned"); expect(state.players["player-one"].energyAttachedThisTurn).toBe(false);
  });

  it("excludes every Pecharunt ex target and shares the Subjugating Chains limit by name", () => {
    let state = ready(); const source = okInPlay("sv6pt5-39", "source"); state.players["player-one"].bench = [source, okInPlay("sv6pt5-39", "other-pecharunt"), okInPlay("sv6pt5-36", "target")]; const actions = getLegalActions(state, "player-one").filter((action) => action.type === "use-ability" && action.description.includes("Subjugating")); expect(actions).toHaveLength(2); expect(actions.every((action) => action.description.includes("Okidogi"))).toBe(true); state = applyAction(state, actions[0]!); expect(state.players["player-one"].active!.stack.at(-1)!.cardId).toBe("sv6pt5-36"); expect(state.players["player-one"].active!.specialConditions).toContain("poisoned"); expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability" && action.description.includes("Subjugating"))).toBe(false);
  });

  it("requires Darkness for Adrena-Brain and atomically moves 1-3 counters with a KO cause", () => {
    let state = ready(); const munkidori = okInPlay("sv6-95", "munkidori"); const damaged = okInPlay("sv6pt5-39", "damaged"); damaged.damage = 40; const damagedId = damaged.stack.at(-1)!.instanceId; state.players["player-one"].bench = [munkidori, damaged]; expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability" && action.description.includes("Adrena"))).toBe(false); addDarkness(munkidori, 1); state = choose(state, "player-one", (action) => action.type === "use-ability" && action.description.includes("Adrena")); state = choose(state, "player-one", (action) => action.type === "select-pokemon" && action.selectionId === damagedId); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); state = choose(state, "player-one", (action) => action.type === "select-pokemon"); state = choose(state, "player-one", (action) => action.type === "confirm-choice"); state = choose(state, "player-one", (action) => action.type === "select-effect-mode" && action.mode === "3"); expect(state.players["player-one"].bench.find((pokemon) => pokemon.stack.at(-1)!.instanceId === damagedId)!.damage).toBe(10); expect(state.players["player-two"].active!.damage).toBe(30); expect(state.events.some((event) => event.type === "damage-counters-moved" && event.amount === 30)).toBe(true);
  });

  it("reduces Munkidori ex Prizes only for opponent attack damage while Pecharunt ex is in play", () => {
    let state = ready("sv6pt5-36", "sv6pt5-37"); addDarkness(state.players["player-one"].active!, 3); state.players["player-one"].active!.specialConditions.push("poisoned"); state.players["player-two"].bench = [okInPlay("sv6pt5-39", "pecharunt")]; state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Chain-Crazed")); expect(state.pendingChoice).toMatchObject({ type: "choose-prize", claims: [{ remaining: 1 }] }); expect(state.events.some((event) => event.type === "prize-modified" && event.amount === -1)).toBe(true);
  });

  it("offers Flip the Script only after a structured prior-opponent-turn Knock Out", () => {
    const state = ready(); state.players["player-one"].bench = [okInPlay("me2pt5-142", "fez")]; expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability" && action.description.includes("Flip"))).toBe(false); state.events.push({ index: 0, turn: state.turn - 1, type: "pokemon-knocked-out", playerId: "player-two", targetPlayerId: "player-one", cause: "attack-damage" }); expect(getLegalActions(state, "player-one").some((action) => action.type === "use-ability" && action.description.includes("Flip"))).toBe(true);
  });

  it("targets Bench with Cruel Arrow and ignores Bench Weakness and Resistance", () => {
    let state = ready("me2pt5-142"); addDarkness(state.players["player-one"].active!, 3); const bench = okInPlay("sv6pt5-36", "bench-target"); state.players["player-two"].bench = [bench]; const targetId = bench.stack.at(-1)!.instanceId; state = choose(state, "player-one", (action) => action.type === "attack" && action.targetId === targetId); expect(state.players["player-two"].bench[0]!.damage).toBe(100); expect(state.players["player-two"].active!.damage).toBe(0);
  });

  it("applies Mind Bend Confusion and resolves a seeded failed attack as 3 self-damage counters", () => {
    let state = ready("sv6-95"); state.cardDefinitions["test-psychic"] = { id: "test-psychic", name: "Basic Psychic Energy", category: "energy", energyType: "psychic", basic: true, implementationStatus: "complete" }; state.players["player-one"].active!.attachedEnergy.push(okInstance("test-psychic", "mind-a"), okInstance("test-psychic", "mind-b"), okInstance("test-psychic", "mind-c")); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Mind Bend")); expect(state.players["player-two"].active!.specialConditions).toContain("confused"); addDarkness(state.players["player-two"].active!, 3); state.rngState = Array.from({ length: 100 }, (_, index) => index + 1).find((seed) => nextRandom(seed).value >= .5)!; state = choose(state, "player-two", (action) => action.type === "attack" && action.description.includes("Chain-Crazed")); expect(state.players["player-one"].active!.damage).toBe(0); expect(state.events.some((event) => event.type === "coin-flip" && event.detail === "confused:tails")).toBe(true);
  });

  it("applies Toxic Subjugation only while the exact Pecharunt is Active", () => {
    const activeState = ready("svp-129"); statePoison(activeState); expect(processPokemonCheckup(activeState, "player-one").state.players["player-two"].active!.damage).toBe(60); const benchState = ready(); benchState.players["player-one"].bench = [okInPlay("svp-129", "toxic-bench")]; statePoison(benchState); expect(processPokemonCheckup(benchState, "player-one").state.players["player-two"].active!.damage).toBe(10);
  });

  it("compiles Budew's Free attack and blocks Items but not Supporters", () => {
    let state = ready("sv8pt5-4"); const budew = okidogiRuntimeCards.find((card): card is PokemonCard => card.id === "sv8pt5-4" && card.category === "pokemon")!; expect(budew.attacks[0]!.cost).toEqual({}); state = choose(state, "player-one", (action) => action.type === "attack" && action.description.includes("Itchy Pollen")); state.players["player-two"].hand.push(okInstance("me1-131", "item"), okInstance("me2pt5-192", "supporter")); const actions = getLegalActions(state, "player-two"); expect(actions.some((action) => action.type === "play-trainer" && action.cardInstanceId.includes("item"))).toBe(false); expect(actions.some((action) => action.type === "play-trainer" && action.cardInstanceId.includes("supporter"))).toBe(true);
  });

  it("runs an immediate Gravity Mountain KO checkpoint for a damaged Stage 2", () => {
    let state = ready(); state.cardDefinitions["test-stage2"] = { id: "test-stage2", name: "Test Stage 2", category: "pokemon", pokemonType: "fire", stage: "stage2", hp: 180, prizeValue: 1, abilities: [], attacks: [], retreatCost: 1, implementationStatus: "complete" }; const stage2 = okInPlay("test-stage2", "mountain-target"); stage2.damage = 150; state.players["player-two"].active = stage2; state.players["player-two"].bench = [okInPlay("sv6pt5-36", "survivor")]; const stadium = okInstance("sv8-177", "mountain"); state.players["player-one"].hand.push(stadium); state = choose(state, "player-one", (action) => action.type === "play-trainer" && action.cardInstanceId === stadium.instanceId); expect(state.players["player-two"].active).toBeNull(); expect(state.events.some((event) => event.type === "pokemon-knocked-out" && event.cause === "stadium-effect")).toBe(true);
  });
});

function statePoison(state: ReturnType<typeof freshOkidogiGame>) { state.players["player-two"].active!.specialConditions.push("poisoned"); }
