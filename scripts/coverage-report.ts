import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCoverageReport, renderFavouriteCoverageMarkdown } from "../src/data/pokemon";
import { loadCoverageContext } from "./coverage-context";

const { catalogue, signatures, favourites } = await loadCoverageContext();
const report = buildCoverageReport(catalogue.cards, signatures, favourites);
await writeFile(resolve("public/data/coverage-report.json"), `${JSON.stringify({ version: 1, sourceCommit: catalogue.source.commit, report, favourites }, null, 2)}\n`, "utf8");
await writeFile(resolve("FAVOURITE_CARD_COVERAGE.md"), `${renderFavouriteCoverageMarkdown(favourites)}\n`, "utf8");
console.log(`Card Behaviour Coverage report\nExact printings: ${report.totalExactPrintings.toLocaleString()}\nExplicit complete: ${report.explicitCompletePrintings.toLocaleString()}\nFunctional inherited complete: ${report.functionalInheritedCompletePrintings.toLocaleString()}\nReviewed-template complete: ${report.reviewedTemplateCompletePrintings.toLocaleString()}\nSafely generated: ${report.safelyGeneratedPrintings.toLocaleString()}\nSimulation-ready exact printings: ${report.totalSimulationReadyPrintings.toLocaleString()}\nBehaviour families: ${report.behaviourFamilies.toLocaleString()}\nFavourite Pokémon with a ready variant: ${report.favouritePokemonWithSimulationReadyVariant}/${favourites.length}\nFavourite Pokémon still fully unsupported: ${report.favouritePokemonFullyUnsupported}`);
for (const [kind, counts] of Object.entries(report.signatures)) console.log(`${kind}: ${counts.complete}/${counts.total} complete; ${counts.partial} partial; ${counts.unsupported} unsupported`);
