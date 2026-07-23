import type { PlayerId } from "../model/actions";
import type { GameState, TemporaryEffect } from "../model/game-state";

export function addTemporaryEffect(state: GameState, effect: TemporaryEffect): void {
  state.temporaryEffects = state.temporaryEffects.filter((candidate) => {
    if (candidate.kind !== effect.kind || candidate.playerId !== effect.playerId) return true;
    if (candidate.kind === "item-lock" || effect.kind === "item-lock") return false;
    return "pokemonId" in candidate && "pokemonId" in effect && candidate.pokemonId !== effect.pokemonId;
  });
  state.temporaryEffects.push(effect);
}

export function expireTemporaryEffects(state: GameState, startingPlayerId: PlayerId): void {
  const turn = state.players[startingPlayerId].turnsTaken;
  state.temporaryEffects = state.temporaryEffects.filter((effect) => effect.playerId !== startingPlayerId || effect.appliesOnPlayerTurn >= turn);
}

export function hasItemLock(state: GameState, playerId: PlayerId): boolean {
  return state.temporaryEffects.some((effect) => effect.kind === "item-lock" && effect.playerId === playerId && effect.appliesOnPlayerTurn === state.players[playerId].turnsTaken);
}

export function hasRetreatLock(state: GameState, playerId: PlayerId, pokemonId: string): boolean {
  return state.temporaryEffects.some((effect) => effect.kind === "retreat-lock" && effect.playerId === playerId && effect.pokemonId === pokemonId && effect.appliesOnPlayerTurn === state.players[playerId].turnsTaken);
}

export function hasAttackLock(state: GameState, playerId: PlayerId, pokemonId: string, attackId: string): boolean {
  return state.temporaryEffects.some((effect) => effect.kind === "attack-lock" && effect.playerId === playerId && effect.pokemonId === pokemonId && effect.attackId === attackId && effect.appliesOnPlayerTurn === state.players[playerId].turnsTaken);
}

/** Ability suppression is public state and applies to either one Pokémon or
 * the whole side for the duration represented by the temporary effect. */
export function hasAbilityLock(state: GameState, playerId: PlayerId, pokemonId: string): boolean {
  return state.temporaryEffects.some((effect) => effect.kind === "ability-lock" && effect.playerId === playerId && (effect.pokemonId === undefined || effect.pokemonId === pokemonId) && effect.appliesOnPlayerTurn === state.players[playerId].turnsTaken);
}
