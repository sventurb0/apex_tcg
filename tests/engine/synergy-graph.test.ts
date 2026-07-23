import { describe, expect, it } from "vitest";
import { buildSynergyChains, capabilitySatisfiesRequirement, engineCompatibility } from "../../src/features/deck-architect/engines/capability-graph";
import { engineById } from "../../src/features/deck-architect/engines/definitions";
import type { EngineCapability, EngineRequirement } from "../../src/features/deck-architect/engines/types";

const filter = (field: "type" | "trait", ...values: string[]) => ({ field, values });

describe("reviewed engine capability graph", () => {
  it("requires semantic compatibility rather than shared type", () => {
    const provider: EngineCapability = { cardId: "grass-search", kind: "search", filters: [filter("type", "Grass")], amount: 2, explanation: "Grass search" };
    const waterRequirement: EngineRequirement = { cardId: "water-attacker", kind: "energy", filters: [filter("type", "Water")], minimum: 1, explanation: "Water energy" };
    expect(capabilitySatisfiesRequirement(provider, waterRequirement)).toBe(false);
  });

  it("does not treat an unknown amount as satisfying a minimum", () => {
    const provider: EngineCapability = { cardId: "one-energy", kind: "energy-from-hand", filters: [filter("type", "Psychic")], explanation: "One attachment" };
    const requirement: EngineRequirement = { cardId: "attacker", kind: "energy", filters: [filter("type", "Psychic")], minimum: 2, explanation: "Two energy" };
    expect(capabilitySatisfiesRequirement(provider, requirement)).toBe(false);
  });

  it("creates bounded semantic chains and rejects central stadium conflicts", () => {
    const grass = engineById("grass-fast-evolution");
    const toolbox = engineById("area-zero-toolbox");
    expect(grass && toolbox).toBeTruthy();
    const chains = buildSynergyChains([grass!, toolbox!], { maxCards: 5 });
    expect(chains.every((chain) => chain.cardIds.length >= 2 && chain.cardIds.length <= 5)).toBe(true);
    expect(engineCompatibility(grass!, toolbox!).compatible).toBe(false);
  });

  it("supports a reviewed Water toolbox engine", () => {
    const water = engineById("water-wellspring-toolbox");
    expect(water?.reviewed).toBe(true);
    expect(water?.energyTypes).toContain("Water");
    expect(water?.sourceDeckIds).toContain("limitless-28262");
  });
});
