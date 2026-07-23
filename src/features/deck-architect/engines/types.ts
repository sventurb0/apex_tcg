import type { PokemonType } from "../../../data/pokemon/types";

export type CardType = PokemonType;
export type EngineId = string;
export type PackageId = string;
export type StrategicTag = "acceleration" | "aggressive" | "bench-damage" | "comeback" | "control" | "damage-spread" | "defence" | "discard" | "draw" | "evolution" | "healing" | "poison" | "setup" | "single-prize" | "toolbox" | "top-deck-control";
export type Zone = "deck" | "hand" | "discard" | "active" | "bench" | "play";
export type TimingConstraint = "once-per-turn" | "on-evolution" | "attack" | "after-knockout" | "while-active" | "continuous";

export type CapabilityKind =
  | "energy-from-deck" | "energy-from-discard" | "energy-from-hand" | "energy-movement"
  | "draw" | "search" | "switch" | "gust" | "heal" | "poison" | "damage-counter-move"
  | "hp-modifier" | "damage-modifier" | "damage-prevention" | "prize-modifier" | "item-lock"
  | "ability-lock" | "retreat-lock" | "evolution-acceleration" | "discard-fill"
  | "top-deck-control" | "bench-expansion" | "bench-damage";
export type RequirementKind =
  | "energy" | "poisoned-attacker" | "damaged-attacker" | "discard-resource" | "specific-stadium"
  | "specific-tool" | "bench-space" | "evolution-line" | "team-trait" | "opponent-damage"
  | "prize-state" | "hand-size" | "top-deck-order";

export interface CapabilityFilter { field: "card-id" | "name" | "type" | "trait" | "supertype" | "zone"; values: string[]; }
/** Requirement filters share the same structural shape as capability filters. */
export type RequirementFilter = CapabilityFilter;
export interface EngineCapability {
  cardId: string;
  kind: CapabilityKind;
  filters: CapabilityFilter[];
  amount?: number;
  zoneFrom?: Zone;
  zoneTo?: Zone;
  timing?: TimingConstraint;
  explanation: string;
}
export interface EngineRequirement {
  cardId: string;
  kind: RequirementKind;
  filters: RequirementFilter[];
  minimum?: number;
  explanation: string;
}
export interface EngineConflict { kind: "stadium" | "bench" | "energy" | "team-trait" | "tool"; withEngineId?: EngineId; explanation: string; }

export interface EngineDefinition {
  id: EngineId;
  name: string;
  energyTypes: CardType[];
  strategicRoles: StrategicTag[];
  providers: EngineCapability[];
  consumers: EngineRequirement[];
  requiredPackages: PackageId[];
  optionalPackages: PackageId[];
  conflicts: EngineConflict[];
  benchDemand: number;
  setupSpeed: "fast" | "medium" | "slow";
  prizeProfile: "single-prize" | "mixed" | "multi-prize";
  sourceDeckIds: string[];
  coreCardIds: string[];
  reviewed: boolean;
  reviewNotes: string[];
}

export interface SynergyStep { providerCardId: string; consumerCardId: string; capability: EngineCapability; requirement: EngineRequirement; explanation: string; }
export interface SynergyChain { id: string; cardIds: string[]; score: number; steps: SynergyStep[]; constraints: string[]; sourceDeckIds: string[]; confidence: "reviewed" | "derived"; }

export interface SourceBackedPackage {
  id: PackageId;
  name: string;
  cardIds: string[];
  sourceDeckIds: string[];
  sourceDeckCount: number;
  weightedTournamentSuccess: number;
  averageCounts: Record<string, number>;
  countRanges: Record<string, { minimum: number; maximum: number }>;
  status: "mandatory" | "optional";
  archetypes: string[];
  semanticExplanation: string;
  reviewed: boolean;
}

export interface StrategyPriority { cardId: string; priority: number; reason: string; }
export interface CapabilityPriority { kind: CapabilityKind; priority: number; reason: string; }
export interface ResourceRule { cardId?: string; resource: string; rule: string; }
export interface BenchPlan { desiredSpaces: number; setupCardIds: string[]; attackerCardIds: string[]; notes: string[]; }
export interface StadiumPlan { preferredCardIds: string[]; preserveWhile: string; }
export interface ToolPlan { assignments: Array<{ toolCardId: string; targetCardIds: string[]; condition: string }>; }
export interface PrizePlan { profile: EngineDefinition["prizeProfile"]; notes: string[]; }
export interface TargetRule { priority: number; rule: string; }
export interface StrategyOverride { condition: string; instruction: string; }
export interface DeckStrategyPlan {
  deckId: string;
  engines: EngineId[];
  primaryAttackers: string[];
  secondaryAttackers: string[];
  setupPriorities: StrategyPriority[];
  capabilityPriorities: CapabilityPriority[];
  protectedResources: ResourceRule[];
  benchPlan: BenchPlan;
  stadiumPlan?: StadiumPlan;
  toolPlan?: ToolPlan;
  prizePlan?: PrizePlan;
  targetSelectionRules: TargetRule[];
  overrides?: StrategyOverride[];
}
