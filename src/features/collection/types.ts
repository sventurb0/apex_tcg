import type { CardImplementation, PokemonCardMetadata } from "../../data/pokemon/types";
import type { SemanticClause } from "../../data/pokemon/semantic-coverage";

export type CollectionResolutionType = "exact" | "set-id-alias" | "functional-reprint-alias";
export type BasicEnergyInventory = "unlimited" | "exact";

export interface OwnedCardEntry {
  ownedProductId: string;
  catalogueCardId: string;
  canonicalBehaviourCardId: string;
  resolutionType: CollectionResolutionType;
  productName: string;
  setName: string;
  sourceSetId: string;
  cardNumber: string;
  material: string;
  rarity: string;
  condition: string;
  quantity: number;
  pricePerUnit: string;
  totalCost: string;
  sourceRow: number;
  metadata: PokemonCardMetadata;
  canonicalMetadata: PokemonCardMetadata;
  implementation: CardImplementation;
}

export interface CollectionDiagnostics {
  csvRows: number;
  physicalCopies: number;
  distinctOwnedProducts: number;
  distinctCatalogueCardIds: number;
  distinctCardNames: number;
  unresolvedRows: number;
  invalidRows: Array<{ sourceRow: number; reason: string }>;
  resolutionBreakdown: Record<CollectionResolutionType, number>;
}

export interface OwnedCollectionDocument {
  version: 1;
  generatedAt: string;
  sourceFile: string;
  basicEnergyInventory: BasicEnergyInventory;
  basicEnergyAssumption: string;
  entries: OwnedCardEntry[];
  diagnostics: CollectionDiagnostics;
}

export interface OwnedCoverageRow {
  ownedProductIds: string[];
  catalogueCardId: string;
  canonicalBehaviourCardId: string;
  gameplayFamilyId: string;
  cardName: string;
  cardType: "Pokémon" | "Trainer" | "Energy";
  copies: number;
  implementationStatus: "complete" | "generated" | "partial" | "unsupported";
  printedClauseCount: number;
  executionProvenClauseCount: number;
  unmatchedClauses: SemanticClause[];
  unknownPrograms: string[];
  choiceSemantics: "exact" | "deterministic-no-choice" | "requires-review";
  runtimeDefinitionAvailable: boolean;
  simulationReady: boolean;
  standardLegal: boolean;
  requiresReviewChoices: string[];
  // Legacy aliases retained for the existing Collection route/report readers.
  printedClauses: number;
  coveredClauses: number;
}
