import { gameplaySignature } from "../catalogue";
import type { BehaviourFamily, CardImplementation, ImplementationResolver, PokemonCardMetadata } from "../types";
import { cardImplementationRegistry } from "./registry";
import { compileSafeGeneratedImplementation } from "./safe-compiler";

function stableHash(value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function handlerId(implementation: CardImplementation): string { const handler = implementation.handlers[0]; return handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : ""; }

export function createImplementationResolver(cards: readonly PokemonCardMetadata[]): ImplementationResolver {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const bySignature = new Map<string, PokemonCardMetadata[]>();
  for (const card of cards) { const signature = gameplaySignature(card); bySignature.set(signature, [...(bySignature.get(signature) ?? []), card]); }
  const explicitOrder = new Map(Object.keys(cardImplementationRegistry).map((id, index) => [id, index]));
  const familyByCardId = new Map<string, BehaviourFamily>();
  const allFamilies: BehaviourFamily[] = [];
  for (const [signature, members] of bySignature) {
    const explicitMembers = members.filter((card) => cardImplementationRegistry[card.id]?.status === "complete" && cardImplementationRegistry[card.id]?.allowFunctionalInheritance !== true).sort((a, b) => (explicitOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (explicitOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
    const generated = explicitMembers.length ? undefined : compileSafeGeneratedImplementation(members[0]!);
    const familyEligible = generated?.status === "generated" || generated?.status === "complete" && generated.implementationSource === "reviewed-template";
    const canonical = explicitMembers[0] ?? (familyEligible ? [...members].sort((a, b) => a.id.localeCompare(b.id))[0] : undefined);
    const canonicalImplementation = canonical ? cardImplementationRegistry[canonical.id] ?? generated : undefined;
    const resolvedHandler = canonicalImplementation ? handlerId(canonicalImplementation) : "";
    if (!canonical || !canonicalImplementation || !resolvedHandler) continue;
    const family: BehaviourFamily = { id: `behaviour:${stableHash(signature)}`, gameplaySignature: signature, canonicalCardId: canonical.id, handlerId: resolvedHandler, memberCardIds: members.map((card) => card.id).sort(), source: explicitMembers.length ? "explicit" : generated?.implementationSource === "reviewed-template" ? "template" : "generated" };
    allFamilies.push(family); for (const member of members) familyByCardId.set(member.id, family);
  }
  const resolve = (card: PokemonCardMetadata): CardImplementation => {
    const exact = cardImplementationRegistry[card.id]; const family = familyByCardId.get(card.id);
    if (exact && exact.allowFunctionalInheritance !== true) return { ...exact, implementationSource: exact.status === "complete" ? "explicit" : exact.status, canonicalCardId: family?.canonicalCardId ?? card.id, behaviourFamilyId: family?.id, equivalentPrintingCount: family?.memberCardIds.length ?? 1 };
    if (family?.source === "explicit") { const canonical = cardImplementationRegistry[family.canonicalCardId]!; return { ...canonical, cardId: card.id, implementationSource: card.id === family.canonicalCardId ? "explicit" : "functional-reprint", canonicalCardId: family.canonicalCardId, behaviourFamilyId: family.id, equivalentPrintingCount: family.memberCardIds.length }; }
    if (family?.source === "template") { const canonicalCard = byId.get(family.canonicalCardId)!; const canonical = compileSafeGeneratedImplementation(canonicalCard); return { ...canonical, cardId: card.id, implementationSource: card.id === family.canonicalCardId ? "reviewed-template" : "functional-reprint", canonicalCardId: family.canonicalCardId, behaviourFamilyId: family.id, equivalentPrintingCount: family.memberCardIds.length }; }
    const safe = compileSafeGeneratedImplementation(card);
    return { ...safe, canonicalCardId: family?.canonicalCardId, behaviourFamilyId: family?.id, equivalentPrintingCount: family?.memberCardIds.length ?? 1 };
  };
  return { resolve, familyFor: (cardId) => familyByCardId.get(cardId), equivalentsFor: (cardId) => { const card = byId.get(cardId); return card ? [...(bySignature.get(gameplaySignature(card)) ?? [])] : []; }, families: () => [...allFamilies].sort((a, b) => a.id.localeCompare(b.id)) };
}
