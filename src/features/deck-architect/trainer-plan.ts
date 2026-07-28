import type { DeckCardEntry } from "../../data/decks/types";
import type { ArchitectKnowledgeBase, ArchitectProfile, ArchitectRequest } from "./types";
import type { CatalogueIndex } from "../../data/pokemon";
import type { EngineDefinition } from "./engines/types";

export type TrainerRole = "basic-search" | "evolution-search" | "draw" | "switching" | "gust" | "recovery" | "stadium" | "tool" | "discard";
export interface TrainerRoleBudget { [role: string]: number; }
export interface TrainerPlan { entries: DeckCardEntry[]; roleBudget: TrainerRoleBudget; providers: Record<TrainerRole, string[]>; unmetRoles: TrainerRole[]; explanations: string[]; }
export function constructTrainerPlan(request: ArchitectRequest, index: CatalogueIndex, knowledge: ArchitectKnowledgeBase, engine?: EngineDefinition, profile: ArchitectProfile = "balanced"): TrainerPlan {
  const providers: Record<TrainerRole, string[]> = { "basic-search": [], "evolution-search": [], draw: [], switching: [], gust: [], recovery: [], stadium: [], tool: [], discard: [] };
  for (const capability of engine?.providers ?? []) { const role: TrainerRole = capability.kind === "search" ? "basic-search" : capability.kind === "draw" ? "draw" : capability.kind === "switch" ? "switching" : capability.kind === "gust" ? "gust" : capability.kind.includes("discard") ? "recovery" : "discard"; if (index.byId.has(capability.cardId)) providers[role].push(capability.cardId); }
  const roleBudget: TrainerRoleBudget = { "basic-search": 8, "evolution-search": 4, draw: profile === "turbo" ? 10 : 8, switching: 2, gust: profile === "aggressive" || profile === "control" ? 3 : 2, recovery: profile === "resilient" ? 5 : 3, stadium: engine?.consumers.some((consumer) => consumer.kind === "specific-stadium") ? 3 : 1, tool: engine?.consumers.some((consumer) => consumer.kind === "specific-tool") ? 3 : 1, discard: 2 };
  const roleTags: Record<TrainerRole, string[]> = { "basic-search": ["pokemon-search", "energy-search"], "evolution-search": ["pokemon-search"], draw: ["draw"], switching: ["switching"], gust: ["gust"], recovery: ["discard-recovery"], stadium: [], tool: [], discard: ["discard-recovery"] };
  const entries: DeckCardEntry[] = [];
  for (const role of Object.keys(roleBudget) as TrainerRole[]) {
    const target = Math.min(4, Math.max(1, Math.ceil(roleBudget[role]! / 4)));
    const candidates = [...knowledge.cardProfiles.values()].filter((profileCard) => index.byId.get(profileCard.cardId)?.supertype === "Trainer" && index.byId.get(profileCard.cardId)?.legalities.standard === "Legal" && (roleTags[role].length === 0 || roleTags[role].some((tag) => profileCard.trainerEnergyRoles.includes(tag as never))) && ["complete", "generated"].includes(profileCard.simulationSupport)).sort((a, b) => b.sourceDeckIds.length - a.sourceDeckIds.length || a.cardId.localeCompare(b.cardId));
    for (const candidate of candidates.slice(0, 2)) entries.push({ cardId: candidate.cardId, count: target });
  }
  if (!entries.length && request.favourites.length) {
    const fallback = [...knowledge.cardProfiles.values()].find((profileCard) => index.byId.get(profileCard.cardId)?.supertype === "Trainer" && index.byId.get(profileCard.cardId)?.legalities.standard === "Legal" && ["complete", "generated"].includes(profileCard.simulationSupport));
    if (fallback) entries.push({ cardId: fallback.cardId, count: 2 });
  }
  const unmetRoles = (Object.keys(roleBudget) as TrainerRole[]).filter((role) => !providers[role].length && roleBudget[role]! > 0);
  return { entries, roleBudget, providers, unmetRoles, explanations: [`Trainer roles were budgeted for ${engine?.name ?? "the selected favourites"}.`, `${profile} prioritizes ${profile === "turbo" ? "search and draw" : profile === "resilient" ? "recovery" : profile === "control" ? "gust and denial" : profile === "aggressive" ? "gust and damage conversion" : "balanced setup and switching"}.`, ...unmetRoles.map((role) => `No reviewed provider was found for ${role}; the role remains unmet.`)] };
}
