import type { PlayerId } from "../model/actions";
import type { PoisonCondition, PokemonInPlay, SpecialCondition } from "../model/cards";
import type { GameState, KnockOutCause } from "../model/game-state";
import { nextRandom } from "../random/seeded-rng";
import { cloneGameState } from "./helpers";
import { effectiveMaxHp, poisonCheckupDamage } from "./modifiers";

const rotatedConditions: SpecialCondition[] = ["asleep", "confused", "paralyzed"];

export function applySpecialCondition(pokemon: PokemonInPlay, condition: SpecialCondition, poison: PoisonCondition = { countersPerCheckup: 1 }): void {
  if (rotatedConditions.includes(condition)) {
    pokemon.specialConditions = pokemon.specialConditions.filter((current) => !rotatedConditions.includes(current));
  }
  if (!pokemon.specialConditions.includes(condition)) pokemon.specialConditions.push(condition);
  if (condition === "poisoned") pokemon.poison = { ...poison, countersPerCheckup: Math.max(1, poison.countersPerCheckup) };
}

export function clearSpecialConditions(pokemon: PokemonInPlay): void {
  pokemon.specialConditions = [];
  pokemon.poison = undefined;
}

export interface PokemonCheckupResult {
  state: GameState;
  knockedOutPlayerIds: PlayerId[];
  knockedOutCauses: { playerId: PlayerId; targetId: string; cause: KnockOutCause }[];
  coinFlips: { playerId: PlayerId; condition: "burned" | "asleep"; heads: boolean }[];
  poisonDamage: { playerId: PlayerId; targetId: string; baseCounters: number; bonusCounters: number; sourceCardId?: string }[];
}

export function processPokemonCheckup(state: GameState, endingPlayerId: PlayerId): PokemonCheckupResult {
  const next = cloneGameState(state);
  const coinFlips: PokemonCheckupResult["coinFlips"] = [];
  const knockedOutCauses: PokemonCheckupResult["knockedOutCauses"] = [];
  const poisonDamage: PokemonCheckupResult["poisonDamage"] = [];
  for (const playerId of ["player-one", "player-two"] as const) {
    const active = next.players[playerId].active;
    if (!active) continue;
    let cause: KnockOutCause | undefined;
    if (active.specialConditions.includes("poisoned")) { const poison = poisonCheckupDamage(next, playerId, active); active.damage += poison.totalDamage; poisonDamage.push({ playerId, targetId: active.stack.at(-1)!.instanceId, baseCounters: poison.baseCounters, bonusCounters: poison.bonusCounters, sourceCardId: active.poison?.sourceCardId }); if (active.damage >= effectiveMaxHp(next, active)) cause = "poison"; }
    if (active.specialConditions.includes("burned")) {
      active.damage += 20;
      if (!cause && active.damage >= effectiveMaxHp(next, active)) cause = "burn";
      const flip = nextRandom(next.rngState);
      next.rngState = flip.state;
      const heads = flip.value < 0.5;
      coinFlips.push({ playerId, condition: "burned", heads });
      if (heads) active.specialConditions = active.specialConditions.filter((condition) => condition !== "burned");
    }
    if (active.specialConditions.includes("asleep")) {
      const flip = nextRandom(next.rngState);
      next.rngState = flip.state;
      const heads = flip.value < 0.5;
      coinFlips.push({ playerId, condition: "asleep", heads });
      if (heads) active.specialConditions = active.specialConditions.filter((condition) => condition !== "asleep");
    }
    if (playerId === endingPlayerId && active.specialConditions.includes("paralyzed")) {
      active.specialConditions = active.specialConditions.filter((condition) => condition !== "paralyzed");
    }
    if (cause) knockedOutCauses.push({ playerId, targetId: active.stack.at(-1)!.instanceId, cause });
  }
  const knockedOutPlayerIds = (["player-one", "player-two"] as const).filter((playerId) => {
    const active = next.players[playerId].active;
    return active ? active.damage >= effectiveMaxHp(next, active) : false;
  });
  return { state: next, knockedOutPlayerIds, knockedOutCauses, coinFlips, poisonDamage };
}
