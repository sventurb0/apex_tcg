import type { CardDefinition } from "../model/cards";
import type { DeckDefinition } from "../model/decks";
import type { PlayerId } from "../model/actions";
import { deriveSeed } from "../random/seeded-rng";
import { calculateMetrics, type SimulationReport } from "./metrics";
import { runHeadlessGame, type AgentType, type GameRunSummary } from "./game-runner";

export interface BatchConfig {
  games: number;
  baseSeed: number;
  subjectDeck: DeckDefinition;
  opponentDeck: DeckDefinition;
  cards: readonly CardDefinition[];
  agentType: AgentType;
  firstPlayerPolicy: "alternate" | "subject" | "opponent" | "random";
}

export function startingPlayerFor(config: BatchConfig, index: number, seed: number): PlayerId {
  if (config.firstPlayerPolicy === "subject") return "player-one";
  if (config.firstPlayerPolicy === "opponent") return "player-two";
  if (config.firstPlayerPolicy === "alternate") return index % 2 === 0 ? "player-one" : "player-two";
  return seed % 2 === 0 ? "player-one" : "player-two";
}

export function runBatch(config: BatchConfig): { report: SimulationReport; games: GameRunSummary[] } {
  const games: GameRunSummary[] = [];
  for (let index = 0; index < config.games; index += 1) {
    const seed = deriveSeed(config.baseSeed, index);
    games.push(runHeadlessGame({
      seed,
      playerOneDeck: config.subjectDeck,
      playerTwoDeck: config.opponentDeck,
      cards: config.cards,
      startingPlayer: startingPlayerFor(config, index, seed),
      playerOneAgent: config.agentType,
      playerTwoAgent: config.agentType,
      detailedLogs: false,
    }));
  }
  return { report: calculateMetrics(games, config.opponentDeck.id), games };
}
