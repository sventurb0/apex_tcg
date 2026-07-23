import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckDefinition } from "../engine/model/decks";
import { runBatch } from "../engine/simulation/batch-runner";
import { runHeadlessGame } from "../engine/simulation/game-runner";
import type { DeckManifest } from "../src/data/decks/types";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const index = createCatalogueIndex(catalogue.cards);
const load = (name: string) => JSON.parse(readFileSync(`src/data/decks/premade/${name}.json`, "utf8")) as DeckManifest;
const teamRocket = load("team-rockets-nidoking");
const skeledirge = load("skeledirge-armarouge");
const okidogi = load("okidogi-ex-poison");
const deck = (manifest: DeckManifest): DeckDefinition => ({ id: manifest.id, name: manifest.name, description: manifest.description, entries: manifest.entries, available: true });
const ids = [...new Set([...teamRocket.entries, ...skeledirge.entries, ...okidogi.entries].map((entry) => entry.cardId))];
const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
const unsupported = teamRocket.entries.filter((entry) => compileCardImplementation(index.byId.get(entry.cardId)!).status !== "complete");
const missingRuntime = teamRocket.entries.filter((entry) => !toRuntimeCardDefinition(index.byId.get(entry.cardId)!));
if (unsupported.length || missingRuntime.length) throw new Error(`Support gate failed: unsupported=${unsupported.length}, missingRuntime=${missingRuntime.length}`);

const vsSkeledirge = runBatch({ games: 100, baseSeed: 210_000, subjectDeck: deck(teamRocket), opponentDeck: deck(skeledirge), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
const vsOkidogi = runBatch({ games: 100, baseSeed: 220_000, subjectDeck: deck(teamRocket), opponentDeck: deck(okidogi), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
const mirror = runBatch({ games: 100, baseSeed: 230_000, subjectDeck: deck(teamRocket), opponentDeck: deck(teamRocket), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
const allGames = [...vsSkeledirge.games, ...vsOkidogi.games, ...mirror.games];
const unresolved = allGames.filter((game) => game.result.unresolved);
const invalidNumeric = allGames.reduce((sum, game) => sum + game.invalidNumericCount, 0);
if (unresolved.length) throw new Error(`Unresolved games: ${unresolved.map((game) => `${game.seed}:${game.result.reason}`).join(", ")}`);
if (invalidNumeric) throw new Error(`Invalid numeric values: ${invalidNumeric}`);

const metric = (key: keyof (typeof allGames)[number]["teamRocketMetrics"]) => allGames.reduce((sum, game) => sum + (game.teamRocketMetrics[key] ?? 0), 0);
const exercised = {
  rareCandy: metric("rareCandyUses"),
  teamRocketEnergy: metric("teamRocketEnergyAttachments"),
  taintedHorn: metric("taintedHornUses"),
  kinglyImpact: metric("kinglyImpactUses"),
  factory: metric("factoryActivations"),
  protonFirstTurn: metric("protonFirstTurnUses"),
  teamRocketSearches: allGames.reduce((sum, game) => sum + ["sv10-176", "sv10-177", "sv10-178"].reduce((inner, id) => inner + Number(game.eventSourceCardIds.includes(id)), 0), 0),
};
const deadPaths = Object.entries(exercised).filter(([, count]) => count === 0);
if (deadPaths.length) throw new Error(`Unexercised Team Rocket paths: ${deadPaths.map(([name]) => name).join(", ")}`);

const replayConfig = { seed: 240_000, playerOneDeck: deck(teamRocket), playerTwoDeck: deck(okidogi), cards, startingPlayer: "player-two" as const, playerOneAgent: "heuristic" as const, playerTwoAgent: "heuristic" as const };
const replayA = runHeadlessGame(replayConfig);
const replayB = runHeadlessGame(replayConfig);
const replayMatches = JSON.stringify({ result: replayA.result, actions: replayA.actionSequence, events: replayA.eventCounts }) === JSON.stringify({ result: replayB.result, actions: replayB.actionSequence, events: replayB.eventCounts });
if (!replayMatches) throw new Error("Deterministic replay mismatch.");

const compact = (batch: typeof vsSkeledirge) => ({ games: batch.report.gamesPlayed, wins: batch.report.wins, losses: batch.report.losses, winPercentage: batch.report.winPercentage, averageTurns: batch.report.averageTurnCount, unresolved: batch.report.errorOrUnresolvedCount, metrics: batch.report.deckSpecificMetrics });
console.log(JSON.stringify({
  support: { exactPrintings: teamRocket.entries.length, runtimeCopies: teamRocket.entries.reduce((sum, entry) => sum + entry.count, 0), missingRuntime: missingRuntime.length },
  matchups: { vsSkeledirge: compact(vsSkeledirge), vsOkidogi: compact(vsOkidogi), mirror: compact(mirror) },
  exercised,
  poison: { checkups: metric("taintedPoisonCheckups"), averageCounters: metric("taintedPoisonCheckups") ? metric("taintedPoisonCounters") / metric("taintedPoisonCheckups") : null },
  safety: { games: allGames.length, unresolved: unresolved.length, invalidNumeric, noLegalAction: allGames.filter((game) => game.result.reason === "no-legal-action").length },
  replay: { seed: replayA.seed, winner: replayA.result.winnerId, actions: replayA.actionCount, fullSequenceAndEventsMatch: replayMatches },
}, null, 2));
