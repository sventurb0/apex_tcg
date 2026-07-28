import { readFileSync } from "node:fs";
import { isRegisteredEffectProgram } from "../../../engine/effects/program-registry";
import { compileCardImplementation, toRuntimeCardDefinition } from "../../data/pokemon";
import { buildCardSemanticCoverage, type SemanticClause } from "../../data/pokemon/semantic-coverage";
import type { PokemonCardMetadata } from "../../data/pokemon/types";
import type { OwnedCollectionDocument, OwnedCoverageRow } from "./types";

const runnerSource = readFileSync("engine/effects/program-runner.ts", "utf8");
const knownProgramIds = new Set<string>();
for (const match of runnerSource.matchAll(/case\s+["']([^"']+)["']/g)) knownProgramIds.add(match[1]!);
for (const match of runnerSource.matchAll(/programId(?:\s*[:=]|\s*===)\s*["']([^"']+)["']/g)) knownProgramIds.add(match[1]!);

// Basic Energy has no effect program and is deterministic by the rules. These
// are the only energy handlers allowed to be considered proven without a
// registered effect branch.
const explicitBasicEnergyHandlers = new Set([
  "energy:basic-grass", "energy:basic-fire", "energy:basic-water", "energy:basic-lightning",
  "energy:basic-psychic", "energy:basic-fighting", "energy:basic-darkness", "energy:basic-metal",
]);

function handlerId(implementation: ReturnType<typeof compileCardImplementation>): string {
  const handler = implementation.handlers[0];
  return handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : "";
}

function printedClauseCount(card: PokemonCardMetadata): number {
  const printed = buildCardSemanticCoverage(card, null, compileCardImplementation(card), knownProgramIds).printed;
  return printed.abilities.length + printed.attacks.length + printed.rules.length + printed.trainerClauses.length + printed.energyClauses.length;
}

function strictSemanticCoverage(card: PokemonCardMetadata) {
  const implementation = compileCardImplementation(card);
  const runtime = toRuntimeCardDefinition(card);
  const coverage = buildCardSemanticCoverage(card, runtime, implementation, knownProgramIds);
  const implementationHandler = handlerId(implementation);
  if (card.supertype === "Energy" && card.energyText?.trim() && !explicitBasicEnergyHandlers.has(implementationHandler)) {
    if (!coverage.unmatchedPrintedClauses.some((clause) => clause.kind === "energy")) coverage.unmatchedPrintedClauses.push({ id: `${card.id}:energy:unbound`, kind: "energy", name: card.name, text: card.energyText });
  }
  const unknownPrograms = [...new Set([
    ...coverage.orphanRuntimeHandlers.map((binding) => binding.programId).filter((id): id is string => Boolean(id)),
    ...(runtime ? [] : implementation.handlers.map((handler) => handler.kind === "custom" ? handler.handlerId : handler.effectId)),
  ].filter((id) => !knownProgramIds.has(id) && !isRegisteredEffectProgram(id)))];
  coverage.complete = implementation.status === "complete" || implementation.status === "generated"
    ? coverage.unmatchedPrintedClauses.length === 0 && coverage.orphanRuntimeHandlers.length === 0 && coverage.choiceSemantics !== "requires-review" && Boolean(runtime)
    : false;
  return { implementation, runtime, coverage, unknownPrograms };
}

export function buildOwnedCoverage(document: OwnedCollectionDocument): OwnedCoverageRow[] {
  const grouped = new Map<string, typeof document.entries>();
  for (const entry of document.entries) grouped.set(entry.catalogueCardId, [...(grouped.get(entry.catalogueCardId) ?? []), entry]);
  return [...grouped.entries()].map(([cardId, entries]) => {
    const entry = entries[0]!;
    const { implementation, runtime, coverage, unknownPrograms } = strictSemanticCoverage(entry.canonicalMetadata);
    const printedCount = printedClauseCount(entry.canonicalMetadata);
    const unmatchedClauses = coverage.unmatchedPrintedClauses as SemanticClause[];
    const executionProven = Math.max(0, printedCount - unmatchedClauses.length);
    const simulationReady = (implementation.status === "complete" || implementation.status === "generated")
      && unmatchedClauses.length === 0
      && unknownPrograms.length === 0
      && coverage.choiceSemantics !== "requires-review"
      && Boolean(runtime);
    return {
      ownedProductIds: [...new Set(entries.map((item) => item.ownedProductId))],
      catalogueCardId: cardId,
      canonicalBehaviourCardId: entry.canonicalBehaviourCardId,
      gameplayFamilyId: implementation.behaviourFamilyId ?? `owned:${cardId}`,
      cardName: entry.metadata.name,
      cardType: entry.metadata.supertype,
      copies: entries.reduce((sum, item) => sum + item.quantity, 0),
      implementationStatus: implementation.status,
      printedClauseCount: printedCount,
      executionProvenClauseCount: executionProven,
      unmatchedClauses,
      unknownPrograms,
      choiceSemantics: coverage.choiceSemantics,
      runtimeDefinitionAvailable: Boolean(runtime),
      simulationReady,
      standardLegal: entry.metadata.legalities.standard === "Legal",
      requiresReviewChoices: coverage.choiceSemantics === "requires-review" ? [cardId] : [],
      printedClauses: printedCount,
      coveredClauses: executionProven,
    } satisfies OwnedCoverageRow;
  }).sort((a, b) => a.cardName.localeCompare(b.cardName) || a.catalogueCardId.localeCompare(b.catalogueCardId));
}

export function ownedCoverageSummary(rows: OwnedCoverageRow[]) {
  const byStatus = (status: OwnedCoverageRow["implementationStatus"]) => rows.filter((row) => row.implementationStatus === status).length;
  const missingClauses = rows.flatMap((row) => row.unmatchedClauses);
  return {
    gameplayFamilies: new Set(rows.map((row) => row.gameplayFamilyId)).size,
    cards: rows.length,
    copies: rows.reduce((sum, row) => sum + row.copies, 0),
    unknownPrograms: rows.flatMap((row) => row.unknownPrograms).length,
    choiceWarnings: rows.flatMap((row) => row.requiresReviewChoices).length,
    simulationReady: rows.filter((row) => row.simulationReady).length,
    complete: byStatus("complete"),
    generated: byStatus("generated"),
    partial: byStatus("partial"),
    unsupported: byStatus("unsupported"),
    missingClauses: missingClauses.length,
    missingClauseDetails: missingClauses,
    falseReadyRows: rows.filter((row) => row.simulationReady && (row.unmatchedClauses.length || row.unknownPrograms.length || row.choiceSemantics === "requires-review" || !row.runtimeDefinitionAvailable || !["complete", "generated"].includes(row.implementationStatus))).map((row) => row.catalogueCardId),
  };
}
