import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join("artifacts", "architect-deep-shards");
const expectedAnchors = 24;
const files = existsSync(dir) ? readdirSync(dir).filter((file) => /^shard-.*\.json$/.test(file)) : [];
const shards = files.map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as { games: number; expectedGames: number; unresolved: number; invalidNumeric: number; choiceLoops: number; noLegalAction: number });
const report = { expectedAnchors, shards: shards.length, missingShards: Math.max(0, expectedAnchors - shards.length), games: shards.reduce((sum, shard) => sum + shard.games, 0), expectedGames: expectedAnchors * 250, unresolved: shards.reduce((sum, shard) => sum + shard.unresolved, 0), invalidNumeric: shards.reduce((sum, shard) => sum + shard.invalidNumeric, 0), choiceLoops: shards.reduce((sum, shard) => sum + shard.choiceLoops, 0), noLegalAction: shards.reduce((sum, shard) => sum + shard.noLegalAction, 0), complete: shards.length === expectedAnchors && shards.every((shard) => shard.games === shard.expectedGames) };
console.log(JSON.stringify(report, null, 2));
if (!report.complete || report.games !== report.expectedGames || report.unresolved || report.invalidNumeric || report.choiceLoops || report.noLegalAction) process.exitCode = 1;
