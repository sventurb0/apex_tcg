import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyseDeck } from "../src/features/deck-builder/validation";
import type { ArchitectCandidate } from "../src/features/deck-architect";
import { analyseCandidateCoherence } from "../src/features/deck-architect/coherence";
import { benchmarkAnchors, index } from "./architect-acceptance-common";
import { architectRevisionHash, generateScreeningCandidates } from "./architect-gauntlet-common";

interface ScreeningShard { architectureHash: string; finalistCandidate: ArchitectCandidate; }
const architectureHash = architectRevisionHash();
const results = benchmarkAnchors.map(([anchorCardId, name]) => {
  const path = join("artifacts", "architect-screening-shards", `shard-${anchorCardId}.json`);
  const persisted = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as ScreeningShard : undefined;
  const candidate = persisted?.architectureHash === architectureHash ? persisted.finalistCandidate : generateScreeningCandidates(anchorCardId)[0];
  if (!candidate) return { anchorCardId, name, coherent: false, failure: "no coherent candidate", total: 0, simulationReady: false };
  const coherence = analyseCandidateCoherence(candidate, index);
  const validation = analyseDeck(candidate.deck, index);
  return { anchorCardId, name, candidateId: candidate.id, fingerprint: candidate.fingerprint, total: validation.total, simulationReady: validation.simulationReady, ...coherence };
});
const coherent = results.filter((result) => result.coherent && result.total === 60 && result.simulationReady).length;
const decorative = results.filter((result) => !result.coherent).map((result) => result.anchorCardId);
console.log(JSON.stringify({ architectureHash, coherent, expected: benchmarkAnchors.length, decorative, results: results.map((result) => ({ anchorCardId: result.anchorCardId, name: result.name, candidateId: "candidateId" in result ? result.candidateId : null, coherent: result.coherent, total: result.total, simulationReady: result.simulationReady, contamination: "contamination" in result ? result.contamination : [], noRoleEdge: "cardsWithNoRoleEdge" in result ? result.cardsWithNoRoleEdge : [], offPlanEnergy: "offPlanEnergyCards" in result ? result.offPlanEnergyCards : [] })) }, null, 2));
if (coherent !== benchmarkAnchors.length || decorative.length) process.exitCode = 1;
