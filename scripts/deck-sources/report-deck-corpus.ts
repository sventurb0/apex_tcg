import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DeckCorpusDocument } from "./types";

function placement(value: number | undefined): string { return value === undefined ? "-" : String(value); }
async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(resolve("src/data/decks/corpus/corpus.json"), "utf8")) as DeckCorpusDocument;
  const unique = new Set(corpus.decks.map((deck) => deck.compositionFingerprint).filter(Boolean)).size;
  const events = [...new Set(corpus.decks.map((deck) => deck.snapshot.eventName).filter(Boolean))].sort();
  const archetypes = [...new Set(corpus.decks.map((deck) => deck.snapshot.archetype))].sort();
  const ready = corpus.decks.filter((deck) => deck.simulationReady);
  const exact = corpus.decks.reduce((sum, deck) => sum + deck.exactResolvedCopies, 0);
  const canonical = corpus.decks.reduce((sum, deck) => sum + deck.canonicalEquivalentCopies, 0);
  const unresolved = corpus.decks.reduce((sum, deck) => sum + deck.unresolvedCopies, 0);
  const rows = corpus.decks.map((deck) => `| ${deck.snapshot.archetype} | ${deck.snapshot.player ?? "-"} | ${deck.snapshot.eventName ?? "-"} | ${placement(deck.snapshot.placement)} | ${deck.exactResolvedCopies} | ${deck.canonicalEquivalentCopies} | ${deck.unresolvedCopies} | ${deck.simulationReady ? "ready" : `${deck.blockers.length} blockers`} | [source](${deck.snapshot.sourceUrl}) |`).join("\n");
  const blockers = corpus.decks.filter((deck) => !deck.simulationReady).map((deck) => `### ${deck.snapshot.archetype} — ${deck.snapshot.player ?? "unknown player"}\n\n${deck.blockers.length ? deck.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- No normalized 60-card manifest could be produced."}`).join("\n\n");
  const markdown = `# Meta Deck Corpus\n\nGenerated ${corpus.generatedAt}. These are composition-exact public snapshots. A canonical-equivalent printing is used only when gameplay identity is verified; it is not represented as the player's cosmetic printing. Tournament placement is provenance, not evidence of simulated strength.\n\n## Summary\n\n- Source snapshots: ${corpus.decks.length}\n- Unique resolved compositions: ${unique}\n- Events: ${events.length} (${events.join(", ") || "none"})\n- Archetypes: ${archetypes.length}\n- Simulation-ready source decks: ${ready.length}\n- Exact source printing copies resolved: ${exact}\n- Canonical-equivalent copies resolved: ${canonical}\n- Unresolved copies: ${unresolved}\n\n## Sources and status\n\n| Archetype | Player | Event | Place | Exact | Canonical | Unresolved | Simulation | Attribution |\n|---|---|---|---:|---:|---:|---:|---|---|\n${rows}\n\n## Exact blockers\n\n${blockers || "No blocked decks."}\n`;
  await writeFile(resolve("META_DECK_CORPUS.md"), markdown, "utf8");
  console.log(`Deck corpus report: ${corpus.decks.length} snapshots, ${unique} unique compositions, ${ready.length} simulation-ready, ${unresolved} unresolved copies.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });

