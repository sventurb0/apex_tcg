import { CANONICAL_BASIC_ENERGY_IDS, compileCardImplementation, implementationResolver, normalizeCardName, type CatalogueIndex, type PokemonCardMetadata } from "../../data/pokemon";
import type { DeckCardEntry, DeckManifest } from "../../data/decks/types";
import { analyseDeck } from "../deck-builder/validation";
import { buildSynergyGraph } from "./synergy-graph";
import { packageById } from "./packages";
import { scoreCandidate } from "./role-analysis";
import { engineDefinitions } from "./engines";
import type { EngineDefinition } from "./engines/types";
import type { ArchitectCandidate, ArchitectRequest, FavouriteSelection } from "./types";

type EngineKind = "fire-stage2" | "darkness-poison" | "team-rocket" | "generic";
type Counts = Map<string, number>;
const variationNames = ["Balanced", "Faster setup", "More recovery", "Safer Energy", "More disruption", "Lower Pokémon count", "Higher damage ceiling", "More draw", "Faster evolution", "Conservative resources"];

function add(counts: Counts, cardId: string, amount: number): void { counts.set(cardId, Math.max(0, (counts.get(cardId) ?? 0) + amount)); if (!counts.get(cardId)) counts.delete(cardId); }
function addPackage(counts: Counts, packageId: string): void { for (const entry of packageById(packageId).requiredCards) add(counts, entry.cardId, entry.count); }
function total(counts: Counts): number { return [...counts.values()].reduce((sum, value) => sum + value, 0); }
function familyHandler(cardId: string): string { return implementationResolver()?.familyFor(cardId)?.handlerId ?? ""; }
function engineFor(favourites: readonly FavouriteSelection[]): EngineKind { const handlers = favourites.map((favorite) => familyHandler(favorite.cardId)); if (handlers.some((handler) => /team-rocket/.test(handler))) return "team-rocket"; if (handlers.some((handler) => /okidogi|pecharunt|munkidori|fezandipiti/.test(handler))) return "darkness-poison"; if (handlers.some((handler) => /skeledirge|armarouge|charcadet|fuecoco/.test(handler))) return "fire-stage2"; return "generic"; }
function reviewedEngineFor(favourites: readonly FavouriteSelection[], index: CatalogueIndex): EngineDefinition | undefined {
  const selected = new Set(favourites.map((favorite) => favorite.cardId));
  return [...engineDefinitions].filter((engine) => engine.reviewed).map((engine) => ({ engine, score: engine.coreCardIds.filter((id) => selected.has(id)).length * 20 + engine.providers.filter((provider) => index.byId.has(provider.cardId)).length + engine.consumers.filter((consumer) => selected.has(consumer.cardId)).length * 3 })).sort((a, b) => b.score - a.score || a.engine.id.localeCompare(b.engine.id)).find((candidate) => candidate.score > 0)?.engine;
}
function addReviewedComplements(counts: Counts, engine: EngineDefinition | undefined, index: CatalogueIndex, favourites: readonly FavouriteSelection[], mode: ArchitectRequest["mode"], protectedIds: Set<string>): void {
  // Existing named engines already install their source-backed packages. The
  // reviewed-core promotion is specifically for the former generic path.
  if (!engine) return;
  const selected = new Set(favourites.map((favorite) => favorite.cardId));
  for (const cardId of engine.coreCardIds) {
    if (selected.has(cardId) || protectedIds.has(cardId)) continue;
    const card = index.byId.get(cardId);
    if (!card) continue;
    const implementation = compileCardImplementation(card);
    if (mode === "simulation-ready" && !["complete", "generated"].includes(implementation.status)) continue;
    // Energy density is tuned separately; engine cores contribute role cards,
    // not an unbounded pile of a single Basic Energy printing.
    if (card.supertype === "Energy") continue;
    const count = card.supertype === "Pokémon" ? (card.subtypes.includes("Basic") ? 2 : 1) : 1;
    add(counts, cardId, count);
    protectedIds.add(cardId);
  }
}
function rebalanceReviewedEngine(counts: Counts, engine: EngineDefinition, index: CatalogueIndex, protectedIds: Set<string>): void {
  const preferredEnergy = CANONICAL_BASIC_ENERGY_IDS[engine.energyTypes[0]?.toLowerCase() ?? ""];
  if (!preferredEnergy || !index.byId.has(preferredEnergy)) return;
  for (const [cardId, count] of [...counts]) if (index.byId.get(cardId)?.supertype === "Energy" && !protectedIds.has(cardId)) add(counts, cardId, -count);
  add(counts, preferredEnergy, Math.max(10, Math.min(12, counts.get(preferredEnergy) ?? 0)) - (counts.get(preferredEnergy) ?? 0));
  const filler = ["sv1-181", "sv1-196", "zsv10pt5-84", "sv6pt5-61", "sv4pt5-80", "sv4-163", "sv1-198", "sv1-175", "sv5-153", "sv1-191"];
  let cursor = 0;
  while (total(counts) < 60 && cursor < filler.length * 4) {
    const cardId = filler[cursor % filler.length]!;
    if ((counts.get(cardId) ?? 0) < 4) add(counts, cardId, 1);
    cursor += 1;
  }
  while (total(counts) > 60) removeFlex(counts, total(counts) - 60, protectedIds, index);
}
function baseCounts(engine: EngineKind, index: CatalogueIndex, favourites: readonly FavouriteSelection[]): Counts {
  const counts: Counts = new Map();
  if (engine === "fire-stage2") { addPackage(counts, "fire-stage2-core"); addPackage(counts, "fire-acceleration"); addPackage(counts, "fire-consistency"); add(counts, "swsh12-16", 1); add(counts, "sve-2", 12); }
  else if (engine === "darkness-poison") { addPackage(counts, "darkness-poison-core"); addPackage(counts, "darkness-utility"); add(counts, "sve-7", 11); }
  else if (engine === "team-rocket") { addPackage(counts, "team-rocket-core"); addPackage(counts, "team-rocket-engine"); add(counts, "sv10-182", 4); add(counts, "sve-7", 6); }
  else {
    addPackage(counts, "generic-setup"); const favourite = index.byId.get(favourites[0]?.cardId ?? ""); if (favourite) add(counts, favourite.id, favourite.subtypes.includes("Basic") ? 4 : 3);
    for (const [id, count] of [["sv4pt5-80",4],["sv1-189",4],["sv1-194",2],["sv2-188",2],["sv5-144",2]] as const) add(counts, id, count);
    const type = favourite?.types?.[0]?.toLowerCase() ?? "colorless"; const energyId = CANONICAL_BASIC_ENERGY_IDS[type] ?? "sve-7"; add(counts, energyId, Math.max(8, 60 - total(counts)));
  }
  return counts;
}

function removeFlex(counts: Counts, amount: number, protectedIds: Set<string>, index: CatalogueIndex): void {
  const priority = [...counts.keys()].filter((id) => !protectedIds.has(id)).sort((a, b) => { const cardA = index.byId.get(a), cardB = index.byId.get(b); const rank = (card?: PokemonCardMetadata) => card?.supertype === "Trainer" ? 0 : card?.supertype === "Energy" ? 1 : 2; return rank(cardA) - rank(cardB) || b.localeCompare(a); });
  let remaining = amount; for (const id of priority) { const removable = Math.min(remaining, counts.get(id) ?? 0); add(counts, id, -removable); remaining -= removable; if (!remaining) break; }
}

function chooseEvolution(index: CatalogueIndex, name: string, simulationReady: boolean): PokemonCardMetadata | undefined { return index.byName.get(normalizeCardName(name))?.filter((card) => !simulationReady || ["complete","generated"].includes(compileCardImplementation(card).status)).sort((a, b) => Number(b.legalities.standard === "Legal") - Number(a.legalities.standard === "Legal") || a.id.localeCompare(b.id))[0]; }
function lockFavourite(counts: Counts, favourite: FavouriteSelection, index: CatalogueIndex, mode: ArchitectRequest["mode"], protectedIds: Set<string>): void {
  const card = index.byId.get(favourite.cardId); if (!card) return; const family = implementationResolver()?.familyFor(card.id); const equivalentInDeck = [...counts.keys()].find((id) => id !== card.id && family && implementationResolver()?.familyFor(id)?.id === family.id);
  if (equivalentInDeck) { const count = counts.get(equivalentInDeck)!; counts.delete(equivalentInDeck); add(counts, card.id, count); }
  else if (!counts.has(card.id)) { const desired = card.supertype === "Pokémon" ? card.subtypes.includes("Basic") ? 3 : 2 : 1; add(counts, card.id, desired); removeFlex(counts, desired, new Set([...protectedIds, card.id]), index); }
  protectedIds.add(card.id);
  if (card.supertype === "Pokémon" && card.evolvesFrom) { let priorName: string | undefined = card.evolvesFrom; let count = card.subtypes.includes("Stage 2") ? 2 : 3; while (priorName) { const existingId = [...counts.keys()].find((id) => normalizeCardName(index.byId.get(id)?.name ?? "") === normalizeCardName(priorName!)); const prior: PokemonCardMetadata | undefined = existingId ? index.byId.get(existingId) : chooseEvolution(index, priorName, mode === "simulation-ready"); if (!prior) break; if (!counts.has(prior.id)) { add(counts, prior.id, count); removeFlex(counts, count, new Set([...protectedIds, prior.id]), index); } protectedIds.add(prior.id); priorName = prior.evolvesFrom; count = 4; } }
}

function applyVariation(counts: Counts, engine: EngineKind, variation: number, index: CatalogueIndex, protectedIds: Set<string>): void {
  const energyId = engine === "fire-stage2" ? "sve-2" : "sve-7";
  const changes: Array<Array<[string, number]>> = engine === "fire-stage2" ? [[],[["sv4pt5-84",1],[energyId,-1]],[["swsh6-145",1],["sv1-198",-1]],[[energyId,2],["sv1-198",-2]],[["sv4pt5-80",1],["sv1-198",-1]],[["swsh12-137",-1],["sv4pt5-84",1]],[["swsh9-144",-1],["sv1-175",1]],[["sv1-189",-1],["sv4pt5-80",1]],[["sv1-191",1],["sv1-198",-1]],[[energyId,1],["sv1-198",-1]]] : engine === "darkness-poison" ? [[],[["me3-81",1],["me2pt5-192",-1]],[["sv6pt5-61",1],["me2pt5-192",-1]],[[energyId,2],["me2pt5-192",-2]],[["me2pt5-183",1],["sv6pt5-57",-1]],[["sv6-131",-1],["zsv10pt5-84",1]],[["sv8pt5-95",1],["sv6pt5-57",-1]],[["sv6pt5-61",1],["sv6pt5-57",-1]],[["me3-81",1],["sv6pt5-57",-1]],[[energyId,1],["me2pt5-192",-1]]] : engine === "team-rocket" ? [[],[["sv5-144",1],[energyId,-1]],[["sv2-188",1],["sv10-171",-1]],[[energyId,2],["sv10-171",-2]],[["sv10-174",1],["sv10-171",-1]],[["sv6pt5-38",-1],["sv5-144",1]],[["sv10-182",-1],[energyId,1]],[["sv10-171",1],["sv10-170",-1]],[["sv1-191",1],["sv10-170",-1]],[[energyId,1],["sv10-170",-1]]] : [[],[["sv1-181",-1],["sv5-144",1]],[["sv6pt5-61",1],["sv4pt5-80",-1]],[[energyId,2],["sv4pt5-80",-2]],[["me2pt5-183",1],["sv1-189",-1]],[["sv5-144",-1],["sv1-181",1]],[["sv1-196",-1],["sv1-194",1]],[["sv1-189",-1],["sv4pt5-80",1]],[["sv1-191",1],["sv4pt5-80",-1]],[[energyId,1],["sv4pt5-80",-1]]];
  for (const [id, amount] of changes[variation % changes.length] ?? []) if (!protectedIds.has(id) || amount > 0) add(counts, id, amount);
  while (total(counts) > 60) removeFlex(counts, total(counts) - 60, protectedIds, index);
  if (total(counts) < 60) add(counts, energyId, 60 - total(counts));
}

function fingerprint(entries: readonly DeckCardEntry[]): string { return entries.map((entry) => `${entry.cardId}:${entry.count}`).sort().join("|"); }
function coverageExplanation(entries: readonly DeckCardEntry[], index: CatalogueIndex, simulationReady: boolean): string {
  const cards = entries.flatMap((entry) => index.byId.get(entry.cardId) ?? []);
  const families = new Set(cards.flatMap((card) => implementationResolver()?.familyFor(card.id)?.id ?? []));
  const inherited = cards.filter((card) => compileCardImplementation(card).implementationSource === "functional-reprint").length;
  return simulationReady
    ? `This deck is simulation-ready because all ${families.size} behaviour families are executable. ${inherited} exact printing selections inherit tested handlers from equivalent printings.`
    : `Creative candidate: ${cards.filter((card) => !["complete", "generated"].includes(compileCardImplementation(card).status)).length} exact printing selections still require executable behaviour.`;
}
export function estimateEnergyCount(entries: readonly DeckCardEntry[], index: CatalogueIndex): { count: number; explanation: string } { const pokemon = entries.flatMap((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" ? [{ card, count: entry.count }] : []; }); const maximumCost = Math.max(0, ...pokemon.flatMap(({ card }) => card.attacks?.map((attack) => attack.energy) ?? [])); const attackers = pokemon.filter(({ card }) => card.attacks?.some((attack) => Number(attack.damage.replace(/\D/g,"")) >= 80)).reduce((sum, value) => sum + value.count, 0); const acceleration = entries.some((entry) => ["sv1-41","swsh9-144","sv10-182","sv6pt5-59"].includes(entry.cardId)); const recovery = entries.some((entry) => ["sv6pt5-61","sv2-188","swsh12pt5-127"].includes(entry.cardId)); const count = Math.max(8, Math.min(15, 7 + maximumCost + Math.ceil(attackers / 3) - Number(acceleration) - Number(recovery))); return { count, explanation: `${count} Energy recommended from maximum attack cost ${maximumCost}, ${attackers} attacker copies, ${acceleration ? "with" : "without"} acceleration and ${recovery ? "with" : "without"} recovery.` }; }

export function generateLegacyCandidates(request: ArchitectRequest, index: CatalogueIndex): { candidates: ArchitectCandidate[]; rejected: Array<{ cardId: string; reasons: string[]; equivalentSupportedIds: string[] }> } {
  const rejected = request.favourites.flatMap((favorite) => { const card = index.byId.get(favorite.cardId); if (!card) return [{ cardId: favorite.cardId, reasons: ["Card is missing from the catalogue."], equivalentSupportedIds: [] }]; const implementation = compileCardImplementation(card); if (request.mode === "simulation-ready" && !["complete","generated"].includes(implementation.status)) return [{ cardId: card.id, reasons: implementation.knownLimitations, equivalentSupportedIds: (implementationResolver()?.equivalentsFor(card.id) ?? []).filter((value) => ["complete","generated"].includes(compileCardImplementation(value).status)).map((value) => value.id) }]; return []; });
  if (rejected.length || !request.favourites.length) return { candidates: [], rejected };
  const engine = engineFor(request.favourites); const reviewedEngine = reviewedEngineFor(request.favourites, index); const candidates: ArchitectCandidate[] = []; const seen = new Set<string>();
  for (let offset = 0; candidates.length < request.candidateCount && offset < 30; offset += 1) {
    const variation = (request.seed + offset) % variationNames.length; const counts = baseCounts(engine, index, request.favourites); const protectedIds = new Set<string>();
    if (engine === "generic") addReviewedComplements(counts, reviewedEngine, index, request.favourites, request.mode, protectedIds);
    for (const favourite of request.favourites) lockFavourite(counts, favourite, index, request.mode, protectedIds); applyVariation(counts, engine, variation, index, protectedIds);
    if (engine === "generic" && reviewedEngine) rebalanceReviewedEngine(counts, reviewedEngine, index, protectedIds);
    const entries = [...counts].filter(([, count]) => count > 0).map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId)); const print = fingerprint(entries); if (seen.has(print)) continue; seen.add(print);
    const deck: DeckManifest = { id: `architect-${engine}-${request.favourites[0]!.cardId}-${request.seed}-${offset}`, name: `${index.byId.get(request.favourites[0]!.cardId)?.name ?? "Favourite"} — ${variationNames[variation]}`, description: reviewedEngine ? `Deck Architect candidate assembled from the reviewed ${reviewedEngine.name} capability chain: ${reviewedEngine.reviewNotes[0] ?? "provider and consumer roles are explicit"}.` : `Deck Architect candidate generated from reviewed ${engine} packages.`, format: request.format, source: "saved", entries };
    const analysis = analyseDeck(deck, index); const unsupportedCardIds = analysis.unsupported.map((card) => card.id); if (request.mode === "simulation-ready" && (!analysis.simulationReady || unsupportedCardIds.length)) continue;
    const edges = buildSynergyGraph(entries.map((entry) => entry.cardId), index, request.mode === "creative"); const score = scoreCandidate(deck, request.favourites, index, edges, unsupportedCardIds.length); const energy = estimateEnergyCount(entries, index);
    candidates.push({ id: deck.id, seed: request.seed, variant: variationNames[variation]!, requiredCardIds: request.favourites.map((favorite) => favorite.cardId), deck, simulationReady: analysis.simulationReady, score, explanations: [coverageExplanation(entries, index, analysis.simulationReady), reviewedEngine ? `Complement chain selected: ${reviewedEngine.name}. ${reviewedEngine.providers.slice(0, 3).map((provider) => `${provider.cardId} provides ${provider.kind}`).join("; ")}.` : packageById(engine === "fire-stage2" ? "fire-stage2-core" : engine === "darkness-poison" ? "darkness-poison-core" : engine === "team-rocket" ? "team-rocket-core" : "generic-setup").explanation, ...edges.slice(0, 4).flatMap((edge) => edge.reasons), energy.explanation], synergyEdges: edges, unsupportedCardIds, energyExplanation: energy.explanation, fingerprint: print });
  }
  return { candidates, rejected };
}
