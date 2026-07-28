import type { OwnedCollectionDocument } from "./types";

export interface AllocatedDeckEntry { cardId: string; count: number; }
export interface DeckAllocation { deckId: string; entries: AllocatedDeckEntry[]; locked?: boolean; }
export interface AllocationIssue { cardId: string; required: number; owned: number; reserved: number; available: number; shortage: number; deckIds: string[]; }

/**
 * Aggregate the exact physical quantities required by a portfolio. The
 * collection importer already maps functional reprints to canonical behaviour
 * IDs, so equivalent printings can satisfy one gameplay slot while the source
 * product metadata remains available for UI allocation details.
 */
export function analyseAllocations(document: OwnedCollectionDocument, decks: readonly DeckAllocation[], basicEnergyInventory = document.basicEnergyInventory): AllocationIssue[] {
  const owned = new Map<string, number>();
  for (const entry of document.entries) owned.set(entry.canonicalBehaviourCardId, (owned.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
  const required = new Map<string, { count: number; deckIds: string[] }>();
  for (const deck of decks) for (const entry of deck.entries) {
    const current = required.get(entry.cardId) ?? { count: 0, deckIds: [] };
    current.count += entry.count;
    if (!current.deckIds.includes(deck.deckId)) current.deckIds.push(deck.deckId);
    required.set(entry.cardId, current);
  }
  return [...required.entries()].flatMap(([cardId, demand]) => {
    if (basicEnergyInventory === "unlimited" && /^sve-\d+$/.test(cardId)) return [];
    const available = owned.get(cardId) ?? 0;
    return [{ cardId, required: demand.count, owned: available, reserved: Math.min(available, demand.count), available: Math.max(0, available - demand.count), shortage: Math.max(0, demand.count - available), deckIds: demand.deckIds }];
  }).filter((issue) => issue.shortage > 0);
}

export function maximumCompatibleDeckSubset(document: OwnedCollectionDocument, decks: readonly DeckAllocation[]): { selected: DeckAllocation[]; rejected: DeckAllocation[]; conflicts: AllocationIssue[] } {
  const selected: DeckAllocation[] = [];
  const rejected: DeckAllocation[] = [];
  for (const deck of decks) {
    const candidate = [...selected, deck];
    if (analyseAllocations(document, candidate).length === 0) selected.push(deck);
    else rejected.push(deck);
  }
  return { selected, rejected, conflicts: analyseAllocations(document, selected) };
}
