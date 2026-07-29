import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArchitectCandidate } from "../src/features/deck-architect";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
import { index } from "./architect-acceptance-common";
import { architectRevisionHash, NIDOKING, OKIDOGI, relevantTournamentOpponent, selectedTargets, SKELEDIRGE } from "./architect-gauntlet-common";

interface ScreeningShard { architectureHash: string; anchorCardId: string; finalistCandidate: ArchitectCandidate; finalistFingerprint: string; candidateScreeningRank: number; }
const outDir = join("artifacts", "architect-deep-shards");
const screeningDir = join("artifacts", "architect-screening-shards");
mkdirSync(outDir, { recursive: true });
const architectureHash = architectRevisionHash();

for (const [anchorCardId, name] of selectedTargets()) {
  const path = join(outDir, `shard-${anchorCardId}.json`);
  if (existsSync(path) && !process.argv.includes("--rerun")) { const existing = JSON.parse(readFileSync(path, "utf8")) as { architectureHash?: string }; if (existing.architectureHash === architectureHash) continue; }
  const screeningPath = join(screeningDir, `shard-${anchorCardId}.json`);
  if (!existsSync(screeningPath)) throw new Error(`${anchorCardId}: fresh screening shard is required before deep testing`);
  const screening = JSON.parse(readFileSync(screeningPath, "utf8")) as ScreeningShard;
  if (screening.architectureHash !== architectureHash) throw new Error(`${anchorCardId}: screening shard is stale (${screening.architectureHash} != ${architectureHash})`);
  const candidate = screening.finalistCandidate;
  if (!candidate?.simulationReady || !candidate.coherence?.coherent) throw new Error(`${anchorCardId}: screening finalist is not coherent and simulation-ready`);
  const relevant = relevantTournamentOpponent(anchorCardId);
  const opponents = [SKELEDIRGE, OKIDOGI, NIDOKING, relevant, { ...candidate.deck, id: `${candidate.deck.id}-mirror`, name: `${candidate.deck.name} mirror` }];
  if (new Set(opponents.map((opponent) => opponent.id)).size !== 5) throw new Error(`${anchorCardId}: the deep gauntlet did not resolve five distinct opponent buckets`);
  const summary = await runQuickGauntlet(candidate, opponents, index, { gamesPerOpponent: 50 });
  if (!summary.anchorContribution?.passesRoleGate || !summary.anchorContribution.definingEventCount) throw new Error(`${anchorCardId}: finalist failed deep anchor contribution: ${JSON.stringify(summary.anchorContribution)}`);
  const shard = {
    version: 2, generatedAt: new Date().toISOString(), architectureHash, anchorCardId, name,
    finalistDeckId: candidate.id, finalistFingerprint: screening.finalistFingerprint, candidateScreeningRank: screening.candidateScreeningRank,
    finalistCandidate: candidate, anchorContribution: summary.anchorContribution, definingEvents: summary.definingEvents ?? {}, byOpponent: summary.byOpponent,
    games: summary.games, expectedGames: 250, deterministicReplaySeed: candidate.seed,
    unresolved: summary.unresolved, invalidNumeric: summary.invalidNumeric, missingProgram: 0, choiceLoops: summary.choiceLoops, noLegalAction: summary.noLegalAction,
    opponentOrder: opponents.map((opponent) => opponent.id), summary,
  };
  writeFileSync(path, JSON.stringify(shard, null, 2));
  console.log(JSON.stringify({ shard: path, anchorCardId, games: shard.games, opponentOrder: shard.opponentOrder, anchorContribution: shard.anchorContribution }, null, 2));
}
