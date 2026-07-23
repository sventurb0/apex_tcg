import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PokemonCardCatalogue } from "../../src/data/pokemon/types";
import type { DeckCorpusDocument, DeckSourceSnapshot, NormalizedCorpusDeck } from "./types";
import { resolveSourceSnapshot } from "./resolve-printings";

/** Re-resolve checked-in source snapshots after behaviour families change.
 * This never contacts tournament sites; it is the safe local counterpart to
 * the development-time `decks:sync` fetch command.
 */
async function main(): Promise<void> {
  const catalogue = JSON.parse(await readFile(resolve("public/data/pokemon-cards.json"), "utf8")) as PokemonCardCatalogue;
  const rawDir = resolve("src/data/decks/corpus/raw");
  const files = (await readdir(rawDir)).filter((file) => file.endsWith(".json"));
  const decks: NormalizedCorpusDeck[] = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(resolve(rawDir, file), "utf8")) as { snapshot: DeckSourceSnapshot };
    decks.push(resolveSourceSnapshot(raw.snapshot, catalogue));
  }
  decks.sort((a, b) => a.id.localeCompare(b.id));
  const fingerprints = new Map<string, NormalizedCorpusDeck>();
  for (const deck of decks) {
    if (!deck.compositionFingerprint) continue;
    const canonical = fingerprints.get(deck.compositionFingerprint);
    if (!canonical) fingerprints.set(deck.compositionFingerprint, deck);
    else { deck.duplicateOf = canonical.id; canonical.sourceSnapshotIds.push(deck.id); }
  }
  const previous = JSON.parse(await readFile(resolve("src/data/decks/corpus/corpus.json"), "utf8")) as DeckCorpusDocument;
  const document: DeckCorpusDocument = { ...previous, generatedAt: new Date().toISOString(), decks };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  await mkdir(resolve("public/data"), { recursive: true });
  await writeFile(resolve("src/data/decks/corpus/corpus.json"), json, "utf8");
  await writeFile(resolve("public/data/meta-deck-corpus.json"), json, "utf8");
  for (const deck of decks) await writeFile(resolve("src/data/decks/corpus/normalized", `${deck.id}.json`), `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  console.log(`Rebuilt ${decks.length} checked-in snapshots; ${decks.filter((deck) => deck.simulationReady).length} simulation-ready.`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
