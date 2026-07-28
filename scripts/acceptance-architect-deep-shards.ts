import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkAnchors, generateAnchor, index } from "./architect-acceptance-common";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
import type { DeckManifest } from "../src/data/decks/types";

const outDir = join("artifacts", "architect-deep-shards");
mkdirSync(outDir, { recursive: true });
const opponent = JSON.parse(readFileSync("src/data/decks/premade/okidogi-ex-poison.json", "utf8")) as DeckManifest;
const indexArg = Number(process.argv.find((arg) => arg.startsWith("--anchor-index="))?.split("=")[1] ?? "NaN");
const targets = Number.isInteger(indexArg) ? benchmarkAnchors.slice(indexArg, indexArg + 1) : benchmarkAnchors;

for (const [cardId, name] of targets) {
  const path = join(outDir, `shard-${cardId}.json`);
  if (existsSync(path) && !process.argv.includes("--rerun")) continue;
  const generated = generateAnchor(cardId, "balanced", 5);
  const candidate = generated.candidates.find((value) => value.simulationReady);
  if (!candidate) throw new Error(`${cardId}: no simulation-ready candidate`);
  const summary = await runQuickGauntlet(candidate, [opponent], index, 250);
  const shard = { cardId, name, candidateId: candidate.id, games: summary.games, expectedGames: 250, unresolved: summary.unresolved, invalidNumeric: summary.invalidNumeric, choiceLoops: summary.choiceLoops, noLegalAction: summary.noLegalAction, summary };
  writeFileSync(path, JSON.stringify(shard, null, 2));
  console.log(JSON.stringify({ shard: path, ...shard }, null, 2));
}
console.log(JSON.stringify({ shardDirectory: outDir, anchors: benchmarkAnchors.length, processed: targets.length }, null, 2));
