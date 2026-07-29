import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
import { architectRevisionHash, generateScreeningCandidates, screeningOpponents, selectedTargets } from "./architect-gauntlet-common";
import { index } from "./architect-acceptance-common";

const outDir = join("artifacts", "architect-screening-shards");
mkdirSync(outDir, { recursive: true });
const architectureHash = architectRevisionHash();
for (const [anchorCardId, name] of selectedTargets()) {
  const path = join(outDir, `shard-${anchorCardId}.json`);
  if (existsSync(path) && !process.argv.includes("--rerun")) { const existing = JSON.parse(readFileSync(path, "utf8")) as { architectureHash?: string }; if (existing.architectureHash === architectureHash) continue; }
  const candidates = generateScreeningCandidates(anchorCardId);
  if (candidates.length < 5) throw new Error(`${anchorCardId}: expected five coherent fingerprint-distinct candidates, found ${candidates.length}`);
  const opponents = screeningOpponents(anchorCardId);
  const screened = [];
  for (const candidate of candidates) {
    const summary = await runQuickGauntlet(candidate, opponents, index, { totalGames: 40 });
    const contribution = summary.anchorContribution;
    const rejectedReasons = [
      ...(!candidate.coherence?.coherent ? ["coherence audit failed"] : []),
      ...(summary.unresolved ? [`${summary.unresolved} unresolved games`] : []),
      ...(summary.invalidNumeric ? [`${summary.invalidNumeric} invalid numeric values`] : []),
      ...(!contribution?.passesRoleGate ? contribution?.failureReasons ?? ["missing anchor contribution"] : []),
      ...(summary.energyStarvationPercentage > 65 && candidate.profile !== "control" ? [`energy starvation ${summary.energyStarvationPercentage.toFixed(1)}%`] : []),
    ];
    const directionalScore = (contribution?.contributionRate ?? 0) * 3 + (contribution?.enteredPlayRate ?? 0) + summary.winRate * .15 - summary.setupFailurePercentage * .5 - summary.energyStarvationPercentage * .15 + candidate.score.total * .05;
    screened.push({ candidate, summary, rejectedReasons, directionalScore });
  }
  const ranked = screened.filter((result) => result.rejectedReasons.length === 0).sort((a, b) => b.directionalScore - a.directionalScore || b.candidate.score.total - a.candidate.score.total || a.candidate.id.localeCompare(b.candidate.id));
  if (!ranked.length) throw new Error(`${anchorCardId}: all candidates failed screening: ${JSON.stringify(screened.map((value) => ({ id: value.candidate.id, reasons: value.rejectedReasons, contribution: value.summary.anchorContribution })))}`);
  const finalist = ranked[0]!;
  const shard = {
    version: 2, generatedAt: new Date().toISOString(), architectureHash, anchorCardId, name,
    candidateCount: candidates.length, games: screened.reduce((sum, result) => sum + result.summary.games, 0), expectedGames: 200,
    unresolved: screened.reduce((sum, result) => sum + result.summary.unresolved, 0), invalidNumeric: screened.reduce((sum, result) => sum + result.summary.invalidNumeric, 0),
    choiceLoops: screened.reduce((sum, result) => sum + result.summary.choiceLoops, 0), noLegalAction: screened.reduce((sum, result) => sum + result.summary.noLegalAction, 0),
    opponents: opponents.map((opponent) => opponent.id),
    candidates: screened.map((result) => ({ candidateId: result.candidate.id, fingerprint: result.candidate.fingerprint, profile: result.candidate.profile, route: result.candidate.route, coherence: result.candidate.coherence, anchorContribution: result.summary.anchorContribution, definingEvents: result.summary.definingEvents, byOpponent: result.summary.byOpponent, summary: result.summary, rejectedReasons: result.rejectedReasons, directionalScore: result.directionalScore })),
    finalistCandidate: { ...finalist.candidate, quickTest: finalist.summary, anchorContribution: finalist.summary.anchorContribution }, finalistDeckId: finalist.candidate.id,
    finalistFingerprint: finalist.candidate.fingerprint, candidateScreeningRank: 1, anchorContribution: finalist.summary.anchorContribution,
    definingEvents: finalist.summary.definingEvents, byOpponent: finalist.summary.byOpponent,
  };
  writeFileSync(path, JSON.stringify(shard, null, 2));
  console.log(JSON.stringify({ shard: path, anchorCardId, games: shard.games, finalistDeckId: shard.finalistDeckId, contribution: shard.anchorContribution }, null, 2));
}
