import type { GameAgent } from "../ai/agent";
import { heuristicAgent } from "../ai/heuristic-agent";
import { randomAgent } from "../ai/random-agent";
import type { PlayerId } from "../model/actions";
import type { GameState } from "../model/game-state";
import type { GameResult, UnresolvedReason } from "../model/results";
import { deriveSeed } from "../random/seeded-rng";
import { createPlayerObservation } from "../rules/observation";
import { applyAction } from "../rules/reducer";
import { createGame, type GameConfig } from "../rules/setup";

export type AgentType = "random" | "heuristic";

export interface RunGameConfig extends GameConfig {
  playerOneAgent?: AgentType;
  playerTwoAgent?: AgentType;
  maxActions?: number;
  maxTurns?: number;
}

export interface GameRunSummary {
  result: GameResult;
  actionCount: number;
  firstAttackTurn: number | null;
  firstKnockOutTurn: number | null;
  finalPrizeCounts: Record<PlayerId, number>;
  mulligans: Record<PlayerId, number>;
  energyMissTurns: number;
  totalMainTurns: number;
  seed: number;
  startingPlayer: PlayerId;
  finalStateSummary: string;
  eventCounts: Record<string, number>;
  eventSourceCardIds: string[];
  actionSequence: string[];
  invalidNumericCount: number;
  teamRocketMetrics: { firstNidokingTurn: number | null; rareCandyUses: number; protonFirstTurnUses: number; taintedHornUses: number; kinglyImpactUses: number; taintedPoisonCounters: number; taintedPoisonCheckups: number; factoryActivations: number; teamRocketEnergyAttachments: number; arianaDrawToEight: number; archerActivations: number };
}

function getAgent(type: AgentType): GameAgent {
  return type === "random" ? randomAgent : heuristicAgent;
}

function unresolved(seed: number, turn: number, reason: UnresolvedReason): GameResult {
  return { winnerId: null, loserId: null, reason, turns: turn, seed, unresolved: true };
}

export function runHeadlessGame(config: RunGameConfig): GameRunSummary {
  let state = createGame({ ...config, detailedLogs: false });
  const agents: Record<PlayerId, GameAgent> = {
    "player-one": getAgent(config.playerOneAgent ?? "heuristic"),
    "player-two": getAgent(config.playerTwoAgent ?? "heuristic"),
  };
  let agentRng: Record<PlayerId, number> = {
    "player-one": deriveSeed(config.seed, 11),
    "player-two": deriveSeed(config.seed, 29),
  };
  const maxActions = config.maxActions ?? 1_500;
  const maxTurns = config.maxTurns ?? 300;
  let actionCount = 0;
  let firstAttackTurn: number | null = null;
  let firstKnockOutTurn: number | null = null;
  let energyMissTurns = 0;
  let totalMainTurns = 0;
  while (!state.result && actionCount < maxActions && state.turn <= maxTurns) {
    const actingId = state.pendingChoice?.playerId ?? state.activePlayerId;
    const observation = createPlayerObservation(state, actingId);
    if (observation.legalActions.length === 0) {
      state.result = unresolved(state.seed, state.turn, "no-legal-action");
      break;
    }
    const decision = agents[actingId].selectAction(observation, agentRng[actingId]);
    agentRng = { ...agentRng, [actingId]: decision.rngState };
    if (decision.action.type === "attack" && firstAttackTurn === null) firstAttackTurn = state.turn;
    if (decision.action.type === "end-turn") {
      totalMainTurns += 1;
      if (!state.players[actingId].energyAttachedThisTurn) energyMissTurns += 1;
    }
    const prizesBefore = state.players[actingId].prizes.length;
    state = applyAction(state, decision.action);
    if (state.players[actingId].prizes.length < prizesBefore && firstKnockOutTurn === null) firstKnockOutTurn = state.turn;
    actionCount += 1;
  }
  if (!state.result) state.result = unresolved(state.seed, state.turn, actionCount >= maxActions ? "action-limit" : "turn-limit");
  const eventCounts = state.events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    if (event.detail) { const semantic = `${event.type}:${event.detail}`; counts[semantic] = (counts[semantic] ?? 0) + 1; }
    if (event.cause) { const cause = `knockout-cause:${event.cause}`; counts[cause] = (counts[cause] ?? 0) + 1; }
    return counts;
  }, {});
  const invalidNumericCount = [...Object.values(state.players).flatMap((player) => [...(player.active ? [player.active] : []), ...player.bench]).map((pokemon) => pokemon.damage), ...state.events.flatMap((event) => event.amount ?? [])].filter((value) => !Number.isFinite(value)).length;
  const countEvent = (predicate: (event: GameState["events"][number]) => boolean) => state.events.filter(predicate).length;
  const firstNidoking = state.events.find((event) => event.type === "pokemon-evolved" && event.sourceCardId === "sv10-119");
  return {
    result: state.result,
    actionCount,
    firstAttackTurn,
    firstKnockOutTurn,
    finalPrizeCounts: { "player-one": state.players["player-one"].prizes.length, "player-two": state.players["player-two"].prizes.length },
    mulligans: { "player-one": state.players["player-one"].mulligans, "player-two": state.players["player-two"].mulligans },
    energyMissTurns,
    totalMainTurns,
    seed: state.seed,
    startingPlayer: state.startingPlayer,
    finalStateSummary: `turn=${state.turn}; prizes=${state.players["player-one"].prizes.length}-${state.players["player-two"].prizes.length}; actions=${actionCount}`,
    eventCounts,
    eventSourceCardIds: [...new Set(state.events.flatMap((event) => event.sourceCardId ?? []))],
    actionSequence: state.actionHistory.map((action) => action.id),
    invalidNumericCount,
    teamRocketMetrics: { firstNidokingTurn: firstNidoking?.turn ?? null, rareCandyUses: countEvent((event) => event.type === "pokemon-evolved" && event.detail === "Rare Candy"), protonFirstTurnUses: countEvent((event) => event.type === "card-played" && event.sourceCardId === "sv10-177" && event.detail?.includes("first-turn") === true), taintedHornUses: countEvent((event) => event.type === "attack-used" && event.detail === "Tainted Horn"), kinglyImpactUses: countEvent((event) => event.type === "attack-used" && event.detail === "Kingly Impact"), taintedPoisonCounters: state.events.filter((event) => event.type === "poison-checkup-damage" && event.sourceCardId === "sv10-119").reduce((sum, event) => sum + (event.amount ?? 0) / 10, 0), taintedPoisonCheckups: countEvent((event) => event.type === "poison-checkup-damage" && event.sourceCardId === "sv10-119"), factoryActivations: countEvent((event) => event.type === "stadium-ability-used" && event.sourceCardId === "sv10-173"), teamRocketEnergyAttachments: countEvent((event) => event.type === "energy-attached-manually" && event.sourceCardId === "sv10-182"), arianaDrawToEight: countEvent((event) => event.detail === "Ariana draw-to-8"), archerActivations: countEvent((event) => event.type === "card-played" && event.sourceCardId === "sv10-170") },
  };
}
