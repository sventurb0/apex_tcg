import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runBatch } from "../../engine/simulation/batch-runner";
import type { CardDefinition } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";
import type { DeckManifest } from "../../src/data/decks/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../../src/data/pokemon";

describe("Academy at Night repetition protection", () => {
  it("resolves the reviewed Slowking corpus matchup instead of reaching a turn limit", () => {
    const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
    const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as { decks: Array<{ snapshot: { sourceDeckId?: string }; manifest?: DeckManifest }> };
    const slowking = corpus.decks.find((deck) => deck.snapshot.sourceDeckId === "28265")!.manifest!;
    const opponent = JSON.parse(readFileSync("src/data/decks/premade/okidogi-ex-poison.json", "utf8"));
    const index = createCatalogueIndex(catalogue.cards); const ids = [...new Set([...slowking.entries, ...opponent.entries].map((entry: { cardId: string }) => entry.cardId))];
    const cards = ids.map((id) => toRuntimeCardDefinition(index.byId.get(id)!)).filter((card): card is CardDefinition => Boolean(card));
    const runtime = (deck: DeckManifest): DeckDefinition => ({ id: deck.id, name: deck.name, description: deck.description, entries: deck.entries, available: true });
    const result = runBatch({ games: 1, baseSeed: 3188917038, subjectDeck: runtime(slowking), opponentDeck: runtime(opponent), cards, agentType: "heuristic", firstPlayerPolicy: "alternate" });
    expect(result.games[0]?.result.unresolved).toBe(false);
    expect(result.games[0]?.result.reason).not.toBe("turn-limit");
  });
});
