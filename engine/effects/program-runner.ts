import type { PlayerId } from "../model/actions";
import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { AllocationChoice, EffectChoice, EffectContinuation, GameState } from "../model/game-state";
import { nextRandom, shuffleDeterministic } from "../random/seeded-rng";
import { cardFor, findPokemon, otherPlayer, playId, pokemonTargets, topCard } from "../rules/helpers";
import { clearSpecialConditions, applySpecialCondition } from "../rules/pokemon-checkup";
import { emitEvent } from "../rules/events";
import { effectiveMaxHp } from "../rules/modifiers";
import { calculateDamage, isKnockedOut, resolveBaseDamage } from "../rules/combat";
import { addTemporaryEffect } from "../rules/temporary-effects";
import { allPokemonHaveTrait, hasCardTrait, pokemonHasTrait } from "../rules/traits";
import { isRareCandyPair, legalRareCandyBasics } from "../rules/evolution";
import { benchCapacity } from "../rules/shared-mechanics";
import { MissingEffectProgramError } from "./errors";

export interface ProgramStart { programId: string; actingPlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string; sourcePokemonId?: string; attackId?: string; after: EffectContinuation["after"]; variables?: Record<string, string[]>; }

export function recordEffectExecution(state: GameState, programId: string, sourceCardId: string, field: "started" | "continued" | "completed" | "declined", definingEvents: string[] = []): void {
  const evidence = state.executionEvidence ?? (state.executionEvidence = []);
  const row = evidence.find((entry) => entry.programId === programId && entry.sourceCardId === sourceCardId) ?? (() => {
    const created = { programId, sourceCardId, started: 0, continued: 0, completed: 0, declined: 0, definingEvents: [] as string[] };
    evidence.push(created); return created;
  })();
  row[field] += 1;
  row.definingEvents = [...new Set([...row.definingEvents, ...definingEvents])];
}

function shuffle(state: GameState, playerId: PlayerId): void { const result = shuffleDeterministic(state.players[playerId].deck, state.rngState); state.players[playerId].deck = result.value; state.rngState = result.state; }
function removeById(zone: CardInstance[], id: string): CardInstance | undefined { const index = zone.findIndex((card) => card.instanceId === id); return index < 0 ? undefined : zone.splice(index, 1)[0]; }
function isBasicEnergy(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "energy" && card.basic; }
function matchesTemplateCategory(state: GameState, instance: CardInstance, category: string): boolean {
  const card = cardFor(state, instance);
  if (category === "pokemon") return card.category === "pokemon";
  if (category === "basic-pokemon") return card.category === "pokemon" && card.stage === "basic";
  if (category === "evolution-pokemon") return card.category === "pokemon" && card.stage !== "basic";
  if (category === "trainer") return card.category === "trainer";
  if (["item", "supporter", "stadium"].includes(category)) return card.category === "trainer" && card.subtype === category;
  if (category === "basic-energy") return card.category === "energy" && card.basic;
  return false;
}
function isBasicDarknessEnergy(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "energy" && card.basic && card.energyType === "darkness"; }
function isSupporter(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "supporter"; }
function isStadium(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "stadium"; }
function isTeamRocketPokemonCard(state: GameState, instance: CardInstance, basicOnly = false): boolean { const card = cardFor(state, instance); return card.category === "pokemon" && (!basicOnly || card.stage === "basic") && hasCardTrait(card, "team-rocket"); }
function isTeamRocketSupporter(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "supporter" && hasCardTrait(card, "team-rocket"); }
function heal(state: GameState, playerId: PlayerId, pokemon: PokemonInPlay, amount: number, sourceCardId: string): void { const healed = Math.min(amount, pokemon.damage); pokemon.damage -= healed; if (healed) emitEvent(state, "damage-healed", playerId, { sourceCardId, targetId: playId(pokemon), amount: healed }); }
function draw(state: GameState, playerId: PlayerId, count: number): void { const player = state.players[playerId]; player.hand.push(...player.deck.splice(0, count)); }
function switchTo(state: GameState, playerId: PlayerId, targetId: string): void { const player = state.players[playerId]; if (!player.active) return; const index = player.bench.findIndex((pokemon) => playId(pokemon) === targetId); if (index < 0) return; clearSpecialConditions(player.active); const target = player.bench.splice(index, 1, player.active)[0]!; player.active = target; }
function discardAttackEnergy(state: GameState, playerId: PlayerId, source: PokemonInPlay | undefined, energy: CardInstance | undefined): void { if (!energy) return; const player = state.players[playerId]; const definition = cardFor(state, energy); if (definition.category === "energy" && definition.effectProgramId === "energy:boomerang" && source) { source.attachedEnergy.push(energy); emitEvent(state, "energy-attached-by-effect", playerId, { sourceCardId: energy.cardId, targetId: playId(source), cardInstanceIds: [energy.instanceId], detail: "Boomerang Energy returned after attack effect" }); return; } player.discard.push(energy); }

function choice(state: GameState, continuation: EffectContinuation, options: Omit<EffectChoice, "type" | "choiceId" | "selectedIds" | "continuation" | "sourceCardId" | "sourceEffectId">): boolean {
  state.phase = "choice";
  state.pendingChoice = { type: "effect-choice", choiceId: `${continuation.programId}:${continuation.step}:${state.actionHistory.length}`, selectedIds: [], continuation, sourceCardId: continuation.sourceCardId, sourceEffectId: continuation.programId, ...options };
  return false;
}

function allocationChoice(state: GameState, continuation: EffectContinuation, options: Omit<AllocationChoice, "type" | "choiceId" | "continuation" | "sourceCardId" | "sourceEffectId" | "remainingUnits" | "allocations">): boolean {
  state.phase = "choice";
  state.pendingChoice = { type: "allocation-choice", choiceId: `${continuation.programId}:${continuation.step}:${state.actionHistory.length}`, continuation, sourceCardId: continuation.sourceCardId, sourceEffectId: continuation.programId, allocations: {}, remainingUnits: options.totalUnits, ...options };
  return false;
}

function continuation(start: ProgramStart, step = 0, variables = start.variables ?? {}): EffectContinuation { return { programId: start.programId, step, actingPlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId, sourceInstanceId: start.sourceInstanceId, sourcePokemonId: start.sourcePokemonId, attackId: start.attackId, variables, after: start.after }; }

export function startEffectProgram(state: GameState, start: ProgramStart): boolean {
  const player = state.players[start.actingPlayerId]; const source = start.sourcePokemonId ? findPokemon(player, start.sourcePokemonId) : undefined;
  if (start.programId.startsWith("generated:owned:")) { recordEffectExecution(state, start.programId, start.sourceCardId, "completed", ["generated-owned-runtime"]); return true; }
  if (start.programId === "energy:telepathic-psychic") {
    const capacity = benchCapacity(state, start.actingPlayerId); const eligibleIds = player.deck.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "pokemon" && definition.stage === "basic" && definition.pokemonType === "psychic"; }).map((instance) => instance.instanceId); const maximum = Math.min(Math.max(0, capacity - player.bench.length), 2, eligibleIds.length);
    if (!maximum) { shuffle(state, start.actingPlayerId); return true; }
    return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: maximum, eligibleIds, optional: true, instruction: `Choose up to ${maximum} Basic Psychic Pokémon to put directly onto your Bench.` });
  }
  if (start.programId === "heal-30-selected-pokemon") {
    const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon.damage > 0).map(playId);
    return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose one of your Pokémon to heal 30 damage." });
  }
  const templateParts = start.programId.split(":");
  if (templateParts[0] === "template") {
    const [, kind, operation, rawValue, rawMaximum] = templateParts; const value = Number(rawValue) || 0;
    if ((kind === "ability" || kind === "attack" || kind === "trainer") && (operation === "draw-fixed" || operation === "active-draw-fixed")) { draw(state, start.actingPlayerId, value); return true; }
    if ((kind === "ability" || kind === "trainer") && operation === "draw-to") { draw(state, start.actingPlayerId, Math.max(0, value - player.hand.length)); return true; }
    if ((kind === "trainer" || kind === "ability") && operation === "discard-hand-draw") { const discarded = player.hand.splice(0); player.discard.push(...discarded); if (discarded.length) emitEvent(state, "cards-discarded", start.actingPlayerId, { sourceCardId: start.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId) }); draw(state, start.actingPlayerId, value); return true; }
    if (kind === "ability" && operation === "discard-one-draw") { return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds: player.hand.map((card) => card.instanceId), optional: false, instruction: `Discard exactly one card to draw ${value} cards.` }); }
    if (kind === "trainer" && operation === "shuffle-hand-draw") { player.deck.push(...player.hand.splice(0)); shuffle(state, start.actingPlayerId); draw(state, start.actingPlayerId, value); return true; }
    if (kind === "trainer" && operation === "both-shuffle-draw") { for (const targetId of [start.actingPlayerId, otherPlayer(start.actingPlayerId)] as const) { const target = state.players[targetId]; target.deck.push(...target.hand.splice(0)); shuffle(state, targetId); draw(state, targetId, value); } return true; }
    if ((kind === "trainer" || kind === "ability" || kind === "attack") && operation === "search-deck-to-hand") { const maximum = Number(rawMaximum) || 1; const eligibleIds = player.deck.filter((instance) => matchesTemplateCategory(state, instance, rawValue ?? "")).map((instance) => instance.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(maximum, eligibleIds.length), eligibleIds, optional: true, instruction: `Choose up to ${maximum} ${rawValue?.replace(/-/g, " ") ?? "matching cards"} from your deck.` }); }
    if ((kind === "trainer" || kind === "attack") && operation === "recover-discard-to-hand") { const maximum = Number(rawMaximum) || 1; const eligibleIds = player.discard.filter((instance) => matchesTemplateCategory(state, instance, rawValue ?? "")).map((instance) => instance.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(maximum, eligibleIds.length), eligibleIds, optional: true, instruction: `Choose up to ${maximum} ${rawValue?.replace(/-/g, " ") ?? "matching cards"} from your discard pile.` }); }
    if ((kind === "trainer" || kind === "ability") && operation === "search-basic-to-bench") { const freeSpaces = Math.max(0, benchCapacity(state, start.actingPlayerId) - player.bench.length); const eligibleIds = player.deck.filter((instance) => matchesTemplateCategory(state, instance, "basic-pokemon")).map((instance) => instance.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(value, freeSpaces, eligibleIds.length), eligibleIds, optional: true, instruction: `Choose up to ${value} Basic Pokémon to put onto your Bench.` }); }
    if (kind === "trainer" && operation === "heal-selected") { const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon.damage > 0).map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: `Choose one of your Pokémon to heal ${value} damage.` }); }
    if (kind === "trainer" && operation === "heal-each-own") { for (const target of pokemonTargets(player)) heal(state, start.actingPlayerId, target, value, start.sourceCardId); return true; }
    if (kind === "trainer" && operation === "heal-selected-clear") { const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon.damage > 0 || pokemon.specialConditions.length > 0).map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: `Choose one of your Pokémon to heal ${value} damage and clear all Special Conditions.` }); }
    if (kind === "trainer" && operation === "heal-active") { if (player.active) heal(state, start.actingPlayerId, player.active, value, start.sourceCardId); return true; }
    if (kind === "trainer" && operation === "clear-active-conditions") { if (player.active) clearSpecialConditions(player.active); return true; }
    if (kind === "ability" && operation === "heal-self" && source) { heal(state, start.actingPlayerId, source, value, start.sourceCardId); return true; }
    if (kind === "ability" && operation === "heal-each-own") { for (const target of pokemonTargets(player)) heal(state, start.actingPlayerId, target, value, start.sourceCardId); return true; }
    if (kind === "ability" && operation === "heal-active") { if (player.active) heal(state, start.actingPlayerId, player.active, value, start.sourceCardId); return true; }
    if (kind === "ability" && operation === "active-heal-selected") { const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon.damage > 0).map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: `Choose one of your Pokémon to heal ${value} damage.` }); }
    if (kind === "ability" && operation === "switch-active") { const eligibleIds = player.bench.map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." }); }
    if (kind === "ability" && operation === "switch-self-active") { if (start.sourcePokemonId) switchTo(state, start.actingPlayerId, start.sourcePokemonId); return true; }
    if (kind === "ability" && operation === "place-opponent-counters") { const opponentId = otherPlayer(start.actingPlayerId); const eligibleIds = pokemonTargets(state.players[opponentId]).map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: `Choose one opposing Pokémon to receive ${value} damage counters.` }); }
    if (kind === "ability" && operation === "active-condition") { const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target) { const condition = rawValue as "poisoned" | "burned" | "confused" | "asleep" | "paralyzed"; applySpecialCondition(target, condition); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: condition }); } return true; }
    if (kind === "attack" && operation === "heal-self" && source) { heal(state, start.actingPlayerId, source, value, start.sourceCardId); return true; }
    if (kind === "attack" && operation === "recoil" && source) { source.damage += value; emitEvent(state, "damage-dealt", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(source), amount: value, detail: "recoil" }); return true; }
    if (kind === "attack" && operation === "condition") { const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target && target.damage < effectiveMaxHp(state, target)) { const condition = rawValue as "poisoned" | "burned" | "confused" | "asleep" | "paralyzed"; applySpecialCondition(target, condition); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: condition }); } return true; }
  }
  switch (start.programId) {
    case "attack:swalot-devouring-mouth": case "attack:hazardous-venom": case "attack:love-impact": case "attack:punishing-fang": case "attack:acrobatics": return true;
    case "attack:relentless-flames": case "attack:proud-fangs": return true;
    case "attack:thunderous-fist": return true;
    case "attack:raging-claws": return true;
    case "attack:bright-flame": { if (source) for (const energy of source.attachedEnergy.filter((energy) => { const definition = cardFor(state, energy); return definition.category === "energy" && definition.energyType === "fire"; }).slice(0, 2)) discardAttackEnergy(state, start.actingPlayerId, source, energy); return true; }
    case "attack:zepto-turn": {
      if (!source || !player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: player.bench.map(playId), optional: false, instruction: "Choose a Benched Pokémon to switch with Mega Zeraora ex." });
    }
    case "tool:technical-machine-devolution": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      for (const pokemon of pokemonTargets(opponent)) if (pokemon.stack.length > 1) { const evolution = pokemon.stack.pop(); if (evolution) opponent.hand.push(evolution); }
      return true;
    }
    case "tool:technical-machine-evolution": {
      const eligibleIds = player.bench.map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Benched Pokémon to evolve." });
    }
    case "attack:defensive-posture": {
      const flip = nextRandom(state.rngState); state.rngState = flip.state;
      if (flip.value < 0.5 && source) addTemporaryEffect(state, { kind: "damage-reduction", playerId: start.actingPlayerId, pokemonId: playId(source), amount: 9999, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:panic-poison": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active;
      if (target) for (const condition of ["burned", "confused", "poisoned"] as const) applySpecialCondition(target, condition);
      return true;
    }
    case "attack:gooped-up": {
      const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active;
      if (target) { applySpecialCondition(target, "confused"); addTemporaryEffect(state, { kind: "retreat-lock", playerId: opponentId, pokemonId: playId(target), appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }); }
      return true;
    }
    case "attack:spinning-tail": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      for (const target of pokemonTargets(opponent)) { target.damage += 30; emitEvent(state, "damage-dealt", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(start.actingPlayerId), amount: 30, detail: "Spinning Tail" }); }
      return true;
    }
    case "attack:assassins-return": {
      const source = start.sourcePokemonId ? findPokemon(player, start.sourcePokemonId) : undefined;
      if (source && player.active === source) { player.active = player.bench.shift() ?? null; player.hand.push(...source.stack, ...source.attachedEnergy); source.stack = []; source.attachedEnergy = []; }
      return true;
    }
    case "attack:jumping-press": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Pokémon for 50 damage." });
    }
    case "attack:paralyzing-ball": {
      const energyIds = source?.attachedEnergy.filter((energy) => { const definition = cardFor(state, energy); return definition.category === "energy" && definition.energyType === "lightning"; }).map((energy) => energy.instanceId) ?? [];
      if (energyIds.length < 2) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 2, max: 2, eligibleIds: energyIds, optional: false, instruction: "Discard 2 Lightning Energy to Paralyze the opponent's Active Pokémon." });
    }
    case "attack:electrobullet": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = opponent.bench.map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Pokémon for 30 damage." });
    }
    case "attack:spinning-bird": {
      if (source) for (const energy of source.attachedEnergy.splice(0, 2)) discardAttackEnergy(state, start.actingPlayerId, source, energy);
      return true;
    }
    case "attack:hyper-beam": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = opponent.active?.attachedEnergy.map((energy) => energy.instanceId) ?? [];
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an Energy attached to the opponent's Active Pokémon to discard." });
    }
    case "attack:dragon-pulse": {
      player.discard.push(...player.deck.splice(0, 2));
      return true;
    }
    case "ability:biting-spree": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: Math.min(2, eligibleIds.length), max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 opposing Pokémon for 2 damage counters each." });
    }
    case "ability:sneaky-bite": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: true, instruction: "Choose an opposing Pokémon for 2 damage counters." });
    }
    case "ability:smog-signals": {
      const capacity = Math.max(0, benchCapacity(state, start.actingPlayerId) - player.bench.length);
      const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon" && cardFor(state, card).name.includes("Koffing")).map((card) => card.instanceId);
      if (!capacity || !eligibleIds.length) { shuffle(state, start.actingPlayerId); return true; }
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, capacity, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Koffing to put onto your Bench." });
    }
    case "ability:flying-entry": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = opponent.bench.map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: Math.min(2, eligibleIds.length), max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 opposing Benched Pokémon for 1 damage counter each." });
    }
    case "attack:flame-cannon": {
      const defenderId = otherPlayer(start.actingPlayerId); const target = state.players[defenderId].active;
      if (target && target.damage < topCard(state, target).hp) { applySpecialCondition(target, "burned"); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "burned" }); }
      return true;
    }
    case "attack:spacing-out": {
      const flip = nextRandom(state.rngState); state.rngState = flip.state; const heads = flip.value < .5;
      emitEvent(state, "coin-flip", start.actingPlayerId, { sourceCardId: start.sourceCardId, detail: heads ? "heads" : "tails" });
      if (heads && source) heal(state, start.actingPlayerId, source, 30, start.sourceCardId); return true;
    }
    case "attack:whirlpool": {
      const flip = nextRandom(state.rngState); state.rngState = flip.state;
      const heads = flip.value < .5; emitEvent(state, "coin-flip", start.actingPlayerId, { sourceCardId: start.sourceCardId, detail: heads ? "heads" : "tails" });
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      const eligibleIds = heads && opponent.active ? opponent.active.attachedEnergy.map((energy) => energy.instanceId) : [];
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an Energy attached to your opponent's Active Pokémon to discard." });
    }
    case "attack:strange-hacking": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      if (opponent.active) {
        applySpecialCondition(opponent.active, "confused");
        emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(opponent.active), detail: "confused" });
      }
      return true;
    }
    case "attack:summoning-jutsu": {
      const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Pokémon from your deck to reveal and put into your hand." });
    }
    case "attack:aroma-shot": if (source) clearSpecialConditions(source); return true;
    case "attack:vitality-song": for (const pokemon of pokemonTargets(player)) heal(state, start.actingPlayerId, pokemon, 30, start.sourceCardId); return true;
    case "attack:burning-voice": return true;
    case "attack:chain-crazed": return true;
    case "attack:eon-blade": { if (source && start.attackId) addTemporaryEffect(state, { kind: "attack-lock", playerId: start.actingPlayerId, pokemonId: playId(source), attackId: start.attackId, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId }); return true; }
    case "attack:sob": { const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target) addTemporaryEffect(state, { kind: "retreat-lock", playerId: otherPlayer(start.actingPlayerId), pokemonId: playId(target), appliesOnPlayerTurn: state.players[otherPlayer(start.actingPlayerId)].turnsTaken + 1, sourceCardId: start.sourceCardId }); return true; }
    case "attack:torrential-pump": {
      if (!source || source.attachedEnergy.length < 3) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds: ["skip", "pump"], optional: false, instruction: "Choose whether to shuffle 3 Energy into your deck for 120 Bench damage." });
    }
    case "attack:allure": case "template:attack:draw-fixed:1": case "template:attack:draw-fixed:2": {
      const count = start.programId === "attack:allure" ? 2 : Number(start.programId.split(":").at(-1)) || 1;
      draw(state, start.actingPlayerId, count); return true;
    }
    case "attack:invite-evil": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.pokemonType === "darkness"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Darkness Pokémon from your deck." });
    }
    case "attack:traverse-time": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "trainer" && definition.subtype === "stadium" || definition.category === "pokemon" && definition.pokemonType === "grass"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Grass Pokémon and/or Stadium cards." });
    }
    case "attack:icicle-loop": {
      const eligibleIds = source?.attachedEnergy.map((energy) => energy.instanceId) ?? [];
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an Energy attached to this Pokémon to return to your hand." });
    }
    case "attack:shadow-bind": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active;
      if (target) addTemporaryEffect(state, { kind: "retreat-lock", playerId: otherPlayer(start.actingPlayerId), pokemonId: playId(target), appliesOnPlayerTurn: state.players[otherPlayer(start.actingPlayerId)].turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:shinobi-blade": {
      const eligibleIds = player.deck.map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose a card from your deck for Shinobi Blade." });
    }
    case "attack:aura-jab": {
      const eligibleIds = player.discard.filter((card) => { const definition = cardFor(state, card); return definition.category === "energy" && definition.basic && definition.energyType === "fighting"; }).map((card) => card.instanceId);
      if (!eligibleIds.length || !player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Basic Fighting Energy from your discard pile." });
    }
    case "attack:growl": {
      const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active;
      if (target) addTemporaryEffect(state, { kind: "damage-reduction", playerId: opponentId, pokemonId: playId(target), amount: 20, appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:gemstone-mimicry": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const active = opponent.active;
      const eligibleIds = active ? active.stack.flatMap((instance) => { const definition = cardFor(state, instance); return definition.category === "pokemon" ? definition.attacks.map((attack) => attack.id) : []; }) : [];
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "mode", min: eligibleIds.length ? 1 : 0, max: 1, eligibleIds, optional: true, instruction: "Choose an attack from your opponent's Active Tera Pokémon." });
    }
    case "attack:mirage-barrage": {
      const eligibleEnergy = source?.attachedEnergy.filter((card) => cardFor(state, card).category === "energy").map((card) => card.instanceId) ?? [];
      if (eligibleEnergy.length < 2) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 2, max: 2, eligibleIds: eligibleEnergy, optional: false, instruction: "Discard 2 Energy from this Pokémon." });
    }
    case "attack:jolting-charge": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "energy" && definition.basic && (definition.energyType === "grass" || definition.energyType === "lightning"); }).map((card) => card.instanceId);
      if (!eligibleIds.length || !pokemonTargets(player).length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(4, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Grass and up to 2 Basic Lightning Energy." });
    }
    case "attack:night-joker": {
      const eligibleIds = player.bench.flatMap((pokemon) => { const definition = topCard(state, pokemon); return definition.attacks.map((attack) => attack.id); });
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "mode", min: eligibleIds.length ? 1 : 0, max: 1, eligibleIds, optional: true, instruction: "Choose an attack from a Benched N's Pokémon." });
    }
    case "attack:seek-inspiration": {
      const top = player.deck.shift();
      if (!top) return true;
      player.discard.push(top);
      const definition = cardFor(state, top);
      if (definition.category !== "pokemon" || definition.hasRuleBox || definition.ruleBox === "multi-prize" || !definition.attacks.length) return true;
      const eligibleIds = definition.attacks.map((attack) => attack.id);
      return choice(state, continuation(start, 1, { copiedCard: [top.instanceId] }), { playerId: start.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds, optional: false, instruction: `Choose an attack from ${definition.name} to use as this attack.` });
    }
    case "attack:push-down": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      if (!opponent.active || !opponent.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: otherPlayer(start.actingPlayerId), selectionKind: "pokemon", min: 1, max: 1, eligibleIds: opponent.bench.map(playId), optional: false, instruction: "Your opponent chooses a Benched Pokémon to become Active." });
    }
    case "attack:trading-places": {
      if (!player.active || !player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: player.bench.map(playId), optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
    }
    case "attack:impact-blow": case "attack:prism-edge": case "attack:blood-moon": {
      if (source && start.attackId) addTemporaryEffect(state, { kind: "attack-lock", playerId: start.actingPlayerId, pokemonId: playId(source), attackId: start.attackId, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:smolder-sault": {
      if (source) for (const attack of topCard(state, source).attacks) addTemporaryEffect(state, { kind: "attack-lock", playerId: start.actingPlayerId, pokemonId: playId(source), attackId: attack.id, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:shred": case "attack:superb-scissors": case "attack:destructive-drill": return true;
    case "attack:hazardous-tail": {
      if (source) { source.damage += 70; emitEvent(state, "damage-dealt", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(source), amount: 70, detail: "Hazardous Tail recoil" }); }
      const target = state.players[otherPlayer(start.actingPlayerId)].active;
      if (target) { applySpecialCondition(target, "paralyzed"); applySpecialCondition(target, "poisoned"); }
      return true;
    }
    case "attack:ascension": {
      if (!source) return true;
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.evolvesFrom === topCard(state, source).name; }).map((card) => card.instanceId);
      if (!eligibleIds.length || !player.bench.some((pokemon) => topCard(state, pokemon).pokemonType === "psychic")) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Pokémon that evolves from this Dwebble." });
    }
    case "attack:thunder-raid": {
      if (source) while (source.attachedEnergy.length) { const energy = source.attachedEnergy.shift(); if (energy) player.discard.push(energy); }
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = opponent.bench.filter((pokemon) => topCard(state, pokemon).isPokemonEx).map(playId);
      if (!eligibleIds.length || !player.bench.some((pokemon) => topCard(state, pokemon).pokemonType === "psychic")) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Pokémon ex for 210 damage." });
    }
    case "attack:drum-beating": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active;
      if (target) addTemporaryEffect(state, { kind: "attack-cost-increase", playerId: otherPlayer(start.actingPlayerId), pokemonId: playId(target), amount: 1, appliesOnPlayerTurn: state.players[otherPlayer(start.actingPlayerId)].turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:wood-hammer": if (source) { source.damage += 50; return true; } return true;
    case "attack:trifrost": {
      if (source) while (source.attachedEnergy.length) { const energy = source.attachedEnergy.shift(); if (energy) player.discard.push(energy); }
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: Math.min(3, eligibleIds.length), max: Math.min(3, eligibleIds.length), eligibleIds, optional: false, instruction: "Choose up to 3 opposing Pokémon for 110 damage each." });
    }
    case "attack:tantrum": if (source) { applySpecialCondition(source, "confused"); return true; } return true;
    case "attack:destined-fight": {
      if (player.active) { player.active.damage = effectiveMaxHp(state, player.active); state.pendingKnockOutCause = { cause: "attack-damage", sourcePlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId }; }
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; if (opponent.active) { opponent.active.damage = effectiveMaxHp(state, opponent.active); state.pendingKnockOutCause = { cause: "attack-damage", sourcePlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId }; }
      return true;
    }
    case "attack:topaz-bolt": {
      const eligibleIds = source?.attachedEnergy.map((energy) => energy.instanceId) ?? [];
      if (eligibleIds.length < 3) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 3, max: 3, eligibleIds, optional: false, instruction: "Choose exactly 3 Energy to discard from this Pokémon." });
    }
    case "attack:delightful-kiss": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "energy" && definition.basic && definition.energyType === "psychic"; }).map((card) => card.instanceId);
      if (!eligibleIds.length || !player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Psychic Energy." });
    }
    case "attack:electromagnetic-sonar": {
      const eligibleIds = player.discard.filter((card) => cardFor(state, card).category === "trainer").map((card) => card.instanceId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Trainer card from your discard pile." });
    }
    case "attack:slight-shift": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const energyIds = pokemonTargets(opponent).flatMap((pokemon) => pokemon.attachedEnergy.map((energy) => energy.instanceId));
      if (!energyIds.length || pokemonTargets(opponent).length < 2) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds: energyIds, optional: false, instruction: "Choose an Energy attached to an opponent's Pokémon." });
    }
    case "attack:hide": {
      const flip = nextRandom(state.rngState); state.rngState = flip.state; const heads = flip.value < .5; emitEvent(state, "coin-flip", start.actingPlayerId, { sourceCardId: start.sourceCardId, detail: heads ? "heads" : "tails" });
      if (heads && source) addTemporaryEffect(state, { kind: "attack-prevention", playerId: start.actingPlayerId, pokemonId: playId(source), appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId });
      return true;
    }
    case "attack:protect-charge": if (source) { addTemporaryEffect(state, { kind: "damage-reduction", playerId: start.actingPlayerId, pokemonId: playId(source), amount: 30, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId }); return true; } return true;
    case "attack:flamebody-cannon": {
      if (source) while (source.attachedEnergy.length) { const energy = source.attachedEnergy.shift(); if (energy) player.discard.push(energy); }
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; if (!opponent.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: opponent.bench.map(playId), optional: false, instruction: "Choose an opposing Benched Pokémon for 90 damage." });
    }
    case "attack:terminal-period": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active;
      if (target && target.damage === 60) { target.damage = effectiveMaxHp(state, target); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId }; }
      return true;
    }
    case "attack:claw-darkness": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; if (!opponent.hand.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds: opponent.hand.map((card) => card.instanceId), optional: false, instruction: "Choose a card from your opponent's revealed hand to discard." });
    }
    case "attack:bounce-back": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; if (!opponent.active || !opponent.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: otherPlayer(start.actingPlayerId), selectionKind: "pokemon", min: 1, max: 1, eligibleIds: opponent.bench.map(playId), optional: false, instruction: "Choose a Benched Pokémon to become Active." });
    }
    case "ability:run-errand": draw(state, start.actingPlayerId, 2); return true;
    case "ability:allure": draw(state, start.actingPlayerId, 2); return true;
    case "ability:teleporter": {
      const source = start.sourcePokemonId ? findPokemon(player, start.sourcePokemonId) : undefined;
      if (!source || player.active !== source || !player.bench.length) return true;
      player.deck.push(...source.stack, ...source.attachedEnergy); player.active = player.bench.shift() ?? null; shuffle(state, start.actingPlayerId); emitEvent(state, "ability-used", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: start.sourcePokemonId, detail: "Teleporter shuffled Active Pokémon" }); return true;
    }
    case "ability:lunar-cycle": {
      const energyId = player.hand.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "energy" && definition.basic && definition.energyType === "fighting"; })[0]?.instanceId;
      if (energyId) { const energy = removeById(player.hand, energyId); if (energy) player.discard.push(energy); draw(state, start.actingPlayerId, 3); emitEvent(state, "ability-used", start.actingPlayerId, { sourceCardId: start.sourceCardId, cardInstanceIds: [energyId], detail: "Lunar Cycle" }); } return true;
    }
    case "ability:boom-boom-groove": {
      const eligibleIds = player.deck.map((instance) => instance.instanceId); if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose any card for Boom Boom Groove." });
    }
    case "ability:mortal-shuriken": {
      const energyIds = player.hand.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "energy" && definition.basic && definition.energyType === "water"; }).map((instance) => instance.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds: energyIds, optional: false, instruction: "Choose a Basic Water Energy from your hand to discard for Mortal Shuriken." });
    }
    case "ability:metallic-signal": {
      const eligibleIds = player.deck.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "pokemon" && definition.pokemonType === "metal" && definition.stage !== "basic"; }).map((instance) => instance.instanceId); if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Evolution Metal Pokémon." });
    }
    case "ability:metal-maker": {
      const top = player.deck.splice(0, 4); const eligibleIds = top.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "energy" && definition.basic && definition.energyType === "metal"; }).map((instance) => instance.instanceId); player.deck.push(...top); if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1, { top: top.map((instance) => instance.instanceId) }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: eligibleIds.length, eligibleIds, optional: true, instruction: "Choose any number of Basic Metal Energy among the top 4 cards." });
    }
    case "ability:run-away-draw": {
      draw(state, start.actingPlayerId, 3);
      if (source) {
        const benchIndex = player.bench.findIndex((pokemon) => pokemon === source);
        if (benchIndex >= 0) player.bench.splice(benchIndex, 1);
        else if (player.active === source) player.active = player.bench.shift() ?? null;
        const returned = [...source.stack, ...source.attachedEnergy]; source.stack = []; source.attachedEnergy = []; player.deck.push(...returned); shuffle(state, start.actingPlayerId);
      }
      return true;
    }
    case "ability:invite-evil": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.pokemonType === "darkness"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Darkness Pokémon from your deck." });
    }
    case "ability:come-and-get-you": {
      const eligibleIds = player.discard.filter((card) => cardFor(state, card).id === "sv8pt5-35").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length, benchCapacity(state, start.actingPlayerId) - player.bench.length), eligibleIds, optional: true, instruction: "Choose up to 3 Duskull from your discard pile for your Bench." });
    }
    case "ability:cursed-blast-5": case "ability:cursed-blast-13": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(opponent).map(playId), optional: false, instruction: `Choose an opposing Pokémon for ${start.programId.endsWith("13") ? 13 : 5} damage counters.` });
    }
    case "ability:seething-spirit": {
      const eligibleIds = player.discard.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Basic Energy from your discard pile to attach." });
    }
    case "ability:jewel-seeker": {
      const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "trainer").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Trainer cards from your deck." });
    }
    case "trainer:rosas-encouragement": {
      if (player.prizes.length <= state.players[otherPlayer(start.actingPlayerId)].prizes.length) return true;
      const eligibleIds = player.discard.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Energy from your discard pile." });
    }
    case "trainer:xerosics-machinations": {
      const opponentId = otherPlayer(start.actingPlayerId); const opponent = state.players[opponentId];
      return choice(state, continuation(start, 1), { playerId: opponentId, selectionKind: "card", min: Math.max(0, opponent.hand.length - 3), max: Math.max(0, opponent.hand.length - 3), eligibleIds: opponent.hand.map((card) => card.instanceId), optional: false, instruction: "Choose cards to discard until your hand has 3 cards." });
    }
    case "trainer:brocks-scouting": {
      const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Pokémon or 1 Evolution Pokémon from your deck." });
    }
    case "trainer:hilda": {
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.stage !== "basic"; }).map((card) => card.instanceId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Evolution Pokémon from your deck." });
    }
    case "ability:skyliner": return true;
    case "ability:snow-sink": { if (state.stadium) { const ownerId = state.stadium.instanceId.startsWith("player-one-") ? "player-one" : "player-two"; state.players[ownerId].discard.push(state.stadium); state.stadium = null; } return true; }
    case "attack:burst-roar": { const discarded = player.hand.splice(0); player.discard.push(...discarded); draw(state, start.actingPlayerId, 6); return true; }
    case "attack:powerful-hand": { const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target) { const amount = player.hand.length * 20; target.damage += amount; emitEvent(state, "damage-dealt", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(start.actingPlayerId), amount, detail: "Powerful Hand damage counters" }); if (isKnockedOut(state, target)) state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId }; } return true; }
    case "attack:teleportation-attack": {
      const eligibleIds = player.bench.map(playId); if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with Abra." });
    }
    case "attack:raging-bolt": case "attack:bellowing-thunder": { const eligibleIds = pokemonTargets(player).flatMap((pokemon) => pokemon.attachedEnergy.filter((instance) => isBasicEnergy(state, instance)).map((instance) => instance.instanceId)); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: eligibleIds.length, eligibleIds, optional: true, instruction: "Choose any number of Basic Energy attached to your Pokémon to discard." }); }
    case "attack:cruel-arrow": return true;
    case "attack:poisonous-musculature": {
      const eligibleIds = player.deck.filter((card) => isBasicDarknessEnergy(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Darkness Energy to attach to this Okidogi ex." });
    }
    case "ability:subjugating-chains": {
      const targetId = start.variables?.target?.[0]; if (targetId) { switchTo(state, start.actingPlayerId, targetId); const target = player.active; if (target) { applySpecialCondition(target, "poisoned"); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "poisoned by Subjugating Chains" }); } } return true;
    }
    case "ability:adrena-brain": {
      const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon.damage >= 10).map(playId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 of your damaged Pokémon to move damage counters from." });
    }
    case "ability:flip-the-script": draw(state, start.actingPlayerId, 3); return true;
    case "ability:attract-customers": {
      const subset = player.deck.slice(0, 6).map((card) => card.instanceId); const eligibleIds = player.deck.slice(0, 6).filter((card) => isSupporter(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Supporter from the top 6 cards." });
    }
    case "ability:charging-up": {
      const eligibleIds = player.discard.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose a Basic Energy from your discard pile to attach to this Pokémon." });
    }
    case "ability:recon-directive": {
      const eligibleIds = player.deck.slice(0, 2).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { top: eligibleIds }), { playerId: start.actingPlayerId, selectionKind: "card", min: Math.min(1, eligibleIds.length), max: Math.min(1, eligibleIds.length), eligibleIds, optional: false, instruction: "Choose 1 of the top 2 cards to put into your hand." });
    }
    case "ability:ns-trade": {
      const eligibleIds = player.hand.map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Discard exactly 1 card to draw 2 cards (Trade)." });
    }
    case "ability:teal-dance": { const eligibleIds = player.hand.filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && card.basic && card.energyType === "grass"; }).map((instance) => instance.instanceId); if (!source || !eligibleIds.length) return true; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose the Basic Grass Energy to attach to this Pokémon." }); }
    case "ability:ripening-charge": { const eligibleIds = player.hand.filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && card.basic && card.energyType === "grass"; }).map((instance) => instance.instanceId); if (!eligibleIds.length || !pokemonTargets(player).length) return true; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Basic Grass Energy to attach." }); }
    case "attack:mind-bend": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "confused"); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "confused" }); } return true;
    }
    case "attack:dirty-headbutt": if (source && start.attackId) { const effect = { kind: "attack-lock" as const, playerId: start.actingPlayerId, pokemonId: playId(source), attackId: start.attackId, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId }; addTemporaryEffect(state, effect); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(source), detail: "Dirty Headbutt attack lock" }); } return true;
    case "attack:ns-zekrom-rampage": { if (source && start.attackId) addTemporaryEffect(state, { kind: "attack-lock", playerId: start.actingPlayerId, pokemonId: playId(source), attackId: start.attackId, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId }); return true; }
    case "attack:yveltal-clutch": { const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active; if (target) addTemporaryEffect(state, { kind: "retreat-lock", playerId: opponentId, pokemonId: playId(target), appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }); return true; }
    case "attack:meowth-tuck-tail": {
      if (source) { const index = player.bench.findIndex((pokemon) => pokemon === source); if (index >= 0) player.bench.splice(index, 1); else if (player.active === source) player.active = player.bench.shift() ?? null; const returned = source.stack.splice(0); returned.push(...source.attachedEnergy); source.attachedEnergy = []; player.hand.push(...returned); }
      return true;
    }
    case "attack:poison-chain": {
      const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "poisoned"); const effect = { kind: "retreat-lock" as const, playerId: opponentId, pokemonId: playId(target), appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }; addTemporaryEffect(state, effect); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "poisoned" }); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, detail: "retreat lock" }); } return true;
    }
    case "attack:itchy-pollen": {
      const opponentId = otherPlayer(start.actingPlayerId); addTemporaryEffect(state, { kind: "item-lock", playerId: opponentId, appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetPlayerId: opponentId, detail: "item lock" }); return true;
    }
    case "attack:tainted-horn": { const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "poisoned", { countersPerCheckup: 8, sourceCardId: start.sourceCardId }); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, detail: "poisoned by Tainted Horn" }); emitEvent(state, "enhanced-poison-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, amount: 8, detail: "Tainted Horn: 8 counters per Checkup" }); } return true; }
    case "attack:erasure-ball": {
      const eligibleIds = player.bench.flatMap((pokemon) => pokemon.attachedEnergy).map((energy) => energy.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Energy from your Benched Pokémon to discard." });
    }
    case "attack:phantom-dive": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)];
      const eligibleIds = opponent.bench.filter((pokemon) => {
        const card = topCard(state, pokemon);
        return !(card.stage === "basic" && hasCardTrait(card, "team-rocket") && pokemonTargets(opponent).some((candidate) => topCard(state, candidate).abilities.some((ability) => ability.effectProgramId === "passive:repelling-veil")));
      }).map(playId);
      if (!eligibleIds.length) { state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId }; return true; }
      return allocationChoice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "allocation", eligibleIds, totalUnits: 6, minimumPerTarget: 0, maximumPerTarget: 6, unitLabel: "damage counter", instruction: "Place 6 damage counters on your opponent's Benched Pokémon." });
    }
    case "attack:tuck-tail": { if (source && player.active === source) { player.active = null; player.hand.push(...source.stack, ...source.attachedEnergy); } return true; }
    case "ability:elegant-heal": for (const pokemon of pokemonTargets(player)) heal(state, start.actingPlayerId, pokemon, 20, start.sourceCardId); return true;
    case "attack:fiery-fighting-spirit": {
      const eligibleIds = player.deck.filter((card) => { const def = cardFor(state, card); return def.category === "energy" && def.basic && def.energyType === "fire"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: 1, eligibleIds, optional: true, instruction: "Choose up to 1 Basic Fire Energy from your deck to attach to this Charcadet." });
    }
    case "attack:colorful-palette": {
      const subset = player.deck.slice(0, 5).map((card) => card.instanceId); const eligibleIds = player.deck.slice(0, 5).filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: eligibleIds.length, eligibleIds, optional: true, instruction: "Choose any number of Basic Energy from the top 5 cards." });
    }
    case "trainer:energy-retrieval": {
      const eligibleIds = player.discard.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Energy from your discard pile." });
    }
    case "trainer:escape-rope": {
      const opponentId = otherPlayer(start.actingPlayerId); const eligibleIds = state.players[opponentId].bench.map(playId);
      if (!eligibleIds.length) return continueEscapeRope(state, continuation(start, 1), []);
      return choice(state, continuation(start, 1), { playerId: opponentId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
    }
    case "trainer:great-ball": {
      const subset = player.deck.slice(0, 7).map((card) => card.instanceId); const eligibleIds = player.deck.slice(0, 7).filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from the top 7 cards." });
    }
    case "trainer:dusk-ball": {
      const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from your deck." });
    }
    case "trainer:iono": {
      for (const playerId of [start.actingPlayerId, otherPlayer(start.actingPlayerId)] as const) { const target = state.players[playerId]; const bottom = shuffleDeterministic(target.hand, state.rngState); state.rngState = bottom.state; target.deck.push(...bottom.value); target.hand = []; }
      for (const playerId of [start.actingPlayerId, otherPlayer(start.actingPlayerId)] as const) draw(state, playerId, state.players[playerId].prizes.length);
      return true;
    }
    case "trainer:jacq": {
      const eligibleIds = player.deck.filter((card) => { const def = cardFor(state, card); return def.category === "pokemon" && def.stage !== "basic"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Evolution Pokémon from your deck." });
    }
    case "trainer:klara": return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds: ["pokemon", "energy", "both"], optional: false, instruction: "Choose Pokémon, Basic Energy, or both Klara modes." });
    case "trainer:nest-ball": {
      const eligibleIds = player.deck.filter((card) => { const def = cardFor(state, card); return def.category === "pokemon" && def.stage === "basic"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(player.bench.length < benchCapacity(state, start.actingPlayerId) ? 1 : 0, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Basic Pokémon to put onto your Bench." });
    }
    case "trainer:professors-research": { const discarded = player.hand.splice(0); player.discard.push(...discarded); if (discarded.length) emitEvent(state, "cards-discarded", start.actingPlayerId, { sourceCardId: start.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId) }); draw(state, start.actingPlayerId, 7); return true; }
    case "trainer:ultra-ball": {
      const eligibleIds = player.hand.map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 2, max: 2, eligibleIds, optional: false, instruction: "Choose exactly 2 other cards to discard for Ultra Ball." });
    }
    case "trainer:secret-box": {
      const discarded = player.hand.splice(0, Math.min(3, player.hand.length)); player.discard.push(...discarded);
      const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "trainer" && ["item", "tool", "supporter", "stadium"].includes(definition.subtype); }).map((card) => card.instanceId);
      return choice(state, continuation(start, 2), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(4, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Item, Pokémon Tool, Supporter, and Stadium from your deck." });
    }
    case "trainer:eri": { const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = opponent.hand.filter((card) => cardFor(state, card).category === "trainer" && cardFor(state, card).subtype === "item").map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Item cards from your opponent's revealed hand to discard." }); }
    case "trainer:ruffian": { const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).filter((pokemon) => Boolean(pokemon.tool) && pokemon.attachedEnergy.some((energy) => cardFor(state, energy).category === "energy" && !isBasicEnergy(state, energy))).map((pokemon) => pokemon.tool!.instanceId); if (!eligibleIds.length) return true; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Pokémon Tool attached to an opposing Pokémon with Special Energy to discard." }); }
    case "tool:black-belt-training": addTemporaryEffect(state, { kind: "attack-damage-bonus", playerId: start.actingPlayerId, amount: 40, appliesOnPlayerTurn: player.turnsTaken, sourceCardId: start.sourceCardId }); return true;
    case "trainer:janines-secret-art": {
      const eligibleIds = pokemonTargets(player).filter((pokemon) => topCard(state, pokemon).pokemonType === "darkness").map(playId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 of your Darkness Pokémon." });
    }
    case "trainer:lillies-determination": { player.deck.push(...player.hand.splice(0)); shuffle(state, start.actingPlayerId); draw(state, start.actingPlayerId, player.prizes.length === 6 ? 8 : 6); return true; }
    case "trainer:colress-tenacity": {
      const eligibleIds = player.deck.filter((card) => isStadium(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Stadium from your deck." });
    }
    case "trainer:boss-orders": {
      const opponentId = otherPlayer(start.actingPlayerId); const eligibleIds = state.players[opponentId].bench.map(playId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 opposing Benched Pokémon to switch Active." });
    }
    case "trainer:cyrano": {
      const eligibleIds = player.deck.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" && card.isPokemonEx; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Pokémon ex from your deck." });
    }
    case "trainer:poke-pad": {
      const eligibleIds = player.deck.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" && !card.hasRuleBox; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon without a Rule Box." });
    }
    case "trainer:pal-pad": {
      const eligibleIds = player.discard.filter((instance) => isSupporter(state, instance)).map((instance) => instance.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Supporter cards from your discard pile to shuffle into your deck." });
    }
    case "trainer:pokegear-3": {
      const subset = player.deck.slice(0, 7).map((card) => card.instanceId); const eligibleIds = player.deck.slice(0, 7).filter((card) => isSupporter(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Supporter from the top 7 cards." });
    }
    case "trainer:energy-switch": {
      const eligibleIds = pokemonTargets(player).flatMap((pokemon) => pokemon.attachedEnergy.filter((energy) => isBasicEnergy(state, energy)).map((energy) => energy.instanceId));
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Basic Energy attached to one of your Pokémon." });
    }
    case "trainer:crispin": {
      const eligibleIds = player.deck.filter((card) => { const def = cardFor(state, card); return def.category === "energy" && def.basic; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Energy cards of different types." });
    }
    case "trainer:crushing-hammer": {
      const flip = nextRandom(state.rngState); state.rngState = flip.state; const heads = flip.value < .5; emitEvent(state, "coin-flip", start.actingPlayerId, { sourceCardId: start.sourceCardId, detail: heads ? "heads" : "tails" });
      if (!heads) return true; const opponent = state.players[otherPlayer(start.actingPlayerId)]; const eligibleIds = pokemonTargets(opponent).flatMap((pokemon) => pokemon.attachedEnergy).map((energy) => energy.instanceId); if (!eligibleIds.length) return true; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an Energy attached to an opponent's Pokémon to discard." });
    }
    case "trainer:unfair-stamp": {
      for (const id of [start.actingPlayerId, otherPlayer(start.actingPlayerId)] as const) { const target = state.players[id]; target.deck.push(...target.hand.splice(0)); shuffle(state, id); draw(state, id, id === start.actingPlayerId ? 5 : 2); } return true;
    }
    case "trainer:special-red-card": { const opponentId = otherPlayer(start.actingPlayerId); const opponent = state.players[opponentId]; opponent.deck.push(...opponent.hand.splice(0)); shuffle(state, opponentId); draw(state, opponentId, 3); return true; }
    case "trainer:night-stretcher": {
      const eligibleIds = player.discard.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" || card.category === "energy" && card.basic; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Pokémon or Basic Energy from your discard pile." });
    }
    case "trainer:master-ball": {
      const eligibleIds = player.deck.filter((instance) => cardFor(state, instance).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from your deck." });
    }
    case "trainer:buddy-buddy-poffin": { const freeSpaces = Math.max(0, benchCapacity(state, start.actingPlayerId) - player.bench.length); const eligibleIds = player.deck.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" && card.stage === "basic" && card.hp <= 70; }).map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, freeSpaces, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Pokémon with 70 HP or less to put onto your Bench." }); }
    case "trainer:earthen-vessel": return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds: player.hand.map((card) => card.instanceId), optional: false, instruction: "Discard exactly 1 other card for Earthen Vessel." });
    case "trainer:rare-candy": { const eligibleIds = legalRareCandyBasics(state, start.actingPlayerId).map(playId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Basic Pokémon to evolve with Rare Candy." }); }
    case "trainer:super-rod": { const eligibleIds = player.discard.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" || card.category === "energy" && card.basic; }).map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Pokémon and Basic Energy to shuffle into your deck." }); }
    case "trainer:team-rocket-archer": { for (const targetId of [start.actingPlayerId, otherPlayer(start.actingPlayerId)] as const) { const target = state.players[targetId]; target.deck.push(...target.hand.splice(0)); shuffle(state, targetId); draw(state, targetId, targetId === start.actingPlayerId ? 5 : 3); } return true; }
    case "trainer:team-rocket-ariana": { const target = allPokemonHaveTrait(state, player, "team-rocket") ? 8 : 5; draw(state, start.actingPlayerId, Math.max(0, target - player.hand.length)); emitEvent(state, "cards-searched", start.actingPlayerId, { sourceCardId: start.sourceCardId, amount: target, detail: target === 8 ? "Ariana draw-to-8" : "Ariana draw-to-5" }); return true; }
    case "trainer:team-rocket-giovanni": { const eligibleIds = player.active && pokemonHasTrait(state, player.active, "team-rocket") ? player.bench.filter((pokemon) => pokemonHasTrait(state, pokemon, "team-rocket")).map(playId) : []; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Team Rocket's Pokémon to switch Active." }); }
    case "trainer:team-rocket-petrel": { const eligibleIds = player.deck.filter((instance) => cardFor(state, instance).category === "trainer").map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Trainer card from your deck." }); }
    case "trainer:team-rocket-proton": { const eligibleIds = player.deck.filter((instance) => isTeamRocketPokemonCard(state, instance, true)).map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Basic Team Rocket's Pokémon." }); }
    case "trainer:team-rocket-transceiver": { const eligibleIds = player.deck.filter((instance) => isTeamRocketSupporter(state, instance)).map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Team Rocket Supporter." }); }
    case "trainer:youngster": { player.deck.push(...player.hand.splice(0)); shuffle(state, start.actingPlayerId); draw(state, start.actingPlayerId, 5); return true; }
    case "trainer:ns-pp-up": {
      const energy = player.discard.find((instance) => isBasicEnergy(state, instance)); const target = player.bench.find((pokemon) => topCard(state, pokemon).name.includes("N's"));
      if (energy && target) { removeById(player.discard, energy.instanceId); target.attachedEnergy.push(energy); emitEvent(state, "energy-attached-by-effect", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "N's PP Up" }); }
      return true;
    }
    case "trainer:ciphermaniac-codebreaking": {
      const selected = player.deck.splice(0, Math.min(2, player.deck.length)); player.deck.unshift(...selected.reverse()); return true;
    }
    case "trainer:lanas-aid": { const eligibleIds = player.discard.filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && card.basic || card.category === "pokemon" && !card.hasRuleBox; }).map((instance) => instance.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 3 Pokémon without a Rule Box and/or Basic Energy from your discard pile." }); }
    case "trainer:dawn": { const eligibleIds = player.deck.filter((candidate) => { const definition = cardFor(state, candidate); return definition.category === "pokemon" && ["basic", "stage1", "stage2"].includes(definition.stage); }).map((candidate) => candidate.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(3, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Basic, 1 Stage 1, and 1 Stage 2 Pokémon from your deck." }); }
    case "trainer:bug-catching-set": { const subset = player.deck.slice(0, 7).map((instance) => instance.instanceId); const eligibleIds = player.deck.slice(0, 7).filter((instance) => { const card = cardFor(state, instance); return card.category === "energy" && card.basic && card.energyType === "grass" || card.category === "pokemon" && card.pokemonType === "grass"; }).map((instance) => instance.instanceId); return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Grass Pokémon or Basic Grass Energy from the top 7 cards." }); }
    case "trainer:glass-trumpet": { const tera = pokemonTargets(player).some((pokemon) => topCard(state, pokemon).traits?.includes("tera")); const eligibleIds = player.bench.filter((pokemon) => topCard(state, pokemon).pokemonType === "colorless").map(playId); if (!tera || !eligibleIds.length || !player.discard.some((instance) => isBasicEnergy(state, instance))) return true; return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Benched Colorless Pokémon for Glass Trumpet." }); }
    case "trainer:premium-power-pro": addTemporaryEffect(state, { kind: "attack-damage-bonus", playerId: start.actingPlayerId, amount: 30, pokemonType: "fighting", appliesOnPlayerTurn: player.turnsTaken, sourceCardId: start.sourceCardId }); return true;
    case "trainer:fighting-gong": {
      const eligibleIds = player.deck.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "energy" && definition.basic && definition.energyType === "fighting" || definition.category === "pokemon" && definition.stage === "basic" && definition.pokemonType === "fighting"; }).map((instance) => instance.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: 1, eligibleIds, optional: true, instruction: "Choose a Basic Fighting Energy or Basic Fighting Pokémon." });
    }
    case "trainer:jumbo-ice-cream": if (player.active && player.active.attachedEnergy.length >= 3) { heal(state, start.actingPlayerId, player.active, 80, start.sourceCardId); } return true;
    case "trainer:wondrous-patch": {
      const eligibleIds = player.discard.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "energy" && definition.basic && definition.energyType === "psychic"; }).map((instance) => instance.instanceId);
      if (!eligibleIds.length || !player.bench.some((pokemon) => topCard(state, pokemon).pokemonType === "psychic")) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Basic Psychic Energy from your discard pile." });
    }
    case "trainer:energy-recycler": {
      const eligibleIds = player.discard.filter((instance) => isBasicEnergy(state, instance)).map((instance) => instance.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(5, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 5 Basic Energy to shuffle into your deck." });
    }
    case "trainer:sacred-ash": {
      const eligibleIds = player.discard.filter((instance) => cardFor(state, instance).category === "pokemon").map((instance) => instance.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(5, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 5 Pokémon to shuffle into your deck." });
    }
    case "trainer:biancas-devotion": {
      const eligibleIds = pokemonTargets(player).filter((pokemon) => effectiveMaxHp(state, pokemon) - pokemon.damage <= 30).map(playId);
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Pokémon with 30 HP or less remaining to heal fully." });
    }
    case "trainer:enhanced-hammer": {
      const eligibleIds = pokemonTargets(state.players[otherPlayer(start.actingPlayerId)]).flatMap((pokemon) => pokemon.attachedEnergy.filter((energy) => { const definition = cardFor(state, energy); return definition.category === "energy" && !isBasicEnergy(state, energy); }).map((energy) => energy.instanceId));
      if (!eligibleIds.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Special Energy attached to an opponent's Pokémon." });
    }
    case "trainer:prime-catcher": {
      const eligibleIds = state.players[otherPlayer(start.actingPlayerId)].bench.map(playId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Pokémon to switch Active." });
    }
    case "trainer:lumiose-galette": if (player.active) { heal(state, start.actingPlayerId, player.active, 20, start.sourceCardId); clearSpecialConditions(player.active); } return true;
    case "trainer:surfer": {
      if (!player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: player.bench.map(playId), optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
    }
    case "trainer:azs-tranquility": {
      if (!player.bench.length) return true;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: player.bench.map(playId), optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
    }
    case "trainer:lisias-appeal": {
      const eligibleIds = state.players[otherPlayer(start.actingPlayerId)].bench.filter((pokemon) => topCard(state, pokemon).stage === "basic").map(playId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Basic Pokémon." });
    }
    case "trainer:precious-trolley": {
      const capacity = benchCapacity(state, start.actingPlayerId); const free = Math.max(0, capacity - player.bench.length); const eligibleIds = player.deck.filter((instance) => { const definition = cardFor(state, instance); return definition.category === "pokemon" && definition.stage === "basic"; }).map((instance) => instance.instanceId); const maximum = Math.min(free, eligibleIds.length);
      const reason = free <= eligibleIds.length ? `You can choose up to ${maximum} because you have ${free} open Bench spaces.` : `Only ${eligibleIds.length} eligible Basic Pokémon remain in your deck.`;
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: maximum, eligibleIds, optional: true, instruction: `Choose up to ${maximum} Basic Pokémon to put directly onto your Bench. ${reason}` });
    }
    case "trainer:hand-trimmer": {
      const opponent = state.players[otherPlayer(start.actingPlayerId)]; const discardCount = Math.max(0, opponent.hand.length - 5); if (!discardCount) { const ownCount = Math.max(0, player.hand.length - 5); if (!ownCount) return true; return choice(state, continuation(start, 2), { playerId: start.actingPlayerId, selectionKind: "card", min: ownCount, max: ownCount, eligibleIds: player.hand.map((card) => card.instanceId), optional: false, instruction: `Choose ${ownCount} cards for you to discard to 5.` }); } return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: discardCount, max: discardCount, eligibleIds: opponent.hand.map((card) => card.instanceId), optional: false, instruction: `Choose ${discardCount} cards for your opponent to discard to 5.` });
    }
    case "trainer:briar": {
      // Briar is legal only with exactly two opposing Prizes; the legal-action
      // gate enforces that condition. The flag is consumed by the next
      // qualifying Tera attack KO in modifiedPrizeValue.
      state.briarPlayerId = start.actingPlayerId;
      state.briarUsed = false;
      return true;
    }
    case "trainer:kieran": {
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds: ["switch", "damage"], optional: false, instruction: "Choose: switch your Active Pokémon, or your attacks do 30 more damage to opposing Pokémon ex/V this turn." });
    }
    case "trainer:drayton": {
      const top = player.deck.slice(0, 7); const eligibleIds = top.filter((card) => { const def = cardFor(state, card); return def.category === "pokemon" || def.category === "trainer"; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { top: top.map((card) => card.instanceId) }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon and 1 Trainer from the top 7 cards of your deck." });
    }
    case "stadium:forest-of-vitality":
    case "stadium:risky-ruins":
    case "stadium:surfing-beach":
    case "stadium:nighttime-mine":
    case "stadium:lumiose-city":
    case "stadium:community-center":
    case "stadium:festival-grounds":
    case "stadium:jamming-tower":
    case "stadium:area-zero-underdepths":
    case "stadium:ns-castle":
    case "tool:light-ball":
    case "tool:brave-bangle":
    case "tool:handheld-fan":
      return true;
    default: throw new MissingEffectProgramError(start.programId, start.sourceCardId);
  }
}

function moveDiscardToHand(state: GameState, playerId: PlayerId, ids: string[]): void { const player = state.players[playerId]; for (const id of ids) { const card = removeById(player.discard, id); if (card) player.hand.push(card); } }
function moveDeckToHand(state: GameState, playerId: PlayerId, ids: string[]): void { const player = state.players[playerId]; for (const id of ids) { const card = removeById(player.deck, id); if (card) player.hand.push(card); } }
function makeBenchedPokemon(instance: CardInstance, turn: number): PokemonInPlay { return { stack: [instance], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: turn, evolvedThisTurn: false, abilityUsage: {} }; }

function continueEscapeRope(state: GameState, cont: EffectContinuation, selected: string[]): boolean {
  if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]);
  const eligibleIds = state.players[cont.actingPlayerId].bench.map(playId);
  if (!eligibleIds.length) return true;
  return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
}

export function continueEffectProgram(state: GameState, pending: EffectChoice, selected: string[]): boolean {
  const cont = pending.continuation; const player = state.players[cont.actingPlayerId];
  if (cont.programId === "heal-30-selected-pokemon") { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (target) heal(state, cont.actingPlayerId, target, 30, cont.sourceCardId); return true; }
  if (cont.programId.startsWith("generated:owned:")) { recordEffectExecution(state, cont.programId, cont.sourceCardId, "completed", ["generated-owned-runtime"]); return true; }
  if (cont.programId === "trainer:transformation-tome") {
    if (cont.step === 1) return choice(state, { ...cont, step: 2, variables: { ...cont.variables, discardPokemon: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: cont.variables.playTargets ?? [], optional: false, instruction: "Choose a Basic Pokémon in play to switch." });
    const replacement = cont.variables.discardPokemon?.[0] ? removeById(player.discard, cont.variables.discardPokemon[0]) : undefined;
    const target = selected[0] ? findPokemon(player, selected[0]) : undefined;
    if (replacement && target) { const old = target.stack[0]; target.stack = [replacement]; player.discard.push(old!); emitEvent(state, "card-played", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [replacement.instanceId], detail: "Transformation Tome switch" }); }
    return true;
  }
  if (cont.programId === "attack:seek-inspiration" && cont.step === 1) {
    const copiedId = cont.variables.copiedCard?.[0];
    const copied = copiedId ? player.discard.find((card) => card.instanceId === copiedId) : undefined;
    const copiedDefinition = copied ? cardFor(state, copied) : undefined;
    const attack = copiedDefinition?.category === "pokemon" ? copiedDefinition.attacks.find((candidate) => candidate.id === selected[0]) : undefined;
    const target = state.players[otherPlayer(cont.actingPlayerId)].active;
    if (attack && target && player.active && copiedDefinition?.category === "pokemon") {
      const copiedSource = { ...player.active, stack: [copied!] };
      const amount = resolveBaseDamage(attack.damage, copiedSource, state, cont.actingPlayerId);
      if (amount > 0) { const damage = calculateDamage(copiedDefinition, topCard(state, target), amount); target.damage += damage; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: copiedDefinition.id, targetId: playId(target), amount: damage, detail: `Seek Inspiration copied ${attack.name} from ${copiedDefinition.name}` }); if (isKnockedOut(state, target)) state.pendingKnockOutCause = { cause: "attack-damage", sourcePlayerId: cont.actingPlayerId, sourceCardId: copiedDefinition.id }; }
      if (attack.effectProgramId) startEffectProgram(state, { programId: attack.effectProgramId, actingPlayerId: cont.actingPlayerId, sourceCardId: copiedDefinition.id, sourcePokemonId: cont.sourcePokemonId, attackId: attack.id, after: "resume-main" });
    }
    return true;
  }
  if (/^template:(?:trainer|ability|attack):search-deck-to-hand:/.test(cont.programId)) { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: cont.programId }); return true; }
  if (/^template:(?:trainer|attack):recover-discard-to-hand:/.test(cont.programId)) { moveDiscardToHand(state, cont.actingPlayerId, selected); return true; }
  if (/^template:(?:trainer|ability):search-basic-to-bench:/.test(cont.programId)) { const benched: string[] = []; for (const id of selected.slice(0, Math.max(0, benchCapacity(state, cont.actingPlayerId) - player.bench.length))) { const card = removeById(player.deck, id); if (card) { player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); benched.push(card.instanceId); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: cont.programId }); return true; }
  if (cont.programId === "energy:telepathic-psychic") { const benched: string[] = []; for (const id of selected.slice(0, Math.max(0, benchCapacity(state, cont.actingPlayerId) - player.bench.length))) { const card = removeById(player.deck, id); if (!card) continue; const pokemon = makeBenchedPokemon(card, state.turn); player.bench.push(pokemon); benched.push(card.instanceId); emitEvent(state, "pokemon-benched", cont.actingPlayerId, { sourceCardId: card.cardId, sourceInstanceId: card.instanceId, targetId: playId(pokemon), detail: "deck-to-bench (Telepathic Psychic Energy)" }); } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Telepathic Psychic Energy" }); return true; }
  if (cont.programId.startsWith("template:trainer:heal-selected:")) { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const amount = Number(cont.programId.split(":")[3]) || 0; if (target) heal(state, cont.actingPlayerId, target, amount, cont.sourceCardId); return true; }
  if (cont.programId.startsWith("template:trainer:heal-selected-clear:")) { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const amount = Number(cont.programId.split(":")[3]) || 0; if (target) { heal(state, cont.actingPlayerId, target, amount, cont.sourceCardId); clearSpecialConditions(target); } return true; }
  if (cont.programId.startsWith("template:ability:discard-one-draw:")) { const discarded = selected[0] ? removeById(player.hand, selected[0]) : undefined; if (discarded) { player.discard.push(discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: [discarded.instanceId] }); } draw(state, cont.actingPlayerId, Number(cont.programId.split(":")[3]) || 0); return true; }
  if (cont.programId.startsWith("template:ability:active-heal-selected:")) { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (target) heal(state, cont.actingPlayerId, target, Number(cont.programId.split(":")[3]) || 0, cont.sourceCardId); return true; }
  if (cont.programId === "template:ability:switch-active:0") { if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true; }
  if (cont.programId.startsWith("template:ability:place-opponent-counters:")) { const opponentId = otherPlayer(cont.actingPlayerId); const target = selected[0] ? findPokemon(state.players[opponentId], selected[0]) : undefined; const counters = Number(cont.programId.split(":")[3]) || 0; if (target) { target.damage += counters * 10; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, amount: counters * 10, detail: "damage counters" }); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; } return true; }
  switch (cont.programId) {
    case "attack:jumping-press": {
      const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined;
      if (target) { target.damage += 50; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 50, detail: "Jumping Press" }); }
      return true;
    }
    case "attack:electrobullet": {
      const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined;
      if (target) { target.damage += 30; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 30, detail: "Electrobullet Bench damage" }); }
      return true;
    }
    case "attack:paralyzing-ball": {
      const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined;
      if (source) for (const id of selected) { const energy = removeById(source.attachedEnergy, id); if (energy) player.discard.push(energy); }
      const target = state.players[otherPlayer(cont.actingPlayerId)].active; if (target) applySpecialCondition(target, "paralyzed");
      return true;
    }
    case "attack:hyper-beam": {
      const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const energy = opponent.active && selected[0] ? removeById(opponent.active.attachedEnergy, selected[0]) : undefined;
      if (energy) opponent.discard.push(energy);
      return true;
    }
    case "ability:biting-spree":
    case "ability:sneaky-bite": {
      const opponent = state.players[otherPlayer(cont.actingPlayerId)];
      for (const id of selected) { const target = findPokemon(opponent, id); if (target) { target.damage += 20; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 20, detail: cont.programId === "ability:biting-spree" ? "Biting Spree" : "Sneaky Bite" }); } }
      return true;
    }
    case "ability:smog-signals": {
      const benched: string[] = [];
      for (const id of selected.slice(0, Math.max(0, benchCapacity(state, cont.actingPlayerId) - player.bench.length))) { const card = removeById(player.deck, id); if (!card) continue; player.bench.push(makeBenchedPokemon(card, state.turn)); benched.push(card.instanceId); }
      shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Smog Signals" }); return true;
    }
    case "ability:flying-entry": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; for (const id of selected) { const target = findPokemon(opponent, id); if (target) target.damage += 10; } return true; }
    case "attack:zepto-turn": if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true;
    case "tool:technical-machine-evolution": {
      for (const id of selected.slice(0, 2)) { const target = findPokemon(player, id); if (!target) continue; const baseName = topCard(state, target).name; const evolution = player.deck.find((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.evolvesFrom === baseName; }); if (evolution) { removeById(player.deck, evolution.instanceId); target.stack.push(evolution); target.evolvedThisTurn = true; } }
      shuffle(state, cont.actingPlayerId); return true;
    }
    case "attack:summoning-jutsu": {
      moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId);
      emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Summoning Jutsu" });
      return true;
    }
    case "attack:whirlpool": {
      const opponent = state.players[otherPlayer(cont.actingPlayerId)];
      const energy = opponent.active && selected[0] ? removeById(opponent.active.attachedEnergy, selected[0]) : undefined;
      if (energy) { opponent.discard.push(energy); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: opponent.active ? playId(opponent.active) : undefined, cardInstanceIds: [energy.instanceId], detail: "Whirlpool" }); }
      return true;
    }
    case "trainer:kieran": {
      if (cont.step === 1 && selected[0] === "switch") {
        const eligibleIds = player.bench.map(playId);
        if (!eligibleIds.length) return true;
        return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
      }
      if (cont.step === 1 && selected[0] === "damage") {
        // Kieran's bonus is intentionally represented as a normal temporary
        // attack modifier; the ex/V target restriction is enforced in combat.
        addTemporaryEffect(state, { kind: "attack-damage-bonus", playerId: cont.actingPlayerId, amount: 30, appliesOnPlayerTurn: player.turnsTaken, sourceCardId: cont.sourceCardId });
        return true;
      }
      if (cont.step === 2 && selected[0]) switchTo(state, cont.actingPlayerId, selected[0]);
      return true;
    }
    case "trainer:drayton": {
      const topIds = cont.variables.top ?? [];
      const chosen = new Set(selected);
      for (const id of selected) moveDeckToHand(state, cont.actingPlayerId, [id]);
      const rest = topIds.filter((id) => !chosen.has(id)).map((id) => removeById(player.deck, id)).filter((card): card is CardInstance => Boolean(card));
      const shuffled = shuffleDeterministic(rest, state.rngState); state.rngState = shuffled.state; player.deck.push(...shuffled.value);
      return true;
    }
    case "attack:invite-evil": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Invite Evil attack" }); return true;
    case "attack:traverse-time": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Traverse Time" }); return true;
    case "attack:icicle-loop": { const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; const energy = selected[0] && source ? removeById(source.attachedEnergy, selected[0]) : undefined; if (energy) player.hand.push(energy); return true; }
    case "attack:shinobi-blade": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true;
    case "attack:aura-jab": {
      if (cont.step === 1) {
        const eligibleIds = player.bench.map(playId);
        return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: selected.length ? 1 : 0, max: 1, eligibleIds, optional: true, instruction: "Choose a Benched Pokémon to receive the selected Fighting Energy." });
      }
      const target = selected[0] ? findPokemon(player, selected[0]) : undefined;
      const energyIds = cont.variables.energy ?? [];
      if (target) for (const id of energyIds) { const card = removeById(player.discard, id); if (card) target.attachedEnergy.push(card); }
      return true;
    }
    case "attack:push-down": case "attack:bounce-back": { if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); return true; }
    case "attack:trading-places": { if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true; }
    case "attack:ascension": {
      const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; const evolution = selected[0] ? removeById(player.deck, selected[0]) : undefined; const definition = evolution ? cardFor(state, evolution) : undefined;
      if (source && evolution && definition?.category === "pokemon" && definition.evolvesFrom === topCard(state, source).name) { source.stack.push(evolution); source.evolvedThisTurn = true; clearSpecialConditions(source); emitEvent(state, "pokemon-evolved", cont.actingPlayerId, { sourceCardId: evolution.cardId, sourceInstanceId: evolution.instanceId, targetId: playId(source), detail: "Ascension" }); }
      shuffle(state, cont.actingPlayerId); return true;
    }
    case "attack:thunder-raid": { const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined; if (target) { target.damage += 210; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 210, detail: "Thunder Raid Bench damage" }); } return true; }
    case "attack:trifrost": { const opponentId = otherPlayer(cont.actingPlayerId); for (const id of selected) { const target = findPokemon(state.players[opponentId], id); if (target) { target.damage += 110; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: id, targetPlayerId: opponentId, amount: 110, detail: "Trifrost Bench damage" }); } } return true; }
    case "attack:topaz-bolt": { const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; if (source) for (const id of selected) { const energy = removeById(source.attachedEnergy, id); if (energy) player.discard.push(energy); } return true; }
    case "attack:delightful-kiss": {
      if (cont.step === 1) return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: selected.length ? 1 : 0, max: 1, eligibleIds: player.bench.map(playId), optional: true, instruction: "Choose a Benched Pokémon to receive the selected Psychic Energy." });
      const target = selected[0] ? findPokemon(player, selected[0]) : undefined; for (const id of cont.variables.energy ?? []) { const energy = removeById(player.deck, id); if (energy && target) target.attachedEnergy.push(energy); } shuffle(state, cont.actingPlayerId); return true;
    }
    case "attack:electromagnetic-sonar": { const card = selected[0] ? removeById(player.discard, selected[0]) : undefined; if (card) player.hand.push(card); return true; }
    case "attack:slight-shift": {
      if (cont.step === 1) { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const source = pokemonTargets(opponent).find((pokemon) => pokemon.attachedEnergy.some((energy) => energy.instanceId === selected[0])); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(opponent).filter((pokemon) => pokemon !== source).map(playId), optional: false, instruction: "Choose another opposing Pokémon to receive that Energy." }); }
      const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const target = selected[0] ? findPokemon(opponent, selected[0]) : undefined; const energyId = cont.variables.energy?.[0]; const source = pokemonTargets(opponent).find((pokemon) => pokemon.attachedEnergy.some((energy) => energy.instanceId === energyId)); const energy = source && energyId ? removeById(source.attachedEnergy, energyId) : undefined; if (energy && target) target.attachedEnergy.push(energy); return true;
    }
    case "attack:flamebody-cannon": { const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined; if (target) { target.damage += 90; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 90, detail: "Flamebody Cannon Bench damage" }); } return true; }
    case "attack:claw-darkness": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const card = selected[0] ? removeById(opponent.hand, selected[0]) : undefined; if (card) opponent.discard.push(card); return true; }
    case "attack:gemstone-mimicry":
    case "attack:night-joker": return true;
    case "attack:mirage-barrage": {
      if (cont.step === 1) {
        const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined;
        for (const id of selected) { const card = removeById(source?.attachedEnergy ?? [], id); discardAttackEnergy(state, cont.actingPlayerId, source, card); }
        const opponent = state.players[otherPlayer(cont.actingPlayerId)];
        return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: Math.min(2, pokemonTargets(opponent).length), max: Math.min(2, pokemonTargets(opponent).length), eligibleIds: pokemonTargets(opponent).map(playId), optional: false, instruction: "Choose 2 of your opponent's Pokémon to take 120 damage." });
      }
      const opponentId = otherPlayer(cont.actingPlayerId); const attackingCard = player.active ? topCard(state, player.active) : undefined;
      for (const id of selected) { const target = findPokemon(state.players[opponentId], id); if (!target || !attackingCard) continue; const damage = target === state.players[opponentId].active ? calculateDamage(attackingCard, topCard(state, target), 120) : 120; target.damage += damage; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: id, targetPlayerId: opponentId, amount: damage, detail: "Mirage Barrage" }); }
      return true;
    }
    case "attack:jolting-charge": {
      if (cont.step === 1) {
        const eligibleIds = pokemonTargets(player).map(playId);
        const energyIds = selected.filter((id) => player.deck.some((card) => card.instanceId === id));
        const allowed = [...energyIds.filter((id) => { const card = player.deck.find((candidate) => candidate.instanceId === id); const definition = card ? cardFor(state, card) : undefined; return definition?.category === "energy" && definition.energyType === "grass"; }).slice(0, 2), ...energyIds.filter((id) => { const card = player.deck.find((candidate) => candidate.instanceId === id); const definition = card ? cardFor(state, card) : undefined; return definition?.category === "energy" && definition.energyType === "lightning"; }).slice(0, 2)];
        return allocationChoice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: allowed } }, { playerId: cont.actingPlayerId, selectionKind: "allocation", eligibleIds, totalUnits: allowed.length, minimumPerTarget: 0, maximumPerTarget: allowed.length, unitLabel: "Energy attachment", instruction: "Distribute up to 2 Basic Grass and 2 Basic Lightning Energy among your Pokémon." });
      }
      shuffle(state, cont.actingPlayerId); return true;
    }
    case "trainer:fighting-gong": case "trainer:energy-recycler": case "trainer:sacred-ash": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true;
    case "trainer:pal-pad": { for (const id of selected) { const card = removeById(player.discard, id); if (card) player.deck.push(card); } shuffle(state, cont.actingPlayerId); return true; }
    case "trainer:precious-trolley": {
      const benched: string[] = [];
      const capacity = benchCapacity(state, cont.actingPlayerId);
      for (const id of selected.slice(0, Math.max(0, capacity - player.bench.length))) {
        const card = removeById(player.deck, id);
        if (!card) continue;
        const pokemon = makeBenchedPokemon(card, state.turn);
        player.bench.push(pokemon);
        benched.push(card.instanceId);
        emitEvent(state, "pokemon-benched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, sourceInstanceId: card.instanceId, targetId: playId(pokemon), detail: "deck-to-bench (Precious Trolley)" });
      }
      shuffle(state, cont.actingPlayerId);
      emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Precious Trolley to Bench" });
      return true;
    }
    case "trainer:hand-trimmer": {
      const opponent = state.players[otherPlayer(cont.actingPlayerId)]; if (cont.step === 1) { for (const id of selected) { const card = removeById(opponent.hand, id); if (card) opponent.discard.push(card); } const ownCount = Math.max(0, player.hand.length - 5); if (!ownCount) return true; return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: ownCount, max: ownCount, eligibleIds: player.hand.map((card) => card.instanceId), optional: false, instruction: `Choose ${ownCount} cards for you to discard to 5.` }); } for (const id of selected) { const card = removeById(player.hand, id); if (card) player.discard.push(card); } return true;
    }
    case "trainer:wondrous-patch": {
      if (cont.step === 1) return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: state.players[cont.actingPlayerId].bench.filter((pokemon) => topCard(state, pokemon).pokemonType === "psychic").map(playId), optional: false, instruction: "Choose a Benched Psychic Pokémon to receive the Energy." });
      const energy = cont.variables.energy?.[0] ? removeById(player.discard, cont.variables.energy[0]) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (energy && target) target.attachedEnergy.push(energy); return true;
    }
    case "trainer:biancas-devotion": { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (target) target.damage = effectiveMaxHp(state, target); return true; }
    case "trainer:enhanced-hammer": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; for (const pokemon of pokemonTargets(opponent)) { const index = pokemon.attachedEnergy.findIndex((energy) => energy.instanceId === selected[0]); if (index >= 0) { opponent.discard.push(pokemon.attachedEnergy.splice(index, 1)[0]!); break; } } return true; }
    case "trainer:prime-catcher": { if (cont.step === 1) { if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); const eligibleIds = player.bench.map(playId); if (!eligibleIds.length) return true; return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." }); } if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true; }
    case "trainer:surfer": if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); draw(state, cont.actingPlayerId, Math.max(0, 5 - player.hand.length)); return true;
    case "trainer:azs-tranquility": if (selected[0]) { switchTo(state, cont.actingPlayerId, selected[0]); const target = player.bench.find((pokemon) => topCard(state, pokemon).isPokemonEx && pokemon !== player.active); if (target) heal(state, cont.actingPlayerId, target, 80, cont.sourceCardId); } return true;
    case "trainer:lisias-appeal": if (selected[0]) { switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); const target = state.players[otherPlayer(cont.actingPlayerId)].active; if (target) applySpecialCondition(target, "confused"); } return true;
    case "retreat-energy": { const active = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; const targetId = cont.variables.target?.[0]; const targetIndex = targetId ? player.bench.findIndex((pokemon) => playId(pokemon) === targetId) : -1; if (!active || targetIndex < 0) return true; for (const id of selected) { const index = active.attachedEnergy.findIndex((energy) => energy.instanceId === id); if (index >= 0) player.discard.push(active.attachedEnergy.splice(index, 1)[0]!); } clearSpecialConditions(active); player.active = player.bench.splice(targetIndex, 1, active)[0]!; player.retreatedThisTurn = true; return true; }
    case "ability:last-ditch-catch": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Last-Ditch Catch" }); return true;
    case "ability:invite-evil": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Invite Evil" }); return true;
    case "ability:come-and-get-you": {
      const player = state.players[cont.actingPlayerId]; const benched: string[] = [];
      for (const id of selected) { const card = removeById(player.discard, id); if (card && player.bench.length < benchCapacity(state, cont.actingPlayerId)) { player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); benched.push(card.instanceId); } }
      emitEvent(state, "cards-recovered", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Come and Get You" }); return true;
    }
    case "ability:cursed-blast-5": case "ability:cursed-blast-13": {
      const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const target = selected[0] ? findPokemon(opponent, selected[0]) : undefined; const counters = cont.programId.endsWith("13") ? 13 : 5;
      if (target) { target.damage += counters * 10; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: counters * 10, detail: "Cursed Blast damage counters" }); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; }
      const player = state.players[cont.actingPlayerId]; const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; if (source) { source.damage = effectiveMaxHp(state, source); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; }
      return true;
    }
    case "ability:seething-spirit": {
      if (cont.step === 1) return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(state.players[cont.actingPlayerId]).map(playId), optional: false, instruction: "Choose your Pokémon to receive the discarded Basic Energy." });
      const player = state.players[cont.actingPlayerId]; const energy = cont.variables.energy?.[0] ? removeById(player.discard, cont.variables.energy[0]) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (energy && target) target.attachedEnergy.push(energy); return true;
    }
    case "ability:jewel-seeker": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Jewel Seeker" }); return true;
    case "ability:boom-boom-groove": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Boom Boom Groove" }); return true;
    case "ability:mortal-shuriken": {
      if (cont.step === 1) { const eligibleIds = pokemonTargets(state.players[otherPlayer(cont.actingPlayerId)]).map(playId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, cost: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opponent's Pokémon for Mortal Shuriken." }); }
      const energy = cont.variables.cost?.[0] ? removeById(player.hand, cont.variables.cost[0]) : undefined;
      if (!energy) throw new Error("Mortal Shuriken's selected Water Energy is unavailable.");
      player.discard.push(energy);
      const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined;
      if (target) { target.damage += 60; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 60, detail: "Mortal Shuriken damage counters" }); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; }
      return true;
    }
    case "ability:metallic-signal": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Metallic Signal" }); return true;
    case "ability:metal-maker": {
      if (cont.step === 1) return allocationChoice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "allocation", eligibleIds: pokemonTargets(player).map(playId), totalUnits: selected.length, minimumPerTarget: 0, maximumPerTarget: selected.length, unitLabel: "Basic Metal Energy", instruction: "Distribute the selected Basic Metal Energy among your Pokémon." });
      return true;
    }
    case "trainer:rosas-encouragement": {
      if (cont.step === 1) {
        const targets = pokemonTargets(player).filter((pokemon) => topCard(state, pokemon).stage === "stage2").map(playId);
        if (!targets.length || !selected.length) return true;
        return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: targets, optional: false, instruction: "Choose your Stage 2 Pokémon to receive the Energy." });
      }
      const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const ids = cont.variables.energy ?? []; if (target) for (const id of ids) { const energy = removeById(player.discard, id); if (energy) target.attachedEnergy.push(energy); } return true;
    }
    case "trainer:xerosics-machinations": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; const discarded: CardInstance[] = []; for (const id of selected) { const card = removeById(opponent.hand, id); if (card) discarded.push(card); } opponent.discard.push(...discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId), targetPlayerId: otherPlayer(cont.actingPlayerId), detail: "Xerosic's Machinations" }); return true; }
    case "trainer:brocks-scouting": {
      const cards = selected.map((id) => player.deck.find((card) => card.instanceId === id)).filter((card): card is CardInstance => Boolean(card)); const evolutionCount = cards.filter((card) => { const definition = cardFor(state, card); return definition.category === "pokemon" && definition.stage !== "basic"; }).length; if (evolutionCount > 1 || evolutionCount === 1 && cards.length > 1) throw new Error("Brock's Scouting allows either up to 2 Basic Pokémon or 1 Evolution Pokémon."); moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true;
    }
    case "trainer:hilda": {
      if (cont.step === 1) { const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "energy").map((card) => card.instanceId); if (!eligibleIds.length) { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true; } return choice(state, { ...cont, step: 2, variables: { ...cont.variables, evolution: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Energy card from your deck." }); }
      moveDeckToHand(state, cont.actingPlayerId, [...(cont.variables.evolution ?? []), ...selected]); shuffle(state, cont.actingPlayerId); return true;
    }
    case "trainer:lanas-aid": moveDiscardToHand(state, cont.actingPlayerId, selected); return true;
    case "trainer:dawn": { const stages = new Set(selected.map((id) => { const card = player.deck.find((candidate) => candidate.instanceId === id); const definition = card ? cardFor(state, card) : undefined; return definition?.category === "pokemon" ? definition.stage : undefined; })); if (stages.size !== selected.length) throw new Error("Dawn allows at most one Pokémon of each Stage."); moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true; }
    case "trainer:bug-catching-set": { const top = (cont.variables.subset ?? []).map((id) => removeById(player.deck, id)).filter((card): card is CardInstance => Boolean(card)); const chosen = top.filter((card) => selected.includes(card.instanceId)); player.hand.push(...chosen); player.deck.push(...top.filter((card) => !selected.includes(card.instanceId))); shuffle(state, cont.actingPlayerId); return true; }
    case "trainer:glass-trumpet": { if (cont.step === 1) { const eligibleIds = player.discard.filter((instance) => isBasicEnergy(state, instance)).map((instance) => instance.instanceId); if (!selected.length || !eligibleIds.length) return true; return choice(state, { ...cont, step: 2, variables: { ...cont.variables, targets: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: Math.min(selected.length, eligibleIds.length), max: Math.min(selected.length, eligibleIds.length), eligibleIds, optional: false, instruction: "Choose one Basic Energy from your discard pile for each selected Pokémon." }); } const targets = cont.variables.targets ?? []; for (let index = 0; index < selected.length; index += 1) { const energy = removeById(player.discard, selected[index]!); const target = targets[index] ? findPokemon(player, targets[index]!) : undefined; if (energy && target) { target.attachedEnergy.push(energy); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Glass Trumpet" }); } } return true; }
    case "attack:torrential-pump": {
      if (cont.step === 1) {
        if (selected[0] === "skip") return true;
        const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined;
        if (!source || source.attachedEnergy.length < 3) return true;
        return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 3, max: 3, eligibleIds: source.attachedEnergy.map((energy) => energy.instanceId), optional: false, instruction: "Choose exactly 3 Energy to shuffle into your deck." });
      }
      if (cont.step === 3) { const target = selected[0] ? findPokemon(state.players[otherPlayer(cont.actingPlayerId)], selected[0]) : undefined; if (target) { target.damage += 120; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: 120, detail: "Torrential Pump Bench damage" }); } return true; }
      const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; const returned = source ? source.attachedEnergy.filter((energy) => selected.includes(energy.instanceId)) : []; if (source && returned.length === 3) { source.attachedEnergy = source.attachedEnergy.filter((energy) => !selected.includes(energy.instanceId)); player.deck.push(...returned); shuffle(state, cont.actingPlayerId); const opponentId = otherPlayer(cont.actingPlayerId); const eligibleIds = state.players[opponentId].bench.map(playId); if (!eligibleIds.length) return true; return choice(state, { ...cont, step: 3, variables: { ...cont.variables, returned: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Pokémon for 120 damage." }); } return true;
    }
    case "ability:teal-dance": { const energy = selected[0] ? removeById(player.hand, selected[0]) : undefined; const source = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; if (energy && source) { source.attachedEnergy.push(energy); draw(state, cont.actingPlayerId, 1); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(source), cardInstanceIds: [energy.instanceId], detail: "Teal Dance" }); } return true; }
    case "ability:ripening-charge": { if (cont.step === 1) return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(player).map(playId), optional: false, instruction: "Choose one of your Pokémon to receive the Energy and heal 30." }); const energy = cont.variables.energy?.[0] ? removeById(player.hand, cont.variables.energy[0]) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (energy && target) { target.attachedEnergy.push(energy); heal(state, cont.actingPlayerId, target, 30, cont.sourceCardId); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Ripening Charge" }); } return true; }
    case "attack:raging-bolt": case "attack:bellowing-thunder": { const selectedEnergy = selected.map((id) => { for (const pokemon of pokemonTargets(player)) { const energy = pokemon.attachedEnergy.find((candidate) => candidate.instanceId === id); if (energy) return { pokemon, energy }; } return undefined; }).filter((entry): entry is { pokemon: PokemonInPlay; energy: CardInstance } => Boolean(entry)); for (const entry of selectedEnergy) { const index = entry.pokemon.attachedEnergy.findIndex((energy) => energy.instanceId === entry.energy.instanceId); if (index >= 0) discardAttackEnergy(state, cont.actingPlayerId, entry.pokemon, entry.pokemon.attachedEnergy.splice(index, 1)[0]!); } const target = state.players[otherPlayer(cont.actingPlayerId)].active; if (target && selectedEnergy.length) { const attackingCard = topCard(state, player.active!); const defendingCard = topCard(state, target); const damage = calculateDamage(attackingCard, defendingCard, selectedEnergy.length * 70); target.damage += damage; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: damage, detail: "Bellowing Thunder selected Energy" }); state.pendingKnockOutCause = { cause: "attack-damage", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; } return true; }
    case "ability:charging-up": { const card = selected[0] ? removeById(player.discard, selected[0]) : undefined; const target = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; if (card && target) { target.attachedEnergy.push(card); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [card.instanceId], detail: "Charging Up" }); } return true; }
    case "ability:recon-directive": { const chosen = selected[0]; const top = cont.variables.top ?? []; const playerDeck = player.deck; for (const id of top) { const index = playerDeck.findIndex((card) => card.instanceId === id); if (index >= 0) { const card = playerDeck.splice(index, 1)[0]!; if (id === chosen) player.hand.push(card); else playerDeck.push(card); } } return true; }
    case "trainer:crispin": {
      if (cont.step === 1) {
        const cards = selected.map((id) => player.deck.find((card) => card.instanceId === id)).filter((card): card is CardInstance => Boolean(card));
        const types = cards.map((card) => { const definition = cardFor(state, card); return definition.category === "energy" ? definition.energyType : undefined; }).filter(Boolean);
        if (new Set(types).size !== types.length) throw new Error("Crispin requires Basic Energy of different types.");
        if (cards.length < 2) { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true; }
        const first = cardFor(state, cards[0]!); const second = cardFor(state, cards[1]!);
        return choice(state, { ...cont, step: 2, variables: { ...cont.variables, cards: selected } }, { playerId: cont.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds: [`hand:${selected[0]}`, `hand:${selected[1]}`], optionLabels: [{ id: `hand:${selected[0]}`, label: `Put ${first.name} into your hand and attach ${second.name}.`, cardInstanceIds: selected }, { id: `hand:${selected[1]}`, label: `Put ${second.name} into your hand and attach ${first.name}.`, cardInstanceIds: selected }], optional: false, instruction: "Choose which Basic Energy goes to your hand and which is attached." });
      }
      if (cont.step === 2) {
        const selectedMode = selected[0] ?? ""; const cards = cont.variables.cards ?? []; const handId = selectedMode.startsWith("hand:") ? selectedMode.slice(5) : cards[0]; const attachId = cards.find((id) => id !== handId);
        const hand = handId ? removeById(player.deck, handId) : undefined; if (hand) player.hand.push(hand);
        if (!attachId) { shuffle(state, cont.actingPlayerId); return true; }
        const attachedCard = attachId ? player.deck.find((card) => card.instanceId === attachId) : undefined;
        const attachedName = attachedCard ? cardFor(state, attachedCard).name : "Basic Energy";
        return choice(state, { ...cont, step: 3, variables: { ...cont.variables, hand: handId ? [handId] : [], attach: [attachId] } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(player).map(playId), optional: false, instruction: `Attach ${attachedName} to one of your Pokémon.` });
      }
      const attachId = cont.variables.attach?.[0]; const energy = attachId ? removeById(player.deck, attachId) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; if (energy && target) { target.attachedEnergy.push(energy); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Crispin" }); } shuffle(state, cont.actingPlayerId); return true;
    }
    case "trainer:crushing-hammer": { const id = selected[0]; if (id) for (const pokemon of pokemonTargets(state.players[otherPlayer(cont.actingPlayerId)])) { const index = pokemon.attachedEnergy.findIndex((energy) => energy.instanceId === id); if (index >= 0) { state.players[otherPlayer(cont.actingPlayerId)].discard.push(pokemon.attachedEnergy.splice(index, 1)[0]!); break; } } return true; }
    case "attack:erasure-ball": {
      const discarded: CardInstance[] = [];
      for (const id of selected) for (const pokemon of player.bench) { const index = pokemon.attachedEnergy.findIndex((energy) => energy.instanceId === id); if (index >= 0) { discarded.push(pokemon.attachedEnergy.splice(index, 1)[0]!); break; } }
      player.discard.push(...discarded); if (discarded.length) { const target = state.players[otherPlayer(cont.actingPlayerId)].active; if (target) { target.damage += discarded.length * 60; emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), targetPlayerId: otherPlayer(cont.actingPlayerId), amount: discarded.length * 60, detail: "Erasure Ball discarded Energy bonus" }); } } return true;
    }
    case "ability:ns-trade": {
      const discarded = selected[0] ? removeById(player.hand, selected[0]) : undefined;
      if (discarded) { player.discard.push(discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: [discarded.instanceId], detail: "Trade cost" }); }
      draw(state, cont.actingPlayerId, 2); return true;
    }
    case "attack:poisonous-musculature": { const target = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; const attached: string[] = []; if (target) for (const id of selected) { const card = removeById(player.deck, id); if (card) { target.attachedEnergy.push(card); attached.push(card.instanceId); } } if (target && attached.length) { applySpecialCondition(target, "poisoned"); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: attached, detail: "Poisonous Musculature" }); emitEvent(state, "special-condition-applied", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), detail: "poisoned by Poisonous Musculature" }); } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "ability:adrena-brain": {
      if (cont.step === 1) { const opponentId = otherPlayer(cont.actingPlayerId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, from: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(state.players[opponentId]).map(playId), optional: false, instruction: "Choose 1 opposing Pokémon to receive the damage counters." }); }
      if (cont.step === 2) { const source = cont.variables.from?.[0] ? findPokemon(player, cont.variables.from[0]) : undefined; const max = Math.min(3, Math.floor((source?.damage ?? 0) / 10)); return choice(state, { ...cont, step: 3, variables: { ...cont.variables, to: selected } }, { playerId: cont.actingPlayerId, selectionKind: "mode", min: 1, max: 1, eligibleIds: Array.from({ length: max }, (_, index) => String(index + 1)), optional: false, instruction: "Choose how many damage counters to move." }); }
      const source = cont.variables.from?.[0] ? findPokemon(player, cont.variables.from[0]) : undefined; const opponentId = otherPlayer(cont.actingPlayerId); const target = cont.variables.to?.[0] ? findPokemon(state.players[opponentId], cont.variables.to[0]) : undefined; const counters = Number(selected[0] ?? 0); if (source && target && counters >= 1 && counters <= 3 && source.damage >= counters * 10) { source.damage -= counters * 10; target.damage += counters * 10; emitEvent(state, "damage-counters-moved", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, sourceInstanceId: cont.sourcePokemonId, targetId: playId(target), targetPlayerId: opponentId, amount: counters * 10, detail: "Adrena-Brain" }); state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId }; } return true;
    }
    case "ability:attract-customers": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Attract Customers" }); return true;
    case "attack:fiery-fighting-spirit": { const card = selected[0] ? removeById(player.deck, selected[0]) : undefined; const target = cont.sourcePokemonId ? findPokemon(player, cont.sourcePokemonId) : undefined; if (card && target) { target.attachedEnergy.push(card); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [card.instanceId] }); } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "attack:colorful-palette": if (cont.step === 1) { if (!selected.length) { shuffle(state, cont.actingPlayerId); return true; } return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: selected } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds: pokemonTargets(player).map(playId), optional: false, instruction: "Choose 1 of your Pokémon to receive all selected Basic Energy." }); } else { const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const energyIds = cont.variables.energy ?? []; if (target) { for (const id of energyIds) { const card = removeById(player.deck, id); if (card) target.attachedEnergy.push(card); } emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: energyIds }); } shuffle(state, cont.actingPlayerId); return true; }
    case "trainer:energy-retrieval": moveDiscardToHand(state, cont.actingPlayerId, selected); return true;
    case "trainer:escape-rope": if (cont.step === 1) return continueEscapeRope(state, cont, selected); if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true;
    case "trainer:great-ball": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true;
    case "trainer:jacq": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true;
    case "trainer:klara": {
      if (cont.step === 1) { const mode = selected[0]!; const variables = { mode: [mode] }; if (mode === "pokemon" || mode === "both") { const eligibleIds = player.discard.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId); return choice(state, { ...cont, step: 2, variables }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Pokémon from your discard pile." }); } return continueEffectProgram(state, { ...pending, continuation: { ...cont, step: 3, variables } }, []); }
      if (cont.step === 2) { moveDiscardToHand(state, cont.actingPlayerId, selected); if (cont.variables.mode?.[0] !== "both") return true; }
      if (cont.step === 2 || cont.step === 3) { const eligibleIds = player.discard.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId); return choice(state, { ...cont, step: 4 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Energy from your discard pile." }); }
      moveDiscardToHand(state, cont.actingPlayerId, selected); return true;
    }
    case "trainer:nest-ball": { const card = selected[0] ? removeById(player.deck, selected[0]) : undefined; if (card && player.bench.length < benchCapacity(state, cont.actingPlayerId)) player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "trainer:ultra-ball": if (cont.step === 1) { const discarded: CardInstance[] = []; for (const id of selected) { const card = removeById(player.hand, id); if (card) discarded.push(card); } player.discard.push(...discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId) }); const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId); return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from your deck." }); } else { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "trainer:secret-box": if (cont.step === 1) { for (const id of selected) { const card = removeById(player.hand, id); if (card) player.discard.push(card); } const eligibleIds = player.deck.filter((card) => { const definition = cardFor(state, card); return definition.category === "trainer" && ["item", "tool", "supporter", "stadium"].includes(definition.subtype); }).map((card) => card.instanceId); return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(4, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Item, Pokémon Tool, Supporter, and Stadium from your deck." }); } else { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); return true; }
    case "trainer:eri": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; for (const id of selected) { const card = removeById(opponent.hand, id); if (card) opponent.discard.push(card); } return true; }
    case "trainer:ruffian": { const opponent = state.players[otherPlayer(cont.actingPlayerId)]; for (const pokemon of pokemonTargets(opponent)) { const tool = pokemon.tool; if (tool?.instanceId === selected[0]) { opponent.discard.push(tool!); pokemon.tool = undefined; const energyIndex = pokemon.attachedEnergy.findIndex((energy) => cardFor(state, energy).category === "energy" && !isBasicEnergy(state, energy)); if (energyIndex >= 0) opponent.discard.push(pokemon.attachedEnergy.splice(energyIndex, 1)[0]!); break; } } return true; }
    case "trainer:janines-secret-art": {
      if (cont.step === 1) { if (!selected.length) { shuffle(state, cont.actingPlayerId); return true; } const eligibleIds = player.deck.filter((card) => isBasicDarknessEnergy(state, card)).map((card) => card.instanceId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, targets: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: Math.min(selected.length, eligibleIds.length), max: Math.min(selected.length, eligibleIds.length), eligibleIds, optional: false, instruction: "Choose one Basic Darkness Energy for each selected Pokémon." }); }
      const targets = cont.variables.targets ?? []; const attached: string[] = []; for (let index = 0; index < selected.length; index += 1) { const target = targets[index] ? findPokemon(player, targets[index]!) : undefined; const energy = removeById(player.deck, selected[index]!); if (target && energy) { target.attachedEnergy.push(energy); attached.push(energy.instanceId); if (target === player.active) { applySpecialCondition(target, "poisoned"); emitEvent(state, "special-condition-applied", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), detail: "poisoned by Janine's Secret Art" }); } emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Janine's Secret Art" }); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: attached }); return true;
    }
    case "trainer:colress-tenacity": {
      if (cont.step === 1) { const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "energy").map((card) => card.instanceId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, stadium: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Energy from your deck." }); }
      const chosen = [...(cont.variables.stadium ?? []), ...selected]; moveDeckToHand(state, cont.actingPlayerId, chosen); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: chosen, detail: "Colress's Tenacity" }); return true;
    }
    case "trainer:boss-orders": if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); return true;
    case "trainer:cyrano": case "trainer:poke-pad": case "trainer:master-ball": case "trainer:dusk-ball": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true;
    case "trainer:pokegear-3": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Pokégear 3.0" }); return true;
    case "trainer:night-stretcher": moveDiscardToHand(state, cont.actingPlayerId, selected); return true;
    case "trainer:energy-switch": {
      if (cont.step === 1) { const energyId = selected[0]!; const source = pokemonTargets(player).find((pokemon) => pokemon.attachedEnergy.some((energy) => energy.instanceId === energyId)); const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon !== source).map(playId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: [energyId], from: source ? [playId(source)] : [] } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a different Pokémon to receive the Basic Energy." }); }
      const source = cont.variables.from?.[0] ? findPokemon(player, cont.variables.from[0]) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const energyId = cont.variables.energy?.[0]; const energyIndex = source && energyId ? source.attachedEnergy.findIndex((energy) => energy.instanceId === energyId) : -1; const energy = source && energyIndex >= 0 ? source.attachedEnergy.splice(energyIndex, 1)[0] : undefined; if (target && energy) { target.attachedEnergy.push(energy); emitEvent(state, "energy-moved", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, sourceInstanceId: energy.instanceId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Energy Switch" }); } return true;
    }
    case "trainer:buddy-buddy-poffin": { const benched: string[] = []; for (const id of selected.slice(0, Math.max(0, benchCapacity(state, cont.actingPlayerId) - player.bench.length))) { const card = removeById(player.deck, id); if (card) { player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); benched.push(card.instanceId); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Buddy-Buddy Poffin to Bench" }); return true; }
    case "trainer:earthen-vessel": {
      if (cont.step === 1) { const discarded = selected[0] ? removeById(player.hand, selected[0]) : undefined; if (discarded) { player.discard.push(discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: [discarded.instanceId], detail: "Earthen Vessel cost" }); } const eligibleIds = player.deck.filter((card) => isBasicEnergy(state, card)).map((card) => card.instanceId); return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Energy from your deck." }); }
      moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Earthen Vessel Basic Energy" }); return true;
    }
    case "trainer:rare-candy": {
      if (cont.step === 1) { const basic = selected[0] ? findPokemon(player, selected[0]) : undefined; const eligibleIds = basic ? player.hand.filter((instance) => isRareCandyPair(state, basic, instance)).map((card) => card.instanceId) : []; return choice(state, { ...cont, step: 2, variables: { ...cont.variables, basic: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose the matching Stage 2 Pokémon from your hand." }); }
      const basic = cont.variables.basic?.[0] ? findPokemon(player, cont.variables.basic[0]) : undefined; const evolution = selected[0] ? removeById(player.hand, selected[0]) : undefined; if (basic && evolution && isRareCandyPair(state, basic, evolution)) { basic.stack.push(evolution); basic.evolvedThisTurn = true; clearSpecialConditions(basic); emitEvent(state, "pokemon-evolved", cont.actingPlayerId, { sourceCardId: evolution.cardId, sourceInstanceId: evolution.instanceId, targetId: playId(basic), detail: "Rare Candy" }); } return true;
    }
    case "trainer:super-rod": { const recovered: string[] = []; for (const id of selected) { const card = removeById(player.discard, id); if (card) { player.deck.push(card); recovered.push(card.instanceId); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-recovered", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: recovered, detail: "Super Rod shuffled into deck" }); return true; }
    case "trainer:team-rocket-giovanni": { if (cont.step === 1) { if (selected[0]) { switchTo(state, cont.actingPlayerId, selected[0]); emitEvent(state, "ability-used", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: selected[0], detail: "Giovanni own switch" }); } const opponentId = otherPlayer(cont.actingPlayerId); const eligibleIds = state.players[opponentId].bench.map(playId); if (!eligibleIds.length) return true; return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose an opposing Benched Pokémon to gust Active." }); } if (selected[0]) { switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); emitEvent(state, "ability-used", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: selected[0], targetPlayerId: otherPlayer(cont.actingPlayerId), detail: "Giovanni opponent gust" }); } return true; }
    case "trainer:team-rocket-petrel": case "trainer:team-rocket-proton": case "trainer:team-rocket-transceiver": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: cont.programId }); return true;
    case "attack:teleportation-attack": if (selected[0]) switchTo(state, cont.actingPlayerId, selected[0]); return true;
    default: throw new MissingEffectProgramError(cont.programId, cont.sourceCardId);
  }
}

export function continueAllocationEffectProgram(state: GameState, pending: AllocationChoice): boolean {
  const cont = pending.continuation;
  if (cont.programId === "ability:metal-maker") {
    const player = state.players[cont.actingPlayerId]; const energyIds = cont.variables.energy ?? []; const total = Object.values(pending.allocations).reduce((sum, value) => sum + value, 0); if (total !== energyIds.length) throw new Error(`Allocate exactly ${energyIds.length} Basic Metal Energy.`); let index = 0;
    for (const [targetId, amount] of Object.entries(pending.allocations)) { const target = findPokemon(player, targetId); if (!target) throw new Error("Metal Maker target is unavailable."); for (let offset = 0; offset < amount; offset += 1) { const energy = removeById(player.deck, energyIds[index++]!); if (energy) target.attachedEnergy.push(energy); } }
    const nonSelected: CardInstance[] = []; for (const id of (cont.variables.top ?? []).filter((id) => !energyIds.includes(id))) { const card = removeById(player.deck, id); if (card) nonSelected.push(card); } const shuffled = shuffleDeterministic(nonSelected, state.rngState); state.rngState = shuffled.state; player.deck.push(...shuffled.value); return true;
  }
  if (cont.programId === "attack:jolting-charge") {
    const player = state.players[cont.actingPlayerId]; const energyIds = cont.variables.energy ?? []; const total = Object.values(pending.allocations).reduce((sum, value) => sum + value, 0);
    if (total !== energyIds.length) throw new Error(`Allocate exactly ${energyIds.length} Energy attachments.`);
    let index = 0;
    for (const [targetId, amount] of Object.entries(pending.allocations)) { const target = findPokemon(player, targetId); if (!target) throw new Error("Jolting Charge target is unavailable."); for (let offset = 0; offset < amount; offset += 1) { const energy = removeById(player.deck, energyIds[index++]!); if (energy) { target.attachedEnergy.push(energy); emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Jolting Charge" }); } } }
    shuffle(state, cont.actingPlayerId); return true;
  }
  if (cont.programId !== "attack:phantom-dive") return true;
  const opponentId = otherPlayer(cont.actingPlayerId);
  const opponent = state.players[opponentId];
  const eligible = new Set(pending.eligibleIds);
  let total = 0;
  for (const [targetId, amount] of Object.entries(pending.allocations)) {
    if (!eligible.has(targetId) || !Number.isInteger(amount) || amount < (pending.minimumPerTarget ?? 0) || amount > (pending.maximumPerTarget ?? pending.totalUnits)) throw new Error("Invalid damage-counter allocation.");
    total += amount;
  }
  if (total !== pending.totalUnits) throw new Error(`Allocate exactly ${pending.totalUnits} ${pending.unitLabel}s.`);
  for (const [targetId, counters] of Object.entries(pending.allocations)) {
    if (!counters) continue;
    const target = findPokemon(opponent, targetId);
    if (!target) throw new Error("Allocation target is unavailable.");
    target.damage += counters * 10;
    emitEvent(state, "damage-allocation", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId, targetPlayerId: opponentId, amount: counters, detail: `Phantom Dive: ${counters} damage counters` });
    emitEvent(state, "damage-dealt", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId, targetPlayerId: opponentId, amount: counters * 10, detail: "Phantom Dive damage counters" });
  }
  state.pendingKnockOutCause = { cause: "effect-damage-counters", sourcePlayerId: cont.actingPlayerId, sourceCardId: cont.sourceCardId };
  return true;
}
