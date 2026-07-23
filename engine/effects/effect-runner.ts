import type { PlayerId } from "../model/actions";
import type { GameState } from "../model/game-state";
import { findPokemon } from "../rules/helpers";
import { applySpecialCondition, clearSpecialConditions } from "../rules/pokemon-checkup";
import { nextRandom, shuffleDeterministic } from "../random/seeded-rng";
import { discardAttachedEnergy } from "../rules/shared-mechanics";
import { emitEvent } from "../rules/events";
import { otherPlayer, playId } from "../rules/helpers";
import { addTemporaryEffect } from "../rules/temporary-effects";
import type { CustomEffectHandlerId, EffectPrimitive } from "./effect-types";

export interface EffectContext {
  playerId: PlayerId;
  targetId?: string;
}

export type CustomEffectHandler = (state: GameState, context: EffectContext) => void;

export class UnsupportedEffectError extends Error {
  constructor(readonly effect: EffectPrimitive) {
    super(`Effect primitive ${effect.type} does not yet have a resolver.`);
    this.name = "UnsupportedEffectError";
  }
}

const customHandlers = new Map<CustomEffectHandlerId, CustomEffectHandler>();

export function registerCustomEffect(id: CustomEffectHandlerId, handler: CustomEffectHandler): void {
  if (customHandlers.has(id)) throw new Error(`Custom effect ${id} is already registered.`);
  customHandlers.set(id, handler);
}

export function runCustomEffect(id: CustomEffectHandlerId, state: GameState, context: EffectContext): void {
  const handler = customHandlers.get(id);
  if (!handler) throw new Error(`Unknown custom effect handler: ${id}`);
  handler(state, context);
}

export function runEffects(state: GameState, context: EffectContext, effects: readonly EffectPrimitive[]): void {
  const player = state.players[context.playerId];
  for (const effect of effects) {
    switch (effect.type) {
      case "draw":
        player.hand.push(...player.deck.splice(0, effect.count));
        break;
      case "shuffle-deck":
        { const shuffled = shuffleDeterministic(player.deck, state.rngState); player.deck = shuffled.value; state.rngState = shuffled.state; }
        break;
      case "heal": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) target.damage = Math.max(0, target.damage - effect.amount);
        break;
      }
      case "add-damage-counters": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) target.damage += effect.count * 10;
        break;
      }
      case "apply-special-condition": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) applySpecialCondition(target, effect.condition);
        break;
      }
      case "remove-special-conditions": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) clearSpecialConditions(target);
        break;
      }
      case "deal-damage": {
        const targetPlayer = effect.target === "self" ? player : state.players[context.playerId === "player-one" ? "player-two" : "player-one"];
        const target = context.targetId ? findPokemon(targetPlayer, context.targetId) : targetPlayer.active;
        if (target) target.damage += effect.amount;
        break;
      }
      case "discard-attached-energy": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) discardAttachedEnergy(state, context.playerId, playId(target), effect.count, undefined, undefined);
        break;
      }
      case "bench-damage": {
        const opponentId = otherPlayer(context.playerId);
        const targets = state.players[opponentId].bench.slice(0, Math.max(0, effect.targets));
        for (const target of targets) { target.damage += effect.amount; emitEvent(state, "damage-dealt", context.playerId, { targetId: playId(target), targetPlayerId: opponentId, amount: effect.amount, detail: "distributed Bench damage" }); }
        break;
      }
      case "modify-hp": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) target.hpModifier = (target.hpModifier ?? 0) + effect.amount;
        break;
      }
      case "modify-prize-value": {
        const target = context.targetId ? findPokemon(player, context.targetId) : player.active;
        if (target) target.prizeValueModifier = (target.prizeValueModifier ?? 0) + effect.amount;
        break;
      }
      case "disable-ability": {
        const targetPlayerId = effect.scope === "all-opponent" ? otherPlayer(context.playerId) : context.playerId;
        const target = context.targetId ? findPokemon(state.players[targetPlayerId], context.targetId) : state.players[targetPlayerId].active;
        addTemporaryEffect(state, { kind: "ability-lock", playerId: targetPlayerId, pokemonId: effect.scope === "all-opponent" ? undefined : target ? playId(target) : undefined, appliesOnPlayerTurn: state.players[targetPlayerId].turnsTaken, sourceCardId: "effect" });
        break;
      }
      case "coin-flip": {
        const flip = nextRandom(state.rngState); state.rngState = flip.state;
        runEffects(state, context, flip.value < .5 ? effect.heads : effect.tails ?? []);
        break;
      }
      case "conditional":
      case "search-deck":
      case "reveal":
      case "look-at-cards":
      case "discard-from-hand":
      case "discard-from-deck":
      case "attach-energy-from-hand":
      case "attach-energy-from-discard":
      case "accelerate-energy":
      case "move-energy":
      case "switch-active":
      case "force-switch":
      case "modify-attack-damage":
      case "copy-attack":
        throw new UnsupportedEffectError(effect);
      case "modify-retreat-cost":
      case "lock-items":
      case "lock-supporters":
      case "lock-retreat":
      case "prevent-damage":
      case "prevent-effects":
      case "return-to-hand":
      case "return-to-deck":
      case "recover-from-discard":
      case "evolve":
      case "devolve":
      case "put-into-play":
      case "once-per-turn":
      case "once-per-game":
      case "lasting-effect":
      case "choose-target":
      case "choose-cards":
        throw new UnsupportedEffectError(effect);
      default: {
        const exhaustive: never = effect;
        throw new Error(`Unknown effect: ${String(exhaustive)}`);
      }
    }
  }
}
