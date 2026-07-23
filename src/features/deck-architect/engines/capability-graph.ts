import type { CapabilityFilter, EngineCapability, EngineDefinition, EngineRequirement, RequirementKind } from "./types";

const capabilityToRequirements: Readonly<Record<EngineCapability["kind"], RequirementKind[]>> = {
  "energy-from-deck": ["energy"], "energy-from-discard": ["energy", "discard-resource"], "energy-from-hand": ["energy"], "energy-movement": ["energy"],
  draw: ["hand-size", "discard-resource"], search: ["evolution-line", "energy", "specific-stadium", "specific-tool", "team-trait"],
  switch: ["bench-space"], gust: ["opponent-damage"], heal: ["damaged-attacker"], poison: ["poisoned-attacker"],
  "damage-counter-move": ["damaged-attacker", "opponent-damage"], "hp-modifier": ["damaged-attacker"], "damage-modifier": ["poisoned-attacker", "specific-tool", "opponent-damage"],
  "damage-prevention": ["damaged-attacker"], "prize-modifier": ["prize-state"], "item-lock": ["opponent-damage"], "ability-lock": ["opponent-damage"],
  "retreat-lock": ["opponent-damage"], "evolution-acceleration": ["evolution-line"], "discard-fill": ["discard-resource"],
  "top-deck-control": ["top-deck-order"], "bench-expansion": ["bench-space"], "bench-damage": ["opponent-damage"],
};

function valuesOverlap(left: CapabilityFilter, right: CapabilityFilter): boolean {
  if (left.field !== right.field) return true;
  return left.values.some((value) => right.values.includes(value) || value === "any" || right.values.includes("any"));
}

export function capabilitySatisfiesRequirement(capability: EngineCapability, requirement: EngineRequirement): boolean {
  if (!capabilityToRequirements[capability.kind].includes(requirement.kind)) return false;
  // A minimum is an executable constraint, not an annotation.  An unknown
  // amount must therefore not be treated as satisfying it.
  if (requirement.minimum !== undefined && (capability.amount === undefined || capability.amount < requirement.minimum)) return false;
  return requirement.filters.every((required) => {
    const comparable = capability.filters.filter((provided) => provided.field === required.field);
    // Missing a required trait/type/zone is not evidence of compatibility.
    // This prevents raw type co-occurrence (or an unqualified search card)
    // from becoming a semantic synergy edge.
    // card-id identifies the consumer card whose text is being satisfied; a
    // provider does not need to repeat that identity in its filters.
    if (comparable.length === 0) return required.field === "card-id";
    return comparable.some((provided) => valuesOverlap(provided, required));
  });
}

export function engineSynergyEdges(engine: EngineDefinition): Array<{ provider: EngineCapability; consumer: EngineRequirement }> {
  return engine.providers.flatMap((provider) => engine.consumers.filter((consumer) => provider.cardId !== consumer.cardId && capabilitySatisfiesRequirement(provider, consumer)).map((consumer) => ({ provider, consumer })));
}

/**
 * Build explainable chains from reviewed engine definitions.  Co-occurrence is
 * never used here: every edge must pass the capability/requirement graph.
 * The bounded depth keeps Architect search predictable while allowing the
 * two-to-five-card chains requested by the product contract.
 */
export function buildSynergyChains(engines: readonly EngineDefinition[], options: { maxCards?: number; sourceDeckIds?: string[] } = {}): Array<import("./types").SynergyChain> {
  const maxCards = Math.min(5, Math.max(2, options.maxCards ?? 5));
  const allowedSources = options.sourceDeckIds ? new Set(options.sourceDeckIds) : undefined;
  const edges = engines.flatMap((engine) => engineSynergyEdges(engine).map((edge) => ({ ...edge, engine })));
  const chains: Array<import("./types").SynergyChain> = [];
  const seen = new Set<string>();
  const walk = (steps: Array<{ provider: EngineCapability; consumer: EngineRequirement; engine: EngineDefinition }>) => {
    if (!steps.length) return;
    const cards = [...new Set(steps.flatMap((item) => [item.provider.cardId, item.consumer.cardId]))];
    if (cards.length >= 2) {
      const sourceDeckIds = [...new Set(steps.flatMap((item) => item.engine.sourceDeckIds))].filter((id) => !allowedSources || allowedSources.has(id));
      if (!allowedSources || sourceDeckIds.length) {
        const key = cards.join("|");
        if (!seen.has(key)) {
          seen.add(key);
          chains.push({
            id: `derived-${chains.length + 1}-${cards.join("-")}`,
            cardIds: cards,
            score: Math.min(100, 60 + steps.length * 8 + Math.min(20, sourceDeckIds.length * 2)),
            steps: steps.map((item) => ({ providerCardId: item.provider.cardId, consumerCardId: item.consumer.cardId, capability: item.provider, requirement: item.consumer, explanation: `${item.provider.cardId} provides ${item.provider.kind} for ${item.consumer.cardId}'s ${item.consumer.kind} requirement.` })),
            constraints: steps.flatMap((item) => item.engine.reviewNotes).slice(0, 4),
            sourceDeckIds,
            confidence: "derived",
          });
        }
      }
    }
    if (cards.length >= maxCards) return;
    const tailStep = steps.at(-1);
    if (!tailStep) return;
    const tail = tailStep.consumer.cardId;
    for (const next of edges) {
      if (next.provider.cardId !== tail || cards.includes(next.consumer.cardId)) continue;
      walk([...steps, next]);
    }
  };
  for (const edge of edges) walk([edge]);
  return chains;
}

export function engineCompatibility(left: EngineDefinition, right: EngineDefinition): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const stadiumConflict = left.conflicts.some((conflict) => conflict.kind === "stadium" && conflict.withEngineId === right.id) || right.conflicts.some((conflict) => conflict.kind === "stadium" && conflict.withEngineId === left.id);
  if (stadiumConflict) reasons.push("Conflicting central Stadium packages cannot both be treated as mandatory.");
  if (left.benchDemand + right.benchDemand > 8) reasons.push(`Combined bench demand ${left.benchDemand + right.benchDemand} exceeds the expanded eight-space ceiling.`);
  const teamRestricted = [...left.consumers, ...right.consumers].some((requirement) => requirement.kind === "team-trait" && (requirement.minimum ?? 0) >= 4);
  if (teamRestricted && [...left.coreCardIds, ...right.coreCardIds].length - [...new Set([...left.coreCardIds, ...right.coreCardIds])].length === 0 && left.id !== right.id) reasons.push("A minimum four-card team-trait board conflicts with an unrelated support engine's bench demand.");
  const provides = [...left.providers, ...right.providers];
  for (const requirement of [...left.consumers, ...right.consumers].filter((item) => item.kind === "energy")) if (!provides.some((capability) => capabilitySatisfiesRequirement(capability, requirement)) && ![...left.energyTypes, ...right.energyTypes].some((type) => requirement.filters.some((filter) => filter.field === "type" && filter.values.includes(type)))) reasons.push(`No structured provider satisfies ${requirement.cardId}'s Energy requirement.`);
  return { compatible: reasons.length === 0, reasons };
}
