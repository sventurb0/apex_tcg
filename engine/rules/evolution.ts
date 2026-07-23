import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { GameState } from "../model/game-state";
import { cardFor, topCard } from "./helpers";

export function isRareCandyPair(state: GameState, basic: PokemonInPlay, stage2Instance: CardInstance): boolean {
  const basicCard = topCard(state, basic); const stage2 = cardFor(state, stage2Instance);
  if (basicCard.stage !== "basic" || stage2.category !== "pokemon" || stage2.stage !== "stage2" || !stage2.evolvesFrom) return false;
  return Object.values(state.cardDefinitions).some((candidate) => candidate.category === "pokemon" && candidate.stage === "stage1" && candidate.evolvesFrom === basicCard.name && candidate.name === stage2.evolvesFrom);
}

export function legalRareCandyBasics(state: GameState, playerId: "player-one" | "player-two"): PokemonInPlay[] {
  const player = state.players[playerId]; if (player.turnsTaken <= 1) return [];
  return [player.active, ...player.bench].filter((pokemon): pokemon is PokemonInPlay => Boolean(pokemon)).filter((pokemon) => pokemon.stack.length === 1 && pokemon.enteredPlayTurn < state.turn && !pokemon.evolvedThisTurn && player.hand.some((instance) => isRareCandyPair(state, pokemon, instance)));
}
