import { CANONICAL_BASIC_ENERGY_IDS, type CatalogueIndex } from "../../data/pokemon";
import type { DeckCardEntry } from "../../data/decks/types";
import type { ArchitectKnowledgeBase, ArchitectProfile, ArchitectRequest } from "./types";
import type { EngineDefinition } from "./engines/types";
import { energyPlanTemplates, type EnergyPlanTemplate } from "./energy-plans";

export interface EnergyPlanEntry { attack: string; requiredUnits: number; eligibleEnergyCards: string[]; accelerationPath: string[]; expectedTurnsToPay: number; coverageWarning?: string; }
export interface ConstructiveEnergyPlan { entries: DeckCardEntry[]; attacks: EnergyPlanEntry[]; explanation: string[]; warnings: string[]; }
function chooseTemplate(engine: EngineDefinition | undefined, profile: ArchitectProfile): EnergyPlanTemplate {
  if (engine?.energyTypes.length && engine.energyTypes.length >= 3) return energyPlanTemplates.find((template) => template.id === "three-colour")!;
  if (engine?.energyTypes.length === 2) return energyPlanTemplates.find((template) => template.id === "two-colour")!;
  if (profile === "turbo") return energyPlanTemplates.find((template) => template.id === "single-type-high-cost")!;
  if (profile === "control") return energyPlanTemplates.find((template) => template.id === "control")!;
  return energyPlanTemplates.find((template) => template.id === "single-type-low-cost")!;
}
export function constructEnergyPlan(request: ArchitectRequest, index: CatalogueIndex, knowledge: ArchitectKnowledgeBase, engine?: EngineDefinition, profile: ArchitectProfile = "balanced"): ConstructiveEnergyPlan {
  const template = chooseTemplate(engine, profile);
  const printedAttackTypes = request.favourites.flatMap((favorite) => index.byId.get(favorite.cardId)?.attacks?.flatMap((attack) => attack.cost.filter((type) => type !== "Colorless")) ?? []);
  const types = engine?.energyTypes.length ? engine.energyTypes : [...new Set(printedAttackTypes.length ? printedAttackTypes : request.favourites.flatMap((favorite) => index.byId.get(favorite.cardId)?.types ?? []))].slice(0, 3);
  const ids = [...new Set(types.map((type) => CANONICAL_BASIC_ENERGY_IDS[type.toLowerCase()]).filter((id): id is string => Boolean(id && index.byId.has(id))))];
  const requestedCount = profile === "turbo" ? template.maximum : profile === "resilient" ? Math.max(template.minimum, template.maximum - 2) : profile === "control" ? template.minimum : Math.ceil((template.minimum + template.maximum) / 2);
  const count = Math.max(template.minimum, Math.min(template.maximum, requestedCount));
  const entries = ids.length ? ids.map((id, position) => ({ cardId: id, count: position === 0 ? Math.max(1, count - Math.max(0, ids.length - 1)) : 1 })).filter((entry) => entry.count > 0) : [{ cardId: "sve-7", count }];
  const attacks = request.favourites.flatMap((favorite) => knowledge.cardProfiles.get(favorite.cardId)?.energyDemand ?? []).map((demand) => ({ attack: demand.attackName, requiredUnits: demand.units, eligibleEnergyCards: ids, accelerationPath: (knowledge.cardProfiles.get(request.favourites[0]?.cardId ?? "")?.capabilities ?? []).filter((capability) => capability.kind.includes("energy")).map((capability) => capability.explanation), expectedTurnsToPay: Math.max(1, Math.ceil(demand.units / Math.max(1, profile === "turbo" ? 2 : 1))), coverageWarning: ids.length ? undefined : "No canonical Energy printing matched the intended attack types." }));
  return { entries, attacks, explanation: [`Applied reviewed Energy template ${template.name} (${template.minimum}-${template.maximum} cards) for ${engine?.name ?? "the selected attack types"}.`, ...template.notes, ...attacks.map((attack) => `${attack.attack}: ${attack.requiredUnits} units, expected payment in ${attack.expectedTurnsToPay} turn(s).`)], warnings: [...template.specialEnergy.filter((id) => !index.byId.has(id)).map((id) => `Special Energy ${id} is not in the current catalogue.`), ...attacks.flatMap((attack) => attack.coverageWarning ? [attack.coverageWarning] : [])] };
}
