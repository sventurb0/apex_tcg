import type { NormalizedCorpusDeck } from "../../../data/decks/corpus/types";
import { engineDefinitions } from "./definitions";
import type { DeckStrategyPlan, EngineDefinition } from "./types";

function matchingEngines(deck: NormalizedCorpusDeck): EngineDefinition[] {
  const ids = new Set(deck.manifest?.entries.map((entry) => entry.cardId) ?? []);
  return engineDefinitions.filter((engine) => engine.sourceDeckIds.includes(deck.id) || engine.coreCardIds.some((id) => ids.has(id))).sort((a, b) => b.coreCardIds.filter((id) => ids.has(id)).length - a.coreCardIds.filter((id) => ids.has(id)).length);
}

export function generateDeckStrategyPlan(deck: NormalizedCorpusDeck): DeckStrategyPlan {
  const ids = new Set(deck.manifest?.entries.map((entry) => entry.cardId) ?? []);
  const engines = matchingEngines(deck);
  const providers = engines.flatMap((engine) => engine.providers).filter((item) => ids.has(item.cardId));
  const consumers = engines.flatMap((engine) => engine.consumers).filter((item) => ids.has(item.cardId));
  const primaryAttackers = [...new Set(consumers.filter((item) => item.kind === "energy").map((item) => item.cardId))];
  const setupCardIds = [...new Set(providers.filter((item) => ["search","draw","energy-from-deck","energy-from-hand","evolution-acceleration","top-deck-control"].includes(item.kind)).map((item) => item.cardId))];
  const stadiumCardIds = [...new Set(consumers.filter((item) => item.kind === "specific-stadium").map((item) => item.cardId).filter((id) => ids.has(id)))];
  return {
    deckId: deck.manifest?.id ?? deck.id,
    engines: engines.map((engine) => engine.id),
    primaryAttackers,
    secondaryAttackers: [...new Set(engines.flatMap((engine) => engine.coreCardIds).filter((id) => ids.has(id) && !primaryAttackers.includes(id)))],
    setupPriorities: setupCardIds.map((cardId, index) => ({ cardId, priority: 100 - index * 5, reason: providers.find((item) => item.cardId === cardId)?.explanation ?? "Reviewed engine setup provider." })),
    capabilityPriorities: [...new Map(providers.map((item) => [item.kind, item])).values()].map((item, index) => ({ kind: item.kind, priority: 100 - index * 4, reason: item.explanation })),
    protectedResources: consumers.filter((item) => item.kind === "discard-resource" || item.kind === "energy").map((item) => ({ cardId: item.cardId, resource: item.kind, rule: item.explanation })),
    benchPlan: { desiredSpaces: Math.min(8, Math.max(2, ...engines.map((engine) => engine.benchDemand))), setupCardIds, attackerCardIds: primaryAttackers, notes: engines.flatMap((engine) => engine.reviewNotes).slice(0, 4) },
    stadiumPlan: stadiumCardIds.length ? { preferredCardIds: stadiumCardIds, preserveWhile: "Its reviewed engine requirement remains active; replace only when the replacement plan is higher priority." } : undefined,
    prizePlan: { profile: engines[0]?.prizeProfile ?? deck.tags.prizeProfile, notes: ["Map prizes from public board and prize counts only; never inspect hidden opponent information."] },
    targetSelectionRules: [{ priority:100,rule:"Prefer a legal Knock Out visible from public state."},{priority:80,rule:"For spread damage, select public targets that improve the next reviewed attack or damage-counter plan."},{priority:60,rule:"Do not expose protected setup providers when a legal attacker is available."}],
    overrides: deck.snapshot.archetype.includes("Slowking") ? [{ condition:"Academy at Night is usable and a non-Rule-Box Pokémon is in hand",instruction:"Order the intended copied attack before using Seek Inspiration." }] : undefined,
  };
}

