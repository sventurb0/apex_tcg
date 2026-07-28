import type { GameAction, PlayerId } from "./actions";
import type { CardDefinition, CardInstance, CardType, PokemonInPlay } from "./cards";
import type { GameResult } from "./results";

export type GamePhase = "setup" | "main" | "choice" | "game-over";

export interface PlayerState {
  id: PlayerId; deckId: string; deck: CardInstance[]; hand: CardInstance[]; prizes: CardInstance[]; discard: CardInstance[];
  active: PokemonInPlay | null; bench: PokemonInPlay[];
  energyAttachedThisTurn: boolean; supporterPlayedThisTurn: boolean; stadiumPlayedThisTurn: boolean; stadiumAbilityUsedThisTurn: boolean;
  retreatedThisTurn: boolean; attacksUsedThisTurn?: number; turnsTaken: number; mulligans: number; prizesTaken: number;
  abilityUsageByName: Record<string, number>;
}

export type KnockOutCause = "attack-damage" | "effect-damage-counters" | "poison" | "burn" | "stadium-effect" | "other-effect";

export type TemporaryEffect =
  | { kind: "attack-lock"; playerId: PlayerId; pokemonId: string; attackId: string; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "retreat-lock"; playerId: PlayerId; pokemonId: string; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "item-lock"; playerId: PlayerId; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "ability-lock"; playerId: PlayerId; pokemonId?: string; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "damage-reduction"; playerId: PlayerId; pokemonId: string; amount: number; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "attack-cost-increase"; playerId: PlayerId; pokemonId: string; amount: number; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "attack-prevention"; playerId: PlayerId; pokemonId: string; appliesOnPlayerTurn: number; sourceCardId: string }
  | { kind: "attack-damage-bonus"; playerId: PlayerId; amount: number; pokemonType?: CardType; appliesOnPlayerTurn: number; sourceCardId: string };

export interface PendingKnockOutCause { cause: KnockOutCause; sourcePlayerId: PlayerId; sourceCardId?: string; }

export interface EffectContinuation {
  programId: string;
  step: number;
  actingPlayerId: PlayerId;
  sourceCardId: string;
  sourceInstanceId?: string;
  sourcePokemonId?: string;
  attackId?: string;
  variables: Record<string, string[]>;
  after: "resume-main" | "finish-attack";
}

export interface EffectChoice {
  type: "effect-choice";
  choiceId: string;
  playerId: PlayerId;
  selectionKind: "card" | "pokemon" | "mode";
  min: number;
  max: number;
  eligibleIds: string[];
  selectedIds: string[];
  optional: boolean;
  instruction: string;
  optionLabels?: EffectChoiceOption[];
  sourceCardId: string;
  sourceEffectId: string;
  continuation: EffectContinuation;
}

export interface EffectChoiceOption {
  id: string;
  label: string;
  description?: string;
  cardInstanceIds?: string[];
  pokemonIds?: string[];
}

export interface AllocationChoice {
  type: "allocation-choice";
  choiceId: string;
  playerId: PlayerId;
  selectionKind: "allocation";
  eligibleIds: string[];
  totalUnits: number;
  remainingUnits: number;
  allocations: Record<string, number>;
  minimumPerTarget?: number;
  maximumPerTarget?: number;
  unitLabel: string;
  instruction: string;
  sourceCardId: string;
  sourceEffectId: string;
  continuation: EffectContinuation;
}

export interface ResolutionResume { kind: "resume-main" | "checkup" | "start-turn"; playerId: PlayerId; }
export interface PrizeClaim { takingPlayerId: PlayerId; remaining: number; }
export type PendingChoice =
  | { type: "setup-placement"; playerId: PlayerId }
  | { type: "mulligan-draw"; playerId: PlayerId; remaining: number; nextPlayerId?: PlayerId }
  | { type: "choose-prize"; playerId: PlayerId; claims: PrizeClaim[]; promotions: PlayerId[]; resume: ResolutionResume }
  | { type: "promote"; playerId: PlayerId; remainingPromotions: PlayerId[]; resume: ResolutionResume }
  | EffectChoice
  | AllocationChoice;

export type GameEventType = "card-played" | "pokemon-benched" | "ability-used" | "stadium-ability-used" | "attack-used" | "cards-searched" | "cards-discarded" | "cards-recovered" | "energy-attached-manually" | "energy-attached-by-effect" | "energy-moved" | "energy-discarded-invalid" | "damage-dealt" | "damage-healed" | "damage-counters-moved" | "damage-allocation" | "special-condition-applied" | "enhanced-poison-applied" | "poison-checkup-damage" | "pokemon-evolved" | "pokemon-knocked-out" | "prize-card-taken" | "prize-modified" | "temporary-effect-applied" | "damage-modifier-applied" | "setup-completed" | "coin-flip";
export interface GameEvent { index: number; turn: number; type: GameEventType; playerId: PlayerId; targetPlayerId?: PlayerId; sourceCardId?: string; sourceInstanceId?: string; targetId?: string; amount?: number; cardInstanceIds?: string[]; detail?: string; cause?: KnockOutCause; }
export interface EffectExecutionEvidence { programId: string; sourceCardId: string; started: number; continued: number; completed: number; declined: number; definingEvents: string[]; }
export interface ActionLogEntry { index: number; turn: number; playerId: PlayerId; actionId: string; description: string; }
export interface ReplayRecord { seed: number; deckIds: [string, string]; startingPlayer: PlayerId; mulligans: Record<PlayerId, number>; actions: GameAction[]; finalResult: GameResult | null; }

export interface GameState {
  seed: number; rngState: number; players: Record<PlayerId, PlayerState>; startingPlayer: PlayerId; activePlayerId: PlayerId;
  turn: number; phase: GamePhase; pendingChoice: PendingChoice | null; actionLog: ActionLogEntry[]; actionHistory: GameAction[];
  events: GameEvent[]; result: GameResult | null; detailedLogs: boolean; cardDefinitions: Record<string, CardDefinition>; stadium: CardInstance | null; executionEvidence?: EffectExecutionEvidence[];
  temporaryEffects: TemporaryEffect[]; pendingKnockOutCause: PendingKnockOutCause | null; legacyEnergyUsed?: boolean; briarPlayerId?: PlayerId; briarUsed?: boolean;
}
