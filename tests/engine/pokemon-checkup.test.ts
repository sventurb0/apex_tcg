import { describe, expect, it } from "vitest";
import { applySpecialCondition, processPokemonCheckup } from "../../engine";
import { freshGame, setupGame } from "../helpers";

describe("Pokémon Checkup foundations", () => {
  it("allows Burned and Poisoned to coexist while the newest rotated condition replaces the previous one", () => {
    const state = setupGame(freshGame());
    const active = state.players["player-one"].active!;
    applySpecialCondition(active, "poisoned");
    applySpecialCondition(active, "burned");
    applySpecialCondition(active, "asleep");
    applySpecialCondition(active, "confused");
    expect(active.specialConditions).toEqual(["poisoned", "burned", "confused"]);
  });

  it("places Poisoned and Burned damage counters in official Checkup order and records deterministic flips", () => {
    const state = setupGame(freshGame({ seed: 44 }));
    const active = state.players["player-one"].active!;
    active.specialConditions = ["poisoned", "burned", "asleep"];
    const checkup = processPokemonCheckup(state, "player-two");
    expect(checkup.state.players["player-one"].active!.damage).toBe(30);
    expect(checkup.coinFlips.map((flip) => flip.condition)).toEqual(["burned", "asleep"]);
    expect(state.players["player-one"].active!.damage).toBe(0);
  });

  it("removes Paralysis only after its owner's turn", () => {
    const state = setupGame(freshGame());
    state.players["player-one"].active!.specialConditions = ["paralyzed"];
    const opponentCheckup = processPokemonCheckup(state, "player-two");
    expect(opponentCheckup.state.players["player-one"].active!.specialConditions).toContain("paralyzed");
    const ownerCheckup = processPokemonCheckup(state, "player-one");
    expect(ownerCheckup.state.players["player-one"].active!.specialConditions).not.toContain("paralyzed");
  });
});
