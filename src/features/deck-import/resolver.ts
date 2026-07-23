import {
  canonicalBasicEnergy, choosePreferredPrinting, compileCardImplementation, gameplaySignature,
  isCardNameMatch, normalizeCardName, normalizeCollectorNumber,
} from "../../data/pokemon";
import type { CatalogueIndex, PokemonCardMetadata, SimulationSupport } from "../../data/pokemon";
import { parseDeckList } from "./parser";
import type { AmbiguousDeckLine, DeckImportReport, DeckLineResolution, FormatProfile, GameplayVariant, ParsedDeckLine, ResolvedDeckLine } from "./types";

interface PrintingDescriptor { name: string; setAlias: string; collectorNumber: string; }

function printingDescriptor(descriptor: string, index: CatalogueIndex): PrintingDescriptor | undefined {
  const parenthesized = descriptor.match(/^(.+?)\s*\(\s*([^\s()]+)\s+([^\s()]+)\s*\)$/u);
  const plain = descriptor.match(/^(.+?)\s+([^\s()]+)\s+([^\s()]+)$/u);
  const match = parenthesized ?? plain;
  if (!match) return undefined;
  const setAlias = match[2]!.toLocaleLowerCase("en-US");
  if (!index.setAliases.has(setAlias)) return undefined;
  return { name: match[1]!.trim(), setAlias, collectorNumber: match[3]! };
}

export function groupGameplayVariants(candidates: readonly PokemonCardMetadata[]): GameplayVariant[] {
  const groups = new Map<string, PokemonCardMetadata[]>();
  for (const card of candidates) {
    const signature = gameplaySignature(card);
    groups.set(signature, [...(groups.get(signature) ?? []), card]);
  }
  return [...groups].map(([signature, printings]) => ({ signature, recommended: choosePreferredPrinting(printings), printings }))
    .sort((a, b) => a.recommended.name.localeCompare(b.recommended.name) || a.recommended.id.localeCompare(b.recommended.id));
}

function resolved(line: ParsedDeckLine, card: PokemonCardMetadata, equivalentPrintings: PokemonCardMetadata[] = [card]): ResolvedDeckLine {
  return { ...line, status: "resolved", card, equivalentPrintings };
}

function resolveNameOnly(line: ParsedDeckLine, candidates: PokemonCardMetadata[]): DeckLineResolution {
  const variants = groupGameplayVariants(candidates);
  if (variants.length === 1) return resolved(line, variants[0]!.recommended, variants[0]!.printings);
  return { ...line, status: "ambiguous", variants };
}

function applySelection(result: DeckLineResolution, selectedId: string | undefined, index: CatalogueIndex): DeckLineResolution {
  if (!selectedId) return result;
  const selected = index.byId.get(selectedId);
  if (!selected) return result;
  if (result.status === "resolved") {
    return result.equivalentPrintings.some((card) => card.id === selected.id) ? resolved(result, selected, result.equivalentPrintings) : result;
  }
  if (result.status === "ambiguous") {
    const variant = result.variants.find((candidate) => candidate.printings.some((card) => card.id === selected.id));
    return variant ? resolved(result, selected, variant.printings) : result;
  }
  return result;
}

export function resolveDeckLine(line: ParsedDeckLine, index: CatalogueIndex, selections: Readonly<Record<number, string>> = {}): DeckLineResolution {
  const basicEnergy = canonicalBasicEnergy(index, line.descriptor);
  if (basicEnergy) return resolved(line, basicEnergy);

  const completeNameCandidates = index.byName.get(normalizeCardName(line.descriptor)) ?? [];
  if (completeNameCandidates.length) return applySelection(resolveNameOnly(line, completeNameCandidates), selections[line.lineNumber], index);

  const printing = printingDescriptor(line.descriptor, index);
  if (printing) {
    const key = `${printing.setAlias}-${normalizeCollectorNumber(printing.collectorNumber)}`;
    const printings = index.byPrinting.get(key) ?? [];
    if (!printings.length) return { ...line, status: "unknown", reason: `No catalogue printing exists for ${printing.setAlias.toUpperCase()} ${printing.collectorNumber}.` };
    const matches = printings.filter((card) => isCardNameMatch(card, printing.name));
    if (!matches.length) {
      const actual = [...new Set(printings.map((card) => card.name))].join(" or ");
      return { ...line, status: "unknown", reason: `${printing.setAlias.toUpperCase()} ${normalizeCollectorNumber(printing.collectorNumber)} is ${actual}, not ${printing.name}.` };
    }
    const exact = choosePreferredPrinting(matches);
    return resolved(line, exact);
  }

  return { ...line, status: "unknown", reason: `No English card name or verified set/number printing matches “${line.descriptor}”.` };
}

function formatWarningsFor(cards: PokemonCardMetadata[], format: FormatProfile): string[] {
  if (format === "none" || format === "custom") return [];
  const key = format === "standard" ? "standard" : "expanded";
  return [...new Map(cards.filter((card) => card.legalities[key] !== "Legal").map((card) => [card.id, `${card.name} (${card.setCode} ${card.collectorNumber}) is not ${format} legal in the source dataset.`])).values()];
}

export function importDeckList(input: string, format: FormatProfile, index: CatalogueIndex, selections: Readonly<Record<number, string>> = {}): DeckImportReport {
  const parsed = parseDeckList(input);
  const lines = parsed.lines.map((line) => resolveDeckLine(line, index, selections));
  const resolvedLines = lines.filter((line): line is ResolvedDeckLine => line.status === "resolved");
  const ambiguous = lines.filter((line): line is AmbiguousDeckLine => line.status === "ambiguous");
  const unknown = lines.filter((line): line is Extract<DeckLineResolution, { status: "unknown" }> => line.status === "unknown");
  const totalCards = resolvedLines.reduce((sum, line) => sum + line.quantity, 0);
  const identityCanSave = parsed.errors.length === 0 && ambiguous.length === 0 && unknown.length === 0 && resolvedLines.length > 0;

  const constructionErrors: string[] = [];
  const constructionWarnings: string[] = [];
  if (totalCards !== 60) constructionWarnings.push(`Deck size is ${totalCards} / 60.`);
  const nameCounts = new Map<string, { display: string; count: number; basicEnergy: boolean }>();
  for (const line of resolvedLines) {
    const key = normalizeCardName(line.card.name);
    const current = nameCounts.get(key) ?? { display: line.card.name, count: 0, basicEnergy: line.card.supertype === "Energy" && line.card.subtypes.includes("Basic") };
    current.count += line.quantity; nameCounts.set(key, current);
  }
  for (const { display, count, basicEnergy } of nameCounts.values()) if (count > 4 && !basicEnergy) constructionErrors.push(`${display}: ${count} copies exceed the four-card same-name limit.`);
  if (!resolvedLines.some((line) => line.card.supertype === "Pokémon" && line.card.subtypes.includes("Basic"))) constructionErrors.push("Deck does not contain a Basic Pokémon.");
  const cards = resolvedLines.map((line) => line.card);
  for (const card of cards.filter((candidate) => candidate.supertype === "Pokémon" && candidate.evolvesFrom)) {
    if (!cards.some((candidate) => normalizeCardName(candidate.name) === normalizeCardName(card.evolvesFrom!))) constructionWarnings.push(`${card.name} evolves from ${card.evolvesFrom}, which is not present.`);
  }
  const formatWarnings = formatWarningsFor(cards, format);
  constructionWarnings.push(...formatWarnings);

  const counts: Record<SimulationSupport, number> = { complete: 0, generated: 0, partial: 0, unsupported: 0 };
  const statusIds: Record<SimulationSupport, Set<string>> = { complete: new Set(), generated: new Set(), partial: new Set(), unsupported: new Set() };
  for (const line of resolvedLines) {
    const status = compileCardImplementation(line.card).status;
    counts[status] += line.quantity; statusIds[status].add(line.card.id);
  }
  const simulation = {
    counts,
    completeCardIds: [...statusIds.complete], generatedCardIds: [...statusIds.generated],
    partialCardIds: [...statusIds.partial], unsupportedCardIds: [...statusIds.unsupported],
    ready: identityCanSave && counts.partial === 0 && counts.unsupported === 0,
  };
  const identity = { parsedLines: parsed.lines.length, resolvedLines: resolvedLines.length, unresolvedLines: unknown.length, ambiguousLines: ambiguous.length, resolvedCopies: totalCards, parserErrors: parsed.errors, canSave: identityCanSave };
  const construction = { currentSize: totalCards, targetSize: 60, errors: constructionErrors, warnings: constructionWarnings };
  const canPlay = identityCanSave && totalCards === 60 && constructionErrors.length === 0 && simulation.ready;
  return {
    lines, resolved: resolvedLines, ambiguous, unknown, identity, construction, simulation,
    totalCards, canSave: identityCanSave, canPlay,
    deckRuleErrors: constructionErrors, formatWarnings,
    unsupportedCardIds: simulation.unsupportedCardIds, partialCardIds: simulation.partialCardIds,
  };
}
