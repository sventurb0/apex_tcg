import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateCatalogue, type CompactCatalogue } from "../../scripts/card-data-utils";
import type { PokemonCardCatalogue } from "../../src/data/pokemon";

async function generatedCatalogue(): Promise<PokemonCardCatalogue> {
  return JSON.parse(await readFile("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
}

describe("generated presentation metadata", () => {
  it("preserves the acceptance-example printings without invented gameplay text", async () => {
    const catalogue = await generatedCatalogue();
    const byId = new Map(catalogue.cards.map((card) => [card.id, card]));
    expect(byId.get("sv2-35")).toMatchObject({ name: "Fuecoco", setCode: "PAL", collectorNumber: "35", artist: "ryoma uratsuka", rarity: "Common", regulationMark: "G" });
    expect(byId.get("sv2-35")?.attacks).toHaveLength(2);
    expect(byId.get("sv2-37")).toMatchObject({ name: "Skeledirge ex", setCode: "PAL", collectorNumber: "37", artist: "5ban Graphics", rarity: "Double Rare" });
    expect(byId.get("sv2-37")?.attacks?.map((attack) => attack.name)).toEqual(["Vitality Song", "Burning Voice"]);
    expect(byId.get("sv2-37")?.abilities).toBeUndefined();
    expect(byId.get("sv1-194")?.rules).toContain("Switch your Active Pokémon with 1 of your Benched Pokémon.");
    const rocketEnergy = catalogue.cards.find((card) => card.name === "Team Rocket's Energy" && card.setCode === "DRI");
    expect(rocketEnergy).toMatchObject({ supertype: "Energy", subtypes: ["Special"], rarity: "Uncommon" });
    expect(rocketEnergy?.energyText).toContain("provides 2 in any combination of Psychic Energy and Darkness Energy");
  });

  it("keeps artist optional while accepting it when supplied", () => {
    const catalogue: CompactCatalogue = { version: 1, generatedAt: "test", source: { repository: "test", commit: "test" }, sets: [], cards: [
      { id: "test-1", name: "With Artist", setId: "test", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 60, types: ["Fire"], artist: "Source Artist" },
      { id: "test-2", name: "Without Artist", setId: "test", setCode: "TST", collectorNumber: "2", supertype: "Trainer", subtypes: ["Item"] },
    ] };
    expect(validateCatalogue(catalogue)).toEqual([]);
    expect(catalogue.cards[0]?.artist).toBe("Source Artist");
    expect(catalogue.cards[1]?.artist).toBeUndefined();
  });
});
