import { mkdirSync, writeFileSync } from "node:fs";
import { importCurrentCollection } from "./collection-common";
const document = importCurrentCollection(); mkdirSync("public/data", { recursive: true }); writeFileSync("public/data/owned-collection.json", `${JSON.stringify(document, null, 2)}\n`);
const d = document.diagnostics; writeFileSync("OWNED_COLLECTION.md", `# Owned Collection\n\nImported ${d.csvRows} CSV rows representing ${d.physicalCopies} physical copies and ${d.distinctOwnedProducts} owned products.\n\n- Catalogue IDs: ${d.distinctCatalogueCardIds}\n- Card names: ${d.distinctCardNames}\n- Unresolved rows: ${d.unresolvedRows}\n- Basic Energy: Unlimited (user-configurable)\n- Resolution: ${JSON.stringify(d.resolutionBreakdown)}\n`);
console.log(JSON.stringify(d, null, 2)); if (d.unresolvedRows) process.exitCode = 1;
