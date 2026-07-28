import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckDefinition } from "../engine/model/decks";
import { runBatch } from "../engine/simulation/batch-runner";
import type { DeckManifest } from "../src/data/decks/types";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

const mode = process.argv[2] === "deep" ? "deep" : process.argv[2] === "quick" ? "quick" : "smoke";
const games = mode === "deep" ? 100 : mode === "quick" ? 1 : 20;
const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const index = createCatalogueIndex(catalogue.cards);
const baseline = (name: string): DeckManifest => JSON.parse(readFileSync(`src/data/decks/premade/${name}.json`, "utf8")) as DeckManifest;
const baselines = [baseline("skeledirge-armarouge"), baseline("okidogi-ex-poison"), baseline("team-rockets-nidoking")];
const shardIndexArg = process.argv.find((arg) => arg.startsWith("--shard-index="));
const shardCountArg = process.argv.find((arg) => arg.startsWith("--shard-count="));
const shardIndex = shardIndexArg ? Number(shardIndexArg.split("=")[1]) : 0;
const shardCount = shardCountArg ? Number(shardCountArg.split("=")[1]) : 1;
const allReady = corpus.decks.filter((deck) => deck.simulationReady && deck.manifest);
const ready = allReady.filter((_, index) => index % shardCount === shardIndex);
const blocked = corpus.decks.filter((deck) => !deck.simulationReady);
// Build one complete runtime card pool for every shard. Deep shards still
// partition the subject decks, but each subject is paired with the same first
// ready corpus opponent, so that opponent's card definitions must be present
// even when it lives on a different shard.
const allManifests = [...allReady.flatMap((deck) => deck.manifest ? [deck.manifest] : []), ...baselines];
const ids = [...new Set(allManifests.flatMap((manifest) => manifest.entries.map((entry) => entry.cardId)))];
const unsupported = ids.filter((id) => !index.byId.has(id) || !["complete", "generated"].includes(compileCardImplementation(index.byId.get(id)!).status));
const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
const runtimeMissing = ids.filter((id) => !cards.some((card) => card.id === id));
if (blocked.length || unsupported.length || runtimeMissing.length) {
  console.error(JSON.stringify({ mode, sourceDecks: corpus.decks.length, ready: ready.length, blocked: blocked.map((deck) => ({ id: deck.snapshot.sourceDeckId, archetype: deck.snapshot.archetype, families: deck.missingBehaviourFamilyIds })), unsupported, runtimeMissing }, null, 2));
  process.exitCode = 1;
} else {
  const runtime = (manifest: DeckManifest): DeckDefinition => ({ id: manifest.id, name: manifest.name, description: manifest.description, entries: manifest.entries, available: true });
  const results: Array<{ sourceDeckId: string; games: number; unresolved: number; invalidNumeric: number; unresolvedDetails?: Array<{ seed: number; reason: string; actionCount: number; finalState: string; tail: string[] }> }> = [];
  const evaluate = (deck: typeof ready[number]) => {
    const subject = runtime(deck.manifest!);
    const opponents = mode === "deep" ? [...baselines, ...allReady.filter((other) => other.id !== deck.id).slice(0, 1).flatMap((other) => other.manifest ? [other.manifest] : [])] : [...baselines, deck.manifest!];
    const played = opponents.flatMap((opponent, index) => runBatch({ games, baseSeed: 700_000 + index * 10_000, subjectDeck: subject, opponentDeck: runtime(opponent), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" }).games);
    const unresolvedGames = played.filter((game) => game.result.unresolved);
    return { sourceDeckId: deck.snapshot.sourceDeckId ?? deck.id, games: played.length, unresolved: unresolvedGames.length, invalidNumeric: played.reduce((sum, game) => sum + game.invalidNumericCount, 0), unresolvedDetails: unresolvedGames.length ? unresolvedGames.map((game) => ({ seed: game.seed, reason: game.result.reason, actionCount: game.actionCount, finalState: game.finalStateSummary, tail: game.actionSequence.slice(-8) })) : undefined };
  };
  const concurrency = mode === "deep" ? 4 : mode === "smoke" ? 8 : 1;
  for (let offset = 0; offset < ready.length; offset += concurrency) {
    const batch = ready.slice(offset, offset + concurrency);
    results.push(...await Promise.all(batch.map((deck) => Promise.resolve().then(() => evaluate(deck)))));
  }
  const report = { mode, sourceDecks: corpus.decks.length, ready: ready.length, shardIndex, shardCount, games: results.reduce((sum, row) => sum + row.games, 0), unresolved: results.reduce((sum, row) => sum + row.unresolved, 0), invalidNumeric: results.reduce((sum, row) => sum + row.invalidNumeric, 0), results };
  if (shardCount > 1) { mkdirSync("artifacts/tournament-deep-shards", { recursive: true }); writeFileSync(`artifacts/tournament-deep-shards/deep-${shardIndex}.json`, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
}
