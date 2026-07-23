import { nextRandom } from "../random/seeded-rng";
import type { GameAgent } from "./agent";

export const randomAgent: GameAgent = {
  id: "random",
  selectAction(observation, rngState) {
    if (observation.legalActions.length === 0) throw new Error("Random agent received no legal actions.");
    const next = nextRandom(rngState);
    const index = Math.floor(next.value * observation.legalActions.length);
    return { action: observation.legalActions[index]!, rngState: next.state };
  },
};
