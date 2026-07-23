import type { CardInstance } from "../../../engine/model/cards";

export interface HandCardGroup { cardId: string; instances: CardInstance[]; }

export function groupHandCards(hand: CardInstance[]): HandCardGroup[] {
  const groups = new Map<string, HandCardGroup>();
  for (const instance of hand) {
    const existing = groups.get(instance.cardId);
    if (existing) existing.instances.push(instance);
    else groups.set(instance.cardId, { cardId: instance.cardId, instances: [instance] });
  }
  return [...groups.values()];
}
