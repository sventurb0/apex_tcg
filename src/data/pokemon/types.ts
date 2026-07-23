export type PokemonType = "Grass" | "Fire" | "Water" | "Lightning" | "Psychic" | "Fighting" | "Darkness" | "Metal" | "Dragon" | "Colorless" | "Fairy";
export type CardSupertype = "Pokémon" | "Trainer" | "Energy";
export type SimulationSupport = "complete" | "generated" | "partial" | "unsupported";
export type CardImplementationStatus = SimulationSupport;
export type ImplementationSource = "explicit" | "functional-reprint" | "generated" | "partial" | "unsupported";
export type BehaviourFamilyId = string;

export interface PrintedAbility { name: string; text: string; type: string; }
export interface PrintedAttack { name: string; cost: Array<PokemonType | "Free">; energy: number; damage: string; text: string; }
export interface PrintedWeakness { type: PokemonType; value: string; }
export interface PrintedResistance { type: PokemonType; value: string; }
export interface CardLegalities { unlimited?: string; expanded?: string; standard?: string; }
export interface CardImages { small: string; large: string; }

export interface PokemonCardMetadata {
  id: string;
  name: string;
  setId: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  supertype: CardSupertype;
  subtypes: string[];
  hp?: number;
  types?: PokemonType[];
  stage?: string;
  evolvesFrom?: string;
  evolvesTo?: string[];
  abilities?: PrintedAbility[];
  attacks?: PrintedAttack[];
  weaknesses?: PrintedWeakness[];
  resistances?: PrintedResistance[];
  retreatCost?: PokemonType[];
  retreat: number;
  rules?: string[];
  ruleBoxText?: string[];
  trainerText?: string;
  energyText?: string;
  regulationMark?: string;
  rarity?: string;
  artist?: string;
  flavorText?: string;
  images?: CardImages;
  releaseDate?: string;
  legalities: CardLegalities;
}

export interface PokemonSetMetadata { id: string; name: string; code: string; series: string; releaseDate: string; }
export interface PokemonCardCatalogue {
  version: 1;
  generatedAt: string;
  source: { repository: string; commit: string };
  sets: PokemonSetMetadata[];
  cards: PokemonCardMetadata[];
}

export type CardHandler = { kind: "declarative"; effectId: string } | { kind: "custom"; handlerId: string };
export interface CardImplementation {
  cardId: string;
  status: SimulationSupport;
  implementationSource?: ImplementationSource;
  canonicalCardId?: string;
  behaviourFamilyId?: BehaviourFamilyId;
  equivalentPrintingCount?: number;
  allowFunctionalInheritance?: boolean;
  handlers: CardHandler[];
  supportedMechanics: string[];
  knownLimitations: string[];
  tests: string[];
}
export interface BehaviourFamily {
  id: BehaviourFamilyId;
  gameplaySignature: string;
  canonicalCardId: string;
  handlerId: string;
  memberCardIds: string[];
  source: "explicit" | "generated";
}
export interface ImplementationResolver {
  resolve(card: PokemonCardMetadata): CardImplementation;
  familyFor(cardId: string): BehaviourFamily | undefined;
  equivalentsFor(cardId: string): PokemonCardMetadata[];
  families(): BehaviourFamily[];
}
export type CardImplementationRegistry = Record<string, CardImplementation>;
export interface CardSupportRow { metadata: PokemonCardMetadata; implementation: CardImplementation; decks: string[]; }
