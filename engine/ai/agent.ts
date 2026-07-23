import type { GameAction } from "../model/actions";
import type { PlayerObservation } from "../model/observation";

export interface AgentDecision {
  action: GameAction;
  rngState: number;
}

export interface GameAgent {
  readonly id: "random" | "heuristic";
  selectAction(observation: PlayerObservation, rngState: number): AgentDecision;
}

export interface StrategyPriority {
  cardId: string;
  weight: number;
}

export interface DeckStrategyProfile {
  deckId: string;
  preferredAttackers: string[];
  setupPriorities: StrategyPriority[];
  protectedResources: string[];
  preferredBenchTargets: string[];
  evaluateState?: (observation: PlayerObservation) => number;
}
