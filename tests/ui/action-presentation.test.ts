import { describe, expect, it } from "vitest";
import { getLegalActions } from "../../engine";
import type { GameAction } from "../../engine/model/actions";
import { groupLegalActions } from "../../src/components/board/action-presentation";
import { forceMain, freshSkeledirgeGame, inPlay, instance } from "../fixtures/skeledirgeRuntime";

function attachmentState() {
  const state = forceMain(freshSkeledirgeGame(310));
  const player = state.players["player-one"];
  player.active = inPlay("swsh12-16", "active-tsareena");
  player.bench = [inPlay("sv4-26", "bench-charcadet"), inPlay("sv2-35", "bench-fuecoco")];
  player.hand = [instance("sve-2", "fire-1"), instance("sve-2", "fire-2"), instance("sve-2", "fire-3")];
  player.energyAttachedThisTurn = false;
  return state;
}

describe("battle action presentation", () => {
  it("keeps nine atomic attach actions but presents exactly one action per target", () => {
    const state = attachmentState();
    const atomic = getLegalActions(state, "player-one").filter((action) => action.type === "attach-energy");
    expect(atomic).toHaveLength(9);
    const presented = groupLegalActions(state, atomic);
    expect(presented).toHaveLength(3);
    expect(presented.map((action) => action.label)).toEqual([
      "Attach Basic Fire Energy to Radiant Tsareena ×3",
      "Attach Basic Fire Energy to Charcadet ×3",
      "Attach Basic Fire Energy to Fuecoco ×3",
    ]);
    expect(presented.every((action) => action.count === 3)).toBe(true);
  });

  it("uses the first identical instance in current hand order as the representative", () => {
    const state = attachmentState();
    const atomic = getLegalActions(state, "player-one").filter((action) => action.type === "attach-energy");
    const reversed = [...atomic].reverse();
    const target = groupLegalActions(state, reversed).find((action) => action.label.includes("Radiant Tsareena"));
    expect(target?.representative).toMatchObject({ type: "attach-energy", cardInstanceId: "fire-1-sve-2" });
  });

  it("does not group different Energy IDs or different targets", () => {
    const state = attachmentState();
    state.players["player-one"].hand.push(instance("sve-3", "water-1"));
    const fireEnergy = state.cardDefinitions["sve-2"]!;
    if (fireEnergy.category !== "energy") throw new Error("Expected the fixture Fire Energy definition.");
    state.cardDefinitions["sve-3"] = { ...fireEnergy, id: "sve-3", name: "Basic Water Energy", energyType: "water" };
    const actions: GameAction[] = [
      { id: "fire-a", type: "attach-energy", playerId: "player-one", cardInstanceId: "fire-1-sve-2", targetId: "active-tsareena-swsh12-16", description: "Attach Basic Fire Energy to Radiant Tsareena" },
      { id: "water-a", type: "attach-energy", playerId: "player-one", cardInstanceId: "water-1-sve-3", targetId: "active-tsareena-swsh12-16", description: "Attach Basic Water Energy to Radiant Tsareena" },
      { id: "fire-b", type: "attach-energy", playerId: "player-one", cardInstanceId: "fire-2-sve-2", targetId: "bench-charcadet-sv4-26", description: "Attach Basic Fire Energy to Charcadet" },
    ];
    expect(groupLegalActions(state, actions)).toHaveLength(3);
  });

  it("never merges Fire Off actions from different donor Pokémon", () => {
    const state = attachmentState();
    const actions: GameAction[] = [
      { id: "fire-off-a", type: "use-ability", playerId: "player-one", sourcePokemonId: "armarouge", abilityId: "fire-off", targetId: "donor-a", cardInstanceId: "energy-a", description: "Use Fire Off" },
      { id: "fire-off-b", type: "use-ability", playerId: "player-one", sourcePokemonId: "armarouge", abilityId: "fire-off", targetId: "donor-b", cardInstanceId: "energy-b", description: "Use Fire Off" },
    ];
    expect(groupLegalActions(state, actions)).toHaveLength(2);
  });

  it("groups two exact Iono copies into one presented Trainer action", () => {
    const state = attachmentState();
    state.players["player-one"].hand = [instance("sv4pt5-80", "iono-1"), instance("sv4pt5-80", "iono-2")];
    const atomic = getLegalActions(state, "player-one").filter((action) => action.type === "play-trainer");
    const presented = groupLegalActions(state, atomic);
    expect(atomic).toHaveLength(2);
    expect(presented).toHaveLength(1);
    expect(presented[0]?.label).toBe("Play Iono ×2");
  });
});
