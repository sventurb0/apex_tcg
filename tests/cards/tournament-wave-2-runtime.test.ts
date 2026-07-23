import { describe, expect, it } from "vitest";
import { compileCardImplementation } from "../../src/data/pokemon/implementations/effect-compiler";
import { toRuntimeCardDefinition } from "../../src/data/pokemon/runtime-adapter";
import { testCatalogue } from "../fixtures/catalogue";

const ids = ["me3-62", "sv9-98", "me2pt5-155", "me1-88", "sv6-25", "me2pt5-8", "me1-9", "me1-10", "sv6-17", "sv6-18", "sv7-14", "me1-12", "sv6-155", "sv7-132", "me2-87", "sv6-143", "me1-117"];
const ogerponBoxIds = ["me1-104", "sv8-76", "sv8-56", "sv8-111", "sv5-123", "sv6-64", "sv7-135"];

describe("Prompt 6 Zoroark / Hydrapple runtime coverage", () => {
  it("resolves every listed printing as an executable implementation", () => {
    for (const id of ids) {
      const metadata = testCatalogue.cards.find((card) => card.id === id);
      expect(metadata, id).toBeDefined();
      expect(compileCardImplementation(metadata!).status, id).toBe("complete");
      expect(toRuntimeCardDefinition(metadata!), id).not.toBeNull();
    }
  });

  it("exposes the defining ability and attack programs", () => {
    const zoroark = toRuntimeCardDefinition(testCatalogue.cards.find((card) => card.id === "sv9-98")!)!;
    const hydrapple = toRuntimeCardDefinition(testCatalogue.cards.find((card) => card.id === "sv7-14")!)!;
    expect(zoroark.category).toBe("pokemon");
    if (zoroark.category !== "pokemon" || hydrapple.category !== "pokemon") throw new Error("Expected Pokémon runtime definitions");
    if (zoroark.category !== "pokemon" || hydrapple.category !== "pokemon") throw new Error("expected Pokémon definitions");
    expect(zoroark.abilities.some((ability) => ability.effectProgramId === "ability:ns-trade")).toBe(true);
    expect(hydrapple.abilities.some((ability) => ability.effectProgramId === "ability:ripening-charge")).toBe(true);
    expect(hydrapple.attacks.find((attack) => attack.name === "Syrup Storm")?.damage).toMatchObject({ kind: "formula", resolverId: "syrup-storm-damage" });
  });
});

describe("Prompt 6 Ogerpon Box runtime coverage", () => {
  it("resolves every mandatory Ogerpon Box printing", () => {
    for (const id of ogerponBoxIds) {
      const metadata = testCatalogue.cards.find((card) => card.id === id);
      expect(metadata, id).toBeDefined();
      expect(compileCardImplementation(metadata!).status, id).toBe("complete");
      expect(toRuntimeCardDefinition(metadata!), id).not.toBeNull();
    }
  });

  it("exposes exact shared mechanics", () => {
    const kangaskhan = toRuntimeCardDefinition(testCatalogue.cards.find((card) => card.id === "me1-104")!)!;
    const passimian = toRuntimeCardDefinition(testCatalogue.cards.find((card) => card.id === "sv8-111")!)!;
    const trumpet = toRuntimeCardDefinition(testCatalogue.cards.find((card) => card.id === "sv7-135")!)!;
    if (kangaskhan.category !== "pokemon" || passimian.category !== "pokemon" || trumpet.category !== "trainer") throw new Error("Expected Ogerpon Box runtime categories");
    expect(kangaskhan.isMega).toBe(true);
    expect(kangaskhan.prizeValue).toBe(3);
    expect(passimian.attacks[0]?.damage).toMatchObject({ kind: "formula", resolverId: "passimian-basic-damage" });
    expect(trumpet.effectProgramId).toBe("trainer:glass-trumpet");
  });
});
