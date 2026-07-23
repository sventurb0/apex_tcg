import type { GameRunSummary } from "./game-runner";

export interface SimulationReport {
  gamesPlayed: number;
  wins: number;
  losses: number;
  drawsOrUnresolved: number;
  winPercentage: number;
  winRateByOpponent: Record<string, number>;
  winRateGoingFirst: number;
  winRateGoingSecond: number;
  averageTurnCount: number;
  medianTurnCount: number;
  averagePrizesTaken: number;
  averagePrizesRemaining: number;
  mulliganRate: number;
  openingSetupFailureRate: number;
  deckOutLosses: number;
  noPokemonLosses: number;
  prizeRaceLosses: number;
  averageTurnOfFirstAttack: number | null;
  averageTurnOfFirstKnockOut: number | null;
  energyStarvationTurnPercentage: number;
  primaryAttackerReadyPercentage: number | null;
  mostUsedCards: string[];
  leastUsedCards: string[];
  cardsStrandedInHand: string[];
  commonFinalBoardStates: string[];
  errorOrUnresolvedCount: number;
  unresolvedSeeds: number[];
  semanticEventCounts: Record<string, number>;
  deckSpecificMetrics: Record<string, number | null>;
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function calculateMetrics(games: readonly GameRunSummary[], opponentId: string): SimulationReport {
  const wins = games.filter((game) => game.result.winnerId === "player-one").length;
  const losses = games.filter((game) => game.result.loserId === "player-one").length;
  const unresolved = games.filter((game) => game.result.unresolved);
  const firstAttacks = games.flatMap((game) => game.firstAttackTurn ?? []);
  const firstKnockOuts = games.flatMap((game) => game.firstKnockOutTurn ?? []);
  const goingFirst = games.filter((game) => game.startingPlayer === "player-one"); const goingSecond = games.filter((game) => game.startingPlayer === "player-two");
  const totalTurns = games.reduce((sum, game) => sum + game.totalMainTurns, 0);
  const stateCounts = new Map<string, number>();
  for (const game of games) stateCounts.set(game.finalStateSummary, (stateCounts.get(game.finalStateSummary) ?? 0) + 1);
  const semanticEventCounts: Record<string, number> = {};
  for (const game of games) for (const [key, count] of Object.entries(game.eventCounts)) semanticEventCounts[key] = (semanticEventCounts[key] ?? 0) + count;
  const metricSum = (key: keyof GameRunSummary["teamRocketMetrics"]) => games.reduce((sum, game) => sum + (game.teamRocketMetrics[key] ?? 0), 0);
  const firstNidokingTurns = games.flatMap((game) => game.teamRocketMetrics.firstNidokingTurn ?? []);
  return {
    gamesPlayed: games.length,
    wins,
    losses,
    drawsOrUnresolved: games.length - wins - losses,
    winPercentage: games.length ? (wins / games.length) * 100 : 0,
    winRateByOpponent: { [opponentId]: games.length ? (wins / games.length) * 100 : 0 },
    winRateGoingFirst: goingFirst.length ? (goingFirst.filter((game) => game.result.winnerId === "player-one").length / goingFirst.length) * 100 : 0,
    winRateGoingSecond: goingSecond.length ? (goingSecond.filter((game) => game.result.winnerId === "player-one").length / goingSecond.length) * 100 : 0,
    averageTurnCount: average(games.map((game) => game.result.turns)),
    medianTurnCount: median(games.map((game) => game.result.turns)),
    averagePrizesTaken: average(games.map((game) => 6 - game.finalPrizeCounts["player-one"])),
    averagePrizesRemaining: average(games.map((game) => game.finalPrizeCounts["player-one"])),
    mulliganRate: average(games.map((game) => game.mulligans["player-one"])),
    openingSetupFailureRate: 0,
    deckOutLosses: games.filter((game) => game.result.loserId === "player-one" && game.result.reason === "deck-out").length,
    noPokemonLosses: games.filter((game) => game.result.loserId === "player-one" && game.result.reason === "no-pokemon").length,
    prizeRaceLosses: games.filter((game) => game.result.loserId === "player-one" && game.result.reason === "prizes").length,
    averageTurnOfFirstAttack: firstAttacks.length ? average(firstAttacks) : null,
    averageTurnOfFirstKnockOut: firstKnockOuts.length ? average(firstKnockOuts) : null,
    energyStarvationTurnPercentage: totalTurns ? (games.reduce((sum, game) => sum + game.energyMissTurns, 0) / totalTurns) * 100 : 0,
    primaryAttackerReadyPercentage: null,
    mostUsedCards: [],
    leastUsedCards: [],
    cardsStrandedInHand: [],
    commonFinalBoardStates: [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([state]) => state),
    errorOrUnresolvedCount: unresolved.length,
    unresolvedSeeds: unresolved.map((game) => game.seed),
    semanticEventCounts,
    deckSpecificMetrics: { averageTurnOfFirstNidoking: firstNidokingTurns.length ? average(firstNidokingTurns) : null, rareCandyUses: metricSum("rareCandyUses"), protonFirstTurnUses: metricSum("protonFirstTurnUses"), taintedHornUses: metricSum("taintedHornUses"), kinglyImpactUses: metricSum("kinglyImpactUses"), averageTaintedPoisonCounters: metricSum("taintedPoisonCheckups") ? metricSum("taintedPoisonCounters") / metricSum("taintedPoisonCheckups") : null, factoryActivations: metricSum("factoryActivations"), teamRocketEnergyAttachments: metricSum("teamRocketEnergyAttachments"), arianaDrawToEight: metricSum("arianaDrawToEight"), archerActivations: metricSum("archerActivations") },
  };
}
