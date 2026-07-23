import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PokemonCardCatalogue } from "../../src/data/pokemon/types";
import type { DeckCorpusDocument, NormalizedCorpusDeck } from "./types";
import { CORPUS_SOURCES, limitlessDeckUrl } from "./corpus-config";
import { fetchLimitlessDeck } from "./limitless-client";
import { resolveSourceSnapshot } from "./resolve-printings";

const rawDirectory = resolve("src/data/decks/corpus/raw");
const normalizedDirectory = resolve("src/data/decks/corpus/normalized");
const corpusPath = resolve("src/data/decks/corpus/corpus.json");
const sourcePath = resolve("src/data/decks/corpus/sources.json");
const runtimePath = resolve("public/data/meta-deck-corpus.json");

function semanticFixture(html: string): string {
  const title = html.match(/<title[^>]*>[\s\S]*?<\/title>/i)?.[0];
  const description = (html.match(/<meta\b[^>]*>/gi) ?? []).find((tag) => /\bname=["']description["']/i.test(tag));
  const rows = (html.match(/<div\b[^>]*class=["'][^"']*decklist-card[^"']*["'][^>]*>[\s\S]*?<\/div>/gi) ?? []).filter((block) => (block.match(/\bclass=["']([^"']*)["']/i)?.[1] ?? "").split(/\s+/).includes("decklist-card"));
  if (!title || !description || rows.length === 0) throw new Error("Cannot preserve semantic source fixture: title, description, or exact decklist-card rows are missing.");
  return ["<!doctype html><html><head>", title, description, "</head><body>", ...rows, "</body></html>"].join("\n");
}

async function mapLimited<T, U>(items: readonly T[], limit: number, work: (item: T) => Promise<U>): Promise<U[]> {
  const output = new Array<U>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) { const index = cursor; cursor += 1; output[index] = await work(items[index]!); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function main(): Promise<void> {
  const catalogue = JSON.parse(await readFile(resolve("public/data/pokemon-cards.json"), "utf8")) as PokemonCardCatalogue;
  const accessedAt = new Date().toISOString();
  console.log(`Fetching ${CORPUS_SOURCES.length} public deck snapshots (development-time only)...`);
  const fetched = await mapLimited(CORPUS_SOURCES, 4, async (config) => {
    const url = limitlessDeckUrl(config.sourceDeckId);
    const result = await fetchLimitlessDeck(url, config.sourceDeckId, accessedAt);
    if (config.reviewedOverride?.player) result.parsed.snapshot.player = config.reviewedOverride.player;
    if (config.reviewedOverride?.notes) result.parsed.snapshot.notes = [...(result.parsed.snapshot.notes ?? []), ...config.reviewedOverride.notes];
    if (config.expected?.placement !== undefined && result.parsed.snapshot.placement !== config.expected.placement) throw new Error(`${config.sourceDeckId}: expected placement ${config.expected.placement}, parsed ${result.parsed.snapshot.placement ?? "none"}.`);
    if (config.expected?.player && result.parsed.snapshot.player !== config.expected.player) throw new Error(`${config.sourceDeckId}: expected player ${config.expected.player}, parsed ${result.parsed.snapshot.player ?? "none"}.`);
    console.log(`  ${config.sourceDeckId}: ${result.parsed.snapshot.archetype} · ${result.parsed.snapshot.player ?? "unknown player"} · 60 cards`);
    return { config, ...result };
  });

  // Nothing is written until every configured page fetched and parsed successfully.
  await Promise.all([mkdir(rawDirectory, { recursive: true }), mkdir(normalizedDirectory, { recursive: true }), mkdir(resolve("public/data"), { recursive: true })]);
  const decks = fetched.map(({ parsed }) => resolveSourceSnapshot(parsed.snapshot, catalogue));
  const canonicalByFingerprint = new Map<string, NormalizedCorpusDeck>();
  for (const deck of decks) {
    if (!deck.compositionFingerprint) continue;
    const canonical = canonicalByFingerprint.get(deck.compositionFingerprint);
    if (!canonical) canonicalByFingerprint.set(deck.compositionFingerprint, deck);
    else { deck.duplicateOf = canonical.id; canonical.sourceSnapshotIds.push(deck.snapshot.id); }
  }
  const document: DeckCorpusDocument = {
    version: 1,
    generatedAt: accessedAt,
    sourcePolicy: "Composition-exact public snapshots. Exact source printings are retained when present; canonical-equivalent choices require identical gameplay signatures.",
    decks,
  };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  await Promise.all([
    ...fetched.map(({ config, parsed, html }) => writeFile(resolve(rawDirectory, `limitless-${config.sourceDeckId}.json`), `${JSON.stringify({ snapshot: parsed.snapshot, diagnostics: parsed.diagnostics, semanticHtmlFixture: semanticFixture(html) }, null, 2)}\n`, "utf8")),
    ...decks.map((deck) => writeFile(resolve(normalizedDirectory, `${deck.id}.json`), `${JSON.stringify(deck, null, 2)}\n`, "utf8")),
    writeFile(sourcePath, `${JSON.stringify(fetched.map(({ parsed }) => parsed.snapshot), null, 2)}\n`, "utf8"),
    writeFile(corpusPath, json, "utf8"),
    writeFile(runtimePath, json, "utf8"),
  ]);
  const unique = new Set(decks.map((deck) => deck.compositionFingerprint).filter(Boolean)).size;
  const ready = decks.filter((deck) => deck.simulationReady).length;
  console.log(`Wrote ${decks.length} snapshots, ${unique} unique resolved compositions, ${ready} simulation-ready.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
