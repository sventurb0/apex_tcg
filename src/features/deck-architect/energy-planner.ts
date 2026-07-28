import { CANONICAL_BASIC_ENERGY_IDS, type CatalogueIndex } from "../../data/pokemon";
import type { DeckCardEntry } from "../../data/decks/types";
import type { ArchitectKnowledgeBase, ArchitectProfile, ArchitectRequest } from "./types";
import type { EngineDefinition } from "./engines/types";

export interface EnergyPlanEntry { attack: string; requiredUnits: number; eligibleEnergyCards: string[]; accelerationPath: string[]; expectedTurnsToPay: number; coverageWarning?: string; }
export interface ConstructiveEnergyPlan { entries: DeckCardEntry[]; attacks: EnergyPlanEntry[]; explanation: string[]; warnings: string[]; }
export function constructEnergyPlan(request: ArchitectRequest, index: CatalogueIndex, knowledge: ArchitectKnowledgeBase, engine?: EngineDefinition, profile: ArchitectProfile = "balanced"): ConstructiveEnergyPlan {
  const types = engine?.energyTypes.length ? engine.energyTypes : request.favourites.flatMap((favorite) => index.byId.get(favorite.cardId)?.types ?? []).slice(0, 2);
  const ids = [...new Set(types.map((type) => CANONICAL_BASIC_ENERGY_IDS[type.toLowerCase()]).filter((id): id is string => Boolean(id && index.byId.has(id))))];
  const count = profile === "turbo" ? 14 : profile === "resilient" ? 11 : profile === "control" ? 10 : 12;
  const entries = ids.length ? ids.map((id, position) => ({ cardId: id, count: position === 0 ? count : 0 })).filter((entry) => entry.count > 0) : [{ cardId: "sve-7", count }];
  const attacks = request.favourites.flatMap((favorite) => knowledge.cardProfiles.get(favorite.cardId)?.energyDemand ?? []).map((demand) => ({ attack: demand.attackName, requiredUnits: demand.units, eligibleEnergyCards: ids, accelerationPath: (knowledge.cardProfiles.get(request.favourites[0]?.cardId ?? "")?.capabilities ?? []).filter((capability) => capability.kind.includes("energy")).map((capability) => capability.explanation), expectedTurnsToPay: Math.max(1, Math.ceil(demand.units / Math.max(1, profile === "turbo" ? 2 : 1))), coverageWarning: ids.length ? undefined : "No canonical Energy printing matched the intended attack types." }));
  return { entries, attacks, explanation: [`Constructed ${count} Energy cards for ${engine?.name ?? "the selected attack types"}.`, ...attacks.map((attack) => `${attack.attack}: ${attack.requiredUnits} units, expected payment in ${attack.expectedTurnsToPay} turn(s).`)], warnings: attacks.flatMap((attack) => attack.coverageWarning ? [attack.coverageWarning] : []) };
}
