import { describe, expect, it } from "vitest";
import { applyAction, createPlayerObservation, getLegalActions } from "../../engine";
import type { GameAction, PlayerId } from "../../engine/model/actions";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { freshSkeledirgeGame, inPlay, skeledirgeIndex, skeledirgeManifest } from "../fixtures/skeledirgeRuntime";

function applyWhere(state: ReturnType<typeof freshSkeledirgeGame>, playerId: PlayerId, predicate: (action: GameAction) => boolean) { const action = getLegalActions(state, playerId).find(predicate); if (!action) throw new Error("Expected legal action"); return applyAction(state, action); }

describe("real-deck setup and integrated Pokémon Checkup", () => {
  it("supports setup Bench placement, explicit completion, and hides the opponent's setup Pokémon", () => {
    let state = freshSkeledirgeGame(); state = applyWhere(state, "player-one", (action) => action.type === "select-active");
    const benchAction = getLegalActions(state, "player-one").find((action) => action.type === "bench-basic"); if (benchAction) state = applyAction(state, benchAction);
    const opponentView = createPlayerObservation(state, "player-two"); expect(opponentView.opponent.active).toBeNull(); expect(opponentView.opponent.bench).toEqual([]);
    state = applyWhere(state, "player-one", (action) => action.type === "finish-setup"); state = applyWhere(state, "player-two", (action) => action.type === "select-active"); state = applyWhere(state, "player-two", (action) => action.type === "finish-setup"); while (state.pendingChoice?.type === "mulligan-draw") state = applyWhere(state, state.pendingChoice.playerId, (action) => action.type === "finish-setup");
    expect(state.phase).toBe("main"); expect(state.events.some((event) => event.type === "setup-completed")).toBe(true); expect(state.players["player-one"].bench.length).toBe(benchAction ? 1 : 0);
  });

  it("offers deterministic optional mulligan bonus draws", () => {
    let state = Array.from({ length: 200 }, (_, index) => freshSkeledirgeGame(index + 1)).find((candidate) => candidate.players["player-one"].mulligans > 0 || candidate.players["player-two"].mulligans > 0)!;
    state = applyWhere(state, "player-one", (action) => action.type === "select-active"); state = applyWhere(state, "player-one", (action) => action.type === "finish-setup"); state = applyWhere(state, "player-two", (action) => action.type === "select-active"); state = applyWhere(state, "player-two", (action) => action.type === "finish-setup");
    expect(state.pendingChoice?.type).toBe("mulligan-draw"); const chooser = state.pendingChoice!.playerId; const before = state.players[chooser].hand.length; state = applyWhere(state, chooser, (action) => action.type === "draw-mulligan"); expect(state.players[chooser].hand.length).toBe(before + 1);
  });

  it("enforces the one-Radiant-Pokémon deck-wide limit", () => {
    const invalid = structuredClone(skeledirgeManifest); invalid.entries.find((entry) => entry.cardId === "swsh12-16")!.count = 2; invalid.entries.find((entry) => entry.cardId === "sve-2")!.count = 11;
    expect(analyseDeck(invalid, skeledirgeIndex).issues.some((issue) => issue.message.includes("only one Radiant Pokémon"))).toBe(true);
  });

  it("runs Burn Checkup during end-turn, records deterministic recovery, and resolves Burn Knock Outs", () => {
    let state = freshSkeledirgeGame(); state.phase = "main"; state.pendingChoice = null; state.activePlayerId = "player-one"; state.turn = 3; state.players["player-one"].active = inPlay("sv2-35", "ending"); state.players["player-two"].active = inPlay("sv4-26", "burn-target"); state.players["player-two"].bench = [inPlay("sv2-35", "burn-survivor")]; state.players["player-two"].active!.damage = 60; state.players["player-two"].active!.specialConditions = ["burned"]; state.rngState = 1;
    state = applyWhere(state, "player-one", (action) => action.type === "end-turn"); expect(state.players["player-two"].discard.some((card) => card.instanceId === "burn-target-sv4-26")).toBe(true); expect(state.pendingChoice?.type).toBe("choose-prize"); expect(state.events.some((event) => event.type === "coin-flip" && event.detail?.startsWith("burned:"))).toBe(true);
  });

  it("never exposes opponent hand, Prize identities, or deck order through observations", () => {
    const state = freshSkeledirgeGame(); const view = createPlayerObservation(state, "player-one"); expect(view.opponent.hand).toEqual({ count: state.players["player-two"].hand.length }); expect(view.opponent.prizeCount).toBe(6); expect("prizes" in view.opponent).toBe(false); expect("deck" in view.opponent).toBe(false);
  });
});
