import type { CatalogueIndex } from "../../data/pokemon";
import { compileCardImplementation, implementationResolver } from "../../data/pokemon";
import { tournamentDecks } from "../../data/decks/corpus";
import { deriveSourcePackages } from "./engines/source-packages";
import { engineDefinitions } from "./engines/definitions";
import { reviewedSynergyChains } from "./engines/synergy-chains";
import { generateDeckStrategyPlan } from "./engines/strategy-plans";
import { buildCardRoleProfile } from "./card-profile";
import type { ArchitectKnowledgeBase, SemanticCardProfile, SelectedCardRole } from "./types";

const cache = new WeakMap<object, ArchitectKnowledgeBase>();

function profileFor(card: ReturnType<CatalogueIndex["byId"]["get"]>, index: CatalogueIndex): SemanticCardProfile | undefined {
  if (!card) return undefined;
  const role = buildCardRoleProfile(card, index);
  const family = implementationResolver()?.familyFor(card.id);
  const engines = engineDefinitions.filter((engine) => engine.coreCardIds.includes(card.id) || engine.providers.some((provider) => provider.cardId === card.id) || engine.consumers.some((consumer) => consumer.cardId === card.id));
  const capabilities = engines.flatMap((engine) => engine.providers.filter((provider) => provider.cardId === card.id));
  const requirements = engines.flatMap((engine) => engine.consumers.filter((consumer) => consumer.cardId === card.id));
  const roles: SelectedCardRole[] = [];
  if (role.attackTags.some((tag) => tag === "primary-attacker")) roles.push("primary-attacker");
  if (capabilities.some((capability) => ["draw", "search", "energy-from-deck", "energy-from-hand", "energy-movement", "evolution-acceleration"].includes(capability.kind))) roles.push("support", "engine-core");
  if (!roles.length) roles.push(card.supertype === "Pokémon" ? "tech" : "support");
  const sourceCounts: SemanticCardProfile["sourceCounts"] = {};
  for (const deck of tournamentDecks) {
    const entry = deck.manifest?.entries.find((item) => item.cardId === card.id);
    if (entry) sourceCounts[deck.id] = { average: entry.count, minimum: entry.count, maximum: entry.count };
  }
  return {
    ...role,
    behaviourFamilyId: family?.id ?? `card:${card.id}`,
    roles: [...new Set(roles)],
    capabilities,
    requirements,
    attackPlans: (card.attacks ?? []).map((attack) => ({ attackName: attack.name, energy: attack.energy, damage: Number(attack.damage.replace(/\D/g, "")) || 0, executable: ["complete", "generated"].includes(compileCardImplementation(card).status) })),
    abilityPlans: (card.abilities ?? []).map((ability) => ({ abilityName: ability.name, executable: ["complete", "generated"].includes(compileCardImplementation(card).status) })),
    energyDemand: (card.attacks ?? []).map((attack) => ({ type: attack.cost[0] ?? card.types?.[0] ?? "Colorless", units: attack.energy, attackName: attack.name })),
    benchDemand: engines.length ? Math.max(...engines.map((engine) => engine.benchDemand)) : (card.supertype === "Pokémon" ? 1 : 0),
    stadiumDependencies: requirements.filter((requirement) => requirement.kind === "specific-stadium").flatMap((requirement) => requirement.filters.flatMap((filter) => filter.field === "card-id" ? filter.values : [])),
    toolDependencies: requirements.filter((requirement) => requirement.kind === "specific-tool").flatMap((requirement) => requirement.filters.flatMap((filter) => filter.field === "card-id" ? filter.values : [])),
    traitDependencies: requirements.filter((requirement) => requirement.kind === "team-trait").flatMap((requirement) => requirement.filters.flatMap((filter) => filter.field === "trait" ? filter.values : [])),
    discardDependencies: requirements.filter((requirement) => requirement.kind === "discard-resource").map((requirement) => requirement.explanation),
    prizeStateDependencies: requirements.filter((requirement) => requirement.kind === "prize-state").map((requirement) => requirement.explanation),
    conflicts: engines.flatMap((engine) => engine.conflicts.map((conflict) => conflict.explanation)),
    sourceDeckIds: [...new Set(tournamentDecks.filter((deck) => deck.manifest?.entries.some((entry) => entry.cardId === card.id)).map((deck) => deck.id))],
    sourceCounts,
  };
}

export function buildArchitectKnowledgeBase(index: CatalogueIndex): ArchitectKnowledgeBase {
  const cached = cache.get(index);
  if (cached) return cached;
  const relevantIds = new Set<string>(tournamentDecks.flatMap((deck) => deck.manifest?.entries.map((entry) => entry.cardId) ?? []));
  for (const engine of engineDefinitions) for (const id of [...engine.coreCardIds, ...engine.providers.map((provider) => provider.cardId), ...engine.consumers.map((consumer) => consumer.cardId)]) relevantIds.add(id);
  const cardProfiles = new Map<string, SemanticCardProfile>();
  for (const card of index.cards) { if (!relevantIds.has(card.id)) continue; const profile = profileFor(card, index); if (profile) cardProfiles.set(card.id, profile); }
  const sourcePackages = new Map(deriveSourcePackages({ version: 1, generatedAt: "architect", sourcePolicy: "reviewed", decks: [...tournamentDecks] }).map((pkg) => [pkg.id, pkg] as const));
  const strategyPlans = new Map(tournamentDecks.map((deck) => [deck.id, generateDeckStrategyPlan(deck)] as const));
  const cardsByCapability = new Map<import("./engines/types").CapabilityKind, string[]>();
  const cardsByRequirement = new Map<import("./engines/types").RequirementKind, string[]>();
  for (const profile of cardProfiles.values()) {
    for (const capability of profile.capabilities) cardsByCapability.set(capability.kind, [...(cardsByCapability.get(capability.kind) ?? []), profile.cardId]);
    for (const requirement of profile.requirements) cardsByRequirement.set(requirement.kind, [...(cardsByRequirement.get(requirement.kind) ?? []), profile.cardId]);
  }
  const decksByCardFamily = new Map<string, string[]>();
  for (const deck of tournamentDecks) for (const entry of deck.manifest?.entries ?? []) { const family = implementationResolver()?.familyFor(entry.cardId)?.id ?? `card:${entry.cardId}`; decksByCardFamily.set(family, [...(decksByCardFamily.get(family) ?? []), deck.id]); }
  const decksByEngine = new Map<string, string[]>();
  for (const engine of engineDefinitions) decksByEngine.set(engine.id, [...engine.sourceDeckIds]);
  const knowledge: ArchitectKnowledgeBase = { cardProfiles, engineDefinitions: new Map(engineDefinitions.map((engine) => [engine.id, engine])), sourcePackages, synergyChains: [...reviewedSynergyChains], strategyPlans, sourceDecks: tournamentDecks, cardsByCapability, cardsByRequirement, decksByCardFamily, decksByEngine };
  cache.set(index, knowledge);
  return knowledge;
}
