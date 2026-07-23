import type { DeckDefinition } from "../../engine/model/decks";

export const fixtureDecks: DeckDefinition[] = [
  { id: "demo-cinder", name: "Fixture Cinder", description: "test only", available: true, entries: [{ cardId: "demo-001", count: 4 }, { cardId: "demo-002", count: 4 }, { cardId: "demo-003", count: 4 }, { cardId: "demo-e-fire", count: 24 }, { cardId: "demo-t-001", count: 4 }, { cardId: "demo-t-002", count: 4 }, { cardId: "demo-t-003", count: 4 }, { cardId: "demo-t-004", count: 4 }, { cardId: "demo-t-005", count: 4 }, { cardId: "demo-t-006", count: 4 }] },
  { id: "demo-brook", name: "Fixture Brook", description: "test only", available: true, entries: [{ cardId: "demo-011", count: 4 }, { cardId: "demo-012", count: 4 }, { cardId: "demo-013", count: 4 }, { cardId: "demo-e-water", count: 18 }, { cardId: "demo-e-lightning", count: 6 }, { cardId: "demo-t-001", count: 4 }, { cardId: "demo-t-002", count: 4 }, { cardId: "demo-t-003", count: 4 }, { cardId: "demo-t-004", count: 4 }, { cardId: "demo-t-005", count: 4 }, { cardId: "demo-t-006", count: 4 }] },
];

export function getFixtureDeck(id: string): DeckDefinition {
  const deck = fixtureDecks.find((candidate) => candidate.id === id);
  if (!deck) throw new Error(`Unknown fixture deck: ${id}`);
  return deck;
}
