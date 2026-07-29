import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { architectRevisionHash } from "./architect-gauntlet-common";
import type { AnchorContribution } from "../src/features/deck-architect";

interface Shard { architectureHash: string; anchorCardId: string; candidateCount: number; games: number; expectedGames: number; unresolved: number; invalidNumeric: number; choiceLoops: number; noLegalAction: number; opponents: string[]; finalistFingerprint: string; anchorContribution?: AnchorContribution; definingEvents?: Record<string, number>; }
const dir = join("artifacts", "architect-screening-shards");
const files = existsSync(dir) ? readdirSync(dir).filter((file) => /^shard-.*\.json$/.test(file)) : [];
const shards = files.map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as Shard);
const architectureHash = architectRevisionHash();
const report = {
  architectureHash, anchors: shards.length, expectedAnchors: 24, games: shards.reduce((sum, shard) => sum + shard.games, 0), expectedGames: 4_800,
  unresolved: shards.reduce((sum, shard) => sum + shard.unresolved, 0), invalidNumeric: shards.reduce((sum, shard) => sum + shard.invalidNumeric, 0),
  choiceLoops: shards.reduce((sum, shard) => sum + shard.choiceLoops, 0), noLegalAction: shards.reduce((sum, shard) => sum + shard.noLegalAction, 0),
  stale: shards.filter((shard) => shard.architectureHash !== architectureHash).map((shard) => shard.anchorCardId),
  failedContribution: shards.filter((shard) => !shard.anchorContribution?.passesRoleGate || !shard.anchorContribution.definingEventCount).map((shard) => shard.anchorCardId),
  malformed: shards.filter((shard) => shard.candidateCount < 5 || shard.games !== shard.expectedGames || shard.opponents.length !== 2).map((shard) => shard.anchorCardId),
};
const complete = report.anchors === report.expectedAnchors && report.games >= report.expectedGames && !report.unresolved && !report.invalidNumeric && !report.choiceLoops && !report.noLegalAction && !report.stale.length && !report.failedContribution.length && !report.malformed.length;
console.log(JSON.stringify({ ...report, complete }, null, 2));
if (!complete) process.exitCode = 1;

