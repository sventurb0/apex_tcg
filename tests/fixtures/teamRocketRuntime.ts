import { readFileSync } from "node:fs";
import type { CardDefinition, CardInstance, PokemonInPlay } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";
import type { GameState } from "../../engine/model/game-state";
import type { PlayerId } from "../../engine/model/actions";
import { createGame } from "../../engine/rules/setup";
import type { DeckManifest } from "../../src/data/decks/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../../src/data/pokemon";

export const teamRocketCatalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const teamRocketManifest = JSON.parse(readFileSync("src/data/decks/premade/team-rockets-nidoking.json", "utf8")) as DeckManifest;
export const teamRocketIndex = createCatalogueIndex(teamRocketCatalogue.cards);
export const teamRocketRuntimeCards = teamRocketManifest.entries.map((entry) => toRuntimeCardDefinition(teamRocketIndex.byId.get(entry.cardId)!)).filter((card): card is CardDefinition => Boolean(card));
export const teamRocketEngineDeck: DeckDefinition = { id: teamRocketManifest.id, name: teamRocketManifest.name, description: teamRocketManifest.description, entries: teamRocketManifest.entries, available: true };
export function freshTeamRocketGame(seed = 31): GameState { return createGame({ seed, playerOneDeck: teamRocketEngineDeck, playerTwoDeck: teamRocketEngineDeck, cards: teamRocketRuntimeCards, startingPlayer: "player-one" }); }
export function trInstance(cardId: string, suffix: string): CardInstance { return { cardId, instanceId: `${suffix}-${cardId}` }; }
export function trInPlay(cardId: string, suffix: string): PokemonInPlay { return { stack: [trInstance(cardId, suffix)], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} }; }
export function forceTeamRocketMain(state: GameState, playerId: PlayerId = "player-one"): GameState { state.phase = "main"; state.pendingChoice = null; state.activePlayerId = playerId; state.turn = Math.max(3, state.turn); state.players[playerId].turnsTaken = 2; return state; }
