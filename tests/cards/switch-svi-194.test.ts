import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { toRuntimeCardDefinition } from "../../src/data/pokemon";
import { setupGame, freshGame, moveCardToHand } from "../helpers";
import { realCardFixtures } from "../fixtures/realCards";

describe("Switch SVI 194", () => {
  it("switches to the chosen Benched Pokémon and removes Special Conditions from the Pokémon moved to the Bench", () => {
    const metadata = realCardFixtures.find((card) => card.id === "sv1-194")!;
    expect(metadata).toMatchObject({ name: "Switch", setCode: "SVI", collectorNumber: "194" });
    const definition = toRuntimeCardDefinition(metadata)!;
    let state = setupGame(freshGame());
    moveCardToHand(state, "player-one", "demo-003");
    const benchAction = getLegalActions(state, "player-one").find((action) => action.type === "bench-basic" && state.players["player-one"].hand.find((card) => card.instanceId === action.cardInstanceId)?.cardId === "demo-003")!;
    state = applyAction(state, benchAction);
    state.cardDefinitions[definition.id] = definition;
    state.players["player-one"].hand.push({ instanceId: "player-one-real-switch", cardId: definition.id });
    state.players["player-one"].active!.specialConditions = ["poisoned", "confused"];
    const previousActiveId = state.players["player-one"].active!.stack.at(-1)!.instanceId;
    const switchAction = getLegalActions(state, "player-one").find((action) => action.type === "play-trainer" && action.cardInstanceId === "player-one-real-switch")!;
    state = applyAction(state, switchAction);
    expect(state.players["player-one"].active!.stack.at(-1)!.cardId).toBe("demo-003");
    expect(state.players["player-one"].bench.find((pokemon) => pokemon.stack.at(-1)!.instanceId === previousActiveId)!.specialConditions).toEqual([]);
  });
});
