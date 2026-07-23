import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { startEffectProgram } from "../../engine/effects/program-runner";
import type { CardDefinition, PokemonInPlay } from "../../engine/model/cards";
import type { GameState, PlayerState } from "../../engine/model/game-state";

const player = (id: "player-one" | "player-two"): PlayerState => ({ id, deckId: id, deck: [], hand: [], prizes: Array.from({ length: 6 }, (_, index) => ({ instanceId: `${id}-prize-${index}`, cardId: "prize" })), discard: [], active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, stadiumPlayedThisTurn: false, stadiumAbilityUsedThisTurn: false, retreatedThisTurn: false, turnsTaken: 1, mulligans: 0, prizesTaken: 0, abilityUsageByName: {} });
const pokemon = (id: string, cardId: string): PokemonInPlay => ({ stack: [{ instanceId: id, cardId }], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 1, evolvedThisTurn: false, abilityUsage: {} });
const definitions: Record<string, CardDefinition> = {
  dragapult: { id: "dragapult", name: "Dragapult ex", category: "pokemon", pokemonType: "dragon", stage: "stage2", hp: 320, attacks: [], abilities: [], retreatCost: 0, implementationStatus: "complete" },
  target: { id: "target", name: "Target", category: "pokemon", pokemonType: "colorless", stage: "basic", hp: 100, attacks: [], abilities: [], retreatCost: 1, implementationStatus: "complete" },
  prize: { id: "prize", name: "Prize", category: "energy", energyType: "colorless", basic: true, implementationStatus: "complete" },
};
function state(): GameState {
  const game: GameState = { seed: 1, rngState: 1, players: { "player-one": player("player-one"), "player-two": player("player-two") }, startingPlayer: "player-one", activePlayerId: "player-one", turn: 3, phase: "main", pendingChoice: null, actionLog: [], actionHistory: [], events: [], result: null, detailedLogs: true, cardDefinitions: definitions, stadium: null, temporaryEffects: [], pendingKnockOutCause: null };
  game.players["player-one"].active = pokemon("dragapult-play", "dragapult"); game.players["player-two"].active = pokemon("active-target", "target"); game.players["player-two"].bench = [pokemon("bench-a", "target"), pokemon("bench-b", "target"), pokemon("bench-c", "target")];
  return game;
}
function start(): GameState { const game = state(); startEffectProgram(game, { programId: "attack:phantom-dive", actingPlayerId: "player-one", sourceCardId: "dragapult", sourcePokemonId: "dragapult-play", after: "finish-attack" }); return game; }
function apply(state: GameState, predicate: (action: ReturnType<typeof getLegalActions>[number]) => boolean): GameState { const action = getLegalActions(state, "player-one").find(predicate); if (!action) throw new Error("Expected legal allocation action"); return applyAction(state, action); }
function allocate(game: GameState, values: number[]): GameState { let state = game; for (let index = 0; index < values.length; index += 1) for (let amount = 0; amount < values[index]!; amount += 1) state = apply(state, (action) => action.type === "increase-allocation" && action.targetId === ["bench-a", "bench-b", "bench-c"][index]); return state; }

describe("allocation choices", () => {
  it.each([[6, 0, 0], [3, 3, 0], [4, 1, 1], [2, 2, 2]])("applies %s/%s/%s Phantom Dive distribution", (...values) => {
    let state = allocate(start(), values); expect(state.pendingChoice?.type).toBe("allocation-choice"); expect(getLegalActions(state, "player-one").some((action) => action.type === "confirm-allocation")).toBe(true); state = apply(state, (action) => action.type === "confirm-allocation"); expect(state.players["player-two"].bench.map((target) => target.damage)).toEqual(values.map((amount) => amount * 10)); expect(state.events.filter((event) => event.type === "damage-allocation").map((event) => event.amount)).toEqual(values.filter(Boolean));
  });
  it("rejects confirmation with five counters and never exposes Active as a target", () => { const state = allocate(start(), [5, 0, 0]); expect(getLegalActions(state, "player-one").some((action) => action.type === "confirm-allocation")).toBe(false); expect(getLegalActions(state, "player-one").some((action) => action.type === "increase-allocation" && action.targetId === "active-target")).toBe(false); });
  it("supports clear and deterministic replay actions", () => { let state = allocate(start(), [2, 2, 2]); state = apply(state, (action) => action.type === "clear-allocation"); expect(state.pendingChoice?.type === "allocation-choice" ? state.pendingChoice.remainingUnits : -1).toBe(6); state = allocate(state, [6, 0, 0]); state = apply(state, (action) => action.type === "confirm-allocation"); expect(state.actionHistory.filter((action) => action.type === "increase-allocation")).toHaveLength(12); expect(state.events.some((event) => event.detail === "Phantom Dive: 6 damage counters")).toBe(true); });
});
