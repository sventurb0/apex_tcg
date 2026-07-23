import type { CatalogueIndex } from "../../data/pokemon";
import { analyseDeck } from "../deck-builder/validation";
import type { ArchitectMode } from "./types";
import type { DeckManifest } from "../../data/decks/types";

export function validateArchitectCandidate(deck: DeckManifest, index: CatalogueIndex, mode: ArchitectMode) { const analysis = analyseDeck(deck, index); return { analysis, valid: analysis.total === 60 && !analysis.issues.some((issue) => issue.severity === "error") && (mode === "creative" || analysis.unsupported.length === 0) }; }
