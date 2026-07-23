import type { DeckManifest } from "../decks/types";
import type { CatalogueIndex } from "./catalogue";
import { isApprovedCardImageUrl } from "./card-image-urls";

const prefetched = new Set<string>();

export function prefetchDeckCardImages(index: CatalogueIndex, decks: readonly DeckManifest[]): void {
  if (typeof Image === "undefined") return;
  for (const cardId of new Set(decks.flatMap((deck) => deck.entries.map((entry) => entry.cardId)))) { const url = index.byId.get(cardId)?.images?.small; if (!isApprovedCardImageUrl(url) || prefetched.has(url)) continue; prefetched.add(url); const image = new Image(); image.decoding = "async"; image.fetchPriority = "low"; image.referrerPolicy = "no-referrer"; image.src = url; }
}
