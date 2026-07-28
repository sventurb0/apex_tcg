import { readFileSync } from "node:fs";

interface PortfolioReport { selectedDecks: number; individualDecksBuildable: number; maximumSimultaneousDecks: number; conflicts: Array<{ cardId: string; required: number; owned: number; shortage: number; deckIds: string[] }> }
const report = JSON.parse(readFileSync("public/data/owned-portfolio-optimisation.json", "utf8")) as PortfolioReport;
const schemaValid = report.conflicts.every((issue) => typeof issue.cardId === "string" && Number.isFinite(issue.required) && Number.isFinite(issue.owned) && Array.isArray(issue.deckIds));
console.log(JSON.stringify({ ...report, schemaValid, conflictsReported: report.conflicts.length }, null, 2));
if (!schemaValid || report.selectedDecks !== 6 || report.individualDecksBuildable !== 6 || report.maximumSimultaneousDecks < 1) process.exitCode = 1;
