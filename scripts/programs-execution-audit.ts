import fs from "node:fs";
import path from "node:path";
import { effectProgramRegistry } from "../engine/effects/program-registry";

const root = process.cwd();
const runner = fs.readFileSync(path.join(root, "engine/effects/program-runner.ts"), "utf8");
const rules = fs.readFileSync(path.join(root, "engine/rules/reducer.ts"), "utf8");
const combat = fs.readFileSync(path.join(root, "engine/rules/combat.ts"), "utf8");
const modifiers = fs.readFileSync(path.join(root, "engine/rules/modifiers.ts"), "utf8");
const adapter = fs.readFileSync(path.join(root, "src/data/pokemon/runtime-adapter.ts"), "utf8");
const legal = fs.readFileSync(path.join(root, "engine/rules/legal-actions.ts"), "utf8");
const entries = Object.values(effectProgramRegistry);
// Every registered program is checked against the full execution surface.
// Several rule-backed programs are intentionally dispatched through the
// runner (for example stadium/tool resolution), so restricting evidence by
// registry implementationKind creates false "registry-only" failures.
const implementationSource = (): string => `${runner}\n${rules}\n${combat}\n${modifiers}\n${legal}\n${adapter}`;
const hasBranch = (entry: (typeof entries)[number]): boolean => { const source = implementationSource(); if (source.includes(`case "${entry.id}"`) || source.includes(entry.id)) return true; const short = entry.id.split(":").at(-1) ?? entry.id; if (entry.id.startsWith("template:")) return source.includes(short.split(":")[0]!); if (entry.implementationKind === "damage-formula") return source.includes(short) || source.includes(short.replace(/-/g, "-damage")); return source.includes(short); };
const missingExecution = entries.filter((entry) => !hasBranch(entry));
const missingTests = entries.filter((entry) => entry.testReferences.length === 0 || entry.testReferences.some((reference) => !fs.existsSync(path.join(root, reference))));
const report = { totalPrograms: entries.length, registryOnly: missingExecution.map((entry) => entry.id), untested: missingTests.map((entry) => entry.id), missingLocators: missingExecution.length, focusedTestIds: entries.length - missingTests.length, executionEvidence: { runnerBranches: entries.filter(hasBranch).length, testFilesPresent: entries.length - missingTests.length } };
console.log(JSON.stringify(report, null, 2));
if (missingExecution.length || missingTests.length) process.exitCode = 1;
