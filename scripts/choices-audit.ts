import fs from "node:fs";
import path from "node:path";

type Finding = { file: string; line: number; pattern: string; source: string; severity: "warning" | "reviewed"; reason?: string };
const root = process.cwd();
const files = ["engine/effects/program-runner.ts", "engine/effects/effect-runner.ts", "engine/rules/reducer.ts"];
const patterns: Array<[string, RegExp]> = [
  ["bench[0]", /\.bench\[0\]/],
  ["hand.find", /\.hand\.find\(/],
  ["deck.find", /\.deck\.find\(/],
  ["attachedEnergy.splice(0", /attachedEnergy\.splice\(0/],
  ["active ?? bench[0]", /active\s*\?\?\s*player\.bench\[0\]/],
  ["slice(0,N) selection", /\.slice\(0,\s*(?:2|3|5|6|7)\)/],
];
const reviewed: Array<{ token: string; reason: string }> = [
  { token: "commonFinalBoardStates", reason: "Metrics keeps the top three aggregate board-state labels; no game choice." },
  { token: "candidateHand = cards.slice(0, 7)", reason: "Initial setup hand is defined by the rules, not a player selection." },
  { token: "const prizes = cards.slice(0, 6)", reason: "Prize setup is defined by the rules; Prize claims are pending choices." },
  { token: "player.deck.slice(0, 2).map", reason: "Recon Directive exposes the top two cards as a pending choice." },
  { token: "player.deck.slice(0, 6).map", reason: "Attract Customers exposes the top six cards as a pending choice." },
  { token: "player.deck.slice(0, 7).map", reason: "Top-seven search effects expose eligible cards through pending choices." },
  { token: "player.deck.slice(0, 5).map", reason: "Top-five reveal effects expose eligible cards through pending choices." },
  { token: "selected.map((id)", reason: "Post-choice lookup resolves the exact physical instance selected by the player." },
  { token: "player.active.attachedEnergy.length === cost", reason: "Retreat auto-payment is allowed only when every eligible attached Energy card must be discarded." },
];
const findings: Finding[] = [];
for (const relative of files) {
  const lines = fs.readFileSync(path.join(root, relative), "utf8").split(/\r?\n/);
  lines.forEach((source, index) => {
    for (const [pattern, regex] of patterns) if (regex.test(source)) {
      const exception = reviewed.find((entry) => source.includes(entry.token));
      findings.push({ file: relative, line: index + 1, pattern, source: source.trim(), severity: exception ? "reviewed" : "warning", ...(exception ? { reason: exception.reason } : {}) });
    }
  });
}
const warnings = findings.filter((finding) => finding.severity === "warning");
console.log(JSON.stringify({ files, reviewedAllowList: reviewed.length, warningCount: warnings.length, reviewedCount: findings.length - warnings.length, warnings, reviewedFindings: findings.filter((finding) => finding.severity === "reviewed") }, null, 2));
