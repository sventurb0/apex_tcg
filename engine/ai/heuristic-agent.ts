import type { GameAction } from "../model/actions";
import type { PlayerObservation } from "../model/observation";
import { nextRandom } from "../random/seeded-rng";
import type { GameAgent } from "./agent";
import { scoreSkeledirgeAction } from "./strategies/skeledirge";
import { scoreOkidogiAction } from "./strategies/okidogi";
import { scoreTeamRocketNidokingAction } from "./strategies/team-rocket-nidoking";

function genericScore(action: GameAction, observation: PlayerObservation): number {
  const architectAnchorId = observation.self.deckId.match(/architect-anchor-([a-z0-9]+(?:pt\d+)?-\d+)-/)?.[1];
  const targetsArchitectAnchor = architectAnchorId && (("cardInstanceId" in action && action.cardInstanceId?.endsWith(`-${architectAnchorId}`)) || ("selectionId" in action && action.selectionId.endsWith(`-${architectAnchorId}`)));
  if (targetsArchitectAnchor && action.type === "select-card") return 18_200;
  if (targetsArchitectAnchor && action.type === "evolve") return 2_600;
  if (architectAnchorId && action.type === "play-trainer" && /Rare Candy|Ultra Ball|Nest Ball|Evolution|Buddy-Buddy|Pokégear|Research|Iono/i.test(action.description)) return 900;
  switch (action.type) {
    case "choose-prize": return 20_000;
    case "select-active": return 19_000;
    case "draw-mulligan": return 18_500;
    case "finish-setup": return 18_000;
    case "select-effect-mode": return action.mode === "both" ? 17_500 : 17_000;
    case "select-card": case "select-pokemon": return 16_000;
    case "confirm-choice": return 15_500;
    case "increase-allocation": return 16_500;
    case "decrease-allocation": return -2_000;
    case "set-allocation": return 16_250;
    case "clear-allocation": return -1_000;
    case "confirm-allocation": return 17_500;
    case "decline-optional-effect": return 15_000;
    case "deselect-card": return -10_000;
    case "attack": return 1_000;
    case "evolve": return 700;
    case "attach-energy": return 600;
    case "bench-basic": return action.description.includes("setup Bench") ? observation.self.bench.length < 3 ? 19_500 : 17_500 : observation.self.bench.length < 2 ? 500 : 120;
    case "use-ability": return 450;
    case "use-stadium": return action.description.includes("Academy at Night") ? observation.legalActions.some((candidate) => candidate.type === "attack" && /Seek Inspiration/i.test(candidate.description)) ? 550 : -500 : 500;
    case "play-trainer": return 250;
    case "retreat": return -100;
    case "end-turn": return 0;
    default: { const exhaustive: never = action; return exhaustive; }
  }
}

function scoreAction(action: GameAction, observation: PlayerObservation): number { const generic = genericScore(action, observation); if (observation.self.deckId === "skeledirge-armarouge" || observation.self.deckId.includes("architect-fire-stage2")) return Math.max(generic, scoreSkeledirgeAction(action, observation)); if (observation.self.deckId === "okidogi-ex-poison" || observation.self.deckId.includes("architect-darkness-poison")) return Math.max(generic, scoreOkidogiAction(action, observation)); if (observation.self.deckId === "team-rockets-nidoking" || observation.self.deckId.includes("architect-team-rocket")) return Math.max(generic, scoreTeamRocketNidokingAction(action, observation)); return generic; }

export const heuristicAgent: GameAgent = { id: "heuristic", selectAction(observation, rngState) { if (!observation.legalActions.length) throw new Error("Heuristic agent received no legal actions."); const random = nextRandom(rngState); const scored = observation.legalActions.map((action) => ({ action, score: scoreAction(action, observation) })); const best = Math.max(...scored.map((candidate) => candidate.score)); const choices = scored.filter((candidate) => candidate.score === best); return { action: choices[Math.floor(random.value * choices.length)]!.action, rngState: random.state }; } };
