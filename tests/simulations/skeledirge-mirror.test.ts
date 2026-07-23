import { describe, expect, it } from "vitest";
import { runBatch } from "../../engine/simulation/batch-runner";
import { runHeadlessGame } from "../../engine/simulation/game-runner";
import { skeledirgeEngineDeck, skeledirgeRuntimeCards } from "../fixtures/skeledirgeRuntime";

describe("Skeledirge ex / Armarouge AI mirror acceptance", () => {
  it("completes 100 deterministic AI mirror games without unresolved states", () => {
    const batch = runBatch({ games: 100, baseSeed: 20_260_722, subjectDeck: skeledirgeEngineDeck, opponentDeck: skeledirgeEngineDeck, cards: skeledirgeRuntimeCards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
    expect(batch.games).toHaveLength(100); expect(batch.report.errorOrUnresolvedCount).toBe(0); expect(batch.games.every((game) => !game.result.unresolved)).toBe(true); expect(batch.games.every((game) => game.result.reason !== "no-legal-action" && game.result.reason !== "action-limit" && game.result.reason !== "turn-limit")).toBe(true); expect(batch.games.every((game) => Number.isFinite(game.result.turns) && game.actionCount < 1_500)).toBe(true); expect(batch.games.every((game) => game.seed > 0)).toBe(true);
    const sources = new Set(batch.games.flatMap((game) => game.eventSourceCardIds)); expect(sources.has("sv1-41")).toBe(true); expect(sources.has("swsh9-144")).toBe(true); expect(["swsh35-52", "sv4pt5-84", "sv4pt5-91", "sv1-175"].some((id) => sources.has(id))).toBe(true); expect(sources.has("sv2-37")).toBe(true);
  }, 30_000);

  it("replays the same seed to the same winner, turn count, and action sequence", () => {
    const config = { seed: 991_337, playerOneDeck: skeledirgeEngineDeck, playerTwoDeck: skeledirgeEngineDeck, cards: skeledirgeRuntimeCards, startingPlayer: "player-one" as const, playerOneAgent: "heuristic" as const, playerTwoAgent: "heuristic" as const };
    const first = runHeadlessGame(config); const second = runHeadlessGame(config); expect(second.result.winnerId).toBe(first.result.winnerId); expect(second.result.turns).toBe(first.result.turns); expect(second.actionSequence).toEqual(first.actionSequence); expect(second.result.unresolved).toBe(false);
  });
});
