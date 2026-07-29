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
function addCapped(counts: Counts, id: string, amount: number, index: CatalogueIndex): void { const name = index.byId.get(id)?.name; const namedCount = name ? [...counts].filter(([candidate]) => index.byId.get(candidate)?.name === name).reduce((sum, [, count]) => sum + count, 0) : counts.get(id) ?? 0; add(counts, id, Math.min(amount, Math.max(0, 4 - namedCount))); }
function addPackage(counts: Counts, packageId: string, index: CatalogueIndex, protectedIds: Set<string>): void {
  let pkg; try { pkg = packageById(packageId); } catch { return; }
  for (const entry of pkg.requiredCards) if (index.byId.has(entry.cardId)) { addCapped(counts, entry.cardId, entry.count, index); protectedIds.add(entry.cardId); }
}
function chooseEngine(request: ArchitectRequest, index: CatalogueIndex, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>) {
  const selected = new Set(request.favourites.map((favorite) => favorite.cardId));
  return [...knowledge.engineDefinitions.values()].map((engine) => {
    const core = engine.coreCardIds.filter((id) => selected.has(id)).length;
    const family = [...selected].filter((id) => engine.coreCardIds.some((coreId) => implementationResolver()?.familyFor(coreId)?.id === implementationResolver()?.familyFor(id)?.id)).length;
    const consumers = engine.consumers.filter((consumer) => selected.has(consumer.cardId)).length;
    const anchorMembership = core * 100 + family * 30 + consumers * 60;
    const installedProviders = anchorMembership > 0 ? engine.providers.filter((provider) => index.byId.has(provider.cardId)).length : 0;
    return { engine, score: anchorMembership + installedProviders };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.engine.id.localeCompare(b.engine.id))[0]?.engine;
}
function addEvolutionChain(counts: Counts, cardId: string, index: CatalogueIndex, protectedIds: Set<string>, mode: ArchitectRequest["mode"]): void {
  const card = index.byId.get(cardId);
  if (!card || card.supertype !== "Pokémon") return;
  const targetCount = (counts.get(card.id) ?? 0) > 0 ? Math.max(counts.get(card.id)!, 4) : 4;
  add(counts, card.id, Math.max(0, targetCount - (counts.get(card.id) ?? 0))); protectedIds.add(card.id);
  let evolvesFrom = card.evolvesFrom;
  while (evolvesFrom) {
    const family = index.byName.get(normalizeCardName(evolvesFrom)) ?? [];
    const prior = family.find((candidate) => mode === "creative" || ["complete", "generated"].includes(compileCardImplementation(candidate).status));
    const lineage = prior ?? family[0];
    if (!lineage) break;
    if (prior) { const priorTarget = 4; add(counts, prior.id, Math.max(0, priorTarget - (counts.get(prior.id) ?? 0))); protectedIds.add(prior.id); }
    evolvesFrom = lineage.evolvesFrom;
  }
}
function constructEnergy(counts: Counts, index: CatalogueIndex, request: ArchitectRequest, engine: ReturnType<typeof chooseEngine>, profile: ArchitectProfile, protectedIds: Set<string>, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>): void {
  const plan = constructEnergyPlan(request, index, knowledge, engine, profile);
  for (const id of [...counts.keys()]) if (index.byId.get(id)?.supertype === "Energy" && !protectedIds.has(id)) remove(counts, id, counts.get(id) ?? 0);
  for (const entry of plan.entries) if (index.byId.has(entry.cardId)) { add(counts, entry.cardId, entry.count); protectedIds.add(entry.cardId); }
}
function trimAndFill(counts: Counts, index: CatalogueIndex, request: ArchitectRequest, protectedIds: Set<string>, flexIds: readonly string[]): void {
  const excluded = new Set(request.excludedCardIds ?? []);
  for (const id of excluded) if (!protectedIds.has(id)) counts.delete(id);
  const countByName = (name: string) => [...counts].filter(([id]) => index.byId.get(id)?.name === name).reduce((sum, [, count]) => sum + count, 0);
  const names = new Set([...counts.keys()].flatMap((id) => index.byId.get(id)?.name ?? []));
  for (const name of names) {
    let excess = countByName(name) - 4;
    for (const id of [...counts.keys()].filter((candidate) => index.byId.get(candidate)?.name === name && !protectedIds.has(candidate)).reverse()) {
      if (excess <= 0) break;
      const amount = Math.min(excess, counts.get(id) ?? 0); remove(counts, id, amount); excess -= amount;
    }
  }
  while (total(counts) > 60) {
    const removable = [...counts.keys()].filter((id) => !protectedIds.has(id)).sort((a, b) => (index.byId.get(a)?.supertype === "Trainer" ? -1 : 1) - (index.byId.get(b)?.supertype === "Trainer" ? -1 : 1) || a.localeCompare(b))[0];
    if (!removable) break; remove(counts, removable, 1);
  }
  const roleProviders = [...new Set([...flexIds, "sv1-196", "me1-131", "me1-125", "sv4-163", "sv1-181", "sv1-198", "me1-119", "me1-130", "sv6pt5-57", "me1-114", "sv1-189", "sv6pt5-61", "me2pt5-183", "sv2-188"])]
    .filter((id) => !excluded.has(id) && index.byId.get(id)?.supertype === "Trainer" && ["complete", "generated"].includes(compileCardImplementation(index.byId.get(id)!).status));
  let cursor = 0;
  while (total(counts) < 60 && roleProviders.some((id) => (counts.get(id) ?? 0) < 4 && countByName(index.byId.get(id)?.name ?? id) < 4)) {
    const id = roleProviders[cursor % roleProviders.length]!;
    if ((counts.get(id) ?? 0) < 4 && countByName(index.byId.get(id)?.name ?? id) < 4) add(counts, id, 1);
    cursor += 1;
  }
  const energyId = [...counts.keys()].find((id) => index.byId.get(id)?.supertype === "Energy");
  while (total(counts) < 60 && energyId && (counts.get(energyId) ?? 0) < (request.preferredEnergyCountRange?.maximum ?? 15)) add(counts, energyId, 1);
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
    const trainerPlan = constructTrainerPlan(request, index, knowledge, engine, profile); for (const entry of trainerPlan.entries) if (index.byId.has(entry.cardId)) addCapped(counts, entry.cardId, entry.count, index);
    constructEnergy(counts, index, request, engine, profile, protectedIds, knowledge);
    const profileProviders: Record<ArchitectProfile, string[]> = { balanced: ["sv4pt5-80", "me1-119"], turbo: ["zsv10pt5-84", "sv1-196"], resilient: ["sv6pt5-61", "me2pt5-183"], control: ["me1-114", "sv6pt5-57"], aggressive: ["me3-81", "sv6-131"] };
    const baseProviders = [...profileProviders[profile], ...trainerPlan.entries.map((entry) => entry.cardId)];
    const rotatedProviders = baseProviders.slice(variant % Math.max(1, baseProviders.length)).concat(baseProviders.slice(0, variant % Math.max(1, baseProviders.length)));
    trimAndFill(counts, index, request, protectedIds, rotatedProviders);
    const entries = [...counts].filter(([, count]) => count > 0).map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId)); const fingerprint = entries.map((entry) => `${entry.cardId}:${entry.count}`).join("|"); if (seen.has(fingerprint)) continue; seen.add(fingerprint);
    const deck: DeckManifest = { id: `architect-anchor-${request.favourites[0]!.cardId}-${profile}-${request.seed}-${variant}`, name: `${index.byId.get(request.favourites[0]!.cardId)?.name ?? "Favourite"} — ${profile} semantic build ${variant + 1}`, description: `Original executable construction using ${engine?.name ?? "exact anchor capability plan"}; no tournament list was cloned.`, format: request.format, source: "saved", entries };
    const analysis = analyseDeck(deck, index); if (request.mode === "simulation-ready" && !analysis.simulationReady) continue;
    const edges = buildSynergyGraph(entries.map((entry) => entry.cardId), index, request.mode === "creative"); const score = scoreCandidate(deck, request.favourites, index, edges, analysis.unsupported.length);
    const energyPlan = constructEnergyPlan(request, index, knowledge, engine, profile);
    candidates.push({ id: deck.id, seed: request.seed, variant: `${profile} semantic`, requiredCardIds: request.favourites.map((favorite) => favorite.cardId), deck, simulationReady: analysis.simulationReady, score, explanations: [`Original semantic construction selected ${engine?.name ?? "role-compatible providers"}.`, `Required packages were assembled before slot filling: ${(engine?.requiredPackages ?? []).join(", ") || "role-budget providers"}.`, `Profile ${profile} changed role budgets and Energy density; variant ${variant + 1} changes flex selection.`, `Trainer plan: ${trainerPlan.entries.length} providers with ${trainerPlan.unmetRoles.length} unmet role(s).`, ...energyPlan.explanation, ...edges.slice(0, 4).flatMap((edge) => edge.reasons)], synergyEdges: edges, unsupportedCardIds: analysis.unsupported.map((card) => card.id), energyExplanation: energyPlan.explanation.join(" "), fingerprint, route: "original", selectedRoles: Object.fromEntries(request.favourites.map((favorite) => [favorite.cardId, favorite.role ?? "primary-attacker"])), packageIds: [...(engine?.requiredPackages ?? [])], profile, strategyPlanId: `original:${engine?.id ?? "roles"}`, trainerPlan, energyPlan: { entries: energyPlan.entries, mainAttackCoverage: energyPlan.attacks[0] ? 1 : 0, secondaryAttackCoverage: energyPlan.attacks[1] ? 1 : 0, expectedManualAttachments: energyPlan.attacks[0]?.expectedTurnsToPay ?? 0, accelerationProviders: energyPlan.attacks.flatMap((attack) => attack.accelerationPath), recoveryProviders: [], explanation: energyPlan.explanation, warnings: energyPlan.warnings } });
  }
  return { candidates, rejected };
}
