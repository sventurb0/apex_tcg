import type { DeckManifest } from "../types";
import type { SimulationSupport } from "../../pokemon/types";

export type DeckSourceKind = "limitless" | "official" | "manual-reviewed";
export type PrintingResolutionKind = "exact" | "canonical-equivalent" | "unresolved";

export interface SourceCardLine {
  quantity: number;
  cardName: string;
  setCode?: string;
  collectorNumber?: string;
}

export interface DeckSourceSnapshot {
  id: string;
  source: DeckSourceKind;
  sourceUrl: string;
  sourceDeckId?: string;
  eventName?: string;
  eventDate?: string;
  placement?: number;
  player?: string;
  format?: string;
  archetype: string;
  accessedAt: string;
  rawNameCounts: Array<{ quantity: number; cardName: string }>;
  sourceCards: SourceCardLine[];
  resolvedManifestId?: string;
  notes?: string[];
}

export interface DeckPrintingResolution {
  quantity: number;
  sourceCardName: string;
  sourceSetCode?: string;
  sourceCollectorNumber?: string;
  chosenCardId?: string;
  chosenCardName?: string;
  behaviourFamilyId?: string;
  resolution: PrintingResolutionKind;
  reason: string;
  support?: SimulationSupport;
}

export interface CorpusDeckTags {
  energyTypes: string[];
  strategic: Array<"aggressive" | "control" | "setup" | "toolbox">;
  prizeProfile: "single-prize" | "mixed" | "multi-prize";
}

export interface NormalizedCorpusDeck {
  id: string;
  snapshot: DeckSourceSnapshot;
  manifest?: DeckManifest;
  resolutions: DeckPrintingResolution[];
  compositionFingerprint?: string;
  duplicateOf?: string;
  sourceSnapshotIds: string[];
  exactResolvedCopies: number;
  canonicalEquivalentCopies: number;
  unresolvedCopies: number;
  simulationReady: boolean;
  supportCounts: Record<SimulationSupport, number>;
  missingBehaviourFamilyIds: string[];
  blockers: string[];
  tags: CorpusDeckTags;
}

export interface DeckCorpusDocument {
  version: 1;
  generatedAt: string;
  sourcePolicy: string;
  decks: NormalizedCorpusDeck[];
}

