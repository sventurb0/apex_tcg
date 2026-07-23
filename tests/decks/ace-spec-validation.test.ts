import { describe, expect, it } from "vitest";
import { analyseDeck } from "../../src/features/deck-builder/validation";
import { okidogiIndex, okidogiManifest } from "../fixtures/okidogiRuntime";

describe("ACE SPEC category validation", () => {
  it("allows one total and rejects multiple copies by category", () => {
    expect(analyseDeck(okidogiManifest, okidogiIndex).issues.some((issue) => /ACE SPEC/.test(issue.message))).toBe(false);
    const invalid = { ...okidogiManifest, entries: okidogiManifest.entries.map((entry) => entry.cardId === "sv5-153" ? { ...entry, count: 2 } : entry) };
    expect(analyseDeck(invalid, okidogiIndex).issues).toContainEqual({ severity: "error", message: "Deck contains 2 ACE SPEC cards; only one ACE SPEC card is allowed in total." });
  });
});
