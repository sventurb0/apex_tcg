import { readFile, writeFile } from "node:fs/promises";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { buildSynergyChains } from "../src/features/deck-architect/engines/capability-graph";
import { engineDefinitions } from "../src/features/deck-architect/engines/definitions";
import { deriveSourcePackages } from "../src/features/deck-architect/engines/source-packages";
import { reviewedSynergyChains } from "../src/features/deck-architect/engines/synergy-chains";
import { generateDeckStrategyPlan } from "../src/features/deck-architect/engines/strategy-plans";

async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
  const packages = deriveSourcePackages(corpus);
  const plans = corpus.decks.map(generateDeckStrategyPlan);
  const derivedChains = buildSynergyChains(engineDefinitions, { maxCards: 5 });
  const chains = [...reviewedSynergyChains, ...derivedChains];
  const chainText = chains.map((chain) => `## ${chain.id}\n\n- Cards: ${chain.cardIds.map((id) => `\`${id}\``).join(" → ")}\n- Score/confidence: ${chain.score} / ${chain.confidence}\n- Sources: ${chain.sourceDeckIds.join(", ") || "derived from reviewed capabilities"}\n${chain.steps.map((step) => `- ${step.explanation}`).join("\n")}\n- Constraints: ${chain.constraints.join(" ")}\n`).join("\n");
  const packageRows = packages.map((item) => `| ${item.name} | ${item.sourceDeckCount} | ${item.weightedTournamentSuccess} | ${item.status} | ${item.reviewed ? "reviewed" : "no corpus evidence"} | ${item.archetypes.join(", ") || "-"} |`).join("\n");
  await writeFile("SYNERGY_ENGINE_WAVE_2.md", `# Synergy Engine Wave 2\n\nCo-occurrence is evidence only. Every reviewed package also has a semantic explanation; contradictory Stadium, Energy, Bench and trait clauses override popularity.\n\n## Summary\n\n- Multi-card synergy chains: ${chains.length} (${reviewedSynergyChains.length} reviewed, ${derivedChains.length} derived)\n- Source package definitions: ${packages.length}\n- Packages with corpus evidence: ${packages.filter((item) => item.reviewed).length}\n- Generated strategy plans: ${plans.length}\n\n## Source-backed packages\n\n| Package | Source decks | Placement weight | Status | Review | Archetypes |\n|---|---:|---:|---|---|---|\n${packageRows}\n\n## Reviewed and derived chains\n\n${chainText}\n`, "utf8");
  await writeFile("public/data/synergy-engine-library.json", `${JSON.stringify({ generatedAt: corpus.generatedAt, chains, reviewedChains: reviewedSynergyChains, derivedChains, packages, strategyPlans: plans }, null, 2)}\n`, "utf8");
  console.log(`Synergy report: ${chains.length} chains (${reviewedSynergyChains.length} reviewed/${derivedChains.length} derived), ${packages.filter((item) => item.reviewed).length}/${packages.length} source-backed packages, ${plans.length} strategy plans.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
