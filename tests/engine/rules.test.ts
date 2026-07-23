import { describe, expect, it } from "vitest";
import { applyAction, GameRuleError, getLegalActions } from "../../engine";
import { runEffects, UnsupportedEffectError } from "../../engine/effects/effect-runner";
import { action, applyWhere, freshGame, moveCardToHand, setupGame } from "../helpers";

describe("turn rules and legal actions", () => {
  it("draws at turn start and enforces one Energy attachment", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one" }));
    expect(state.players["player-one"].hand).toHaveLength(7);
    moveCardToHand(state, "player-one", "demo-e-fire");
    const attach = action(state, "player-one", (candidate) => candidate.type === "attach-energy");
    state = applyAction(state, attach);
    expect(state.players["player-one"].energyAttachedThisTurn).toBe(true);
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "attach-energy")).toBe(false);
  });

  it("places Basic creatures and blocks same-turn evolution", () => {
    let state = setupGame(freshGame());
    moveCardToHand(state, "player-one", "demo-001");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "bench-basic" && state.players["player-one"].hand.find((card) => card.instanceId === candidate.cardInstanceId)?.cardId === "demo-001");
    moveCardToHand(state, "player-one", "demo-002");
    const benchId = state.players["player-one"].bench[0]!.stack.at(-1)!.instanceId;
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "evolve" && candidate.targetId === benchId)).toBe(false);
    state.players["player-one"].turnsTaken = 2;
    state.players["player-one"].bench[0]!.enteredPlayTurn = state.turn - 1;
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "evolve" && candidate.targetId === benchId)).toBe(true);
  });

  it("enforces one Supporter per turn", () => {
    let state = setupGame(freshGame());
    state.players["player-one"].turnsTaken = 2;
    moveCardToHand(state, "player-one", "demo-t-001");
    moveCardToHand(state, "player-one", "demo-t-001");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "play-trainer" && candidate.description.includes("Field Notes"));
    expect(state.players["player-one"].supporterPlayedThisTurn).toBe(true);
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "play-trainer" && candidate.description.includes("Field Notes"))).toBe(false);
  });

  it("blocks attacks and Supporters for the player going first on their first turn", () => {
    const state = setupGame(freshGame({ startingPlayer: "player-one" }));
    moveCardToHand(state, "player-one", "demo-t-001");
    moveCardToHand(state, "player-one", "demo-e-fire");
    const attached = applyWhere(state, "player-one", (candidate) => candidate.type === "attach-energy");
    const actions = getLegalActions(attached, "player-one");
    expect(actions.some((candidate) => candidate.type === "attack")).toBe(false);
    expect(actions.some((candidate) => candidate.type === "play-trainer" && candidate.description.includes("Field Notes"))).toBe(false);
  });

  it("creates an explicit pending choice for deck searches, then shuffles", () => {
    let state = setupGame(freshGame());
    moveCardToHand(state, "player-one", "demo-t-006");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "play-trainer" && candidate.description.includes("Supply Map"));
    expect(state.pendingChoice?.type).toBe("effect-choice");
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "select-card")).toBe(true);
    const deckCount = state.players["player-one"].deck.length;
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "select-card");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "confirm-choice");
    expect(state.pendingChoice).toBeNull();
    expect(state.players["player-one"].deck).toHaveLength(deckCount - 1);
  });

  it("runs resolved declarative primitives, including deterministic coin flips", () => {
    const state = setupGame(freshGame());
    state.players["player-one"].active!.damage = 30;
    runEffects(state, { playerId: "player-one" }, [{ type: "heal", amount: 20 }, { type: "apply-special-condition", condition: "poisoned" }]);
    expect(state.players["player-one"].active).toMatchObject({ damage: 10, specialConditions: ["poisoned"] });
    runEffects(state, { playerId: "player-one" }, [{ type: "coin-flip", heads: [{ type: "heal", amount: 10 }], tails: [] }]);
    expect(state.rngState).not.toBe(42);
    expect(() => runEffects(state, { playerId: "player-one" }, [{ type: "copy-attack" }])).toThrow(UnsupportedEffectError);
  });

  it("rejects illegal actions without mutating state", () => {
    const state = setupGame(freshGame());
    const snapshot = structuredClone(state);
    expect(() => applyAction(state, { id: "fake", type: "end-turn", playerId: "player-two", description: "Cheat" })).toThrow(GameRuleError);
    expect(state).toEqual(snapshot);
  });

  it("loses when unable to draw at turn start", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one" }));
    state.players["player-two"].deck = [];
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "end-turn");
    expect(state.result).toMatchObject({ winnerId: "player-one", reason: "deck-out" });
  });

  it("keeps one shared Stadium and prevents playing the same Stadium name", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one" }));
    moveCardToHand(state, "player-one", "demo-t-004");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "play-trainer" && candidate.description.includes("Training Ground"));
    expect(state.stadium?.cardId).toBe("demo-t-004");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "end-turn");
    moveCardToHand(state, "player-two", "demo-t-004");
    expect(getLegalActions(state, "player-two").some((candidate) => candidate.type === "play-trainer" && candidate.description.includes("Training Ground"))).toBe(false);
  });
});
