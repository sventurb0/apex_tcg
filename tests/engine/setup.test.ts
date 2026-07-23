import { describe, expect, it } from "vitest";
import type { DeckDefinition } from "../../engine/model/decks";
import { createGame } from "../../engine/rules/setup";
import { fixtureCardList } from "../fixtures/cards";
import { getFixtureDeck } from "../fixtures/decks";

describe("game setup", () => {
  it("deals opening hands, places Prizes, and preserves 60 cards", () => {
    const state = createGame({ seed: 101, playerOneDeck: getFixtureDeck("demo-cinder"), playerTwoDeck: getFixtureDeck("demo-brook"), cards: fixtureCardList });
    for (const player of Object.values(state.players)) {
      expect(player.hand).toHaveLength(7);
      expect(player.prizes).toHaveLength(6);
      expect(player.deck.length + player.hand.length + player.prizes.length).toBe(60);
      expect(player.hand.some((instance) => {
        const card = state.cardDefinitions[instance.cardId];
        return card?.category === "pokemon" && card.stage === "basic";
      })).toBe(true);
    }
  });

  it("records mulligans until a Basic is found", () => {
    const sparse: DeckDefinition = {
      id: "sparse", name: "Sparse", description: "test", available: true,
      entries: [{ cardId: "demo-001", count: 1 }, { cardId: "demo-e-fire", count: 59 }],
    };
    let mulligans = 0;
    for (let seed = 1; seed < 100 && mulligans === 0; seed += 1) {
      mulligans = createGame({ seed, playerOneDeck: sparse, playerTwoDeck: getFixtureDeck("demo-brook"), cards: fixtureCardList }).players["player-one"].mulligans;
    }
    expect(mulligans).toBeGreaterThan(0);
  });

  it("repeats setup exactly for the same seed", () => {
    const config = { seed: 555, playerOneDeck: getFixtureDeck("demo-cinder"), playerTwoDeck: getFixtureDeck("demo-brook"), cards: fixtureCardList };
    const a = createGame(config);
    const b = createGame(config);
    expect(a.players["player-one"].deck).toEqual(b.players["player-one"].deck);
    expect(a.players["player-two"].hand).toEqual(b.players["player-two"].hand);
  });
});
