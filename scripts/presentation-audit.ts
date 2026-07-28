import { readFileSync } from "node:fs";

const visibleFiles = [
  "src/components/board/GameBoard.tsx",
  "src/components/board/action-presentation.ts",
  "engine/rules/legal-actions.ts",
];
const forbidden = [
  /Resolving\s+\$\{state\.pendingChoice\.sourceEffectId\}/i,
  /description:\s*`[^`]*\b(?:player-one|player-two)\b[^`]*`/i,
  /description:\s*`[^`]*\b(?:hand|attach):\$\{/i,
  /description:\s*`[^`]*\btargetId\b[^`]*`/i,
  /<small>Resolving\s+\{state\.pendingChoice\.sourceEffectId\}<\/small>/i,
];
const warnings: string[] = [];
for (const file of visibleFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) if (pattern.test(source)) {
    if (pattern.test(source)) warnings.push(`${file}: ${pattern}`);
  }
}
if (warnings.length) {
  console.error(JSON.stringify({ warnings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ audit: "presentation", warnings: 0, checked: visibleFiles }, null, 2));
}
