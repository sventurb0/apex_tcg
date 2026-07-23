import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LimitlessParseError, parseLimitlessDeckPage } from "../../scripts/deck-sources/limitless-parser";

describe("Limitless source parser", () => {
  it("parses the checked-in semantic fixture with nested price markup", () => {
    const raw = JSON.parse(readFileSync("src/data/decks/corpus/raw/limitless-28249.json", "utf8")) as {
      snapshot: { accessedAt: string };
      semanticHtmlFixture: string;
    };
    const result = parseLimitlessDeckPage(
      raw.semanticHtmlFixture,
      "https://limitlesstcg.com/decks/list/28249",
      "28249",
      raw.snapshot.accessedAt,
    );
    expect(result.diagnostics.totalCards).toBe(60);
    expect(result.diagnostics.cardBlockCount).toBeGreaterThan(1);
    expect(result.snapshot.archetype).toBe("Lillie's Clefairy");
    expect(result.snapshot.rawNameCounts.some((row) => row.cardName === "Crispin" && row.quantity === 4)).toBe(true);
  });

  it("fails loudly when semantic rows disappear", () => {
    expect(() => parseLimitlessDeckPage(
      "<title>Changed</title><meta name=\"description\" content=\"Changed\">",
      "https://limitlesstcg.com/decks/list/fixture",
      "fixture",
      new Date(0).toISOString(),
    )).toThrowError(LimitlessParseError);
  });
});

