import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnchorContribution, MatchupSummary } from "../src/features/deck-architect";
import { architectRevisionHash } from "./architect-gauntlet-common";

interface Shard { architectureHash: string; anchorCardId: string; finalistFingerprint: string; reviewedSharedShellReason?: string; games: number; expectedGames: number; unresolved: number; invalidNumeric: number; missingProgram: number; choiceLoops: number; noLegalAction: number; anchorContribution?: AnchorContribution; definingEvents: Record<string, number>; byOpponent: Record<string, MatchupSummary>; }
const dir = join("artifacts", "architect-deep-shards");
const files = existsSync(dir) ? readdirSync(dir).filter((file) => /^shard-.*\.json$/.test(file)) : [];
const shards = files.map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as Shard);
const architectureHash = architectRevisionHash();
const fingerprintGroups = new Map<string, Shard[]>();
for (const shard of shards) fingerprintGroups.set(shard.finalistFingerprint, [...(fingerprintGroups.get(shard.finalistFingerprint) ?? []), shard]);
const duplicates = [...fingerprintGroups.values()].filter((group) => group.length > 1 && group.some((shard) => !shard.reviewedSharedShellReason)).map((group) => group.map((shard) => shard.anchorCardId));
const report = {
  architectureHash, expectedAnchors: 24, shards: shards.length, games: shards.reduce((sum, shard) => sum + shard.games, 0), expectedGames: 6_000,
  unresolved: shards.reduce((sum, shard) => sum + shard.unresolved, 0), invalidNumeric: shards.reduce((sum, shard) => sum + shard.invalidNumeric, 0), missingProgram: shards.reduce((sum, shard) => sum + shard.missingProgram, 0), choiceLoops: shards.reduce((sum, shard) => sum + shard.choiceLoops, 0), noLegalAction: shards.reduce((sum, shard) => sum + shard.noLegalAction, 0),
  stale: shards.filter((shard) => shard.architectureHash !== architectureHash).map((shard) => shard.anchorCardId),
  wrongBuckets: shards.filter((shard) => Object.keys(shard.byOpponent).length !== 5 || Object.values(shard.byOpponent).some((bucket) => bucket.games !== 50)).map((shard) => shard.anchorCardId),
  failedContribution: shards.filter((shard) => !shard.anchorContribution?.passesRoleGate || !shard.anchorContribution.definingEventCount || !Object.keys(shard.definingEvents).length).map((shard) => shard.anchorCardId),
  duplicateFingerprints: duplicates,
};
const complete = report.shards === report.expectedAnchors && report.games === report.expectedGames && !report.unresolved && !report.invalidNumeric && !report.missingProgram && !report.choiceLoops && !report.noLegalAction && !report.stale.length && !report.wrongBuckets.length && !report.failedContribution.length && !report.duplicateFingerprints.length;
console.log(JSON.stringify({ ...report, complete }, null, 2));
if (!complete) process.exitCode = 1;

