import { readFileSync } from "node:fs";
import { createCatalogueIndex, type PokemonCardCatalogue } from "../../src/data/pokemon";

export const testCatalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const testCatalogueIndex = createCatalogueIndex(testCatalogue.cards);
