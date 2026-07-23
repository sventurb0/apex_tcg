import type { AttackDamage, AttackDefinition, CardType, PokemonCard, PokemonInPlay } from "../model/cards";
import type { GameState } from "../model/game-state";
import type { PlayerId } from "../model/actions";
import { cardFor } from "./helpers";
import { effectiveMaxHp } from "./modifiers";

export function canPayAttackCost(state: GameState, pokemon: PokemonInPlay, attack: AttackDefinition): boolean {
  const energy = pokemon.attachedEnergy.map((instance) => cardFor(state, instance)).filter((card) => card.category === "energy");
  let totals: Partial<Record<CardType, number>>[] = [{}];
  for (const card of energy) { const options = card.supplyOptions?.length ? card.supplyOptions : [{ [card.energyType]: 1 }]; totals = totals.flatMap((total) => options.map((option) => { const combined = { ...total }; for (const [type, units] of Object.entries(option) as [CardType, number][]) combined[type] = (combined[type] ?? 0) + units; return combined; })); }
  return totals.some((available) => { let typedUsed = 0; for (const [type, required] of Object.entries(attack.cost) as [CardType, number][]) { if (type === "colorless") continue; if ((available[type] ?? 0) < required) return false; typedUsed += required; } const total = Object.values(available).reduce((sum, value) => sum + (value ?? 0), 0); return total - typedUsed >= (attack.cost.colorless ?? 0); });
}

export function resolveBaseDamage(damage: AttackDamage, attacker: PokemonInPlay, state?: GameState, attackingPlayerId?: PlayerId): number {
  if (damage.kind === "none") return 0;
  if (damage.kind === "fixed") return damage.amount;
  if (damage.resolverId === "burning-voice-damage") return Math.max(0, 270 - attacker.damage);
  if (damage.resolverId === "chain-crazed-damage") return 130 + (attacker.specialConditions.includes("poisoned") ? 130 : 0);
  if (damage.resolverId === "irritated-outburst-damage" && state && attackingPlayerId) { const opponentId = attackingPlayerId === "player-one" ? "player-two" : "player-one"; return 60 * state.players[opponentId].prizesTaken; }
  if (damage.resolverId === "horn-rend-damage" && state && attackingPlayerId) { const opponentId = attackingPlayerId === "player-one" ? "player-two" : "player-one"; return state.players[opponentId].active && state.players[opponentId].active.damage > 0 ? 120 : 60; }
  throw new Error(`Unknown attack damage resolver: ${damage.resolverId}`);
}

export function calculateDamage(attacker: PokemonCard, defender: PokemonCard, baseDamage: number): number {
  let damage = baseDamage;
  if (defender.weakness?.type === attacker.pokemonType) damage *= defender.weakness.multiplier;
  if (defender.resistance?.type === attacker.pokemonType) damage -= defender.resistance.amount;
  return Math.max(0, damage);
}

export function isKnockedOut(state: GameState, pokemon: PokemonInPlay): boolean { return pokemon.damage >= effectiveMaxHp(state, pokemon); }
