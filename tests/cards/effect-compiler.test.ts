import { describe, expect, it } from "vitest";
import { compileCardImplementation, toRuntimeCardDefinition } from "../../src/data/pokemon";
import type { PokemonCardMetadata } from "../../src/data/pokemon";
import { realCardFixtures } from "../fixtures/realCards";
import { testCatalogueIndex } from "../fixtures/catalogue";

describe("reusable card-effect compiler", () => {
  it("recognizes exact reusable healing and switching templates", () => {
    expect(compileCardImplementation(realCardFixtures.find((card) => card.id === "sv1-188")!).status).toBe("complete");
    expect(compileCardImplementation(realCardFixtures.find((card) => card.id === "sv1-194")!).status).toBe("complete");
  });

  it("generates Basic Energy and printed-damage Pokémon without per-card handlers", () => {
    const energy: PokemonCardMetadata = { id: "test-energy", name: "Basic Fire Energy", setId: "test", setName: "Test", setCode: "TST", collectorNumber: "2", supertype: "Energy", subtypes: ["Basic"], types: ["Fire"], retreat: 0, legalities: { standard: "Legal" } };
    const pokemon: PokemonCardMetadata = { id: "test-1", name: "Test Pokémon", setId: "test", setName: "Test", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 60, types: ["Fire"], retreat: 1, attacks: [{ name: "Tackle", cost: ["Fire"], energy: 1, damage: "20", text: "" }], legalities: {} };
    expect(compileCardImplementation(energy).status).toBe("generated");
    expect(compileCardImplementation(pokemon).status).toBe("generated");
  });

  it("uses the inferred type for the canonical Basic Fire Energy runtime definition", () => {
    const fire = testCatalogueIndex.byId.get("sve-2")!;
    expect(fire.types).toEqual(["Fire"]);
    expect(toRuntimeCardDefinition(fire)).toMatchObject({ category: "energy", energyType: "fire", basic: true });
  });
});
