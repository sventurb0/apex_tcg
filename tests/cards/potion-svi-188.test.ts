import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { toRuntimeCardDefinition } from "../../src/data/pokemon";
import { setupGame, freshGame } from "../helpers";
import { realCardFixtures } from "../fixtures/realCards";

describe("Potion SVI 188", () => {
  it("uses exact metadata and heals exactly 30 from a selected Pokémon", () => {
    const metadata = realCardFixtures.find((card) => card.id === "sv1-188")!;
    expect(metadata).toMatchObject({ name: "Potion", setCode: "SVI", collectorNumber: "188" });
    const definition = toRuntimeCardDefinition(metadata)!;
    let state = setupGame(freshGame());
    state.cardDefinitions[definition.id] = definition;
    state.players["player-one"].hand.push({ instanceId: "player-one-real-potion", cardId: definition.id });
    state.players["player-one"].active!.damage = 40;
    const potion = getLegalActions(state, "player-one").find((action) => action.type === "play-trainer" && action.cardInstanceId === "player-one-real-potion")!;
    state = applyAction(state, potion);
    expect(state.players["player-one"].active!.damage).toBe(10);
  });

  it("cannot be played without a damaged target", () => {
    const definition = toRuntimeCardDefinition(realCardFixtures.find((card) => card.id === "sv1-188")!)!;
    const state = setupGame(freshGame());
    state.cardDefinitions[definition.id] = definition;
    state.players["player-one"].hand.push({ instanceId: "player-one-real-potion", cardId: definition.id });
    expect(getLegalActions(state, "player-one").some((action) => action.type === "play-trainer" && action.cardInstanceId === "player-one-real-potion")).toBe(false);
  });
});
