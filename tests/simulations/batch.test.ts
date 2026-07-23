import { describe, expect, it } from "vitest";
import { runBatch } from "../../engine/simulation/batch-runner";
import { fixtureCardList } from "../fixtures/cards";
import { getFixtureDeck } from "../fixtures/decks";

describe("batch simulation integration", () => {
  it("runs 100 games without exceptions and reproduces every result", () => {
    const config = { games: 100, baseSeed: 123456, subjectDeck: getFixtureDeck("demo-cinder"), opponentDeck: getFixtureDeck("demo-brook"), cards: fixtureCardList, agentType: "heuristic" as const, firstPlayerPolicy: "alternate" as const };
    const first = runBatch(config);
    const second = runBatch(config);
    expect(first.games).toHaveLength(100);
    expect(first.games.every((game) => game.result || game.actionCount === 1500)).toBe(true);
    expect(first.games.map((game) => game.result)).toEqual(second.games.map((game) => game.result));
    expect(first.report).toEqual(second.report);
  }, 30_000);
});
