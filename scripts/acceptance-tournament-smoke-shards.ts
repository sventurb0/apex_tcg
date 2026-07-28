import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckDefinition } from "../engine/model/decks";
import { runBatch } from "../engine/simulation/batch-runner";
import type { DeckManifest } from "../src/data/decks/types";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

const outDir = join("artifacts", "tournament-smoke-shards");
mkdirSync(outDir, { recursive: true });
const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const index = createCatalogueIndex(catalogue.cards);
const baseline = (name: string): DeckManifest => JSON.parse(readFileSync(`src/data/decks/premade/${name}.json`, "utf8")) as DeckManifest;
const baselines = [baseline("skeledirge-armarouge"), baseline("okidogi-ex-poison"), baseline("team-rockets-nidoking")];
const ready = corpus.decks.filter((deck) => deck.simulationReady && deck.manifest);
const allManifests = [...ready.flatMap((deck) => deck.manifest ? [deck.manifest] : []), ...baselines];
const ids = [...new Set(allManifests.flatMap((manifest) => manifest.entries.map((entry) => entry.cardId)))];
const unsupported = ids.filter((id) => !index.byId.has(id) || !["complete", "generated"].includes(compileCardImplementation(index.byId.get(id)!).status));
if (unsupported.length) throw new Error(`Unsupported runtime cards: ${unsupported.join(", ")}`);
const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
const runtime = (manifest: DeckManifest): DeckDefinition => ({ id: manifest.id, name: manifest.name, description: manifest.description, entries: manifest.entries, available: true });
const indexArg = Number(process.argv.find((arg) => arg.startsWith("--deck-index="))?.split("=")[1] ?? "NaN");
const targets = Number.isInteger(indexArg) ? ready.slice(indexArg, indexArg + 1) : ready;
const opponentsFor = (manifest: DeckManifest): DeckManifest[] => [...baselines, manifest];

for (const deck of targets) {
  const sourceDeckId = deck.snapshot.sourceDeckId ?? deck.id;
  const path = join(outDir, `shard-${sourceDeckId}.json`);
  if (existsSync(path) && !process.argv.includes("--rerun")) continue;
  const subject = runtime(deck.manifest!);
  const games = opponentsFor(deck.manifest!).flatMap((opponent, matchup) => runBatch({ games: 20, baseSeed: 2_000_000 + (deck.snapshot.sourceDeckId ? Number(deck.snapshot.sourceDeckId.replace(/\D/g, "")) || 0 : 0) + matchup * 10_000, subjectDeck: subject, opponentDeck: runtime(opponent), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games);
  const unresolved = games.filter((game) => game.result.unresolved);
  const shard = { sourceDeckId, deckName: deck.snapshot.archetype, expectedGames: 80, games: games.length, unresolved: unresolved.length, invalidNumeric: games.reduce((sum, game) => sum + game.invalidNumericCount, 0), choiceLoops: games.filter((game) => /choice loop/i.test(game.result.reason ?? "")).length, noLegalAction: games.filter((game) => /no legal action/i.test(game.result.reason ?? "")).length, turnLimit: games.filter((game) => /turn limit/i.test(game.result.reason ?? "")).length, seeds: games.map((game) => game.seed), unresolvedDetails: unresolved.map((game) => ({ seed: game.seed, reason: game.result.reason, tail: game.actionSequence.slice(-8) })) };
  writeFileSync(path, JSON.stringify(shard, null, 2));
  console.log(JSON.stringify({ shard: path, ...shard }, null, 2));
}
console.log(JSON.stringify({ shardDirectory: outDir, totalSourceDecks: corpus.decks.length, ready: ready.length, processed: targets.length }, null, 2));
