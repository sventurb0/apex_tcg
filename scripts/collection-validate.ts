import { loadCollection } from "./collection-common";
const d = loadCollection().diagnostics; const ok = d.csvRows === 169 && d.physicalCopies === 343 && d.distinctOwnedProducts === 153 && d.unresolvedRows === 0 && d.resolutionBreakdown.exact === 134 && d.resolutionBreakdown["set-id-alias"] === 23 && d.resolutionBreakdown["functional-reprint-alias"] === 12;
console.log(JSON.stringify({ ...d, pass: ok }, null, 2)); if (!ok) process.exitCode = 1;
