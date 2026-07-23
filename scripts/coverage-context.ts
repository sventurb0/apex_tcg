import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckManifest } from "../src/data/decks/types";
import { buildCoverageSignatureIndex, buildFavouriteCoverage, createCatalogueIndex, type PokemonCardCatalogue } from "../src/data/pokemon";

export async function loadCoverageContext() {
  const catalogue = JSON.parse(await readFile(resolve("public/data/pokemon-cards.json"), "utf8")) as PokemonCardCatalogue;
  createCatalogueIndex(catalogue.cards);
  const files = ["skeledirge-armarouge.json", "okidogi-ex-poison.json", "team-rockets-nidoking.json"];
  const decks = await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve("src/data/decks/premade", file), "utf8")) as DeckManifest));
  const deckReferences = Object.fromEntries(decks.map((deck) => [deck.name, deck.entries.map((entry) => entry.cardId)]));
  const signatures = buildCoverageSignatureIndex(catalogue.cards, deckReferences);
  const favourites = buildFavouriteCoverage(catalogue.cards, signatures);
  return { catalogue, decks, deckReferences, signatures, favourites };
}
