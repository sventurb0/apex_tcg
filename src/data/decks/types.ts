import type { FormatProfile } from "../../features/deck-import/types";

export interface DeckCardEntry { cardId: string; count: number; }
export interface DeckManifest {
  id: string;
  name: string;
  description: string;
  format: FormatProfile;
  entries: DeckCardEntry[];
  source: "premade" | "saved";
  favourite?: boolean;
  sourcePremadeId?: string;
  createdAt?: string;
  updatedAt?: string;
  architect?: { seed: number; selectedCardIds: string[]; mode: "simulation-ready" | "creative"; candidateScore: number; explanation: string[]; };
}

export interface PremadeSlot { id: string; name: string; status: "planned"; }
