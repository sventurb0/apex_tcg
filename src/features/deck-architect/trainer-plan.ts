import type { DeckCardEntry } from "../../data/decks/types";
import type { ArchitectKnowledgeBase, ArchitectProfile, ArchitectRequest } from "./types";
import type { CatalogueIndex } from "../../data/pokemon";
import type { EngineDefinition } from "./engines/types";

export type TrainerRole = "basic-search" | "evolution-search" | "draw" | "switching" | "gust" | "recovery" | "stadium" | "tool" | "discard";
export interface TrainerRoleBudget { [role: string]: number; }
export interface TrainerPlan { entries: DeckCardEntry[]; roleBudget: TrainerRoleBudget; providers: Record<TrainerRole, string[]>; unmetRoles: TrainerRole[]; explanations: string[]; }
export function constructTrainerPlan(request: ArchitectRequest, index: CatalogueIndex, knowledge: ArchitectKnowledgeBase, engine?: EngineDefinition, profile: ArchitectProfile = "balanced"): TrainerPlan {
  const providers: Record<TrainerRole, string[]> = { "basic-search": [], "evolution-search": [], draw: [], switching: [], gust: [], recovery: [], stadium: [], tool: [], discard: [] };
  const excluded = new Set(request.excludedCardIds ?? []);
  const usable = (id: string) => index.byId.has(id) && !excluded.has(id) && ["complete", "generated"].includes(knowledge.cardProfiles.get(id)?.simulationSupport ?? "");
  const stageTwo = request.favourites.some((favorite) => index.byId.get(favorite.cardId)?.subtypes.includes("Stage 2"));
  const evolved = request.favourites.some((favorite) => Boolean(index.byId.get(favorite.cardId)?.evolvesFrom));
  const roleBudget: TrainerRoleBudget = {
    "basic-search": profile === "turbo" ? 8 : 6,
    "evolution-search": evolved ? (stageTwo ? 5 : 3) : 0,
    draw: profile === "turbo" ? 9 : profile === "resilient" ? 7 : 8,
    switching: profile === "control" ? 3 : 2,
    gust: profile === "aggressive" || profile === "control" ? 3 : 2,
    recovery: profile === "resilient" ? 4 : 2,
    stadium: engine?.consumers.some((consumer) => consumer.kind === "specific-stadium") ? 2 : 0,
    tool: engine?.consumers.some((consumer) => consumer.kind === "specific-tool" || consumer.kind === "poisoned-attacker") ? 2 : 0,
    discard: engine?.consumers.some((consumer) => consumer.kind === "discard-resource") ? 2 : 0,
  };
  const roleCandidates: Record<TrainerRole, string[]> = {
    "basic-search": ["sv1-196", "me1-131"],
    "evolution-search": stageTwo ? ["me1-125", "sv4-163"] : ["sv4-163", "me1-131"],
    draw: profile === "resilient" ? ["me1-119", "sv1-189", "sv1-181"] : ["sv1-181", "sv1-198", "me1-119"],
    switching: ["me1-130", "sv6pt5-57"],
    gust: ["me1-114", "sv1-189"],
    recovery: ["sv6pt5-61", "me2pt5-183", "sv2-188"],
    stadium: (engine?.providers ?? []).filter((provider) => index.byId.get(provider.cardId)?.subtypes.includes("Stadium")).map((provider) => provider.cardId),
    tool: (engine?.providers ?? []).filter((provider) => index.byId.get(provider.cardId)?.subtypes.includes("Pokémon Tool")).map((provider) => provider.cardId),
    discard: ["me1-131", "sv1-181"],
  };
  const counts = new Map<string, number>();
  for (const role of Object.keys(roleBudget) as TrainerRole[]) {
    let remaining = roleBudget[role] ?? 0;
    for (const id of roleCandidates[role].filter(usable)) {
      if (remaining <= 0) break;
      const amount = Math.min(4 - (counts.get(id) ?? 0), Math.ceil(remaining / Math.max(1, roleCandidates[role].length)));
      if (amount <= 0) continue;
      counts.set(id, (counts.get(id) ?? 0) + amount); providers[role].push(id); remaining -= amount;
    }
  }
  const entries = [...counts].map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId));
  const unmetRoles = (Object.keys(roleBudget) as TrainerRole[]).filter((role) => roleBudget[role]! > 0 && !providers[role].length);
  return { entries, roleBudget, providers, unmetRoles, explanations: [`Trainer roles were budgeted for ${engine?.name ?? "the selected favourites"}.`, `${profile} prioritizes ${profile === "turbo" ? "search and draw" : profile === "resilient" ? "recovery" : profile === "control" ? "gust and denial" : profile === "aggressive" ? "gust and damage conversion" : "balanced setup and switching"}.`, ...unmetRoles.map((role) => `No reviewed provider was found for ${role}; the role remains unmet.`)] };
}
