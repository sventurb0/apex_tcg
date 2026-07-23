import { describe, expect, it } from "vitest";
import { compileCardImplementation } from "../../src/data/pokemon/implementations/effect-compiler";
import { toRuntimeCardDefinition } from "../../src/data/pokemon/runtime-adapter";
import { testCatalogue } from "../fixtures/catalogue";
import type { PokemonCard, TrainerCard } from "../../engine/model/cards";

const ids = ["sv10-20", "sv10-81", "sv10-51", "sv10-87", "sv9-56", "sv5-154", "me4-80", "sv6-129", "sv6-130", "me2pt5-16", "me3-62", "sv7-133", "me3-71", "sv6-165", "me4-82", "sv10-180"];

describe("Prompt 6 Rocket Mewtwo and Dragapult runtime coverage", () => {
  it("resolves every listed printing as executable", () => {
    for (const id of ids) {
      const metadata = testCatalogue.cards.find((card) => card.id === id);
      expect(metadata, id).toBeDefined();
      expect(compileCardImplementation(metadata!), id).toMatchObject({ status: "complete" });
      expect(toRuntimeCardDefinition(metadata!), id).not.toBeNull();
    }
  });

  it("exposes the defining executable programs", () => {
    const card = (id: string) => toRuntimeCardDefinition(testCatalogue.cards.find((candidate) => candidate.id === id)!)!;
    const pokemon = (id: string) => card(id) as PokemonCard;
    expect(pokemon("sv10-20").abilities[0]?.effectProgramId).toBe("ability:charging-up");
    expect(pokemon("sv10-81").attacks.find((attack) => attack.name === "Erasure Ball")?.damage).toMatchObject({ resolverId: "erasure-ball-damage" });
    expect(pokemon("sv9-56").attacks.find((attack) => attack.name === "Full Moon Rondo")?.damage).toMatchObject({ resolverId: "full-moon-rondo-damage" });
    expect(pokemon("sv6-130").attacks.find((attack) => attack.name === "Phantom Dive")?.effectProgramId).toBe("attack:phantom-dive");
    expect(pokemon("sv6-129").abilities[0]?.effectProgramId).toBe("ability:recon-directive");
    expect((card("sv5-154") as TrainerCard).effectProgramId).toBe("tool:maximum-belt");
  });
});
