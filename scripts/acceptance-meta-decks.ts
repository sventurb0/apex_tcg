import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckCorpusDocument, NormalizedCorpusDeck } from "../src/data/decks/corpus/types";

const mandatory = ["28249", "28236", "28250", "28251", "28252", "28254", "28257", "28262", "28266", "28405"];

function totalRows(deck: NormalizedCorpusDeck): number {
  return deck.resolutions.reduce((sum, row) => sum + row.quantity, 0);
}

async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(resolve("src/data/decks/corpus/corpus.json"), "utf8")) as DeckCorpusDocument;
  const errors: string[] = [];
  const sourceIds = new Set(corpus.decks.map((deck) => deck.snapshot.sourceDeckId).filter((id): id is string => Boolean(id)));
  for (const id of mandatory) if (!sourceIds.has(id)) errors.push(`mandatory source ${id} is missing`);
  for (const deck of corpus.decks) {
    if (totalRows(deck) !== 60) errors.push(`${deck.id}: resolution rows do not cover exactly 60 cards`);
    const manifestTotal = deck.manifest?.entries.reduce((sum, entry) => sum + entry.count, 0);
    if (deck.manifest && manifestTotal !== 60) errors.push(`${deck.id}: manifest is not exactly 60 cards`);
    if (deck.simulationReady && (!deck.manifest || deck.unresolvedCopies > 0 || deck.supportCounts.partial > 0 || deck.supportCounts.unsupported > 0)) {
      errors.push(`${deck.id}: simulation-ready claim has unresolved or non-executable cards`);
    }
  }
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  const ready = corpus.decks.filter((deck) => deck.simulationReady);
  const blocked = corpus.decks.filter((deck) => !deck.simulationReady);
  console.log(`Meta-deck acceptance: ${ready.length} simulation-ready source decks, ${blocked.length} blocked with explicit blockers.`);
  if (blocked.length) console.log(`First blockers: ${blocked.slice(0, 5).map((deck) => `${deck.snapshot.archetype} (${deck.missingBehaviourFamilyIds.length} families)`).join("; ")}`);
  console.log("Runtime game batches are intentionally executed only for decks that clear the exact behaviour gate; no source deck is reported ready by composition alone.");
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
