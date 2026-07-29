import { CANONICAL_BASIC_ENERGY_IDS, compileCardImplementation, implementationResolver, type CatalogueIndex } from "../../data/pokemon";
import type { DeckCardEntry, DeckManifest } from "../../data/decks/types";
import { analyseDeck } from "../deck-builder/validation";
import { buildSynergyGraph } from "./synergy-graph";
import { buildArchitectKnowledgeBase } from "./knowledge-base";
import { scoreCandidate } from "./role-analysis";
import { engineDefinitions } from "./engines/definitions";
import type { ArchitectCandidate, ArchitectProfile, ArchitectRequest, SelectedCardRole } from "./types";
import { generateOriginalCandidates } from "./original-builder";
import { generateHybridCandidates } from "./hybrid-builder";
import { withCoherence } from "./coherence";

const profileNames: Record<ArchitectProfile, string> = { balanced: "Balanced", turbo: "Turbo", resilient: "Resilient", control: "Control", aggressive: "Aggressive" };
const profileOrder: ArchitectProfile[] = ["balanced", "turbo", "resilient", "control", "aggressive"];

function add(counts: Map<string, number>, id: string, count: number): void { if (count <= 0) return; counts.set(id, (counts.get(id) ?? 0) + count); }
function remove(counts: Map<string, number>, id: string, count: number): void { const next = (counts.get(id) ?? 0) - count; if (next > 0) counts.set(id, next); else counts.delete(id); }
function total(counts: Map<string, number>): number { return [...counts.values()].reduce((sum, count) => sum + count, 0); }
function sourceMatch(request: ArchitectRequest, _index: CatalogueIndex, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>) {
  const selected = new Set(request.favourites.map((favorite) => favorite.cardId));
  const families = new Set(request.favourites.map((favorite) => implementationResolver()?.familyFor(favorite.cardId)?.id));
  return knowledge.sourceDecks.map((deck) => {
    const ids = new Set(deck.manifest?.entries.map((entry) => entry.cardId) ?? []);
    const exact = [...selected].filter((id) => ids.has(id)).length;
    const family = [...families].filter(Boolean).reduce((score, familyId) => score + (deck.manifest?.entries.some((entry) => implementationResolver()?.familyFor(entry.cardId)?.id === familyId) ? 1 : 0), 0);
    const engineScore = engineDefinitions.some((engine) => [...selected].some((id) => engine.coreCardIds.includes(id)) && engine.sourceDeckIds.includes(deck.id)) ? 250 : 0;
    return { deck, score: exact * 100 + family * 25 + engineScore + (deck.snapshot.placement ? Math.max(0, 50 - deck.snapshot.placement) : 0) };
  }).filter((item) => item.score > 0 && item.deck.manifest && request.favourites.every((favorite) => !favorite.exactPrintingRequired || item.deck.manifest!.entries.some((entry) => entry.cardId === favorite.cardId || implementationResolver()?.familyFor(entry.cardId)?.id === implementationResolver()?.familyFor(favorite.cardId)?.id)) && ([...selected].every((id) => item.deck.manifest!.entries.some((entry) => entry.cardId === id || implementationResolver()?.familyFor(entry.cardId)?.id === implementationResolver()?.familyFor(id)?.id)) || selected.size === 1)).sort((a, b) => b.score - a.score || a.deck.id.localeCompare(b.deck.id))[0];
}
function selectedRoles(request: ArchitectRequest, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>): Record<string, SelectedCardRole> {
  return Object.fromEntries(request.favourites.map((favorite) => {
    if (favorite.role && favorite.role !== "auto") return [favorite.cardId, favorite.role];
    const profile = knowledge.cardProfiles.get(favorite.cardId);
    return [favorite.cardId, profile?.roles[0] ?? "auto"];
  }));
}
function lockPrintings(counts: Map<string, number>, request: ArchitectRequest): void {
  for (const favorite of request.favourites) {
    const existing = [...counts.keys()].find((id) => id !== favorite.cardId && implementationResolver()?.familyFor(id)?.id === implementationResolver()?.familyFor(favorite.cardId)?.id);
    if (favorite.exactPrintingRequired && existing) { const amount = counts.get(existing) ?? 0; remove(counts, existing, amount); add(counts, favorite.cardId, amount); }
    if (!counts.has(favorite.cardId)) add(counts, favorite.cardId, favorite.minimumCount ?? 1);
    const current = counts.get(favorite.cardId) ?? 0;
    if (favorite.minimumCount && current < favorite.minimumCount) add(counts, favorite.cardId, favorite.minimumCount - current);
    if (favorite.maximumCount && current > favorite.maximumCount) remove(counts, favorite.cardId, current - favorite.maximumCount);
  }
}
function trimAndFill(counts: Map<string, number>, index: CatalogueIndex, request: ArchitectRequest, protectedIds: Set<string>): void {
  for (const id of request.excludedCardIds ?? []) if (!protectedIds.has(id)) counts.delete(id);
  const energyRange = request.preferredEnergyCountRange ?? { minimum: 8, maximum: 15 };
  while (total(counts) > 60) {
    const removable = [...counts.keys()].filter((id) => !protectedIds.has(id)).sort((a, b) => {
      const cardA = index.byId.get(a), cardB = index.byId.get(b);
      const rank = (card: typeof cardA) => card?.supertype === "Energy" ? 1 : card?.supertype === "Trainer" ? 0 : 2;
      return rank(cardA) - rank(cardB) || a.localeCompare(b);
    })[0];
    if (!removable) break; remove(counts, removable, 1);
  }
  const energyCount = [...counts].filter(([id]) => index.byId.get(id)?.supertype === "Energy").reduce((sum, [, count]) => sum + count, 0);
  const preferredType = [...request.favourites].map((favorite) => index.byId.get(favorite.cardId)?.types?.[0]).find(Boolean)?.toLowerCase() ?? "colorless";
  const energyId = CANONICAL_BASIC_ENERGY_IDS[preferredType] ?? "sve-7";
  const sourceRoleProviders = [...counts.keys()].filter((id) => index.byId.get(id)?.supertype === "Trainer" && !protectedIds.has(id));
  let cursor = 0;
  while (total(counts) < 60 && sourceRoleProviders.some((id) => (counts.get(id) ?? 0) < 4)) { const id = sourceRoleProviders[cursor % sourceRoleProviders.length]!; if ((counts.get(id) ?? 0) < 4) add(counts, id, 1); cursor += 1; }
  while (total(counts) < 60 && (counts.get(energyId) ?? 0) < energyRange.maximum) add(counts, energyId, 1);
  if (energyCount > energyRange.maximum) { for (const [id, count] of [...counts]) if (index.byId.get(id)?.supertype === "Energy" && !protectedIds.has(id)) { remove(counts, id, Math.min(count, energyCount - energyRange.maximum)); break; } }
  while (total(counts) < 60) add(counts, energyId, 1);
  const byName = new Map<string, Array<{ id: string; count: number }>>();
  for (const [id, count] of counts) { const card = index.byId.get(id); if (!card || card.supertype === "Energy" && card.subtypes.includes("Basic")) continue; byName.set(card.name, [...(byName.get(card.name) ?? []), { id, count }]); }
  for (const entries of byName.values()) { let excess = entries.reduce((sum, entry) => sum + entry.count, 0) - 4; if (excess <= 0) continue; for (const entry of entries) { if (!excess) break; const removable = Math.min(excess, Math.max(0, counts.get(entry.id) ?? 0) - (protectedIds.has(entry.id) ? 1 : 0)); if (removable) { remove(counts, entry.id, removable); excess -= removable; } } }
  while (total(counts) < 60) add(counts, energyId, 1);
}
function buildEnergyPlan(entries: readonly DeckCardEntry[], request: ArchitectRequest, index: CatalogueIndex, knowledge: ReturnType<typeof buildArchitectKnowledgeBase>) {
  const energyEntries = entries.filter((entry) => index.byId.get(entry.cardId)?.supertype === "Energy");
  const energyCount = energyEntries.reduce((sum, entry) => sum + entry.count, 0);
  const demands = request.favourites.flatMap((favorite) => knowledge.cardProfiles.get(favorite.cardId)?.energyDemand ?? []);
  const main = demands[0]?.units ?? 0;
  const secondary = demands[1]?.units ?? main;
  const basicCoverage = main ? Math.min(1, energyCount / Math.max(1, main * 3)) : 1;
  const secondaryCoverage = secondary ? Math.min(1, energyCount / Math.max(1, secondary * 4)) : 1;
  const accelerationProviders = request.favourites.flatMap((favorite) => (knowledge.cardProfiles.get(favorite.cardId)?.capabilities ?? []).filter((capability) => capability.kind.includes("energy")).map(() => favorite.cardId));
  const recoveryProviders = request.favourites.flatMap((favorite) => (knowledge.cardProfiles.get(favorite.cardId)?.capabilities ?? []).filter((capability) => capability.kind === "energy-from-discard" || capability.kind === "discard-fill").map(() => favorite.cardId));
  const warnings: string[] = [];
  const range = request.preferredEnergyCountRange;
  if (range && (energyCount < range.minimum || energyCount > range.maximum)) warnings.push(`Energy count ${energyCount} is outside the requested ${range.minimum}-${range.maximum} range.`);
  return { entries: energyEntries, mainAttackCoverage: basicCoverage, secondaryAttackCoverage: secondaryCoverage, expectedManualAttachments: Math.max(0, main - accelerationProviders.length), accelerationProviders: [...new Set(accelerationProviders)], recoveryProviders: [...new Set(recoveryProviders)], explanation: [`${energyCount} Energy cards planned from the source shell.`, `Primary attack demand ${main || 0} and secondary demand ${secondary || 0} are covered against the retained count.`], warnings };
}
function sourceCandidates(request: ArchitectRequest, index: CatalogueIndex, profile: ArchitectProfile, count: number): ArchitectCandidate[] {
  const knowledge = buildArchitectKnowledgeBase(index); const match = sourceMatch(request, index, knowledge); if (!match || request.allowSourceCopy === false || (request.excludedCardIds?.length ?? 0) > 0) return [];
  const roles = selectedRoles(request, knowledge); const sourceDeck = match.deck; const source = sourceDeck.manifest!; const candidates: ArchitectCandidate[] = [];
  for (let offset = 0; candidates.length < count && offset < 20; offset += 1) {
    const variantProfile = request.profile ? profile : profileOrder[offset % profileOrder.length]!;
    const counts = new Map(source.entries.map((entry) => [entry.cardId, entry.count])); const protectedIds = new Set(request.favourites.map((favorite) => favorite.cardId)); lockPrintings(counts, request); trimAndFill(counts, index, request, protectedIds);
    const entries = [...counts].filter(([, amount]) => amount > 0).map(([cardId, amount]) => ({ cardId, count: amount })).sort((a, b) => a.cardId.localeCompare(b.cardId)); const deck: DeckManifest = { id: `architect-proven-${sourceDeck.id}-${request.seed}-${offset}`, name: `${index.byId.get(request.favourites[0]!.cardId)?.name ?? sourceDeck.snapshot.archetype} — ${profileNames[variantProfile]}`, description: `Proven source shell from ${sourceDeck.snapshot.player ?? "the tournament corpus"}'s ${sourceDeck.snapshot.archetype} list, adapted with the ${profileNames[variantProfile]} package profile.`, format: request.format, source: "saved", entries };
    const analysis = analyseDeck(deck, index);
    if (request.mode === "simulation-ready" && (!sourceDeck.simulationReady || analysis.unsupported.length > 0)) continue;
    const edges = buildSynergyGraph(entries.map((entry) => entry.cardId), index, request.mode === "creative");
    const score = scoreCandidate(deck, request.favourites, index, edges, analysis.unsupported.length);
    const packageIds = [...new Set(engineDefinitionsFor(entries, knowledge).flatMap((engine) => [...engine.requiredPackages, ...engine.optionalPackages].filter((id) => knowledge.sourcePackages.has(id))))];
    const namedSynergy = request.favourites.some((favorite) => favorite.cardId === "sv9-56") ? "Lillie's Clefairy Multi-Type Bench" : request.favourites.some((favorite) => ["sv6-25", "sv7-14"].includes(favorite.cardId)) ? "Teal Mask Ogerpon / Hydrapple" : sourceDeck.snapshot.archetype;
    const energyPlan = buildEnergyPlan(entries, request, index, knowledge);
    candidates.push({ id: deck.id, seed: request.seed, variant: profileNames[variantProfile], requiredCardIds: request.favourites.map((favorite) => favorite.cardId), deck, simulationReady: analysis.simulationReady, score, explanations: [`Proven source shell: ${sourceDeck.snapshot.archetype} · ${sourceDeck.snapshot.player ?? "tournament source"} · placement ${sourceDeck.snapshot.placement ?? "n/a"}.`, `Reviewed engine package: ${namedSynergy}.`, ...edges.slice(0, 5).flatMap((edge) => edge.reasons), `Profile ${profileNames[variantProfile]} changes semantic priorities while preserving the source engine.`, `Source engine plan: ${sourceDeck.snapshot.archetype} with ${packageIds.length} reviewed packages.`], synergyEdges: edges, unsupportedCardIds: analysis.unsupported.map((card) => card.id), energyExplanation: energyPlan.explanation.join(" "), fingerprint: entries.map((entry) => `${entry.cardId}:${entry.count}`).join("|"), route: offset === 0 ? "proven" : "variation", sourceDeckId: sourceDeck.id, strategyPlanId: sourceDeck.id, sourceEvidence: { player: sourceDeck.snapshot.player, event: sourceDeck.snapshot.eventName, placement: sourceDeck.snapshot.placement, archetype: sourceDeck.snapshot.archetype }, selectedRoles: roles, packageIds, profile: variantProfile, energyPlan });
  }
  return candidates;
}
function engineDefinitionsFor(entries: readonly DeckCardEntry[], knowledge: ReturnType<typeof buildArchitectKnowledgeBase>) { const ids = new Set(entries.map((entry) => entry.cardId)); return [...knowledge.engineDefinitions.values()].filter((engine) => engine.coreCardIds.some((id) => ids.has(id)) || engine.sourceDeckIds.some((id) => knowledge.sourceDecks.find((deck) => deck.id === id)?.manifest?.entries.some((entry) => ids.has(entry.cardId)))); }

export function generateSemanticCandidates(request: ArchitectRequest, index: CatalogueIndex): { candidates: ArchitectCandidate[]; rejected: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> } {
  const rejected = request.favourites.flatMap((favorite) => { const card = index.byId.get(favorite.cardId); if (!card) return [{ cardId: favorite.cardId, reasons: ["Card is missing from the catalogue."], equivalentSupportedIds: [] }]; const implementation = compileCardImplementation(card); return request.mode === "simulation-ready" && !["complete", "generated"].includes(implementation.status) ? [{ cardId: card.id, reasons: implementation.knownLimitations, equivalentSupportedIds: (implementationResolver()?.equivalentsFor(card.id) ?? []).filter((value) => ["complete", "generated"].includes(compileCardImplementation(value).status)).map((value) => value.id) }] : []; });
  if (rejected.length || !request.favourites.length) return { candidates: [], rejected };
  const profile = request.profile ?? "balanced";
  const pool: ArchitectCandidate[] = [...sourceCandidates(request, index, profile, 1)];
  const hybrid = generateHybridCandidates({ ...request, candidateCount: 5 }, index);
  if (hybrid.candidates[0]) pool.push(hybrid.candidates[0]);
  const orderedProfiles = request.profile ? [profile, ...profileOrder.filter((value) => value !== profile)] : profileOrder;
  let rejectedOriginal: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> = [];
  for (const candidateProfile of orderedProfiles) {
    const original = generateOriginalCandidates({ ...request, profile: candidateProfile, candidateCount: 5 }, index);
    rejectedOriginal = original.rejected;
    const candidate = original.candidates[0];
    if (candidate) pool.push({ ...candidate, route: candidateProfile === "control" || candidateProfile === "resilient" ? "control-resilient" : "original", profile: candidateProfile, explanations: ["Original capability construction: the exact anchor, its evolution line, bounded Energy, and declared Trainer roles were assembled before flex slots.", ...candidate.explanations] });
  }
  const reviewedPool = [...new Map(pool.map((candidate) => [candidate.fingerprint, candidate])).values()].map((candidate) => withCoherence(candidate, index));
  const candidates = reviewedPool.filter((candidate) => candidate.coherence?.coherent).slice(0, request.candidateCount);
  return { candidates, rejected: candidates.length ? [] : [...hybrid.rejected, ...rejectedOriginal] };
}

export function generateCandidates(request: ArchitectRequest, index: CatalogueIndex) { return generateSemanticCandidates(request, index); }
