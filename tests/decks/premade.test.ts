import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { premadeDecks } from "../../src/data/decks/premade";
import type { PokemonCardCatalogue } from "../../src/data/pokemon";

const catalogue = JSON.parse(readFileSync(new URL("../../public/data/pokemon-cards.json", import.meta.url), "utf8")) as PokemonCardCatalogue;
const byId = new Map(catalogue.cards.map((card) => [card.id, card]));

describe("supplied premade decks", () => {
  it.each(premadeDecks)("resolves every $name entry and contains 60 cards", (deck) => {
    expect(deck.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(60);
    expect(deck.entries.filter((entry) => !byId.has(entry.cardId))).toEqual([]);
  });

  it("retains Team Rocket's Energy restrictions from its exact source record", () => {
    const energy = byId.get("sv10-182")!;
    expect(energy.name).toBe("Team Rocket's Energy");
    expect(energy.energyText).toMatch(/Team Rocket's Pokémon/i);
    expect(energy.energyText).toMatch(/can only be attached/i);
    expect(energy.energyText).toMatch(/discard this card/i);
    expect(energy.energyText).toMatch(/provides 2 in any combination of Psychic Energy and Darkness Energy/i);
  });
});
