import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckCorpusDocument } from "./types";

interface CoveragePriority { rank: number; familyId: string; sourceDecksBlocked: number; bestPlacement?: number; blockedCopies: number; exampleCards: string[]; score: number; reasons: string[]; }
async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(resolve("src/data/decks/corpus/corpus.json"), "utf8")) as DeckCorpusDocument;
  const grouped = new Map<string, { decks: Set<string>; placements: number[]; copies: number; cards: Set<string> }>();
  for (const deck of corpus.decks) for (const row of deck.resolutions.filter((item) => item.support === "partial" || item.support === "unsupported" || item.resolution === "unresolved")) {
    const familyId = row.behaviourFamilyId ?? (row.chosenCardId ? `unimplemented:${row.chosenCardId}` : `unresolved:${row.sourceCardName.toLowerCase()}`);
    const value = grouped.get(familyId) ?? { decks: new Set(), placements: [], copies: 0, cards: new Set() };
    value.decks.add(deck.id); value.copies += row.quantity; value.cards.add(row.chosenCardName ?? row.sourceCardName);
    if (deck.snapshot.placement !== undefined) value.placements.push(deck.snapshot.placement);
    grouped.set(familyId, value);
  }
  const entries: CoveragePriority[] = [...grouped].map(([familyId, value]) => {
    const bestPlacement = value.placements.length ? Math.min(...value.placements) : undefined;
    const score = value.decks.size * 100 + (bestPlacement ? Math.max(0, 65 - bestPlacement) * 3 : 0) + Math.min(50, value.copies * 2);
    return { rank: 0, familyId, sourceDecksBlocked: value.decks.size, bestPlacement, blockedCopies: value.copies, exampleCards: [...value.cards].sort(), score, reasons: [`Blocks ${value.decks.size} source deck snapshot(s).`, bestPlacement ? `Best blocked tournament placement: ${bestPlacement}.` : "No placement metadata.", `Appears in ${value.copies} blocked copies.`] };
  }).sort((a, b) => b.score - a.score || a.familyId.localeCompare(b.familyId)).map((entry, index) => ({ ...entry, rank: index + 1 }));
  await writeFile(resolve("public/data/deck-coverage-plan.json"), `${JSON.stringify({ generatedAt: corpus.generatedAt, entries }, null, 2)}\n`, "utf8");
  console.log(`Deck coverage plan: ${entries.length} missing or unresolved families. Top: ${entries.slice(0, 5).map((entry) => `${entry.familyId} (${entry.sourceDecksBlocked} decks)`).join(", ") || "none"}.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });

