import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckCorpusDocument } from "./types";
import { MANDATORY_SOURCE_IDS } from "./corpus-config";

async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(resolve("src/data/decks/corpus/corpus.json"), "utf8")) as DeckCorpusDocument;
  const errors: string[] = [];
  if (corpus.version !== 1) errors.push(`Unsupported corpus version ${String(corpus.version)}.`);
  if (corpus.decks.length < 30) errors.push(`Corpus has ${corpus.decks.length} snapshots; at least 30 are required.`);
  const ids = new Set<string>();
  const sourceIds = new Set<string>();
  for (const deck of corpus.decks) {
    if (ids.has(deck.id)) errors.push(`${deck.id}: duplicate snapshot ID.`); ids.add(deck.id);
    if (deck.snapshot.sourceDeckId) sourceIds.add(deck.snapshot.sourceDeckId);
    const sourceTotal = deck.snapshot.rawNameCounts.reduce((sum, row) => sum + row.quantity, 0);
    const resolutionTotal = deck.resolutions.reduce((sum, row) => sum + row.quantity, 0);
    const manifestTotal = deck.manifest?.entries.reduce((sum, row) => sum + row.count, 0);
    if (sourceTotal !== 60) errors.push(`${deck.id}: source composition has ${sourceTotal} cards.`);
    if (resolutionTotal !== 60) errors.push(`${deck.id}: printing-resolution rows cover ${resolutionTotal} cards.`);
    if (deck.manifest && manifestTotal !== 60) errors.push(`${deck.id}: normalized manifest has ${manifestTotal} cards.`);
    if (!/^https:\/\/limitlesstcg\.com\/decks\/list\/\d+$/.test(deck.snapshot.sourceUrl)) errors.push(`${deck.id}: invalid or missing source URL.`);
    if (!deck.snapshot.accessedAt || !Number.isFinite(Date.parse(deck.snapshot.accessedAt))) errors.push(`${deck.id}: invalid accessedAt.`);
    if (!deck.snapshot.archetype || !deck.snapshot.sourceCards.length) errors.push(`${deck.id}: source provenance or card rows are incomplete.`);
    const accounted = deck.exactResolvedCopies + deck.canonicalEquivalentCopies + deck.unresolvedCopies;
    if (accounted !== 60) errors.push(`${deck.id}: resolution counters account for ${accounted} cards.`);
    if (deck.simulationReady && (!deck.manifest || deck.unresolvedCopies || deck.supportCounts.partial || deck.supportCounts.unsupported)) errors.push(`${deck.id}: simulation-ready claim violates exact runtime gate.`);
  }
  for (const mandatory of MANDATORY_SOURCE_IDS) if (!sourceIds.has(mandatory)) errors.push(`Mandatory Limitless snapshot ${mandatory} is missing.`);
  if (errors.length) { console.error(errors.map((error) => `- ${error}`).join("\n")); process.exitCode = 1; return; }
  const unique = new Set(corpus.decks.map((deck) => deck.compositionFingerprint).filter(Boolean)).size;
  console.log(`Deck corpus valid: ${corpus.decks.length} source snapshots, ${unique} unique resolved compositions, ${corpus.decks.filter((deck) => deck.simulationReady).length} simulation-ready.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });

