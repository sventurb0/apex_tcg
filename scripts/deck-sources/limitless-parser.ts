import type { DeckSourceSnapshot, SourceCardLine } from "./types";

export class LimitlessParseError extends Error {
  constructor(message: string) { super(`Limitless deck parser: ${message}`); this.name = "LimitlessParseError"; }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;|&#039;/gi, "'")
    .replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function stripTags(value: string): string { return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }
function attribute(markup: string, name: string): string | undefined {
  const match = markup.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]!) : undefined;
}
function metaContent(html: string, name: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => attribute(candidate, "name")?.toLowerCase() === name.toLowerCase());
  return tag ? attribute(tag, "content") : undefined;
}
function firstText(block: string, className: string): string | undefined {
  const match = block.match(new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return match ? stripTags(match[1]!) : undefined;
}

/** Delimit rows by semantic decklist-card openings, not the first nested div. */
function semanticCardBlocks(html: string): string[] {
  const openings = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bdecklist-card\b[^"']*["'][^>]*>/gi)];
  return openings.map((match, index) => {
    const start = match.index ?? 0;
    const end = openings[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}
function isoDate(value: string): string | undefined {
  const match = value.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  if (!match) return undefined;
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  return `${match[3]}-${String(months.indexOf(match[2]!.toLowerCase()) + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

export interface ParsedLimitlessDeck {
  snapshot: DeckSourceSnapshot;
  diagnostics: { title: string; description: string; cardBlockCount: number; totalCards: number };
}

export function parseLimitlessDeckPage(html: string, sourceUrl: string, sourceDeckId: string, accessedAt: string): ParsedLimitlessDeck {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]!) : "";
  const description = metaContent(html, "description") ?? "";
  if (!title || !description) throw new LimitlessParseError(`missing semantic title or description for source deck ${sourceDeckId}; source HTML may have changed.`);

  const cards: SourceCardLine[] = [];
  const blocks = semanticCardBlocks(html);
  for (const block of blocks) {
    const openTag = block.match(/^<div\b[^>]*>/i)?.[0] ?? "";
    const quantityText = firstText(block, "card-count");
    const cardName = firstText(block, "card-name");
    const quantity = Number(quantityText);
    if (!cardName || !Number.isInteger(quantity) || quantity <= 0) throw new LimitlessParseError(`invalid semantic card row in source deck ${sourceDeckId}.`);
    cards.push({ quantity, cardName, setCode: attribute(openTag, "data-set"), collectorNumber: attribute(openTag, "data-number") });
  }
  if (!cards.length) throw new LimitlessParseError(`found no .decklist-card rows for source deck ${sourceDeckId}; source HTML may have changed.`);
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
  if (totalCards !== 60) throw new LimitlessParseError(`source deck ${sourceDeckId} contains ${totalCards} cards, expected exactly 60.`);

  const titlePrefix = title.split(/\s+by\s+/i)[0]?.trim() ?? "";
  const descriptionParts = description.split(/\s+-\s+/).map((part) => part.trim());
  const byMatch = descriptionParts[0]?.match(/^(.+?)\s+decklist\s+by\s+(.+)$/i);
  const placementPart = descriptionParts.find((part) => /\bPlace\b/i.test(part));
  const placement = placementPart ? Number(placementPart.match(/(\d+)(?:st|nd|rd|th)?\s+Place/i)?.[1]) : undefined;
  const eventName = placementPart?.replace(/^\d+(?:st|nd|rd|th)?\s+Place\s+/i, "").trim();
  const eventDate = isoDate(description);
  const archetype = byMatch?.[1]?.trim() || titlePrefix;
  const player = byMatch?.[2]?.trim();
  if (!archetype) throw new LimitlessParseError(`could not determine archetype for source deck ${sourceDeckId}.`);

  const snapshot: DeckSourceSnapshot = {
    id: `limitless-${sourceDeckId}`,
    source: "limitless",
    sourceUrl,
    sourceDeckId,
    eventName,
    eventDate,
    placement: Number.isFinite(placement) ? placement : undefined,
    player,
    format: "standard",
    archetype,
    accessedAt,
    rawNameCounts: cards.map(({ quantity, cardName }) => ({ quantity, cardName })),
    sourceCards: cards,
    resolvedManifestId: `corpus-limitless-${sourceDeckId}`,
    notes: ["Public tournament composition snapshot. Cosmetic printings may be canonicalized only when gameplay identity is verified."],
  };
  return { snapshot, diagnostics: { title, description, cardBlockCount: blocks.length, totalCards } };
}
