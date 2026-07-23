import type { DeckSection, ParsedDeckLine } from "./types";

const headingPattern = /^(pok[eé]mon|trainers?|energy|energies)(?:\s*\(\s*\d+\s*\)|\s*:\s*\d+|\s*:)?$/iu;

function sectionForHeading(value: string): DeckSection | undefined {
  const match = value.match(headingPattern);
  if (!match) return undefined;
  const heading = match[1]!.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US");
  if (heading.startsWith("pokemon")) return "Pokémon";
  if (heading.startsWith("trainer")) return "Trainer";
  return "Energy";
}

export interface ParsedDeckList {
  lines: ParsedDeckLine[];
  errors: string[];
}

export function parseDeckList(input: string): ParsedDeckList {
  const lines: ParsedDeckLine[] = [];
  const errors: string[] = [];
  let section: DeckSection | undefined;
  input.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const nextSection = sectionForHeading(trimmed);
    if (nextSection) { section = nextSection; return; }
    const match = trimmed.match(/^(\d+)\s*[x×]?\s+(.+)$/iu);
    if (!match) {
      errors.push(`Line ${index + 1} (${JSON.stringify(raw)}): expected a positive quantity followed by a card descriptor.`);
      return;
    }
    const quantity = Number(match[1]);
    const descriptor = match[2]!.trim();
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.push(`Line ${index + 1} (${JSON.stringify(raw)}): quantity must be a positive integer.`);
      return;
    }
    if (!descriptor) {
      errors.push(`Line ${index + 1} (${JSON.stringify(raw)}): card descriptor is empty.`);
      return;
    }
    lines.push({ lineNumber: index + 1, raw, quantity, descriptor, ...(section ? { section } : {}) });
  });
  return { lines, errors };
}
