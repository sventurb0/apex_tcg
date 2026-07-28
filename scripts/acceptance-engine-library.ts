import { engineDefinitions } from "../src/features/deck-architect/engines/definitions";
import { deckPackages } from "../src/features/deck-architect/packages";
import { reviewedSynergyChains } from "../src/features/deck-architect/engines/synergy-chains";
import { energyPlanTemplates } from "../src/features/deck-architect/energy-plans";
import type { PokemonType } from "../src/data/pokemon/types";

const supportedTypes: PokemonType[] = ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Dragon", "Colorless", "Fairy"];
const unique = (values: string[]) => new Set(values).size === values.length;
const missingTypes = supportedTypes.filter((type) => !energyPlanTemplates.some((template) => template.types.includes(type)));
const result = {
  reviewedEngines: engineDefinitions.filter((engine) => engine.reviewed).length,
  trainerPackages: deckPackages.length,
  reviewedPokemonSynergies: reviewedSynergyChains.filter((chain) => chain.confidence === "reviewed").length,
  energyPlanTemplates: energyPlanTemplates.length,
  missingEnergyTypes: missingTypes,
  ontologyComplete: engineDefinitions.every((engine) => engine.corePokemon.length > 0 && engine.trainerPackage.length > 0 && engine.energyPlan.length > 0 && engine.setupSequence && engine.mainAttackPlan && engine.recoveryPlan),
  duplicateEngineIds: !unique(engineDefinitions.map((engine) => engine.id)),
  duplicatePackageIds: !unique(deckPackages.map((pack) => pack.id)),
  duplicateSynergyIds: !unique(reviewedSynergyChains.map((chain) => chain.id)),
};
console.log(JSON.stringify(result, null, 2));
if (result.reviewedEngines < 20 || result.trainerPackages < 25 || result.reviewedPokemonSynergies < 25 || result.missingEnergyTypes.length || !result.ontologyComplete || result.duplicateEngineIds || result.duplicatePackageIds || result.duplicateSynergyIds) process.exitCode = 1;
