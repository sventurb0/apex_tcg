import { readFile } from "node:fs/promises";
import { CATALOGUE_PATH, validateCatalogue, type CompactCatalogue } from "./card-data-utils";

const catalogue = JSON.parse(await readFile(CATALOGUE_PATH, "utf8")) as CompactCatalogue;
const errors = validateCatalogue(catalogue);
if (errors.length) {
  console.error(`Card catalogue validation failed (${errors.length}):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${catalogue.cards.length.toLocaleString()} English exact-printing records across ${catalogue.sets.length} sets.`);
  const withImages = catalogue.cards.filter((card) => Boolean((card as { images?: unknown }).images)).length;
  console.log(`Images: ${withImages.toLocaleString()} with both sizes; ${(catalogue.cards.length - withImages).toLocaleString()} without images.`);
  console.log(`Source commit: ${catalogue.source.commit}`);
}
