import type { SimulationSupport } from "../types";
import type { StrategicTag } from "../ability-coverage";

export type CoverageEffectKind = "ability" | "attack" | "trainer" | "energy";
export type CoverageComplexity = "low" | "medium" | "high";
export type SignatureSupport = "complete" | "partial" | "unsupported";

export interface CoverageSignature {
  id: string;
  kind: CoverageEffectKind;
  displayName: string;
  normalizedText: string;
  printedDamage?: string;
  costShape?: string[];
  exactOccurrenceCount: number;
  cardIds: string[];
  cardNames: string[];
  functionalFamilyCount: number;
  functionalReprintCount: number;
  standardLegalPrintings: number;
  support: SignatureSupport;
  sourceStatuses: Partial<Record<SimulationSupport, number>>;
  completeCardIds: string[];
  unsupportedCardIds: string[];
  strategicTags: StrategicTag[];
  referencedByDecks: string[];
  favouriteNames: string[];
  complexity: CoverageComplexity;
  proposedTemplate?: string;
  implementedTemplateId?: string;
}

export interface CoverageSignatureIndex {
  abilities: CoverageSignature[];
  attacks: CoverageSignature[];
  trainerEffects: CoverageSignature[];
  energyEffects: CoverageSignature[];
}

export interface CoveragePriorityEntry {
  rank: number;
  familyId: string;
  kind: CoverageEffectKind;
  normalizedText: string;
  exampleCards: string[];
  printingCount: number;
  uniqueCardNames: number;
  functionalReprintsUnlocked: number;
  standardLegalPrintings: number;
  strategicTags: StrategicTag[];
  proposedTemplate: string;
  complexity: CoverageComplexity;
  expectedCardsUnlocked: number;
  testsRequired: string[];
  score: number;
  reasons: string[];
}

export interface FavouriteCoverageRow {
  name: string;
  exactPrintings: number;
  gameplayVariants: number;
  functionalInheritedPrintings: number;
  safelyGeneratedPrintings: number;
  completePrintings: number;
  partialPrintings: number;
  unsupportedPrintings: number;
  missingAbilityFamilies: string[];
  missingAttackFamilies: string[];
  bestSimulationReadyCardId?: string;
  bestCreativeCardId?: string;
  estimatedImplementationEffort: CoverageComplexity | "complete" | "unavailable";
  synergyPackages: string[];
}

export interface CoverageReport {
  generatedAt: string;
  totalExactPrintings: number;
  explicitCompletePrintings: number;
  functionalInheritedCompletePrintings: number;
  reviewedTemplateCompletePrintings: number;
  safelyGeneratedPrintings: number;
  totalSimulationReadyPrintings: number;
  partialPrintings: number;
  unsupportedPrintings: number;
  behaviourFamilies: number;
  signatures: Record<CoverageEffectKind, { total: number; complete: number; partial: number; unsupported: number }>;
  favouritePokemonWithSimulationReadyVariant: number;
  favouritePokemonFullyUnsupported: number;
  commonExecutableTrainerFamilies: number;
}
