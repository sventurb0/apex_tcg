import { compileCardImplementation, implementationResolver, normalizeCardName, type CatalogueIndex } from "../../data/pokemon";
import type { DeckManifest } from "../../data/decks/types";
import { analyseDeck } from "../deck-builder/validation";
import { buildSynergyGraph } from "./synergy-graph";
import { scoreCandidate } from "./role-analysis";
import { buildArchitectKnowledgeBase } from "./knowledge-base";
import { packageById } from "./packages";
import { constructEnergyPlan } from "./energy-planner";
import { constructTrainerPlan } from "./trainer-plan";
import type { ArchitectCandidate, ArchitectProfile, ArchitectRequest } from "./types";

type Counts = Map<string, number>;

function add(counts: Counts, id: string, amount: number): void { if (amount > 0) counts.set(id, (counts.get(id) ?? 0) + amount); }
function remove(counts: Counts, id: string, amount: number): void { const next = (counts.get(id) ?? 0) - amount; if (next > 0) counts.set(id, next); else counts.delete(id); }
function total(counts: Counts): number { return [...counts.values()].reduce((sum, count) => sum + count, 0); }
function addPackage(counts: Counts, packageId: string, index: CatalogueIndex, protectedIds: Set<string>): void {
  let pkg; try { pkg = packageById(packageId); } catch { return; }
  for (const entry of pkg.requiredCards) if (index.byId.has(entry.cardId)) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
}
function chooseEngine(request: ArchitectRequest, index: CatalogueIndex, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>) {
  const selected = new Set(request.favourites.map((favorite) => favorite.cardId));
  return [...knowledge.engineDefinitions.values()].map((engine) => {
    const core = engine.coreCardIds.filter((id) => selected.has(id)).length;
    const family = [...selected].filter((id) => engine.coreCardIds.some((coreId) => implementationResolver()?.familyFor(coreId)?.id === implementationResolver()?.familyFor(id)?.id)).length;
    const providers = engine.providers.filter((provider) => index.byId.has(provider.cardId)).length;
    const consumers = engine.consumers.filter((consumer) => selected.has(consumer.cardId)).length;
    return { engine, score: core * 100 + family * 30 + consumers * 15 + providers };
  }).sort((a, b) => b.score - a.score || a.engine.id.localeCompare(b.engine.id))[0]?.engine;
}
function addEvolutionChain(counts: Counts, cardId: string, index: CatalogueIndex, protectedIds: Set<string>, mode: ArchitectRequest["mode"]): void {
  const card = index.byId.get(cardId);
  if (!card || card.supertype !== "Pokémon") return;
  const targetCount = (counts.get(card.id) ?? 0) > 0 ? counts.get(card.id)! : card.subtypes.includes("Basic") ? 3 : card.subtypes.includes("Stage 2") ? 2 : 2;
  add(counts, card.id, Math.max(0, targetCount - (counts.get(card.id) ?? 0))); protectedIds.add(card.id);
  let evolvesFrom = card.evolvesFrom;
  while (evolvesFrom) {
    const prior = index.byName.get(normalizeCardName(evolvesFrom))?.find((candidate) => mode === "creative" || ["complete", "generated"].includes(compileCardImplementation(candidate).status));
    if (!prior) break;
    const priorTarget = prior.subtypes.includes("Basic") ? 4 : 3; add(counts, prior.id, Math.max(0, priorTarget - (counts.get(prior.id) ?? 0))); protectedIds.add(prior.id); evolvesFrom = prior.evolvesFrom;
  }
}
function addRoleBudget(counts: Counts, index: CatalogueIndex, profile: ArchitectProfile, protectedIds: Set<string>, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>, variant = 0): void {
  const priorities: Record<ArchitectProfile, string[]> = { balanced: ["engine-core", "support"], turbo: ["engine-core", "support"], resilient: ["support", "engine-core"], control: ["support", "tech"], aggressive: ["primary-attacker", "engine-core"] };
  const candidates = [...knowledge.cardProfiles.values()].filter((card) => !protectedIds.has(card.cardId) && index.byId.get(card.cardId)?.legalities.standard === "Legal" && card.roles.some((role) => priorities[profile].includes(role))).sort((a, b) => b.sourceDeckIds.length - a.sourceDeckIds.length || a.cardId.localeCompare(b.cardId));
  const span = profile === "turbo" ? 6 : 5;
  for (const candidate of candidates.slice(variant % Math.max(1, candidates.length - span + 1), (variant % Math.max(1, candidates.length - span + 1)) + span)) { add(counts, candidate.cardId, candidate.cardId.startsWith("sve-") ? 0 : candidate.roles.includes("engine-core") ? 2 : 1); protectedIds.add(candidate.cardId); }
}
function constructEnergy(counts: Counts, index: CatalogueIndex, request: ArchitectRequest, engine: ReturnType<typeof chooseEngine>, profile: ArchitectProfile, protectedIds: Set<string>, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>): void {
  const plan = constructEnergyPlan(request, index, knowledge, engine, profile);
  for (const id of [...counts.keys()]) if (index.byId.get(id)?.supertype === "Energy" && !protectedIds.has(id)) remove(counts, id, counts.get(id) ?? 0);
  for (const entry of plan.entries) if (index.byId.has(entry.cardId)) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
}
function trimAndFill(counts: Counts, index: CatalogueIndex, protectedIds: Set<string>, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>): void {
  while (total(counts) > 60) {
    const removable = [...counts.keys()].filter((id) => !protectedIds.has(id)).sort((a, b) => (index.byId.get(a)?.supertype === "Trainer" ? -1 : 1) - (index.byId.get(b)?.supertype === "Trainer" ? -1 : 1) || a.localeCompare(b))[0];
    if (!removable) break; remove(counts, removable, 1);
  }
  const fillers = [...knowledge.cardProfiles.values()].filter((profile) => !protectedIds.has(profile.cardId) && index.byId.get(profile.cardId)?.legalities.standard === "Legal" && ["complete", "generated"].includes(compileCardImplementation(index.byId.get(profile.cardId)!).status)).sort((a, b) => b.sourceDeckIds.length - a.sourceDeckIds.length || a.cardId.localeCompare(b.cardId));
  let cursor = 0; while (total(counts) < 60 && fillers.length) { const id = fillers[cursor % fillers.length]!.cardId; if ((counts.get(id) ?? 0) < 4) add(counts, id, 1); cursor += 1; if (cursor > fillers.length * 8) break; }
  const energyId = [...counts.keys()].find((id) => index.byId.get(id)?.supertype === "Energy"); while (total(counts) < 60 && energyId) add(counts, energyId, 1);
}
export function generateOriginalCandidates(request: ArchitectRequest, index: CatalogueIndex): { candidates: ArchitectCandidate[]; rejected: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> } {
  const knowledge = buildArchitectKnowledgeBase(index); const rejected: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> = [];
  for (const favorite of request.favourites) { const card = index.byId.get(favorite.cardId); if (!card) rejected.push({ cardId: favorite.cardId, reasons: ["Card is missing from the catalogue."], equivalentSupportedIds: [] }); else if (request.mode === "simulation-ready" && !["complete", "generated"].includes(compileCardImplementation(card).status)) rejected.push({ cardId: favorite.cardId, reasons: compileCardImplementation(card).knownLimitations, equivalentSupportedIds: [] }); }
  if (rejected.length || !request.favourites.length) return { candidates: [], rejected };
  const engine = chooseEngine(request, index, knowledge); const candidates: ArchitectCandidate[] = []; const seen = new Set<string>(); const profile = request.profile ?? "balanced";
  for (let variant = 0; candidates.length < request.candidateCount && variant < 24; variant += 1) {
    const counts: Counts = new Map(); const protectedIds = new Set<string>();
    if (engine) { for (const packageId of engine.requiredPackages) addPackage(counts, packageId, index, protectedIds); const optional = profile === "turbo" ? engine.optionalPackages.slice(0, 1) : profile === "resilient" ? engine.optionalPackages.slice(-1) : profile === "control" ? engine.optionalPackages.filter((id) => /control|denial|tool/i.test(id)) : []; for (const packageId of optional) addPackage(counts, packageId, index, protectedIds); }
    for (const favorite of request.favourites) addEvolutionChain(counts, favorite.cardId, index, protectedIds, request.mode);
    const trainerPlan = constructTrainerPlan(request, index, knowledge, engine, profile); for (const entry of trainerPlan.entries) if (index.byId.has(entry.cardId)) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
    addRoleBudget(counts, index, profile, protectedIds, knowledge, variant); constructEnergy(counts, index, request, engine, profile, protectedIds, knowledge);
    trimAndFill(counts, index, protectedIds, knowledge);
    const entries = [...counts].filter(([, count]) => count > 0).map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId)); const fingerprint = entries.map((entry) => `${entry.cardId}:${entry.count}`).join("|"); if (seen.has(fingerprint)) continue; seen.add(fingerprint);
    const deck: DeckManifest = { id: `architect-original-${request.seed}-${variant}`, name: `${index.byId.get(request.favourites[0]!.cardId)?.name ?? "Favourite"} — ${profile} semantic build ${variant + 1}`, description: `Original executable construction using ${engine?.name ?? "catalogue-derived role providers"}; no tournament list was cloned.`, format: request.format, source: "saved", entries };
    const analysis = analyseDeck(deck, index); if (request.mode === "simulation-ready" && !analysis.simulationReady) continue;
    const edges = buildSynergyGraph(entries.map((entry) => entry.cardId), index, request.mode === "creative"); const score = scoreCandidate(deck, request.favourites, index, edges, analysis.unsupported.length);
    const energyPlan = constructEnergyPlan(request, index, knowledge, engine, profile);
    candidates.push({ id: deck.id, seed: request.seed, variant: `${profile} semantic`, requiredCardIds: request.favourites.map((favorite) => favorite.cardId), deck, simulationReady: analysis.simulationReady, score, explanations: [`Original semantic construction selected ${engine?.name ?? "role-compatible providers"}.`, `Required packages were assembled before slot filling: ${(engine?.requiredPackages ?? []).join(", ") || "role-budget providers"}.`, `Profile ${profile} changed role budgets and Energy density; variant ${variant + 1} changes flex selection.`, `Trainer plan: ${trainerPlan.entries.length} providers with ${trainerPlan.unmetRoles.length} unmet role(s).`, ...energyPlan.explanation, ...edges.slice(0, 4).flatMap((edge) => edge.reasons)], synergyEdges: edges, unsupportedCardIds: analysis.unsupported.map((card) => card.id), energyExplanation: energyPlan.explanation.join(" "), fingerprint, route: "original", selectedRoles: Object.fromEntries(request.favourites.map((favorite) => [favorite.cardId, favorite.role ?? "primary-attacker"])), packageIds: [...(engine?.requiredPackages ?? [])], profile, strategyPlanId: `original:${engine?.id ?? "roles"}`, trainerPlan, energyPlan: { entries: energyPlan.entries, mainAttackCoverage: energyPlan.attacks[0] ? 1 : 0, secondaryAttackCoverage: energyPlan.attacks[1] ? 1 : 0, expectedManualAttachments: energyPlan.attacks[0]?.expectedTurnsToPay ?? 0, accelerationProviders: energyPlan.attacks.flatMap((attack) => attack.accelerationPath), recoveryProviders: [], explanation: energyPlan.explanation, warnings: energyPlan.warnings } });
  }
  return { candidates, rejected };
}
