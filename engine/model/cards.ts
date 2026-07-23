export type CardId = string;
export type CardType = "fire" | "water" | "lightning" | "grass" | "fighting" | "psychic" | "darkness" | "metal" | "dragon" | "fairy" | "colorless";
export type ImplementationStatus = "complete" | "generated" | "partial" | "placeholder" | "unsupported";
export type PokemonStage = "basic" | "stage1" | "stage2";
export type TrainerSubtype = "item" | "supporter" | "stadium" | "tool";
export type SpecialCondition = "asleep" | "burned" | "confused" | "paralyzed" | "poisoned";
export type CardTrait = "team-rocket" | "pokemon-ex" | "radiant" | "ace-spec";
export interface PoisonCondition { countersPerCheckup: number; sourceCardId?: string; }

export type AttackDamage =
  | { kind: "none"; printed: string }
  | { kind: "fixed"; amount: number; printed: string }
  | { kind: "formula"; printed: string; resolverId: string };

export interface AttackDefinition {
  id: string;
  name: string;
  cost: Partial<Record<CardType, number>>;
  damage: AttackDamage;
  text?: string;
  effectProgramId?: string;
}

export type AbilityCategory = "activated" | "passive" | "triggered";
export type AbilityUsageLimit = "unrestricted" | "once-per-turn-per-pokemon" | "once-per-turn-by-name" | "once-per-game";
export interface AbilityTargetingRules {
  sourceMayBeActive: boolean;
  sourceMayBeBenched: boolean;
  targetKind?: "self" | "own-pokemon" | "own-benched-pokemon" | "attached-energy";
}

export interface AbilityDefinition {
  id: string;
  name: string;
  text: string;
  category: AbilityCategory;
  usageLimit: AbilityUsageLimit;
  effectProgramId: string;
  targeting: AbilityTargetingRules;
}

export interface PokemonCard {
  id: CardId;
  name: string;
  category: "pokemon";
  pokemonType: CardType;
  stage: PokemonStage;
  evolvesFrom?: string;
  hp: number;
  ruleBox?: "single-prize" | "multi-prize";
  hasRuleBox?: boolean;
  isPokemonEx?: boolean;
  prizeValue?: number;
  abilities: AbilityDefinition[];
  attacks: AttackDefinition[];
  weakness?: { type: CardType; multiplier: number };
  resistance?: { type: CardType; amount: number };
  retreatCost: number;
  regulationMark?: string;
  implementationStatus: ImplementationStatus;
  traits?: CardTrait[];
}

export interface EnergyCard {
  id: CardId;
  name: string;
  category: "energy";
  energyType: CardType;
  basic: boolean;
  traits?: CardTrait[];
  supplyOptions?: Array<Partial<Record<CardType, number>>>;
  attachOnlyToTrait?: CardTrait;
  implementationStatus: ImplementationStatus;
}

export interface TrainerCard {
  id: CardId;
  name: string;
  category: "trainer";
  subtype: TrainerSubtype;
  text: string;
  effectProgramId: string;
  implementationStatus: ImplementationStatus;
  traits?: CardTrait[];
  canPlayGoingFirstFirstTurn?: boolean;
}

export type CardDefinition = PokemonCard | EnergyCard | TrainerCard;

export interface CardInstance { instanceId: string; cardId: CardId; }

export interface PokemonInPlay {
  stack: CardInstance[];
  damage: number;
  attachedEnergy: CardInstance[];
  tool?: CardInstance;
  specialConditions: SpecialCondition[];
  poison?: PoisonCondition;
  enteredPlayTurn: number;
  evolvedThisTurn: boolean;
  abilityUsage: Record<string, number>;
}
