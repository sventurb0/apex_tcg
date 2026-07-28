import type { CardType } from "./engines/types";

export type EnergyPlanId = string;
export interface EnergyPlanTemplate {
  id: EnergyPlanId;
  name: string;
  types: CardType[];
  minimum: number;
  maximum: number;
  acceleration: string[];
  recovery: string[];
  specialEnergy: string[];
  notes: string[];
}

export const energyPlanTemplates: readonly EnergyPlanTemplate[] = [
  { id:"single-type-low-cost", name:"Single-type low-cost", types:["Colorless"], minimum:8, maximum:11, acceleration:[], recovery:["energy-recovery"], specialEnergy:[], notes:["For one- and two-Energy attackers with low retreat demand."] },
  { id:"single-type-high-cost", name:"Single-type high-cost", types:["Fire"], minimum:12, maximum:16, acceleration:["fire-acceleration"], recovery:["discard-recovery"], specialEnergy:[], notes:["Protects high attack costs and discard acceleration from starvation."] },
  { id:"stage2-acceleration", name:"Stage 2 acceleration", types:["Grass","Fire","Metal"], minimum:11, maximum:15, acceleration:["rare-candy-stage-two","energy-from-discard"], recovery:["energy-recovery"], specialEnergy:[], notes:["Balances evolution burden with a first-attack target turn."] },
  { id:"discard-acceleration", name:"Discard acceleration", types:["Fighting","Fire"], minimum:10, maximum:14, acceleration:["discard-setup","energy-from-discard"], recovery:["discard-recovery"], specialEnergy:[], notes:["Requires deliberate discard access before the attack turn."] },
  { id:"two-colour", name:"Multi-type two-colour", types:["Fire","Psychic"], minimum:10, maximum:14, acceleration:["multitype-energy-search"], recovery:["energy-recovery"], specialEnergy:["me3-88"], notes:["Used by Dragapult and other two-type plans; counts each attack's coloured requirement separately."] },
  { id:"three-colour", name:"Multi-type three-colour", types:["Grass","Water","Psychic"], minimum:11, maximum:15, acceleration:["multitype-energy-search"], recovery:["energy-recovery"], specialEnergy:[], notes:["Crispin-style plans need distinct Basic Energy types in deck before search is counted."] },
  { id:"special-energy-heavy", name:"Special-Energy-heavy", types:["Psychic","Darkness"], minimum:8, maximum:13, acceleration:["special-energy-search"], recovery:["energy-recovery"], specialEnergy:["sv10-182","me3-88"], notes:["Special Energy clauses must be executable; unsupported special effects block the plan."] },
  { id:"toolbox-attackers", name:"Toolbox attackers", types:["Grass","Water","Lightning","Psychic","Dragon","Fairy"], minimum:10, maximum:14, acceleration:["multitype-energy-search"], recovery:["energy-recovery"], specialEnergy:[], notes:["Bench and attack selection are modelled as resource costs, not free flexibility."] },
  { id:"single-prize-low-energy", name:"Single-prize low-energy", types:["Psychic","Colorless"], minimum:7, maximum:10, acceleration:["basic-energy-search"], recovery:["pokemon-recovery"], specialEnergy:[], notes:["Preserves Trainer density for single-prize engines."] },
  { id:"energy-scaling", name:"Energy-scaling attacker", types:["Grass","Lightning"], minimum:12, maximum:17, acceleration:["energy-from-hand"], recovery:["energy-recovery"], specialEnergy:[], notes:["High density is deliberate when damage scales from total attached Energy."] },
  { id:"attack-copy", name:"Attack-copy deck", types:["Darkness","Psychic"], minimum:9, maximum:13, acceleration:["basic-energy-search"], recovery:["discard-recovery"], specialEnergy:[], notes:["Copies are selected by legal attack availability, not type alone."] },
  { id:"control", name:"Control deck", types:["Colorless","Psychic"], minimum:8, maximum:12, acceleration:["basic-energy-search"], recovery:["pokemon-recovery"], specialEnergy:[], notes:["Control lists trade raw Energy density for legal disruption and recovery."] },
];

export function energyPlanById(id: EnergyPlanId): EnergyPlanTemplate | undefined { return energyPlanTemplates.find((template) => template.id === id); }
