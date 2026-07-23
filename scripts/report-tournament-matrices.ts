import { readFileSync, writeFileSync } from "node:fs";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { compileCardImplementation, createCatalogueIndex, type PokemonCardCatalogue } from "../src/data/pokemon";

const targets: Record<string, string> = { ROCKET_MEWTWO: "28351", DRAGAPULT: "28271", NS_ZOROARK: "28274", HYDRAPPLE: "28269", OGERPON_BOX: "28263" };
const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const index = createCatalogueIndex(catalogue.cards);
for (const [name, sourceId] of Object.entries(targets)) {
  const deck = corpus.decks.find((item) => item.snapshot.sourceDeckId === sourceId);
  if (!deck?.manifest) continue;
  const rows = deck.manifest.entries.map((entry) => {
    const card = index.byId.get(entry.cardId);
    const implementation = card ? compileCardImplementation(card) : undefined;
    const text = card?.supertype === "Pokémon" ? [...(card.abilities ?? []).map((item) => `Ability ${item.name}: ${item.text}`), ...(card.attacks ?? []).map((item) => `Attack ${item.name}: ${item.text || item.damage}`)].join(" ") : card?.trainerText ?? card?.name ?? entry.cardId;
    return `| ${entry.cardId} | ${entry.count} | ${text.replace(/\|/g, "\\|")} | ${implementation?.handlers.map((handler) => handler.kind === "custom" ? handler.handlerId : handler.effectId).join(", ") || "blocked"} | ${implementation?.behaviourFamilyId ?? "-"} | ${implementation?.status ?? "unsupported"} | ${implementation?.tests.join(", ") || "-"} |`;
  }).join("\n");
  writeFileSync(`${name}_IMPLEMENTATION_MATRIX.md`, `# ${name} implementation matrix\n\nSource: ${deck.snapshot.sourceUrl}. This matrix is generated from the exact resolved manifest; a deck is promoted only when every row is executable and its runtime acceptance batch passes.\n\n| Card ID | Count | Printed text | Handler | Behaviour family | Status | Tests |\n|---|---:|---|---|---|---|---|\n${rows}\n`, "utf8");
}
console.log(`Wrote ${Object.keys(targets).length} tournament implementation matrices.`);
