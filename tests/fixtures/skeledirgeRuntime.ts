import { readFileSync } from "node:fs";
import type { CardDefinition, CardInstance, PokemonInPlay } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";
import { createGame } from "../../engine/rules/setup";
import type { GameState } from "../../engine/model/game-state";
import type { PlayerId } from "../../engine/model/actions";
import type { DeckManifest } from "../../src/data/decks/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../../src/data/pokemon";

export const skeledirgeCatalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const skeledirgeManifest = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8")) as DeckManifest;
export const skeledirgeIndex = createCatalogueIndex(skeledirgeCatalogue.cards);
export const skeledirgeRuntimeCards = skeledirgeManifest.entries.map((entry) => toRuntimeCardDefinition(skeledirgeIndex.byId.get(entry.cardId)!)).filter((card): card is CardDefinition => Boolean(card));
export const skeledirgeEngineDeck: DeckDefinition = { id: skeledirgeManifest.id, name: skeledirgeManifest.name, description: skeledirgeManifest.description, entries: skeledirgeManifest.entries, available: true };

export function freshSkeledirgeGame(seed = 17): GameState { return createGame({ seed, playerOneDeck: skeledirgeEngineDeck, playerTwoDeck: skeledirgeEngineDeck, cards: skeledirgeRuntimeCards, startingPlayer: "player-one" }); }
export function instance(cardId: string, suffix: string): CardInstance { return { cardId, instanceId: `${suffix}-${cardId}` }; }
export function inPlay(cardId: string, suffix: string): PokemonInPlay { return { stack: [instance(cardId, suffix)], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} }; }
export function forceMain(state: GameState, playerId: PlayerId = "player-one"): GameState { state.phase = "main"; state.pendingChoice = null; state.activePlayerId = playerId; state.turn = Math.max(3, state.turn); state.players[playerId].turnsTaken = 2; return state; }
