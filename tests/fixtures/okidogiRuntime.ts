import { readFileSync } from "node:fs";
import type { CardDefinition, CardInstance, PokemonInPlay } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";
import type { GameState } from "../../engine/model/game-state";
import type { PlayerId } from "../../engine/model/actions";
import { createGame } from "../../engine/rules/setup";
import type { DeckManifest } from "../../src/data/decks/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../../src/data/pokemon";

export const okidogiCatalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const okidogiManifest = JSON.parse(readFileSync("src/data/decks/premade/okidogi-ex-poison.json", "utf8")) as DeckManifest;
export const okidogiIndex = createCatalogueIndex(okidogiCatalogue.cards);
export const okidogiRuntimeCards = okidogiManifest.entries.map((entry) => toRuntimeCardDefinition(okidogiIndex.byId.get(entry.cardId)!)).filter((card): card is CardDefinition => Boolean(card));
export const okidogiEngineDeck: DeckDefinition = { id: okidogiManifest.id, name: okidogiManifest.name, description: okidogiManifest.description, entries: okidogiManifest.entries, available: true };

export function freshOkidogiGame(seed = 23): GameState { return createGame({ seed, playerOneDeck: okidogiEngineDeck, playerTwoDeck: okidogiEngineDeck, cards: okidogiRuntimeCards, startingPlayer: "player-one" }); }
export function okInstance(cardId: string, suffix: string): CardInstance { return { cardId, instanceId: `${suffix}-${cardId}` }; }
export function okInPlay(cardId: string, suffix: string): PokemonInPlay { return { stack: [okInstance(cardId, suffix)], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} }; }
export function forceOkidogiMain(state: GameState, playerId: PlayerId = "player-one"): GameState { state.phase = "main"; state.pendingChoice = null; state.activePlayerId = playerId; state.turn = Math.max(3, state.turn); state.players[playerId].turnsTaken = 2; return state; }
