import type { PlayerId } from "../model/actions";
import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { EffectChoice, EffectContinuation, GameState } from "../model/game-state";
import { nextRandom, shuffleDeterministic } from "../random/seeded-rng";
import { cardFor, findPokemon, otherPlayer, playId, pokemonTargets, topCard } from "../rules/helpers";
import { clearSpecialConditions, applySpecialCondition } from "../rules/pokemon-checkup";
import { emitEvent } from "../rules/events";
import { effectiveMaxHp } from "../rules/modifiers";
import { addTemporaryEffect } from "../rules/temporary-effects";
import { allPokemonHaveTrait, hasCardTrait, pokemonHasTrait } from "../rules/traits";
import { isRareCandyPair, legalRareCandyBasics } from "../rules/evolution";

export interface ProgramStart { programId: string; actingPlayerId: PlayerId; sourceCardId: string; sourceInstanceId?: string; sourcePokemonId?: string; attackId?: string; after: EffectContinuation["after"]; variables?: Record<string, string[]>; }

function shuffle(state: GameState, playerId: PlayerId): void { const result = shuffleDeterministic(state.players[playerId].deck, state.rngState); state.players[playerId].deck = result.value; state.rngState = result.state; }
function removeById(zone: CardInstance[], id: string): CardInstance | undefined { const index = zone.findIndex((card) => card.instanceId === id); return index < 0 ? undefined : zone.splice(index, 1)[0]; }
function isBasicEnergy(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "energy" && card.basic; }
function isBasicDarknessEnergy(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "energy" && card.basic && card.energyType === "darkness"; }
function isSupporter(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "supporter"; }
function isStadium(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "stadium"; }
function isTeamRocketPokemonCard(state: GameState, instance: CardInstance, basicOnly = false): boolean { const card = cardFor(state, instance); return card.category === "pokemon" && (!basicOnly || card.stage === "basic") && hasCardTrait(card, "team-rocket"); }
function isTeamRocketSupporter(state: GameState, instance: CardInstance): boolean { const card = cardFor(state, instance); return card.category === "trainer" && card.subtype === "supporter" && hasCardTrait(card, "team-rocket"); }
function heal(state: GameState, playerId: PlayerId, pokemon: PokemonInPlay, amount: number, sourceCardId: string): void { const healed = Math.min(amount, pokemon.damage); pokemon.damage -= healed; if (healed) emitEvent(state, "damage-healed", playerId, { sourceCardId, targetId: playId(pokemon), amount: healed }); }
function draw(state: GameState, playerId: PlayerId, count: number): void { const player = state.players[playerId]; player.hand.push(...player.deck.splice(0, count)); }
function switchTo(state: GameState, playerId: PlayerId, targetId: string): void { const player = state.players[playerId]; if (!player.active) return; const index = player.bench.findIndex((pokemon) => playId(pokemon) === targetId); if (index < 0) return; clearSpecialConditions(player.active); const target = player.bench.splice(index, 1, player.active)[0]!; player.active = target; }

function choice(state: GameState, continuation: EffectContinuation, options: Omit<EffectChoice, "type" | "choiceId" | "selectedIds" | "continuation" | "sourceCardId" | "sourceEffectId">): boolean {
  state.phase = "choice";
  state.pendingChoice = { type: "effect-choice", choiceId: `${continuation.programId}:${continuation.step}:${state.actionHistory.length}`, selectedIds: [], continuation, sourceCardId: continuation.sourceCardId, sourceEffectId: continuation.programId, ...options };
  return false;
}

function continuation(start: ProgramStart, step = 0, variables = start.variables ?? {}): EffectContinuation { return { programId: start.programId, step, actingPlayerId: start.actingPlayerId, sourceCardId: start.sourceCardId, sourceInstanceId: start.sourceInstanceId, sourcePokemonId: start.sourcePokemonId, attackId: start.attackId, variables, after: start.after }; }

export function startEffectProgram(state: GameState, start: ProgramStart): boolean {
  const player = state.players[start.actingPlayerId]; const source = start.sourcePokemonId ? findPokemon(player, start.sourcePokemonId) : undefined;
  switch (start.programId) {
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
    case "attack:aroma-shot": if (source) clearSpecialConditions(source); return true;
    case "attack:vitality-song": for (const pokemon of pokemonTargets(player)) heal(state, start.actingPlayerId, pokemon, 30, start.sourceCardId); return true;
    case "attack:burning-voice": return true;
    case "attack:chain-crazed": return true;
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
    case "attack:mind-bend": {
      const target = state.players[otherPlayer(start.actingPlayerId)].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "confused"); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "confused" }); } return true;
    }
    case "attack:dirty-headbutt": if (source && start.attackId) { const effect = { kind: "attack-lock" as const, playerId: start.actingPlayerId, pokemonId: playId(source), attackId: start.attackId, appliesOnPlayerTurn: player.turnsTaken + 1, sourceCardId: start.sourceCardId }; addTemporaryEffect(state, effect); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(source), detail: "Dirty Headbutt attack lock" }); } return true;
    case "attack:poison-chain": {
      const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "poisoned"); const effect = { kind: "retreat-lock" as const, playerId: opponentId, pokemonId: playId(target), appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }; addTemporaryEffect(state, effect); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), detail: "poisoned" }); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, detail: "retreat lock" }); } return true;
    }
    case "attack:itchy-pollen": {
      const opponentId = otherPlayer(start.actingPlayerId); addTemporaryEffect(state, { kind: "item-lock", playerId: opponentId, appliesOnPlayerTurn: state.players[opponentId].turnsTaken + 1, sourceCardId: start.sourceCardId }); emitEvent(state, "temporary-effect-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetPlayerId: opponentId, detail: "item lock" }); return true;
    }
    case "attack:tainted-horn": { const opponentId = otherPlayer(start.actingPlayerId); const target = state.players[opponentId].active; if (target && target.damage < effectiveMaxHp(state, target)) { applySpecialCondition(target, "poisoned", { countersPerCheckup: 8, sourceCardId: start.sourceCardId }); emitEvent(state, "special-condition-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, detail: "poisoned by Tainted Horn" }); emitEvent(state, "enhanced-poison-applied", start.actingPlayerId, { sourceCardId: start.sourceCardId, targetId: playId(target), targetPlayerId: opponentId, amount: 8, detail: "Tainted Horn: 8 counters per Checkup" }); } return true; }
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
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(player.bench.length < 5 ? 1 : 0, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Basic Pokémon to put onto your Bench." });
    }
    case "trainer:professors-research": { const discarded = player.hand.splice(0); player.discard.push(...discarded); if (discarded.length) emitEvent(state, "cards-discarded", start.actingPlayerId, { sourceCardId: start.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId) }); draw(state, start.actingPlayerId, 7); return true; }
    case "trainer:ultra-ball": {
      const eligibleIds = player.hand.map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 2, max: 2, eligibleIds, optional: false, instruction: "Choose exactly 2 other cards to discard for Ultra Ball." });
    }
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
    case "trainer:pokegear-3": {
      const subset = player.deck.slice(0, 7).map((card) => card.instanceId); const eligibleIds = player.deck.slice(0, 7).filter((card) => isSupporter(state, card)).map((card) => card.instanceId);
      return choice(state, continuation(start, 1, { subset }), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Supporter from the top 7 cards." });
    }
    case "trainer:energy-switch": {
      const eligibleIds = pokemonTargets(player).flatMap((pokemon) => pokemon.attachedEnergy.filter((energy) => isBasicEnergy(state, energy)).map((energy) => energy.instanceId));
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Basic Energy attached to one of your Pokémon." });
    }
    case "trainer:night-stretcher": {
      const eligibleIds = player.discard.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" || card.category === "energy" && card.basic; }).map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose 1 Pokémon or Basic Energy from your discard pile." });
    }
    case "trainer:master-ball": {
      const eligibleIds = player.deck.filter((instance) => cardFor(state, instance).category === "pokemon").map((card) => card.instanceId);
      return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from your deck." });
    }
    case "trainer:buddy-buddy-poffin": { const freeSpaces = Math.max(0, 5 - player.bench.length); const eligibleIds = player.deck.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" && card.stage === "basic" && card.hp <= 70; }).map((card) => card.instanceId); return choice(state, continuation(start, 1), { playerId: start.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(2, freeSpaces, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 2 Basic Pokémon with 70 HP or less to put onto your Bench." }); }
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
    default: return true;
  }
}

function moveDiscardToHand(state: GameState, playerId: PlayerId, ids: string[]): void { const player = state.players[playerId]; for (const id of ids) { const card = removeById(player.discard, id); if (card) player.hand.push(card); } }
function moveDeckToHand(state: GameState, playerId: PlayerId, ids: string[]): void { const player = state.players[playerId]; for (const id of ids) { const card = removeById(player.deck, id); if (card) player.hand.push(card); } }

function continueEscapeRope(state: GameState, cont: EffectContinuation, selected: string[]): boolean {
  if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]);
  const eligibleIds = state.players[cont.actingPlayerId].bench.map(playId);
  if (!eligibleIds.length) return true;
  return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a Benched Pokémon to switch with your Active Pokémon." });
}

export function continueEffectProgram(state: GameState, pending: EffectChoice, selected: string[]): boolean {
  const cont = pending.continuation; const player = state.players[cont.actingPlayerId];
  switch (cont.programId) {
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
    case "trainer:nest-ball": { const card = selected[0] ? removeById(player.deck, selected[0]) : undefined; if (card && player.bench.length < 5) player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "trainer:ultra-ball": if (cont.step === 1) { const discarded: CardInstance[] = []; for (const id of selected) { const card = removeById(player.hand, id); if (card) discarded.push(card); } player.discard.push(...discarded); emitEvent(state, "cards-discarded", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: discarded.map((card) => card.instanceId) }); const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "pokemon").map((card) => card.instanceId); return choice(state, { ...cont, step: 2 }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Pokémon from your deck." }); } else { moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true; }
    case "trainer:janines-secret-art": {
      if (cont.step === 1) { if (!selected.length) { shuffle(state, cont.actingPlayerId); return true; } const eligibleIds = player.deck.filter((card) => isBasicDarknessEnergy(state, card)).map((card) => card.instanceId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, targets: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: Math.min(selected.length, eligibleIds.length), max: Math.min(selected.length, eligibleIds.length), eligibleIds, optional: false, instruction: "Choose one Basic Darkness Energy for each selected Pokémon." }); }
      const targets = cont.variables.targets ?? []; const attached: string[] = []; for (let index = 0; index < selected.length; index += 1) { const target = targets[index] ? findPokemon(player, targets[index]!) : undefined; const energy = removeById(player.deck, selected[index]!); if (target && energy) { target.attachedEnergy.push(energy); attached.push(energy.instanceId); if (target === player.active) { applySpecialCondition(target, "poisoned"); emitEvent(state, "special-condition-applied", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), detail: "poisoned by Janine's Secret Art" }); } emitEvent(state, "energy-attached-by-effect", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Janine's Secret Art" }); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: attached }); return true;
    }
    case "trainer:colress-tenacity": {
      if (cont.step === 1) { const eligibleIds = player.deck.filter((card) => cardFor(state, card).category === "energy").map((card) => card.instanceId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, stadium: selected } }, { playerId: cont.actingPlayerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, optional: true, instruction: "Choose up to 1 Energy from your deck." }); }
      const chosen = [...(cont.variables.stadium ?? []), ...selected]; moveDeckToHand(state, cont.actingPlayerId, chosen); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: chosen, detail: "Colress's Tenacity" }); return true;
    }
    case "trainer:boss-orders": if (selected[0]) switchTo(state, otherPlayer(cont.actingPlayerId), selected[0]); return true;
    case "trainer:cyrano": case "trainer:poke-pad": case "trainer:master-ball": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected }); return true;
    case "trainer:pokegear-3": moveDeckToHand(state, cont.actingPlayerId, selected); shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: selected, detail: "Pokégear 3.0" }); return true;
    case "trainer:night-stretcher": moveDiscardToHand(state, cont.actingPlayerId, selected); return true;
    case "trainer:energy-switch": {
      if (cont.step === 1) { const energyId = selected[0]!; const source = pokemonTargets(player).find((pokemon) => pokemon.attachedEnergy.some((energy) => energy.instanceId === energyId)); const eligibleIds = pokemonTargets(player).filter((pokemon) => pokemon !== source).map(playId); return choice(state, { ...cont, step: 2, variables: { ...cont.variables, energy: [energyId], from: source ? [playId(source)] : [] } }, { playerId: cont.actingPlayerId, selectionKind: "pokemon", min: 1, max: 1, eligibleIds, optional: false, instruction: "Choose a different Pokémon to receive the Basic Energy." }); }
      const source = cont.variables.from?.[0] ? findPokemon(player, cont.variables.from[0]) : undefined; const target = selected[0] ? findPokemon(player, selected[0]) : undefined; const energyId = cont.variables.energy?.[0]; const energyIndex = source && energyId ? source.attachedEnergy.findIndex((energy) => energy.instanceId === energyId) : -1; const energy = source && energyIndex >= 0 ? source.attachedEnergy.splice(energyIndex, 1)[0] : undefined; if (target && energy) { target.attachedEnergy.push(energy); emitEvent(state, "energy-moved", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, sourceInstanceId: energy.instanceId, targetId: playId(target), cardInstanceIds: [energy.instanceId], detail: "Energy Switch" }); } return true;
    }
    case "trainer:buddy-buddy-poffin": { const benched: string[] = []; for (const id of selected.slice(0, Math.max(0, 5 - player.bench.length))) { const card = removeById(player.deck, id); if (card) { player.bench.push({ stack: [card], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: state.turn, evolvedThisTurn: false, abilityUsage: {} }); benched.push(card.instanceId); } } shuffle(state, cont.actingPlayerId); emitEvent(state, "cards-searched", cont.actingPlayerId, { sourceCardId: cont.sourceCardId, cardInstanceIds: benched, detail: "Buddy-Buddy Poffin to Bench" }); return true; }
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
    default: return true;
  }
}
