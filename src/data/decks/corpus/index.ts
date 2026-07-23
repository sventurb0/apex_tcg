import corpusJson from "./corpus.json";
import type { DeckCorpusDocument, NormalizedCorpusDeck } from "./types";

export * from "./types";
export const deckCorpus = corpusJson as DeckCorpusDocument;
export const tournamentDecks: readonly NormalizedCorpusDeck[] = deckCorpus.decks;
export const tournamentDeckManifests = tournamentDecks.flatMap((deck) => deck.manifest ? [deck.manifest] : []);

