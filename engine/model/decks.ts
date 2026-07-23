import type { CardDefinition, CardId } from "./cards";

export interface DeckEntry {
  cardId: CardId;
  count: number;
}

export interface DeckDefinition {
  id: string;
  name: string;
  description: string;
  entries: DeckEntry[];
  available: boolean;
  requiredInformation?: string;
  primaryAttackerIds?: CardId[];
}

export interface DeckValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateDeck(deck: DeckDefinition, cards: ReadonlyMap<CardId, CardDefinition>): DeckValidationIssue[] {
  const issues: DeckValidationIssue[] = [];
  if (!deck.available) {
    issues.push({ severity: "warning", message: deck.requiredInformation ?? "Exact 60-card list and card definitions are required." });
    return issues;
  }
  const total = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total !== 60) issues.push({ severity: "error", message: `Deck contains ${total} cards; exactly 60 are required.` });
  const names = new Map<string, number>();
  let basics = 0;
  for (const entry of deck.entries) {
    const card = cards.get(entry.cardId);
    if (!card) {
      issues.push({ severity: "error", message: `Missing definition for ${entry.cardId}.` });
      continue;
    }
    if (card.category === "pokemon" && card.stage === "basic") basics += entry.count;
    names.set(card.name, (names.get(card.name) ?? 0) + entry.count);
    if (card.implementationStatus !== "complete") {
      issues.push({ severity: "warning", message: `${card.name} is ${card.implementationStatus}.` });
    }
    if (card.category === "pokemon" && card.evolvesFrom) {
      const hasBase = deck.entries.some((candidate) => cards.get(candidate.cardId)?.name === card.evolvesFrom);
      if (!hasBase) issues.push({ severity: "error", message: `${card.name} has no ${card.evolvesFrom} in the deck.` });
    }
  }
  for (const [name, count] of names) {
    const isBasicEnergy = deck.entries.some((entry) => {
      const card = cards.get(entry.cardId);
      return card?.name === name && card.category === "energy" && card.basic;
    });
    if (count > 4 && !isBasicEnergy) issues.push({ severity: "error", message: `${name} exceeds the four-card name limit.` });
  }
  if (basics === 0) issues.push({ severity: "error", message: "Deck must contain at least one Basic Pokémon." });
  return issues;
}
