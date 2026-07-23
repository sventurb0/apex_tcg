import type { PokemonCardMetadata, SimulationSupport } from "../../data/pokemon";

export type FormatProfile = "standard" | "expanded" | "custom" | "none";
export type DeckSection = "Pokémon" | "Trainer" | "Energy";

export interface ParsedDeckLine {
  lineNumber: number;
  raw: string;
  quantity: number;
  descriptor: string;
  section?: DeckSection;
}

export interface GameplayVariant {
  signature: string;
  recommended: PokemonCardMetadata;
  printings: PokemonCardMetadata[];
}

export interface ResolvedDeckLine extends ParsedDeckLine {
  status: "resolved";
  card: PokemonCardMetadata;
  equivalentPrintings: PokemonCardMetadata[];
}

export interface AmbiguousDeckLine extends ParsedDeckLine {
  status: "ambiguous";
  variants: GameplayVariant[];
}

export interface UnknownDeckLine extends ParsedDeckLine {
  status: "unknown";
  reason: string;
}

export type DeckLineResolution = ResolvedDeckLine | AmbiguousDeckLine | UnknownDeckLine;

export interface ImportIdentityReport {
  parsedLines: number;
  resolvedLines: number;
  unresolvedLines: number;
  ambiguousLines: number;
  resolvedCopies: number;
  parserErrors: string[];
  canSave: boolean;
}

export interface ImportConstructionReport {
  currentSize: number;
  targetSize: number;
  errors: string[];
  warnings: string[];
}

export interface ImportSimulationReport {
  counts: Record<SimulationSupport, number>;
  completeCardIds: string[];
  generatedCardIds: string[];
  partialCardIds: string[];
  unsupportedCardIds: string[];
  ready: boolean;
}

export interface DeckImportReport {
  lines: DeckLineResolution[];
  resolved: ResolvedDeckLine[];
  ambiguous: AmbiguousDeckLine[];
  unknown: UnknownDeckLine[];
  identity: ImportIdentityReport;
  construction: ImportConstructionReport;
  simulation: ImportSimulationReport;
  totalCards: number;
  canSave: boolean;
  canPlay: boolean;
  deckRuleErrors: string[];
  formatWarnings: string[];
  unsupportedCardIds: string[];
  partialCardIds: string[];
}
