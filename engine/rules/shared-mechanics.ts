import type { PlayerId } from "../model/actions";
import type { AttackDefinition, CardInstance, CardType, PokemonInPlay } from "../model/cards";
import type { GameEventType, GameState } from "../model/game-state";
import { cardFor, findPokemon, otherPlayer, playId, pokemonTargets, topCard } from "./helpers";
import { emitEvent } from "./events";

/** Return the public top card without mutating the deck. */
export function topDeckCard(state: GameState, playerId: PlayerId): CardInstance | undefined { return state.players[playerId].deck[0]; }

/** Put a chosen card on top of a player's deck, preserving all other cards. */
export function putCardOnTop(state: GameState, playerId: PlayerId, cardInstanceId: string): boolean {
  const player = state.players[playerId];
  const index = player.hand.findIndex((card) => card.instanceId === cardInstanceId);
  if (index < 0) return false;
  const [card] = player.hand.splice(index, 1);
  if (!card) return false;
  player.deck.unshift(card);
  return true;
}

/** Deterministically reorder only the revealed top cards. */
export function reorderTopDeck(state: GameState, playerId: PlayerId, orderedIds: readonly string[]): boolean {
  const player = state.players[playerId];
  const count = orderedIds.length;
  if (!count || player.deck.slice(0, count).some((card, index) => card.instanceId !== orderedIds[index] && !orderedIds.includes(card.instanceId))) return false;
  const top = player.deck.splice(0, count);
  const byId = new Map(top.map((card) => [card.instanceId, card]));
  if (orderedIds.some((id) => !byId.has(id))) { player.deck.unshift(...top); return false; }
  player.deck.unshift(...orderedIds.map((id) => byId.get(id)!));
  return true;
}

export interface CounterPlacement { targetId: string; counters: number; }

/** Place counters on distributed targets. This intentionally does not resolve
 * knock-outs; callers choose the correct resume/cause for the effect. */
export function placeDistributedDamageCounters(state: GameState, sourcePlayerId: PlayerId, targetPlayerId: PlayerId, placements: readonly CounterPlacement[], sourceCardId: string): number {
  let placed = 0;
  for (const placement of placements) {
    if (placement.counters <= 0) continue;
    const target = findPokemon(state.players[targetPlayerId], placement.targetId);
    if (!target) continue;
    const counters = Math.floor(placement.counters);
    target.damage += counters * 10;
    placed += counters;
    emitEvent(state, "damage-dealt", sourcePlayerId, { sourceCardId, targetId: playId(target), targetPlayerId, amount: counters * 10, detail: "damage counters" });
  }
  return placed;
}

/** Move an arbitrary subset of attached Energy to discard, preserving card
 * identity and allowing Special Energy or typed costs to be selected. */
export function discardAttachedEnergy(state: GameState, playerId: PlayerId, pokemonId: string, count: number, predicate?: (card: ReturnType<typeof cardFor>) => boolean, sourceCardId?: string): CardInstance[] {
  const pokemon = findPokemon(state.players[playerId], pokemonId);
  if (!pokemon || count <= 0) return [];
  const chosen: CardInstance[] = [];
  for (let index = pokemon.attachedEnergy.length - 1; index >= 0 && chosen.length < count; index -= 1) {
    const energy = pokemon.attachedEnergy[index]!;
    if (predicate && !predicate(cardFor(state, energy))) continue;
    chosen.push(pokemon.attachedEnergy.splice(index, 1)[0]!);
  }
  state.players[playerId].discard.push(...chosen);
  if (chosen.length) emitEvent(state, "energy-moved", playerId, { sourceCardId, targetId: pokemonId, cardInstanceIds: chosen.map((card) => card.instanceId), amount: chosen.length, detail: "attached Energy discarded" });
  return chosen;
}

export function hasEnergy(state: GameState, pokemon: PokemonInPlay, minimum: number, energyType?: CardType): boolean {
  return pokemon.attachedEnergy.filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && (!energyType || card.energyType === energyType); }).length >= minimum;
}

export function canUseAttackCondition(state: GameState, playerId: PlayerId, attacker: PokemonInPlay, condition: NonNullable<import("../model/cards").AttackDefinition["condition"]>): boolean {
  const opponent = state.players[otherPlayer(playerId)];
  if (condition.kind === "opponent-damaged") return pokemonTargets(opponent).some((pokemon) => pokemon.damage > 0);
  if (condition.kind === "opponent-has-prizes") return opponent.prizes.length >= condition.minimum;
  if (condition.kind === "attached-energy") return hasEnergy(state, attacker, condition.minimum, condition.energyType);
  if (condition.kind === "discard-energy") return state.players[playerId].discard.filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && (!condition.energyType || card.energyType === condition.energyType); }).length >= condition.minimum;
  return false;
}

/** Resolve attacks copied from visible Pokémon. The caller supplies legal
 * source targets, so hidden information is never consulted. */
export function copiedAttacks(state: GameState, targets: readonly PokemonInPlay[], predicate?: (attack: AttackDefinition, source: PokemonInPlay) => boolean): Array<{ attack: AttackDefinition; sourcePokemonId: string }> {
  return targets.flatMap((source) => topCard(state, source).attacks.filter((attack) => !predicate || predicate(attack, source)).map((attack) => ({ attack: { ...attack, id: `copied:${playId(source)}:${attack.id}` }, sourcePokemonId: playId(source) })));
}

export function benchCapacity(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  const stadium = state.stadium ? cardFor(state, state.stadium) : undefined;
  if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:area-zero-underdepths") {
    const hasTera = pokemonTargets(player).some((pokemon) => topCard(state, pokemon).traits?.includes("tera"));
    if (hasTera) return 8;
  }
  return 5;
}

export interface TriggeredAbilityMatch { playerId: PlayerId; pokemon: PokemonInPlay; abilityId: string; effectProgramId: string; }

/** Discover triggered Bench abilities after a public event. Execution is left
 * to the reducer/program runner so choices remain deterministic and visible. */
export function triggeredBenchAbilities(state: GameState, eventType: GameEventType, ownerId?: PlayerId): TriggeredAbilityMatch[] {
  const owners = ownerId ? [ownerId] : (["player-one", "player-two"] as PlayerId[]);
  const triggerEvent = [...state.events].reverse().find((event) => event.type === eventType);
  return owners.flatMap((playerId) => state.players[playerId].bench.flatMap((pokemon) => {
    const sourceId = playId(pokemon);
    if (triggerEvent?.targetId && eventType === "pokemon-benched" && triggerEvent.targetId !== sourceId) return [];
    return topCard(state, pokemon).abilities.filter((ability) => ability.category === "triggered" && !state.temporaryEffects.some((effect) => effect.kind === "ability-lock" && effect.playerId === playerId && (!effect.pokemonId || effect.pokemonId === sourceId))).filter((ability) => { const triggers = ability.triggerOn ? (Array.isArray(ability.triggerOn) ? ability.triggerOn : [ability.triggerOn]) : []; return triggers.includes(eventType); }).map((ability) => ({ playerId, pokemon, abilityId: ability.id, effectProgramId: ability.effectProgramId }));
  }));
}
