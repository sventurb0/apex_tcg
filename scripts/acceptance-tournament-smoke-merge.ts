import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join("artifacts", "tournament-smoke-shards");
const expectedDecks = 37;
const files = existsSync(dir) ? readdirSync(dir).filter((file) => /^shard-.*\.json$/.test(file)) : [];
const shards = files.map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as { sourceDeckId: string; games: number; unresolved: number; invalidNumeric: number; choiceLoops: number; noLegalAction: number; turnLimit: number });
const total = shards.reduce((sum, shard) => sum + shard.games, 0);
const report = { expectedDecks, shards: shards.length, missingShards: Math.max(0, expectedDecks - shards.length), games: total, expectedGames: expectedDecks * 4 * 20, unresolved: shards.reduce((sum, shard) => sum + shard.unresolved, 0), invalidNumeric: shards.reduce((sum, shard) => sum + shard.invalidNumeric, 0), choiceLoops: shards.reduce((sum, shard) => sum + shard.choiceLoops, 0), noLegalAction: shards.reduce((sum, shard) => sum + shard.noLegalAction, 0), turnLimit: shards.reduce((sum, shard) => sum + shard.turnLimit, 0), complete: shards.length === expectedDecks && total === expectedDecks * 4 * 20 };
console.log(JSON.stringify(report, null, 2));
if (!report.complete || report.unresolved || report.invalidNumeric || report.choiceLoops || report.noLegalAction || report.turnLimit) process.exitCode = 1;
