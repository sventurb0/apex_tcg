import type { PlayerId } from "../model/actions";
import type { CardDefinition, CardInstance } from "../model/cards";
import type { DeckDefinition } from "../model/decks";
import type { GameState, PlayerState } from "../model/game-state";
import { deriveSeed, shuffleDeterministic } from "../random/seeded-rng";

export interface GameConfig {
  seed: number;
  playerOneDeck: DeckDefinition;
  playerTwoDeck: DeckDefinition;
  cards: readonly CardDefinition[];
  startingPlayer?: PlayerId;
  detailedLogs?: boolean;
}

function instantiateDeck(deck: DeckDefinition, playerId: PlayerId): CardInstance[] {
  let sequence = 0;
  return deck.entries.flatMap((entry) => Array.from({ length: entry.count }, () => ({
    instanceId: `${playerId}-${sequence++}-${entry.cardId}`,
    cardId: entry.cardId,
  })));
}

function hasBasic(hand: readonly CardInstance[], definitions: Readonly<Record<string, CardDefinition>>): boolean {
  return hand.some((instance) => {
    const card = definitions[instance.cardId];
    return card?.category === "pokemon" && card.stage === "basic";
  });
}

function preparePlayer(
  playerId: PlayerId,
  deck: DeckDefinition,
  definitions: Readonly<Record<string, CardDefinition>>,
  seed: number,
): { player: PlayerState; rngState: number } {
  let rngState = seed;
  let mulligans = 0;
  let cards = instantiateDeck(deck, playerId);
  let hand: CardInstance[] | null = null;
  for (let attempt = 0; attempt <= 100; attempt += 1) {
    const shuffled = shuffleDeterministic(cards, rngState);
    rngState = shuffled.state;
    cards = shuffled.value;
    const candidateHand = cards.slice(0, 7);
    cards = cards.slice(7);
    if (hasBasic(candidateHand, definitions)) {
      hand = candidateHand;
      break;
    }
    cards = [...cards, ...candidateHand];
    mulligans += 1;
  }
  if (!hand) throw new Error(`${deck.name} could not produce a Basic Pokémon after 100 mulligans.`);
  const prizes = cards.slice(0, 6);
  cards = cards.slice(6);
  return {
    player: {
      id: playerId,
      deckId: deck.id,
      deck: cards,
      hand,
      prizes,
      discard: [],
      active: null,
      bench: [],
      energyAttachedThisTurn: false,
      supporterPlayedThisTurn: false,
      stadiumPlayedThisTurn: false,
      stadiumAbilityUsedThisTurn: false,
      retreatedThisTurn: false,
      attacksUsedThisTurn: 0,
      turnsTaken: 0,
      mulligans,
      prizesTaken: 0,
      abilityUsageByName: {},
    },
    rngState,
  };
}

export function createGame(config: GameConfig): GameState {
  const definitions = Object.fromEntries(config.cards.map((card) => [card.id, card]));
  const seed = config.seed >>> 0 || 1;
  const first = preparePlayer("player-one", config.playerOneDeck, definitions, seed);
  const second = preparePlayer("player-two", config.playerTwoDeck, definitions, deriveSeed(first.rngState, 1));
  const startingPlayer = config.startingPlayer ?? (seed % 2 === 0 ? "player-one" : "player-two");
  return {
    seed,
    rngState: second.rngState,
    players: { "player-one": first.player, "player-two": second.player },
    startingPlayer,
    activePlayerId: startingPlayer,
    turn: 0,
    phase: "setup",
    pendingChoice: { type: "setup-placement", playerId: "player-one" },
    actionLog: [],
    actionHistory: [],
    events: [],
    result: null,
    detailedLogs: config.detailedLogs ?? true,
    cardDefinitions: definitions,
    stadium: null,
    executionEvidence: [],
    temporaryEffects: [],
    pendingKnockOutCause: null,
    legacyEnergyUsed: false,
  };
}
