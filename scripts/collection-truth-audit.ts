import { coverage, coverageSummary, loadCollection } from "./collection-common";

const document = loadCollection();
const rows = coverage(document);
const summary = coverageSummary(document);
const result = {
  generatedAt: new Date().toISOString(),
  collectionRows: document.diagnostics.csvRows,
  physicalCopies: document.diagnostics.physicalCopies,
  productsResolved: document.diagnostics.distinctOwnedProducts,
  readyExactProducts: rows.filter((row) => row.simulationReady).reduce((sum, row) => sum + row.ownedProductIds.length, 0),
  readyGameplayFamilies: new Set(rows.filter((row) => row.simulationReady).map((row) => row.gameplayFamilyId)).size,
  gameplayFamilies: summary.gameplayFamilies,
  partial: summary.partial,
  unsupported: summary.unsupported,
  unknownPrograms: summary.unknownPrograms,
  choiceWarnings: summary.choiceWarnings,
  missingClauses: summary.missingClauses,
  falseReadyRows: summary.falseReadyRows,
  rows,
};
console.log(JSON.stringify(result, null, 2));
if (result.collectionRows !== 169 || result.physicalCopies !== 343 || result.productsResolved !== 153 || result.partial || result.unsupported || result.unknownPrograms || result.choiceWarnings || result.missingClauses || result.falseReadyRows.length) process.exitCode = 1;
