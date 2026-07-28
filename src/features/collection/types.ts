import type { CardImplementation, PokemonCardMetadata } from "../../data/pokemon/types";

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
  catalogueCardId: string;
  canonicalBehaviourCardId: string;
  gameplayFamilyId: string;
  cardName: string;
  copies: number;
  implementationStatus: string;
  choiceSemantics: string;
  simulationReady: boolean;
  standardLegal: boolean;
  unknownPrograms: string[];
  requiresReviewChoices: string[];
  printedClauses: number;
  coveredClauses: number;
}

