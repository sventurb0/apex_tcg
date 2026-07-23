import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckDefinition } from "../engine/model/decks";
import { runBatch } from "../engine/simulation/batch-runner";
import { runHeadlessGame } from "../engine/simulation/game-runner";
import type { DeckManifest } from "../src/data/decks/types";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const index = createCatalogueIndex(catalogue.cards);
const manifest = (path: string) => JSON.parse(readFileSync(path, "utf8")) as DeckManifest;
const okidogi = manifest("src/data/decks/premade/okidogi-ex-poison.json");
const skeledirge = manifest("src/data/decks/premade/skeledirge-armarouge.json");
const deck = (value: DeckManifest): DeckDefinition => ({ id: value.id, name: value.name, description: value.description, entries: value.entries, available: true });
const ids = [...new Set([...okidogi.entries, ...skeledirge.entries].map((entry) => entry.cardId))];
const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
const okidogiUnsupported = okidogi.entries.filter((entry) => compileCardImplementation(index.byId.get(entry.cardId)!).status !== "complete");
const okidogiMissingRuntime = okidogi.entries.filter((entry) => !toRuntimeCardDefinition(index.byId.get(entry.cardId)!));
if (okidogiUnsupported.length || okidogiMissingRuntime.length) throw new Error(`Support gate failed: unsupported=${okidogiUnsupported.length}, missingRuntime=${okidogiMissingRuntime.length}`);

const vsSkeledirge = runBatch({ games: 100, baseSeed: 86_700, subjectDeck: deck(okidogi), opponentDeck: deck(skeledirge), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
const mirror = runBatch({ games: 100, baseSeed: 96_700, subjectDeck: deck(okidogi), opponentDeck: deck(okidogi), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
const allGames = [...vsSkeledirge.games, ...mirror.games];
const unresolved = allGames.filter((game) => game.result.unresolved);
const invalidNumeric = allGames.reduce((sum, game) => sum + game.invalidNumericCount, 0);
if (unresolved.length) throw new Error(`Unresolved games: ${unresolved.map((game) => `${game.seed}:${game.result.reason}`).join(", ")}`);
if (invalidNumeric) throw new Error(`Invalid numeric values: ${invalidNumeric}`);

const replayConfig = { seed: 123_456, playerOneDeck: deck(okidogi), playerTwoDeck: deck(skeledirge), cards, startingPlayer: "player-two" as const, playerOneAgent: "heuristic" as const, playerTwoAgent: "heuristic" as const };
const replayA = runHeadlessGame(replayConfig); const replayB = runHeadlessGame(replayConfig);
const replayMatches = JSON.stringify({ result: replayA.result, actions: replayA.actionSequence }) === JSON.stringify({ result: replayB.result, actions: replayB.actionSequence });
if (!replayMatches) throw new Error("Deterministic replay mismatch.");

const semantic = (games: typeof allGames) => games.reduce<Record<string, number>>((totals, game) => { for (const [key, count] of Object.entries(game.eventCounts)) totals[key] = (totals[key] ?? 0) + count; return totals; }, {});
const reasonCounts = (games: typeof allGames) => games.reduce<Record<string, number>>((counts, game) => { counts[game.result.reason] = (counts[game.result.reason] ?? 0) + 1; return counts; }, {});
const compactReport = (report: typeof vsSkeledirge.report) => ({ gamesPlayed: report.gamesPlayed, wins: report.wins, losses: report.losses, drawsOrUnresolved: report.drawsOrUnresolved, winPercentage: report.winPercentage, winRateGoingFirst: report.winRateGoingFirst, winRateGoingSecond: report.winRateGoingSecond, averageTurnCount: report.averageTurnCount, medianTurnCount: report.medianTurnCount, averageTurnOfFirstAttack: report.averageTurnOfFirstAttack, averageTurnOfFirstKnockOut: report.averageTurnOfFirstKnockOut, errorOrUnresolvedCount: report.errorOrUnresolvedCount });
const coreEvents = (games: typeof allGames) => { const totals = semantic(games); const keys = ["attack-used:Poisonous Musculature","energy-attached-by-effect:Poisonous Musculature","ability-used:Subjugating Chains","energy-attached-by-effect:Janine's Secret Art","attack-used:Chain-Crazed","damage-modifier-applied:Binding Mochi","damage-counters-moved:Adrena-Brain","ability-used:Flip the Script","prize-modified:Oh No You Don't","temporary-effect-applied:item lock","temporary-effect-applied:retreat lock","knockout-cause:stadium-effect"]; return Object.fromEntries(keys.map((key) => [key, totals[key] ?? 0])); };
console.log(JSON.stringify({
  support: { exactPrintings: okidogi.entries.length, complete: okidogi.entries.length - okidogiUnsupported.length, runtimeCopies: okidogi.entries.reduce((sum, entry) => sum + (toRuntimeCardDefinition(index.byId.get(entry.cardId)!) ? entry.count : 0), 0), missingRuntime: okidogiMissingRuntime.length },
  vsSkeledirge: { report: compactReport(vsSkeledirge.report), resultReasons: reasonCounts(vsSkeledirge.games), coreEvents: coreEvents(vsSkeledirge.games) },
  mirror: { report: compactReport(mirror.report), resultReasons: reasonCounts(mirror.games), coreEvents: coreEvents(mirror.games) },
  safety: { unresolved: unresolved.length, invalidNumeric, noLegalAction: allGames.filter((game) => game.result.reason === "no-legal-action").length, actionLimit: allGames.filter((game) => game.result.reason === "action-limit").length, turnLimit: allGames.filter((game) => game.result.reason === "turn-limit").length },
  replay: { seed: replayA.seed, winner: replayA.result.winnerId, turns: replayA.result.turns, actions: replayA.actionCount, fullActionSequenceMatch: replayMatches },
}, null, 2));
