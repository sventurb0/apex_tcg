import type { DeckManifest } from "../../data/decks/types";
import { saveDeck } from "../deck-builder/storage";
import type { ArchitectCandidate, ArchitectRequest } from "./types";

export function candidateManifest(candidate: ArchitectCandidate, request: ArchitectRequest): DeckManifest { return { ...candidate.deck, architect: { seed: candidate.seed, selectedCardIds: request.favourites.map((favorite) => favorite.cardId), mode: request.mode, candidateScore: candidate.score.total, explanation: candidate.explanations } }; }
export function saveArchitectCandidate(candidate: ArchitectCandidate, request: ArchitectRequest): DeckManifest { const manifest = candidateManifest(candidate, request); saveDeck(manifest); return manifest; }
export function exportArchitectCandidate(candidate: ArchitectCandidate, request?: ArchitectRequest): string { return JSON.stringify(request ? candidateManifest(candidate, request) : candidate.deck, null, 2); }
