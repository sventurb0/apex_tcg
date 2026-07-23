import { continueEffectProgram, startEffectProgram } from "../effects/program-runner";
import type { GameAction, PlayerId } from "../model/actions";
import type { CardInstance, PokemonInPlay } from "../model/cards";
import type { EffectChoice, GameState, KnockOutCause, PendingKnockOutCause, PlayerState, ResolutionResume } from "../model/game-state";
import type { GameResult } from "../model/results";
import { calculateDamage, isKnockedOut, resolveBaseDamage } from "./combat";
import { emitEvent } from "./events";
import { getLegalActions } from "./legal-actions";
import { cardFor, cloneGameState, findPokemon, otherPlayer, playId, pokemonTargets, removeFromDeck, removeFromHand, topCard } from "./helpers";
import { clearSpecialConditions, processPokemonCheckup } from "./pokemon-checkup";
import { attackDamageBonus, modifiedPrizeValue } from "./modifiers";
import { expireTemporaryEffects } from "./temporary-effects";
import { benchCapacity, canUseAttackCondition } from "./shared-mechanics";
import { nextRandom } from "../random/seeded-rng";
import { enforceAttachmentValidity } from "./attachment-validity";
import { hasCardTrait } from "./traits";

export class GameRuleError extends Error { constructor(message: string, readonly action?: GameAction) { super(message); this.name = "GameRuleError"; } }

function result(state: GameState, winnerId: PlayerId, reason: GameResult["reason"]): void { state.result = { winnerId, loserId: otherPlayer(winnerId), reason, turns: state.turn, seed: state.seed, unresolved: false }; state.phase = "game-over"; state.pendingChoice = null; }

function startTurn(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId]; state.activePlayerId = playerId; state.phase = "main"; state.pendingChoice = null; state.turn += 1;
  player.energyAttachedThisTurn = false; player.supporterPlayedThisTurn = false; player.stadiumPlayedThisTurn = false; player.stadiumAbilityUsedThisTurn = false; player.retreatedThisTurn = false; player.turnsTaken += 1;
  player.abilityUsageByName = {}; expireTemporaryEffects(state, playerId);
  for (const pokemon of pokemonTargets(player)) { pokemon.evolvedThisTurn = false; pokemon.abilityUsage = {}; }
  const drawn = player.deck.shift(); if (!drawn) result(state, otherPlayer(playerId), "deck-out"); else player.hand.push(drawn);
}


function makePokemon(instance: CardInstance, turn: number): PokemonInPlay { return { stack: [instance], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: turn, evolvedThisTurn: false, abilityUsage: {} }; }
function discardPokemon(player: PlayerState, pokemon: PokemonInPlay): void { player.discard.push(...pokemon.stack, ...pokemon.attachedEnergy); if (pokemon.tool) player.discard.push(pokemon.tool); }

function performResume(state: GameState, resume: ResolutionResume): void {
  if (state.result) return;
  if (resume.kind === "resume-main") { state.phase = "main"; state.pendingChoice = null; return; }
  if (resume.kind === "start-turn") { startTurn(state, resume.playerId); return; }
  runCheckup(state, resume.playerId);
}

function queuePrizeAndPromotion(state: GameState, claims: { takingPlayerId: PlayerId; remaining: number }[], promotions: PlayerId[], resume: ResolutionResume): void {
  const usableClaims = claims.filter((claim) => claim.remaining > 0 && state.players[claim.takingPlayerId].prizes.length > 0);
  if (usableClaims.length) { state.phase = "choice"; state.pendingChoice = { type: "choose-prize", playerId: usableClaims[0]!.takingPlayerId, claims: usableClaims, promotions, resume }; return; }
  if (promotions.length) { state.phase = "choice"; state.pendingChoice = { type: "promote", playerId: promotions[0]!, remainingPromotions: promotions.slice(1), resume }; return; }
  performResume(state, resume);
}

function resolveKnockOuts(state: GameState, resume: ResolutionResume, context: PendingKnockOutCause = { cause: "other-effect", sourcePlayerId: state.activePlayerId }, causeByTarget: Readonly<Record<string, KnockOutCause>> = {}): void {
  const claims: { takingPlayerId: PlayerId; remaining: number }[] = []; const promotions: PlayerId[] = [];
  for (const playerId of ["player-one", "player-two"] as const) {
    const player = state.players[playerId]; const knocked: PokemonInPlay[] = [];
    if (player.active && isKnockedOut(state, player.active)) { knocked.push(player.active); player.active = null; if (player.bench.length) promotions.push(playerId); }
    for (let index = player.bench.length - 1; index >= 0; index -= 1) if (isKnockedOut(state, player.bench[index]!)) knocked.push(player.bench.splice(index, 1)[0]!);
    for (const pokemon of knocked) { const knockedId = playId(pokemon); const knockedCardId = topCard(state, pokemon).id; const cause = causeByTarget[knockedId] ?? context.cause; const prizes = modifiedPrizeValue(state, playerId, pokemon, cause, context.sourcePlayerId); discardPokemon(player, pokemon); if (prizes.value) claims.push({ takingPlayerId: otherPlayer(playerId), remaining: Math.min(prizes.value, state.players[otherPlayer(playerId)].prizes.length) }); emitEvent(state, "pokemon-knocked-out", otherPlayer(playerId), { sourceCardId: context.sourceCardId ?? knockedCardId, targetId: knockedId, targetPlayerId: playerId, amount: prizes.value, cause, detail: knockedCardId }); if (prizes.reduction) emitEvent(state, "prize-modified", playerId, { sourceCardId: knockedCardId, targetId: knockedId, amount: -prizes.reduction, cause, detail: "Oh No You Don't" }); }
  }
  state.pendingKnockOutCause = null;
  for (const playerId of ["player-one", "player-two"] as const) if (!state.players[playerId].active && state.players[playerId].bench.length === 0) { result(state, otherPlayer(playerId), "no-pokemon"); return; }
  queuePrizeAndPromotion(state, claims, promotions, resume);
}

function runCheckup(state: GameState, endingPlayerId: PlayerId): void {
  const checkup = processPokemonCheckup(state, endingPlayerId); Object.assign(state, checkup.state);
  for (const flip of checkup.coinFlips) emitEvent(state, "coin-flip", flip.playerId, { detail: `${flip.condition}:${flip.heads ? "heads" : "tails"}` });
  for (const poison of checkup.poisonDamage) { emitEvent(state, "poison-checkup-damage", poison.playerId, { sourceCardId: poison.sourceCardId, targetId: poison.targetId, amount: poison.baseCounters * 10, detail: `${poison.baseCounters} base Poison counters` }); if (poison.bonusCounters) emitEvent(state, "damage-modifier-applied", otherPlayer(poison.playerId), { sourceCardId: "svp-129", targetId: poison.targetId, amount: poison.bonusCounters * 10, detail: "Toxic Subjugation" }); }
  const causeByTarget = Object.fromEntries(checkup.knockedOutCauses.map((entry) => [entry.targetId, entry.cause]));
  resolveKnockOuts(state, { kind: "start-turn", playerId: otherPlayer(endingPlayerId) }, { cause: "other-effect", sourcePlayerId: otherPlayer(endingPlayerId) }, causeByTarget);
}

function finishAttack(state: GameState, attackingPlayerId: PlayerId, sourceCardId?: string): void { resolveKnockOuts(state, { kind: "checkup", playerId: attackingPlayerId }, { cause: "attack-damage", sourcePlayerId: attackingPlayerId, sourceCardId }); }

function finishEffect(state: GameState, choice: EffectChoice): void { state.pendingChoice = null; if (choice.continuation.after === "finish-attack") finishAttack(state, choice.continuation.actingPlayerId, choice.continuation.sourceCardId); else if (state.pendingKnockOutCause) resolveKnockOuts(state, { kind: "resume-main", playerId: choice.continuation.actingPlayerId }, state.pendingKnockOutCause); else { state.phase = "main"; } }

function applySelectActive(state: GameState, action: Extract<GameAction, { type: "select-active" }>): void {
  const pending = state.pendingChoice; const player = state.players[action.playerId];
  if (pending?.type === "promote") { const index = player.bench.findIndex((pokemon) => playId(pokemon) === action.cardInstanceId); if (index < 0) throw new GameRuleError("The selected Pokémon is not on the Bench.", action); player.active = player.bench.splice(index, 1)[0]!; const next = pending.remainingPromotions; if (next.length) state.pendingChoice = { ...pending, playerId: next[0]!, remainingPromotions: next.slice(1) }; else performResume(state, pending.resume); return; }
  if (pending?.type !== "setup-placement" || player.active) throw new GameRuleError("Active selection is not available.", action);
  player.active = makePokemon(removeFromHand(player, action.cardInstanceId), state.turn);
}

function beginMulliganDraws(state: GameState): void {
  const firstCount = state.players["player-two"].mulligans; const secondCount = state.players["player-one"].mulligans;
  if (firstCount) state.pendingChoice = { type: "mulligan-draw", playerId: "player-one", remaining: firstCount, nextPlayerId: secondCount ? "player-two" : undefined };
  else if (secondCount) state.pendingChoice = { type: "mulligan-draw", playerId: "player-two", remaining: secondCount };
  else { emitEvent(state, "setup-completed", state.startingPlayer); startTurn(state, state.startingPlayer); }
}

function applyFinishSetup(state: GameState, playerId: PlayerId): void {
  const pending = state.pendingChoice;
  if (pending?.type === "setup-placement") { if (!state.players[playerId].active) throw new GameRuleError("Choose an Active Basic Pokémon first."); if (playerId === "player-one") state.pendingChoice = { type: "setup-placement", playerId: "player-two" }; else beginMulliganDraws(state); return; }
  if (pending?.type === "mulligan-draw") { if (pending.nextPlayerId) { const count = state.players[otherPlayer(pending.nextPlayerId)].mulligans; state.pendingChoice = { type: "mulligan-draw", playerId: pending.nextPlayerId, remaining: count }; } else { emitEvent(state, "setup-completed", playerId); startTurn(state, state.startingPlayer); } }
}

function applyTrainer(state: GameState, action: Extract<GameAction, { type: "play-trainer" }>): void {
  const player = state.players[action.playerId]; const instance = removeFromHand(player, action.cardInstanceId); const card = cardFor(state, instance);
  if (card.category !== "trainer") throw new GameRuleError("The selected card is not a Trainer.", action);
  const isTeamRocketSupporter = card.subtype === "supporter" && hasCardTrait(card, "team-rocket");
  const detail = isTeamRocketSupporter
    ? card.canPlayGoingFirstFirstTurn && action.playerId === state.startingPlayer && player.turnsTaken === 1
      ? "Team Rocket Supporter; Proton first-turn exception"
      : "Team Rocket Supporter"
    : undefined;
  emitEvent(state, "card-played", action.playerId, { sourceCardId: card.id, sourceInstanceId: instance.instanceId, detail });
  if (card.subtype === "supporter") player.supporterPlayedThisTurn = true;
  if (card.subtype === "stadium") { if (state.stadium) { const ownerId: PlayerId = state.stadium.instanceId.startsWith("player-one-") ? "player-one" : "player-two"; state.players[ownerId].discard.push(state.stadium); } state.stadium = instance; player.stadiumPlayedThisTurn = true; if (card.effectProgramId === "stadium:gravity-mountain") resolveKnockOuts(state, { kind: "resume-main", playerId: action.playerId }, { cause: "stadium-effect", sourcePlayerId: action.playerId, sourceCardId: card.id }); return; }
  if (card.subtype === "tool" && action.targetId) { const target = findPokemon(player, action.targetId); if (!target) throw new GameRuleError("Tool target is unavailable.", action); target.tool = instance; return; }
  player.discard.push(instance);
  if (card.effectProgramId === "trainer:switch" && action.targetId) { const active = player.active; const index = player.bench.findIndex((pokemon) => playId(pokemon) === action.targetId); if (!active || index < 0) throw new GameRuleError("Switch target is unavailable.", action); clearSpecialConditions(active); player.active = player.bench.splice(index, 1, active)[0]!; return; }
  if (card.effectProgramId === "heal-30-selected-pokemon" && action.targetId) { const target = findPokemon(player, action.targetId); if (target) { const amount = Math.min(30, target.damage); target.damage -= amount; emitEvent(state, "damage-healed", action.playerId, { sourceCardId: card.id, targetId: playId(target), amount }); } return; }
  if (card.effectProgramId === "draw-two") { player.hand.push(...player.deck.splice(0, 2)); return; }
  if (card.effectProgramId === "search-basic") { const eligibleIds = player.deck.filter((candidate) => { const def = cardFor(state, candidate); return def.category === "pokemon" && def.stage === "basic"; }).map((candidate) => candidate.instanceId); state.phase = "choice"; state.pendingChoice = { type: "effect-choice", choiceId: `search-basic:${state.actionHistory.length}`, playerId: action.playerId, selectionKind: "card", min: 0, max: Math.min(1, eligibleIds.length), eligibleIds, selectedIds: [], optional: true, instruction: "Choose up to 1 Basic Pokémon.", sourceCardId: card.id, sourceEffectId: card.effectProgramId, continuation: { programId: "trainer:great-ball", step: 1, actingPlayerId: action.playerId, sourceCardId: card.id, sourceInstanceId: instance.instanceId, variables: {}, after: "resume-main" } }; return; }
  const completed = startEffectProgram(state, { programId: card.effectProgramId, actingPlayerId: action.playerId, sourceCardId: card.id, sourceInstanceId: instance.instanceId, after: "resume-main" }); if (completed) state.phase = "main";
}

function applyAbility(state: GameState, action: Extract<GameAction, { type: "use-ability" }>): void {
  const player = state.players[action.playerId]; const source = findPokemon(player, action.sourcePokemonId); if (!source) throw new GameRuleError("Ability user is unavailable.", action);
  const card = topCard(state, source); const ability = card.abilities.find((candidate) => candidate.id === action.abilityId); if (!ability) throw new GameRuleError("Ability has no executable runtime definition.", action);
  if (ability.effectProgramId === "ability:fire-off") { const donor = action.targetId ? findPokemon(player, action.targetId) : undefined; if (!donor || donor === player.active || !action.cardInstanceId || !player.active) throw new GameRuleError("Fire Off source is unavailable.", action); const index = donor.attachedEnergy.findIndex((energy) => energy.instanceId === action.cardInstanceId); const energy = index >= 0 ? donor.attachedEnergy[index] : undefined; const energyDef = energy ? cardFor(state, energy) : undefined; if (!energy || energyDef?.category !== "energy" || energyDef.energyType !== "fire") throw new GameRuleError("Fire Off requires attached Fire Energy from the Bench.", action); donor.attachedEnergy.splice(index, 1); player.active.attachedEnergy.push(energy); emitEvent(state, "energy-moved", action.playerId, { sourceCardId: card.id, sourceInstanceId: energy.instanceId, targetId: playId(player.active), cardInstanceIds: [energy.instanceId] }); }
  else { startEffectProgram(state, { programId: ability.effectProgramId, actingPlayerId: action.playerId, sourceCardId: card.id, sourcePokemonId: playId(source), after: "resume-main", variables: { ...(action.targetId ? { target: [action.targetId] } : {}), ...(action.cardInstanceId ? { card: [action.cardInstanceId] } : {}) } }); }
  if (ability.usageLimit === "once-per-turn-per-pokemon") source.abilityUsage[ability.id] = state.turn;
  if (ability.usageLimit === "once-per-turn-by-name") player.abilityUsageByName[ability.name] = state.turn;
  emitEvent(state, "ability-used", action.playerId, { sourceCardId: card.id, targetId: playId(source), detail: ability.name });
}

function applyStadiumAbility(state: GameState, action: Extract<GameAction, { type: "use-stadium" }>): void {
  const stadium = state.stadium ? cardFor(state, state.stadium) : undefined;
  if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:team-rocket-factory") { const player = state.players[action.playerId]; player.hand.push(...player.deck.splice(0, 2)); player.stadiumAbilityUsedThisTurn = true; emitEvent(state, "stadium-ability-used", action.playerId, { sourceCardId: stadium.id, detail: "Team Rocket's Factory draw 2" }); return; }
  if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:prism-tower") { const player = state.players[action.playerId]; if (player.hand.length < 2 || player.stadiumAbilityUsedThisTurn) throw new GameRuleError("Prism Tower requires 2 cards in hand.", action); player.discard.push(...player.hand.splice(0, 2)); const drawn = player.deck.shift(); if (drawn) player.hand.push(drawn); player.stadiumAbilityUsedThisTurn = true; emitEvent(state, "stadium-ability-used", action.playerId, { sourceCardId: stadium.id, detail: "Prism Tower discard 2 draw 1" }); return; }
  const player = state.players[action.playerId]; const target = findPokemon(player, action.targetId); const energyIndex = player.discard.findIndex((card) => card.instanceId === action.cardInstanceId); const energy = energyIndex >= 0 ? player.discard[energyIndex] : undefined;
  if (!target || !player.bench.includes(target) || topCard(state, target).pokemonType !== "fire" || !energy) throw new GameRuleError("Magma Basin target is unavailable.", action);
  const energyDef = cardFor(state, energy); if (energyDef.category !== "energy" || energyDef.energyType !== "fire") throw new GameRuleError("Magma Basin requires Fire Energy.", action);
  player.discard.splice(energyIndex, 1); target.attachedEnergy.push(energy); target.damage += 20; player.stadiumAbilityUsedThisTurn = true;
  emitEvent(state, "stadium-ability-used", action.playerId, { sourceCardId: state.stadium?.cardId, targetId: playId(target) }); emitEvent(state, "energy-attached-by-effect", action.playerId, { sourceCardId: state.stadium?.cardId, targetId: playId(target), cardInstanceIds: [energy.instanceId] });
  resolveKnockOuts(state, { kind: "resume-main", playerId: action.playerId }, { cause: "effect-damage-counters", sourcePlayerId: action.playerId, sourceCardId: state.stadium?.cardId });
}

function applyAttack(state: GameState, action: Extract<GameAction, { type: "attack" }>): void {
  const attacker = state.players[action.playerId]; const defenderId = otherPlayer(action.playerId); const defender = state.players[defenderId]; if (!attacker.active || !defender.active) throw new GameRuleError("Both players need an Active Pokémon to attack.", action);
  const attackingCard = topCard(state, attacker.active); const attack = attackingCard.attacks.find((candidate) => candidate.id === action.attackId); if (!attack) throw new GameRuleError("Attack is not available.", action); if (attack.condition && !canUseAttackCondition(state, action.playerId, attacker.active, attack.condition)) throw new GameRuleError("The attack's condition is not satisfied.", action);
  emitEvent(state, "attack-used", action.playerId, { sourceCardId: attackingCard.id, targetId: action.targetId ?? playId(defender.active), detail: attack.name });
  if (attacker.active.specialConditions.includes("confused")) { const flip = nextRandom(state.rngState); state.rngState = flip.state; const heads = flip.value < .5; emitEvent(state, "coin-flip", action.playerId, { sourceCardId: attackingCard.id, targetId: playId(attacker.active), detail: `confused:${heads ? "heads" : "tails"}` }); if (!heads) { attacker.active.damage += 30; emitEvent(state, "damage-dealt", action.playerId, { sourceCardId: attackingCard.id, targetId: playId(attacker.active), amount: 30, detail: "Confusion self-damage" }); resolveKnockOuts(state, { kind: "checkup", playerId: action.playerId }, { cause: "other-effect", sourcePlayerId: action.playerId, sourceCardId: attackingCard.id }); return; } }
  const targeted = action.targetId ? findPokemon(defender, action.targetId) : defender.active; if (!targeted) throw new GameRuleError("Attack target is unavailable.", action); const targetIsActive = targeted === defender.active; const defendingCard = topCard(state, targeted);
  const baseDamage = resolveBaseDamage(attack.damage, attacker.active, state, action.playerId); const bonus = attackDamageBonus(state, attacker.active, targetIsActive); const benchProtected = !targetIsActive && defendingCard.id === "sv6-130"; const fairyZone = pokemonTargets(attacker).some((pokemon) => topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:fairy-zone")); const effectiveDefendingCard = fairyZone && defendingCard.pokemonType === "dragon" ? { ...defendingCard, weakness: { type: "psychic" as const, multiplier: 2 } } : defendingCard; const damage = benchProtected ? 0 : targetIsActive ? calculateDamage(attackingCard, effectiveDefendingCard, baseDamage + bonus.amount) : baseDamage;
  if (attack.damage.kind === "formula" && attack.damage.resolverId === "horn-rend-damage" && targeted.damage > 0) emitEvent(state, "damage-modifier-applied", action.playerId, { sourceCardId: attackingCard.id, targetId: playId(targeted), amount: 60, detail: "Horn Rend conditional bonus" });
  targeted.damage += damage; if (damage) emitEvent(state, "damage-dealt", action.playerId, { sourceCardId: attackingCard.id, targetId: playId(targeted), amount: damage }); if (bonus.amount) emitEvent(state, "damage-modifier-applied", action.playerId, { sourceCardId: bonus.sourceCardId, targetId: playId(targeted), amount: bonus.amount, detail: "Binding Mochi" });
  if (attack.effectProgramId) { const effectsBlocked = defendingCard.stage === "basic" && hasCardTrait(defendingCard, "team-rocket") && pokemonTargets(defender).some((pokemon) => topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:repelling-veil")); if (!effectsBlocked) { const completed = startEffectProgram(state, { programId: attack.effectProgramId, actingPlayerId: action.playerId, sourceCardId: attackingCard.id, sourcePokemonId: playId(attacker.active), attackId: attack.id, after: "finish-attack", variables: action.targetId ? { target: [action.targetId] } : undefined }); if (!completed) return; } }
  finishAttack(state, action.playerId, attackingCard.id);
}

function applyPrize(state: GameState, action: Extract<GameAction, { type: "choose-prize" }>): void {
  const pending = state.pendingChoice; if (pending?.type !== "choose-prize") throw new GameRuleError("No Prize selection is pending.", action); const player = state.players[action.playerId]; const index = player.prizes.findIndex((card) => card.instanceId === action.cardInstanceId); const prize = index >= 0 ? player.prizes.splice(index, 1)[0] : undefined; if (!prize) throw new GameRuleError("Prize card is unavailable.", action);
  player.hand.push(prize); player.prizesTaken += 1; emitEvent(state, "prize-card-taken", action.playerId, { cardInstanceIds: [prize.instanceId] }); if (!player.prizes.length) { result(state, action.playerId, "prizes"); return; }
  const claims = [...pending.claims]; claims[0] = { ...claims[0]!, remaining: claims[0]!.remaining - 1 }; if (claims[0]!.remaining <= 0) claims.shift(); queuePrizeAndPromotion(state, claims, pending.promotions, pending.resume);
}

function applyChoiceSelection(state: GameState, selectionId: string, select: boolean): void { const pending = state.pendingChoice; if (pending?.type !== "effect-choice" || !pending.eligibleIds.includes(selectionId)) throw new GameRuleError("Selection is not eligible."); const selected = pending.selectedIds.filter((id) => id !== selectionId); if (select && selected.length < pending.max) selected.push(selectionId); state.pendingChoice = { ...pending, selectedIds: selected }; }
function confirmChoice(state: GameState, selectedOverride?: string[]): void { const pending = state.pendingChoice; if (pending?.type !== "effect-choice") throw new GameRuleError("No effect choice is pending."); const selected = selectedOverride ?? pending.selectedIds; if (selected.length < pending.min || selected.length > pending.max) throw new GameRuleError(`Select between ${pending.min} and ${pending.max}.`); state.pendingChoice = null; const completed = continueEffectProgram(state, pending, selected); if (completed) finishEffect(state, pending); }

function mutate(state: GameState, action: GameAction): void {
  const player = state.players[action.playerId];
  switch (action.type) {
    case "select-active": applySelectActive(state, action); break;
    case "bench-basic": { if (player.bench.length >= benchCapacity(state, action.playerId)) throw new GameRuleError("The Bench is full.", action); const instance = removeFromHand(player, action.cardInstanceId); const pokemon = makePokemon(instance, state.turn); player.bench.push(pokemon); emitEvent(state, "pokemon-benched", action.playerId, { sourceCardId: instance.cardId, sourceInstanceId: instance.instanceId, targetId: playId(pokemon) }); if (instance.cardId === "me3-62" && !player.abilityUsageByName["Last-Ditch Catch"]) { const supporter = player.deck.find((candidate) => { const definition = cardFor(state, candidate); return definition.category === "trainer" && definition.subtype === "supporter"; }); if (supporter) { removeFromDeck(player, supporter.instanceId); player.hand.push(supporter); emitEvent(state, "cards-searched", action.playerId, { sourceCardId: instance.cardId, cardInstanceIds: [supporter.instanceId], detail: "Last-Ditch Catch" }); } player.abilityUsageByName["Last-Ditch Catch"] = state.turn; } break; }
    case "finish-setup": applyFinishSetup(state, action.playerId); break;
    case "draw-mulligan": { const pending = state.pendingChoice; if (pending?.type !== "mulligan-draw") break; const card = player.deck.shift(); if (card) player.hand.push(card); state.pendingChoice = { ...pending, remaining: Math.max(0, pending.remaining - 1) }; break; }
    case "attach-energy": { const instance = removeFromHand(player, action.cardInstanceId); const target = findPokemon(player, action.targetId); if (!target) throw new GameRuleError("Energy target is unavailable.", action); target.attachedEnergy.push(instance); player.energyAttachedThisTurn = true; emitEvent(state, "energy-attached-manually", action.playerId, { sourceCardId: instance.cardId, targetId: playId(target), cardInstanceIds: [instance.instanceId], detail: instance.cardId === "sv10-182" ? "Team Rocket's Energy" : undefined }); break; }
    case "evolve": { const instance = removeFromHand(player, action.cardInstanceId); const target = findPokemon(player, action.targetId); if (!target) throw new GameRuleError("Evolution target is unavailable.", action); target.stack.push(instance); target.evolvedThisTurn = true; clearSpecialConditions(target); emitEvent(state, "pokemon-evolved", action.playerId, { sourceCardId: instance.cardId, targetId: playId(target) }); const stadium = state.stadium ? cardFor(state, state.stadium) : undefined; if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:gravity-mountain") resolveKnockOuts(state, { kind: "resume-main", playerId: action.playerId }, { cause: "stadium-effect", sourcePlayerId: action.playerId, sourceCardId: stadium.id }); break; }
    case "play-trainer": applyTrainer(state, action); break;
    case "use-stadium": applyStadiumAbility(state, action); break;
    case "use-ability": applyAbility(state, action); break;
    case "attack": applyAttack(state, action); break;
    case "retreat": { if (!player.active) throw new GameRuleError("There is no Active Pokémon to retreat.", action); const targetIndex = player.bench.findIndex((pokemon) => playId(pokemon) === action.targetId); const skyliner = pokemonTargets(player).some((pokemon) => topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:skyliner")); const cost = skyliner && topCard(state, player.active).stage === "basic" ? 0 : topCard(state, player.active).retreatCost; player.discard.push(...player.active.attachedEnergy.splice(0, cost)); clearSpecialConditions(player.active); const target = player.bench.splice(targetIndex, 1, player.active)[0]; if (!target) throw new GameRuleError("Retreat target is unavailable.", action); player.active = target; player.retreatedThisTurn = true; break; }
    case "choose-prize": applyPrize(state, action); break;
    case "select-card": case "select-pokemon": applyChoiceSelection(state, action.selectionId, true); break;
    case "deselect-card": applyChoiceSelection(state, action.selectionId, false); break;
    case "confirm-choice": confirmChoice(state); break;
    case "decline-optional-effect": confirmChoice(state, []); break;
    case "select-effect-mode": confirmChoice(state, [action.mode]); break;
    case "end-turn": runCheckup(state, action.playerId); break;
    default: { const exhaustive: never = action; throw new GameRuleError(`Unsupported action: ${String(exhaustive)}`); }
  }
}

export function applyAction(state: GameState, submittedAction: GameAction): GameState {
  const canonical = getLegalActions(state, submittedAction.playerId).find((action) => action.id === submittedAction.id); if (!canonical || canonical.type !== submittedAction.type) throw new GameRuleError(`Illegal action: ${submittedAction.description || submittedAction.id}`, submittedAction);
  const next = cloneGameState(state); mutate(next, canonical); enforceAttachmentValidity(next); next.actionHistory.push(canonical); if (next.detailedLogs) next.actionLog.push({ index: next.actionLog.length, turn: state.turn, playerId: canonical.playerId, actionId: canonical.id, description: canonical.description }); return next;
}
