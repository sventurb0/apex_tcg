export type CardId = string;
export type CardType = "fire" | "water" | "lightning" | "grass" | "fighting" | "psychic" | "darkness" | "metal" | "dragon" | "fairy" | "colorless";
export type ImplementationStatus = "complete" | "generated" | "partial" | "placeholder" | "unsupported";
export type PokemonStage = "basic" | "stage1" | "stage2";
export type TrainerSubtype = "item" | "supporter" | "stadium" | "tool";
export type SpecialCondition = "asleep" | "burned" | "confused" | "paralyzed" | "poisoned";
export type CardTrait = "team-rocket" | "pokemon-ex" | "radiant" | "tera" | "ace-spec";
export interface PoisonCondition { countersPerCheckup: number; sourceCardId?: string; }

export type AttackDamage =
  | { kind: "none"; printed: string }
  | { kind: "fixed"; amount: number; printed: string }
  | { kind: "formula"; printed: string; resolverId: string };

export type AttackCondition =
  | { kind: "opponent-damaged" }
  | { kind: "opponent-has-prizes"; minimum: number }
  | { kind: "attached-energy"; minimum: number; energyType?: CardType }
  | { kind: "discard-energy"; minimum: number; energyType?: CardType };

export interface AttackDefinition {
  id: string;
  name: string;
  cost: Partial<Record<CardType, number>>;
  damage: AttackDamage;
  text?: string;
  effectProgramId?: string;
  /** Optional executable gate for attacks whose text has a conditional cost. */
  condition?: AttackCondition;
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
  /** Triggered abilities are evaluated against public game events. */
  triggerOn?: import("./game-state").GameEventType | import("./game-state").GameEventType[];
}

export interface PokemonCard {
  id: CardId;
  name: string;
  category: "pokemon";
  /** Optional discriminator convenience for generic card predicates. */
  subtype?: TrainerSubtype;
  effectProgramId?: string;
  pokemonType: CardType;
  stage: PokemonStage;
  evolvesFrom?: string;
  hp: number;
  ruleBox?: "single-prize" | "multi-prize";
  hasRuleBox?: boolean;
  isPokemonEx?: boolean;
  isMega?: boolean;
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
  subtype?: TrainerSubtype;
  effectProgramId?: string;
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
  hpModifier?: number;
  prizeValueModifier?: number;
}
