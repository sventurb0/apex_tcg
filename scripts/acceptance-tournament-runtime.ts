import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckDefinition } from "../engine/model/decks";
import { runBatch } from "../engine/simulation/batch-runner";
import { runHeadlessGame } from "../engine/simulation/game-runner";
import type { DeckManifest } from "../src/data/decks/types";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

const configs: Record<string, { sourceId: string; requiredEvents: string[] }> = {
  "rocket-mewtwo": { sourceId: "28351", requiredEvents: ["sv10-20", "sv10-81"] },
  dragapult: { sourceId: "28271", requiredEvents: ["sv6-129", "sv6-130"] },
  "ns-zoroark": { sourceId: "28274", requiredEvents: ["sv9-98"] },
  hydrapple: { sourceId: "28269", requiredEvents: ["sv6-25", "sv7-14"] },
  "ogerpon-box": { sourceId: "28263", requiredEvents: ["sv6-64", "sv7-131"] },
};

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const key = process.argv[2] ?? "";
const config = configs[key];
if (!config) throw new Error(`Usage: acceptance-tournament-runtime.ts ${Object.keys(configs).join("|")}`);
const source = corpus.decks.find((deck) => deck.snapshot.sourceDeckId === config.sourceId);
if (!source?.manifest) throw new Error(`${key}: checked-in source manifest is not a complete 60-card list.`);
if (!source.simulationReady) throw new Error(`${key}: simulationReady=false; missing families: ${source.missingBehaviourFamilyIds.join(", ")}`);
const index = createCatalogueIndex(catalogue.cards);
const runtime = (manifest: DeckManifest): DeckDefinition => ({ id: manifest.id, name: manifest.name, description: manifest.description, entries: manifest.entries, available: true });
const baseline = (name: string): DeckManifest => JSON.parse(readFileSync(`src/data/decks/premade/${name}.json`, "utf8")) as DeckManifest;
const skeledirge = baseline("skeledirge-armarouge");
const okidogi = baseline("okidogi-ex-poison");
const rocket = baseline("team-rockets-nidoking");
const ids = [...new Set([source.manifest, skeledirge, okidogi, rocket].flatMap((deck) => deck.entries.map((entry) => entry.cardId)))];
const unsupported = ids.filter((id) => { const card = index.byId.get(id); return !card || !["complete", "generated"].includes(compileCardImplementation(card).status); });
const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
if (unsupported.length || cards.length !== ids.length) throw new Error(`${key}: runtime support gate failed; unsupported=${unsupported.join(", ")}`);
const subject = runtime(source.manifest);
const games = [
  ...runBatch({ games: 100, baseSeed: 610_000, subjectDeck: subject, opponentDeck: runtime(skeledirge), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games,
  ...runBatch({ games: 100, baseSeed: 620_000, subjectDeck: subject, opponentDeck: runtime(okidogi), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games,
  ...runBatch({ games: 100, baseSeed: 630_000, subjectDeck: subject, opponentDeck: runtime(rocket), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games,
  ...runBatch({ games: 50, baseSeed: 640_000, subjectDeck: subject, opponentDeck: subject, cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games,
];
const unresolved = games.filter((game) => game.result.unresolved);
const invalid = games.reduce((sum, game) => sum + game.invalidNumericCount, 0);
if (unresolved.length || invalid) throw new Error(`${key}: unresolved=${unresolved.length}, invalidNumeric=${invalid}`);
const events = new Set(games.flatMap((game) => game.eventSourceCardIds));
const missingEvents = config.requiredEvents.filter((id) => !events.has(id));
if (missingEvents.length) throw new Error(`${key}: defining engine events were not exercised: ${missingEvents.join(", ")}`);
const replayConfig = { seed: 650_000, playerOneDeck: subject, playerTwoDeck: runtime(okidogi), cards, startingPlayer: "player-one" as const, playerOneAgent: "heuristic" as const, playerTwoAgent: "heuristic" as const };
const replayA = runHeadlessGame(replayConfig);
const replayB = runHeadlessGame(replayConfig);
if (JSON.stringify({ result: replayA.result, actions: replayA.actionSequence, events: replayA.eventCounts }) !== JSON.stringify({ result: replayB.result, actions: replayB.actionSequence, events: replayB.eventCounts })) throw new Error(`${key}: deterministic replay mismatch`);
const wins = games.filter((game) => game.result.winnerId === "player-one").length;
console.log(JSON.stringify({ deck: source.snapshot.archetype, player: source.snapshot.player, source: source.snapshot.sourceUrl, cards: source.manifest.entries.reduce((sum, entry) => sum + entry.count, 0), simulationReady: source.simulationReady, games: games.length, wins, losses: games.length - wins, unresolved: unresolved.length, invalidNumeric: invalid, definingEvents: [...events].filter((id) => config.requiredEvents.includes(id)), replay: { seed: replayA.seed, winner: replayA.result.winnerId, actions: replayA.actionCount } }, null, 2));
