import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCoveragePlan } from "../src/data/pokemon";
import { loadCoverageContext } from "./coverage-context";

const { catalogue, signatures } = await loadCoverageContext();
const plan = buildCoveragePlan(signatures);
await writeFile(resolve("public/data/coverage-plan.json"), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), sourceCommit: catalogue.source.commit, entries: plan }, null, 2)}\n`, "utf8");
console.log(`Card Behaviour Coverage implementation plan\nRanked unsupported families: ${plan.length.toLocaleString()}\nLow / medium / high complexity: ${plan.filter((entry) => entry.complexity === "low").length.toLocaleString()} / ${plan.filter((entry) => entry.complexity === "medium").length.toLocaleString()} / ${plan.filter((entry) => entry.complexity === "high").length.toLocaleString()}`);
for (const entry of plan.slice(0, 30)) console.log(`${entry.rank.toString().padStart(3)}  ${entry.score.toString().padStart(4)}  ${entry.kind.padEnd(7)} ${entry.complexity.padEnd(6)} ${entry.familyId} · ${entry.exampleCards.join(", ")} · ${entry.proposedTemplate}`);
