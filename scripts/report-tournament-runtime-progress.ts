import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DeckCorpusDocument, NormalizedCorpusDeck } from "../src/data/decks/corpus/types";

const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const semanticAudit = existsSync("public/data/corpus-semantic-audit.json") ? JSON.parse(readFileSync("public/data/corpus-semantic-audit.json", "utf8")) as { coverage: Array<{ cardId: string; complete: boolean; unmatchedPrintedClauses: Array<{ kind: string; name: string }>; orphanRuntimeHandlers: Array<{ programId?: string }> }> } : undefined;
const semanticById = new Map((semanticAudit?.coverage ?? []).map((card) => [card.cardId, card]));
const smokePassed = process.argv.includes("--smoke-passed");
const deepPassed = process.argv.includes("--deep-passed");
const runtimeCount = (deck: NormalizedCorpusDeck): number => deck.manifest?.entries.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
const choiceReview = (deck: NormalizedCorpusDeck): "reviewed" | "pending" => deck.simulationReady && deck.missingBehaviourFamilyIds.length === 0 ? "reviewed" : "pending";
const focusedTests = (deck: NormalizedCorpusDeck): string[] => deck.manifest ? [`manifest:${deck.snapshot.sourceDeckId ?? deck.id}`] : [];

const rows = corpus.decks.map((deck) => {
  const semanticReady = deck.simulationReady && Boolean(deck.manifest?.entries.every((entry) => semanticById.get(entry.cardId)?.complete ?? false));
  return {
  sourceDeckId: deck.snapshot.sourceDeckId ?? deck.id,
  archetype: deck.snapshot.archetype,
  player: deck.snapshot.player ?? "Unknown",
  event: deck.snapshot.eventName ?? "Unknown",
  exactManifest: Boolean(deck.manifest) && runtimeCount(deck) === 60 && deck.unresolvedCopies === 0,
  missingBehaviourFamilies: deck.missingBehaviourFamilyIds,
  implementedFamilies: deck.resolutions.flatMap((resolution) => resolution.behaviourFamilyId ? [resolution.behaviourFamilyId] : []),
  choiceSemanticsReview: choiceReview(deck),
  runtimeCardCount: runtimeCount(deck),
  focusedTests: focusedTests(deck),
  smokeAcceptance: semanticReady ? (smokePassed ? "passed" : "pending") : "blocked",
  deepArchetypeAcceptance: semanticReady ? (deepPassed ? "passed" : "pending") : "blocked",
  humanPlayable: semanticReady,
  aiPlayable: semanticReady,
  simulationReady: semanticReady,
  supportCounts: deck.supportCounts,
  blockers: [...deck.blockers, ...((deck.manifest?.entries ?? []).flatMap((entry) => { const card = semanticById.get(entry.cardId); return card && !card.complete ? [`${entry.cardId}: semantic clauses unmatched (${card.unmatchedPrintedClauses.length}) or orphan handlers (${card.orphanRuntimeHandlers.length})`] : []; }))],
  };
});
const ready = rows.filter((row) => row.simulationReady).length;
const progress = { generatedAt: new Date().toISOString(), sourceDecks: rows.length, simulationReady: ready, blocked: rows.length - ready, decks: rows };
writeFileSync("public/data/tournament-runtime-progress.json", `${JSON.stringify(progress, null, 2)}\n`);
const markdown = ["# Tournament Runtime Progress", "", `Generated: ${progress.generatedAt}`, `Source decks: ${progress.sourceDecks}`, `Simulation-ready: ${progress.simulationReady}`, `Blocked: ${progress.blocked}`, "", "| Source | Archetype | Player | Runtime cards | Missing families | Choice review | Smoke | Deep | Human/AI |", "|---|---|---|---:|---:|---|---|---|---|"];
for (const row of rows) markdown.push(`| ${row.sourceDeckId} | ${row.archetype} | ${row.player} | ${row.runtimeCardCount}/60 | ${row.missingBehaviourFamilies.length} | ${row.choiceSemanticsReview} | ${row.smokeAcceptance} | ${row.deepArchetypeAcceptance} | ${row.humanPlayable && row.aiPlayable ? "ready" : "blocked"} |`);
writeFileSync("TOURNAMENT_RUNTIME_PROGRESS.md", `${markdown.join("\n")}\n`);
console.log(JSON.stringify({ sourceDecks: progress.sourceDecks, simulationReady: progress.simulationReady, blocked: progress.blocked }, null, 2));
