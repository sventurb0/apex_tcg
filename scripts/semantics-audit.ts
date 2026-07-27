import { readFileSync, writeFileSync } from "node:fs";
import { createCatalogueIndex } from "../src/data/pokemon/catalogue";
import { compileCardImplementation } from "../src/data/pokemon/implementations/effect-compiler";
import type { PokemonCardCatalogue, PokemonCardMetadata } from "../src/data/pokemon/types";
import { buildCardSemanticCoverage, type CardSemanticCoverage, type SemanticClause } from "../src/data/pokemon/semantic-coverage";
import { toRuntimeCardDefinition } from "../src/data/pokemon/runtime-adapter";
import type { DeckCorpusDocument } from "../src/data/decks/corpus/types";
import { isRegisteredEffectProgram } from "../engine/effects/program-registry";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const corpus = JSON.parse(readFileSync("src/data/decks/corpus/corpus.json", "utf8")) as DeckCorpusDocument;
const index = createCatalogueIndex(catalogue.cards);
const ids = [...new Set(corpus.decks.flatMap((deck) => deck.manifest?.entries.map((entry) => entry.cardId) ?? []))].sort();
const runnerSource = readFileSync("engine/effects/program-runner.ts", "utf8");
const programIds = new Set<string>();
for (const match of runnerSource.matchAll(/case\s+["']([^"']+)["']/g)) programIds.add(match[1]!);
for (const match of runnerSource.matchAll(/programId:\s*["']([^"']+)["']/g)) programIds.add(match[1]!);
for (const match of runnerSource.matchAll(/programId\s*===\s*["']([^"']+)["']/g)) programIds.add(match[1]!);

const reviewedAttackNames = new Set<string>();
const explicitEnergyHandlers = new Set(["energy:basic-grass", "energy:basic-fire", "energy:basic-water", "energy:basic-lightning", "energy:basic-psychic", "energy:basic-fighting", "energy:basic-darkness", "energy:basic-metal", "energy:prism", "energy:team-rocket", "energy:growing-grass", "energy:rocky-fighting", "energy:telepathic-psychic", "energy:mist", "energy:legacy", "energy:boomerang", "energy:enriching", "energy:ignition", "energy:neo-upper", "energy:spiky"]);
const knownProgram = (programId: string | undefined): boolean => Boolean(programId && (programIds.has(programId) || isRegisteredEffectProgram(programId)));

function addClause(coverage: CardSemanticCoverage, clause: SemanticClause): void {
  if (!coverage.unmatchedPrintedClauses.some((candidate) => candidate.id === clause.id || candidate.kind === clause.kind && candidate.text === clause.text)) coverage.unmatchedPrintedClauses.push(clause);
}

function semanticCoverage(card: PokemonCardMetadata): CardSemanticCoverage {
  const implementation = compileCardImplementation(card);
  const runtime = toRuntimeCardDefinition(card);
  const coverage = buildCardSemanticCoverage(card, runtime, implementation, programIds, reviewedAttackNames);
  const handler = implementation.handlers[0];
  const handlerId = handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : "";
  if (card.supertype === "Energy" && card.energyText?.trim() && !explicitEnergyHandlers.has(handlerId)) addClause(coverage, { id: `${card.id}:energy:generic-fallback`, kind: "energy", name: card.name, text: card.energyText });
  if (card.supertype === "Trainer" && card.trainerText?.trim() && runtime?.category === "trainer" && !knownProgram(runtime.effectProgramId)) addClause(coverage, { id: `${card.id}:trainer:missing-branch`, kind: "trainer", name: card.name, text: card.trainerText });
  if (card.supertype === "Pokémon" && runtime?.category === "pokemon") {
    for (const [index, printed] of (card.attacks ?? []).entries()) {
      const runtimeAttack = runtime.attacks[index];
      if (/[+×x]|\d+\s*[-–]/u.test(printed.damage) && runtimeAttack?.damage.kind !== "formula") addClause(coverage, { id: `${card.id}:attack:${index}:variable-damage`, kind: "attack", name: printed.name, text: printed.text || printed.damage });
      if (printed.text?.trim() && runtimeAttack?.effectProgramId && !knownProgram(runtimeAttack.effectProgramId) && !reviewedAttackNames.has(`${card.id}:${printed.name}`)) addClause(coverage, { id: `${card.id}:attack:${index}:unknown-program`, kind: "attack", name: printed.name, text: printed.text });
    }
  }
  coverage.complete = coverage.unmatchedPrintedClauses.length === 0 && coverage.orphanRuntimeHandlers.length === 0 && coverage.choiceSemantics !== "requires-review";
  return coverage;
}

const cards = ids.map((id) => index.byId.get(id)).filter((card): card is PokemonCardMetadata => Boolean(card));
// Include explicitly registered rule/modifier/template implementations in the
// executable set used by orphan-handler checks. Runner branches are discovered
// directly from source above; registry entries cover non-runner implementations.
for (const card of cards) {
  const runtime = toRuntimeCardDefinition(card);
  const handlers = runtime?.category === "pokemon"
    ? [...runtime.abilities.map((ability) => ability.effectProgramId), ...runtime.attacks.map((attack) => attack.effectProgramId)]
    : runtime?.category === "trainer" ? [runtime.effectProgramId] : runtime?.category === "energy" ? [runtime.effectProgramId] : [];
  for (const handler of handlers) if (handler && isRegisteredEffectProgram(handler)) programIds.add(handler);
}
const coverage = cards.map(semanticCoverage);
const byKind = (kind: SemanticClause["kind"]) => coverage.flatMap((card) => card.unmatchedPrintedClauses.filter((clause) => clause.kind === kind));
const report = {
  generatedAt: new Date().toISOString(),
  corpusDecks: corpus.decks.length,
  uniqueExactCardIds: cards.length,
  cards,
  coverage,
  summary: {
    completeCards: coverage.filter((card) => card.complete).length,
    falseCompleteCards: coverage.filter((card) => !card.complete && ["complete", "generated"].includes(compileCardImplementation(index.byId.get(card.cardId)! ).status)).length,
    unmatchedPrintedAbilities: byKind("ability").length,
    unmatchedAttackEffects: byKind("attack").length,
    unmatchedTrainerClauses: byKind("trainer").length,
    unmatchedSpecialEnergyClauses: byKind("energy").length,
    unknownEffectPrograms: coverage.reduce((sum, card) => sum + card.orphanRuntimeHandlers.length, 0),
    choiceRequiresReview: coverage.filter((card) => card.choiceSemantics === "requires-review").length,
  },
  affectedDecks: corpus.decks.filter((deck) => deck.manifest?.entries.some((entry) => coverage.find((card) => card.cardId === entry.cardId && !card.complete))).map((deck) => ({ sourceDeckId: deck.snapshot.sourceDeckId ?? deck.id, archetype: deck.snapshot.archetype })),
};
if (process.argv.includes("--write-json")) writeFileSync("public/data/corpus-semantic-audit.json", `${JSON.stringify(report, null, 2)}\n`);
if (process.argv.includes("--write-md")) {
  const lines = ["# Corpus semantic audit", "", `Generated: ${report.generatedAt}`, `Unique exact card IDs: ${report.uniqueExactCardIds}`, `Semantically complete cards: ${report.summary.completeCards}`, `False-complete cards: ${report.summary.falseCompleteCards}`, "", "## Clause summary", "", `- Unmatched Abilities: ${report.summary.unmatchedPrintedAbilities}`, `- Unmatched attack effects: ${report.summary.unmatchedAttackEffects}`, `- Unmatched Trainer clauses: ${report.summary.unmatchedTrainerClauses}`, `- Unmatched Special Energy clauses: ${report.summary.unmatchedSpecialEnergyClauses}`, `- Unknown effect programs: ${report.summary.unknownEffectPrograms}`, `- Choice reviews required: ${report.summary.choiceRequiresReview}`, "", "## Cards", "", "| Card | Status | Unmatched clauses | Orphan handlers | Choice |", "|---|---|---:|---:|---|"];
  for (const card of report.coverage) lines.push(`| ${card.cardId} | ${card.complete ? "complete" : "blocked"} | ${card.unmatchedPrintedClauses.length} | ${card.orphanRuntimeHandlers.length} | ${card.choiceSemantics} |`);
  lines.push("", "## Affected decks", "", ...report.affectedDecks.map((deck) => `- ${deck.sourceDeckId} — ${deck.archetype}`));
  writeFileSync("CORPUS_SEMANTIC_AUDIT.md", `${lines.join("\n")}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--fail") && (report.summary.unmatchedPrintedAbilities || report.summary.unmatchedAttackEffects || report.summary.unmatchedTrainerClauses || report.summary.unmatchedSpecialEnergyClauses || report.summary.unknownEffectPrograms || report.summary.choiceRequiresReview)) process.exitCode = 1;
