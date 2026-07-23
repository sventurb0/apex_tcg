import type { DeckManifest } from "../../data/decks/types";

export const SAVED_DECKS_STORAGE_KEY = "tcg-decklab.saved-decks.v2";

export function loadSavedDecks(): DeckManifest[] {
  try { return JSON.parse(localStorage.getItem(SAVED_DECKS_STORAGE_KEY) ?? "[]") as DeckManifest[]; } catch { return []; }
}

function persist(decks: DeckManifest[]): DeckManifest[] {
  localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(decks));
  window.dispatchEvent(new Event("tcg-decks-changed"));
  return decks;
}

export function saveDeck(deck: DeckManifest): DeckManifest[] {
  const now = new Date().toISOString();
  const saved: DeckManifest = { ...deck, source: "saved", createdAt: deck.createdAt ?? now, updatedAt: now };
  return persist([...loadSavedDecks().filter((candidate) => candidate.id !== deck.id), saved]);
}

export function deleteDeck(id: string): DeckManifest[] { return persist(loadSavedDecks().filter((deck) => deck.id !== id)); }

export function duplicateDeck(deck: DeckManifest): DeckManifest {
  const now = new Date().toISOString();
  const copy: DeckManifest = {
    ...structuredClone(deck), id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${deck.name} — Copy`, source: "saved", sourcePremadeId: deck.source === "premade" ? deck.id : deck.sourcePremadeId,
    favourite: false, createdAt: now, updatedAt: now,
  };
  saveDeck(copy);
  return copy;
}

export function createBlankDeck(): DeckManifest {
  const now = new Date().toISOString();
  return { id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "Untitled deck", description: "", format: "custom", entries: [], source: "saved", createdAt: now, updatedAt: now };
}
