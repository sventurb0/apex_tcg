import type { CoveragePriorityEntry, CoverageSignature, CoverageSignatureIndex } from "./types";

function score(signature: CoverageSignature): { value: number; reasons: string[] } {
  const reasons: string[] = []; let value = 0;
  value += Math.min(40, signature.exactOccurrenceCount * 2); if (signature.exactOccurrenceCount > 1) reasons.push(`${signature.exactOccurrenceCount} exact occurrences share this family.`);
  value += Math.min(30, signature.cardNames.length * 3); if (signature.cardNames.length > 1) reasons.push(`Unlocks ${signature.cardNames.length} unique card names.`);
  value += Math.min(25, signature.standardLegalPrintings * 3); if (signature.standardLegalPrintings) reasons.push(`${signature.standardLegalPrintings} occurrences are Standard legal.`);
  value += signature.referencedByDecks.length * 18; if (signature.referencedByDecks.length) reasons.push(`Referenced by ${signature.referencedByDecks.join(", ")}.`);
  value += signature.favouriteNames.length * 25; if (signature.favouriteNames.length) reasons.push(`Blocks favourite Pokémon: ${signature.favouriteNames.join(", ")}.`);
  if (signature.proposedTemplate) { value += 20; reasons.push(`Matches proposed reviewed primitive ${signature.proposedTemplate}.`); }
  if (signature.kind === "trainer") { value += 12; reasons.push("Trainer families are broadly reusable across archetypes."); }
  value -= signature.complexity === "low" ? 0 : signature.complexity === "medium" ? 15 : 45;
  if (signature.complexity === "high") reasons.push("High timing, targeting, or state-interaction risk lowers priority.");
  return { value, reasons };
}

export function buildCoveragePlan(index: CoverageSignatureIndex): CoveragePriorityEntry[] {
  const signatures = [...index.abilities, ...index.attacks.filter((signature) => signature.normalizedText || !/^\d*$/.test(signature.printedDamage ?? "")), ...index.trainerEffects, ...index.energyEffects].filter((signature) => signature.support !== "complete");
  const entries = signatures.map((signature) => { const priority = score(signature); return { rank: 0, familyId: signature.id, kind: signature.kind, normalizedText: signature.normalizedText || `[printed damage ${signature.printedDamage || "none"}]`, exampleCards: signature.cardNames.slice(0, 5), printingCount: signature.exactOccurrenceCount, uniqueCardNames: signature.cardNames.length, functionalReprintsUnlocked: signature.functionalReprintCount, standardLegalPrintings: signature.standardLegalPrintings, strategicTags: signature.strategicTags, proposedTemplate: signature.proposedTemplate ?? `custom:${signature.kind}-family`, complexity: signature.complexity, expectedCardsUnlocked: signature.unsupportedCardIds.length, testsRequired: ["positive exact-card example", "near-match rejection", ...(signature.functionalReprintCount ? ["functional-reprint identity"] : []), ...(signature.normalizedText.includes("coin") ? ["deterministic RNG"] : []), ...(signature.normalizedText.includes("damage") ? ["KO checkpoint"] : [])], score: priority.value, reasons: priority.reasons } satisfies CoveragePriorityEntry; }).sort((a, b) => b.score - a.score || b.printingCount - a.printingCount || a.familyId.localeCompare(b.familyId));
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
