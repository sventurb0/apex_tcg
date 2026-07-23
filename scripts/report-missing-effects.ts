import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileCardImplementation } from "../src/data/pokemon/implementations/effect-compiler";
import type { PokemonCardCatalogue } from "../src/data/pokemon/types";
import type { DeckManifest } from "../src/data/decks/types";

const catalogue = JSON.parse(await readFile(resolve("public/data/pokemon-cards.json"), "utf8")) as PokemonCardCatalogue;
const decks = await Promise.all(["skeledirge-armarouge.json", "okidogi-ex-poison.json", "team-rockets-nidoking.json"].map(async (file) => JSON.parse(await readFile(resolve("src/data/decks/premade", file), "utf8")) as DeckManifest));
const byId = new Map(catalogue.cards.map((card) => [card.id, card]));

console.log("Pokémon TCG premade simulation-support report");
console.log(`Catalogue records: ${catalogue.cards.length.toLocaleString()}`);
const catalogueSupport = catalogue.cards.reduce<Record<string, number>>((counts, card) => {
  const status = compileCardImplementation(card).status;
  counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}, {});
console.log(`Catalogue simulation support: complete ${catalogueSupport.complete ?? 0}; generated ${catalogueSupport.generated ?? 0}; partial ${catalogueSupport.partial ?? 0}; unsupported ${catalogueSupport.unsupported ?? 0}`);
for (const deck of decks) {
  const total = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
  const missingRecords = deck.entries.filter((entry) => !byId.has(entry.cardId));
  const rows = deck.entries.flatMap((entry) => { const card = byId.get(entry.cardId); return card ? [{ entry, card, implementation: compileCardImplementation(card) }] : []; });
  const ready = rows.filter((row) => ["complete", "generated"].includes(row.implementation.status));
  const incomplete = rows.filter((row) => !["complete", "generated"].includes(row.implementation.status));
  console.log(`\n${deck.name}`);
  console.log(`Cards: ${total}; unique printings: ${deck.entries.length}; resolved: ${deck.entries.length - missingRecords.length}`);
  console.log(`Simulation-supported printings: ${ready.length}; requiring implementation: ${incomplete.length}; simulation-ready: ${missingRecords.length === 0 && incomplete.length === 0 ? "yes" : "no"}`);
  for (const row of incomplete) console.log(`- ${row.card.id} | ${row.card.name} | ${row.implementation.status} | ${row.implementation.knownLimitations.join(" / ")}`);
  for (const entry of missingRecords) console.log(`- ${entry.cardId} | MISSING CATALOGUE RECORD`);
}
