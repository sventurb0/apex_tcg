/// <reference lib="webworker" />
import { calculateMetrics } from "../../engine/simulation/metrics";
import { runHeadlessGame, type AgentType, type GameRunSummary } from "../../engine/simulation/game-runner";
import { deriveSeed } from "../../engine/random/seeded-rng";
import type { PlayerId } from "../../engine/model/actions";
import type { CardDefinition } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";

interface StartMessage {
  type: "start";
  requestId: string;
  games: number;
  baseSeed: number;
  subjectDeck: DeckDefinition;
  opponentDeck: DeckDefinition;
  cards: CardDefinition[];
  agentType: AgentType;
  firstPlayerPolicy: "alternate" | "subject" | "opponent" | "random";
}

let cancelled = false;
const scope = self as unknown as DedicatedWorkerGlobalScope;

function startingPlayer(message: StartMessage, index: number, seed: number): PlayerId {
  if (message.firstPlayerPolicy === "subject") return "player-one";
  if (message.firstPlayerPolicy === "opponent") return "player-two";
  if (message.firstPlayerPolicy === "alternate") return index % 2 === 0 ? "player-one" : "player-two";
  return seed % 2 === 0 ? "player-one" : "player-two";
}

async function simulate(message: StartMessage): Promise<void> {
  cancelled = false;
  if (!message.subjectDeck.available || !message.opponentDeck.available) throw new Error("Simulation refused: both exact decks must pass the accuracy gate.");
  const subject = message.subjectDeck;
  const opponent = message.opponentDeck;
  const games: GameRunSummary[] = [];
  for (let index = 0; index < message.games && !cancelled; index += 1) {
    const seed = deriveSeed(message.baseSeed, index);
    games.push(runHeadlessGame({
      seed,
      playerOneDeck: subject,
      playerTwoDeck: opponent,
      cards: message.cards,
      startingPlayer: startingPlayer(message, index, seed),
      playerOneAgent: message.agentType,
      playerTwoAgent: message.agentType,
    }));
    if (index % 5 === 4 || index === message.games - 1) {
      scope.postMessage({ type: "progress", requestId: message.requestId, completed: index + 1, total: message.games });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (cancelled) {
    scope.postMessage({ type: "cancelled", requestId: message.requestId, completed: games.length });
  } else {
    scope.postMessage({ type: "complete", requestId: message.requestId, report: calculateMetrics(games, opponent.id) });
  }
}

scope.onmessage = (event: MessageEvent<StartMessage | { type: "cancel" }>) => {
  if (event.data.type === "cancel") {
    cancelled = true;
    return;
  }
  void simulate(event.data);
};

export {};
