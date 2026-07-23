import type { PlayerId } from "./actions";

export type WinReason = "prizes" | "no-pokemon" | "deck-out";
export type UnresolvedReason = "action-limit" | "turn-limit" | "no-legal-action";

export interface GameResult {
  winnerId: PlayerId | null;
  loserId: PlayerId | null;
  reason: WinReason | UnresolvedReason;
  turns: number;
  seed: number;
  unresolved: boolean;
}
