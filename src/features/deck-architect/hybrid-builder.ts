import { compileCardImplementation, implementationResolver, normalizeCardName, type CatalogueIndex } from "../../data/pokemon";
import type { DeckManifest } from "../../data/decks/types";
import { analyseDeck } from "../deck-builder/validation";
import { buildSynergyGraph } from "./synergy-graph";
import { buildArchitectKnowledgeBase } from "./knowledge-base";
import { packageById } from "./packages";
import { constructEnergyPlan } from "./energy-planner";
import { constructTrainerPlan } from "./trainer-plan";
import { scoreCandidate } from "./role-analysis";
import type { ArchitectCandidate, ArchitectRequest } from "./types";
import type { EngineDefinition } from "./engines/types";

function add(counts: Map<string, number>, id: string, amount: number): void { if (amount > 0) counts.set(id, (counts.get(id) ?? 0) + amount); }
function remove(counts: Map<string, number>, id: string, amount: number): void { const next = (counts.get(id) ?? 0) - amount; if (next > 0) counts.set(id, next); else counts.delete(id); }
function total(counts: Map<string, number>): number { return [...counts.values()].reduce((sum, count) => sum + count, 0); }
function enginesFor(request: ArchitectRequest, index: CatalogueIndex) {
  const knowledge = buildArchitectKnowledgeBase(index); const selected = request.favourites.map((favorite) => favorite.cardId);
  return [...knowledge.engineDefinitions.values()].map((engine) => ({ engine, score: selected.reduce((sum, id) => sum + (engine.coreCardIds.includes(id) ? 100 : engine.coreCardIds.some((core) => implementationResolver()?.familyFor(core)?.id === implementationResolver()?.familyFor(id)?.id) ? 20 : 0), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.engine.id.localeCompare(b.engine.id));
}
function evolution(counts: Map<string, number>, cardId: string, index: CatalogueIndex, protectedIds: Set<string>): void {
  let card = index.byId.get(cardId); if (!card || card.supertype !== "Pokémon") return;
  add(counts, card.id, card.subtypes.includes("Basic") ? 3 : card.subtypes.includes("Stage 2") ? 2 : 2); protectedIds.add(card.id);
  let name = card.evolvesFrom;
  while (name) { const prior = index.byName.get(normalizeCardName(name))?.find((candidate) => ["complete", "generated"].includes(compileCardImplementation(candidate).status)); if (!prior) break; add(counts, prior.id, prior.subtypes.includes("Basic") ? 4 : 3); protectedIds.add(prior.id); card = prior; name = card.evolvesFrom; }
}
function combinedEngine(a: EngineDefinition, b: EngineDefinition): EngineDefinition {
  return { ...a, id: `hybrid:${a.id}+${b.id}`, name: `${a.name} + ${b.name}`, energyTypes: [...new Set([...a.energyTypes, ...b.energyTypes])], strategicRoles: [...new Set([...a.strategicRoles, ...b.strategicRoles])], providers: [...a.providers, ...b.providers], consumers: [...a.consumers, ...b.consumers], requiredPackages: [...new Set([...a.requiredPackages, ...b.requiredPackages])], optionalPackages: [], conflicts: [...a.conflicts, ...b.conflicts], benchDemand: a.benchDemand + b.benchDemand, sourceDeckIds: [...new Set([...a.sourceDeckIds, ...b.sourceDeckIds])], coreCardIds: [...new Set([...a.coreCardIds, ...b.coreCardIds])], reviewNotes: [...a.reviewNotes, ...b.reviewNotes] };
}
export function generateHybridCandidates(request: ArchitectRequest, index: CatalogueIndex): { candidates: ArchitectCandidate[]; rejected: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> } {
  if (request.favourites.length < 2) return { candidates: [], rejected: [] };
  const matches = enginesFor(request, index); const selected = [...new Map(matches.map((match) => [match.engine.id, match.engine])).values()].slice(0, 2);
  if (selected.length < 2) return { candidates: [], rejected: [{ cardId: request.favourites[0]!.cardId, reasons: ["Two independently reviewed engines are required for a Hybrid candidate."], equivalentSupportedIds: [] }] };
  if (selected[0]!.conflicts.some((conflict) => conflict.withEngineId === selected[1]!.id) || selected[1]!.conflicts.some((conflict) => conflict.withEngineId === selected[0]!.id) || selected.reduce((sum, engine) => sum + engine.benchDemand, 0) > 7) return { candidates: [], rejected: [{ cardId: request.favourites[0]!.cardId, reasons: ["The selected engines conflict on Stadium, Tool, Energy, or Bench demand."], equivalentSupportedIds: [] }] };
  const knowledge = buildArchitectKnowledgeBase(index); const engine = combinedEngine(selected[0]!, selected[1]!); const candidates: ArchitectCandidate[] = []; const seen = new Set<string>(); const profile = request.profile ?? "balanced";
  for (let variant = 0; candidates.length < request.candidateCount && variant < 24; variant += 1) {
    const counts = new Map<string, number>(); const protectedIds = new Set<string>();
    for (const packageId of engine.requiredPackages) { try { for (const entry of packageById(packageId).requiredCards) if (index.byId.has(entry.cardId)) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); } } catch { /* unknown package is not a reason to invent cards */ } }
    for (const favorite of request.favourites) evolution(counts, favorite.cardId, index, protectedIds);
    const trainerPlan = constructTrainerPlan(request, index, knowledge, engine, profile); for (const entry of trainerPlan.entries) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
    const energyPlan = constructEnergyPlan(request, index, knowledge, engine, profile); for (const id of [...counts.keys()]) if (index.byId.get(id)?.supertype === "Energy" && !protectedIds.has(id)) remove(counts, id, counts.get(id) ?? 0); for (const entry of energyPlan.entries) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
    const flex = [...knowledge.cardProfiles.values()].filter((card) => !protectedIds.has(card.cardId) && card.roles.includes(variant % 2 ? "support" : "tech") && index.byId.get(card.cardId)?.legalities.standard === "Legal").sort((a, b) => b.sourceDeckIds.length - a.sourceDeckIds.length || a.cardId.localeCompare(b.cardId))[variant % 5]; if (flex) add(counts, flex.cardId, 1);
    const fillers = [...knowledge.cardProfiles.values()].filter((card) => !protectedIds.has(card.cardId) && index.byId.get(card.cardId)?.legalities.standard === "Legal" && ["complete", "generated"].includes(compileCardImplementation(index.byId.get(card.cardId)!).status)).sort((a, b) => b.sourceDeckIds.length - a.sourceDeckIds.length || a.cardId.localeCompare(b.cardId)); let cursor = 0; while (total(counts) > 60) { const removable = [...counts.keys()].find((id) => !protectedIds.has(id)); if (!removable) break; remove(counts, removable, 1); } while (total(counts) < 60 && fillers.length) { const id = fillers[cursor++ % fillers.length]!.cardId; if ((counts.get(id) ?? 0) < 4) add(counts, id, 1); }
    const entries = [...counts].filter(([, count]) => count > 0).map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId)); const fingerprint = entries.map((entry) => `${entry.cardId}:${entry.count}`).join("|"); if (seen.has(fingerprint)) continue; seen.add(fingerprint);
    const deck: DeckManifest = { id: `architect-hybrid-${request.seed}-${variant}`, name: `${request.favourites.map((favorite) => index.byId.get(favorite.cardId)?.name ?? favorite.cardId).join(" + ")} — ${profile} hybrid ${variant + 1}`, description: `Hybrid executable construction joins ${selected[0]!.name} and ${selected[1]!.name}; both engine packages and their requirement chains are present.`, format: request.format, source: "saved", entries };
    const analysis = analyseDeck(deck, index); if (request.mode === "simulation-ready" && !analysis.simulationReady) continue; const edges = buildSynergyGraph(entries.map((entry) => entry.cardId), index, request.mode === "creative"); const score = scoreCandidate(deck, request.favourites, index, edges, analysis.unsupported.length);
    candidates.push({ id: deck.id, seed: request.seed, variant: `${profile} hybrid`, requiredCardIds: request.favourites.map((favorite) => favorite.cardId), deck, simulationReady: analysis.simulationReady, score, explanations: [`Hybrid construction combines ${selected[0]!.name} and ${selected[1]!.name}.`, `Both engine package sets are assembled: ${engine.requiredPackages.join(", ")}.`, `Capability/requirement connection: ${engine.providers[0]?.cardId ?? "provider"} supplies ${engine.consumers[0]?.kind ?? "a reviewed requirement"}.`, ...energyPlan.explanation], synergyEdges: edges, unsupportedCardIds: analysis.unsupported.map((card) => card.id), energyExplanation: energyPlan.explanation.join(" "), fingerprint, route: "hybrid", packageIds: engine.requiredPackages, profile, strategyPlanId: `hybrid:${selected.map((item) => item.id).join("+")}`, trainerPlan, energyPlan: { entries: energyPlan.entries, mainAttackCoverage: energyPlan.attacks[0] ? 1 : 0, secondaryAttackCoverage: energyPlan.attacks[1] ? 1 : 0, expectedManualAttachments: energyPlan.attacks[0]?.expectedTurnsToPay ?? 0, accelerationProviders: energyPlan.attacks.flatMap((attack) => attack.accelerationPath), recoveryProviders: [], explanation: energyPlan.explanation, warnings: energyPlan.warnings } });
  }
  return { candidates, rejected: [] };
}
