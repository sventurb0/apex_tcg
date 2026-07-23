import { describe, expect, it } from "vitest";
import { applyAction, createPlayerObservation, getLegalActions } from "../../engine";
import { heuristicAgent } from "../../engine/ai/heuristic-agent";
import { randomAgent } from "../../engine/ai/random-agent";
import { runHeadlessGame } from "../../engine/simulation/game-runner";
import { fixtureCardList } from "../fixtures/cards";
import { getFixtureDeck } from "../fixtures/decks";
import { freshGame, setupGame } from "../helpers";

describe("observations and AI", () => {
  it("filters the opponent hand, Prizes, and deck order", () => {
    const state = setupGame(freshGame());
    const observation = createPlayerObservation(state, "player-one");
    expect(observation.self.hand).toEqual(state.players["player-one"].hand);
    expect(observation.opponent.hand).toEqual({ count: state.players["player-two"].hand.length });
    expect(observation.opponent).not.toHaveProperty("deck");
    expect(observation.opponent).not.toHaveProperty("prizes");
  });

  it("both agents select only a legal action", () => {
    const state = setupGame(freshGame());
    const observation = createPlayerObservation(state, "player-one");
    for (const agent of [randomAgent, heuristicAgent]) {
      const decision = agent.selectAction(observation, 99);
      expect(getLegalActions(state, "player-one").map((action) => action.id)).toContain(decision.action.id);
      expect(() => applyAction(state, decision.action)).not.toThrow();
    }
  });

  it("completes a full AI-versus-AI game or the explicit safety limit", () => {
    const game = runHeadlessGame({ seed: 7, playerOneDeck: getFixtureDeck("demo-cinder"), playerTwoDeck: getFixtureDeck("demo-brook"), cards: fixtureCardList, maxActions: 1500 });
    expect(game.result).toBeTruthy();
    expect(game.actionCount).toBeLessThanOrEqual(1500);
  });
});
