import type { GameAction, PlayerId } from "../model/actions";
import type { CardType, PokemonInPlay } from "../model/cards";
import type { EffectChoice, GameState } from "../model/game-state";
import { canPayAttackCost } from "./combat";
import { cardFor, playId, pokemonTargets, topCard } from "./helpers";
import { hasAttackLock, hasItemLock, hasRetreatLock } from "./temporary-effects";
import { canAttachEnergyToPokemon } from "./attachment-validity";
import { legalRareCandyBasics } from "./evolution";
import { hasCardTrait, pokemonHasTrait } from "./traits";

function actionId(type: string, ...parts: string[]): string { return [type, ...parts].join(":"); }
function basicInHand(state: GameState, playerId: PlayerId) { return state.players[playerId].hand.filter((instance) => { const card = cardFor(state, instance); return card.category === "pokemon" && card.stage === "basic"; }); }

function setupActions(state: GameState, playerId: PlayerId): GameAction[] {
  const pending = state.pendingChoice; if (pending?.type !== "setup-placement" || pending.playerId !== playerId) return [];
  const player = state.players[playerId]; const actions: GameAction[] = [];
  if (!player.active) for (const instance of basicInHand(state, playerId)) actions.push({ id: actionId("select-active", instance.instanceId), type: "select-active", playerId, cardInstanceId: instance.instanceId, description: `Choose ${cardFor(state, instance).name} as Active` });
  else { if (player.bench.length < 5) for (const instance of basicInHand(state, playerId)) actions.push({ id: actionId("setup-bench", instance.instanceId), type: "bench-basic", playerId, cardInstanceId: instance.instanceId, description: `Place ${cardFor(state, instance).name} on the setup Bench` }); actions.push({ id: "finish-setup", type: "finish-setup", playerId, description: "Finish setup" }); }
  return actions;
}

function effectChoiceActions(state: GameState, pending: EffectChoice): GameAction[] {
  if (pending.selectionKind === "mode") return pending.eligibleIds.map((mode) => ({ id: actionId("mode", pending.choiceId, mode), type: "select-effect-mode" as const, playerId: pending.playerId, mode, description: `Choose ${mode === "both" ? "both modes" : `${mode} mode`}` }));
  const selected = new Set(pending.selectedIds); const actions: GameAction[] = [];
  for (const selectionId of pending.eligibleIds) {
    if (selected.has(selectionId)) actions.push({ id: actionId("deselect", pending.choiceId, selectionId), type: "deselect-card", playerId: pending.playerId, selectionId, description: "Deselect choice" });
    else if (pending.selectedIds.length < pending.max) {
      if (pending.selectionKind === "pokemon") { const pokemon = pokemonTargets(state.players[pending.playerId]).find((target) => playId(target) === selectionId); actions.push({ id: actionId("select", pending.choiceId, selectionId), type: "select-pokemon", playerId: pending.playerId, selectionId, description: `Select ${pokemon ? topCard(state, pokemon).name : "Pokémon"}` }); }
      else { const player = state.players[pending.playerId]; const instance = [...player.hand, ...player.deck, ...player.discard].find((card) => card.instanceId === selectionId); actions.push({ id: actionId("select", pending.choiceId, selectionId), type: "select-card", playerId: pending.playerId, selectionId, description: `Select ${instance ? cardFor(state, instance).name : "card"}` }); }
    }
  }
  if (pending.selectedIds.length >= pending.min && pending.selectedIds.length <= pending.max) actions.push({ id: actionId("confirm", pending.choiceId), type: "confirm-choice", playerId: pending.playerId, description: `Confirm selection (${pending.selectedIds.length})` });
  if (pending.optional && pending.min === 0 && pending.selectedIds.length === 0) actions.push({ id: actionId("decline", pending.choiceId), type: "decline-optional-effect", playerId: pending.playerId, description: "Choose none and continue" });
  return actions;
}

function retreatCost(state: GameState, pokemon: PokemonInPlay): number { const tool = pokemon.tool ? cardFor(state, pokemon.tool) : null; return Math.max(0, topCard(state, pokemon).retreatCost - (tool?.category === "trainer" && tool.effectProgramId === "light-boots" ? 1 : 0)); }
function isBasicEnergy(state: GameState, instanceId: string): boolean { for (const player of Object.values(state.players)) for (const pokemon of pokemonTargets(player)) { const instance = pokemon.attachedEnergy.find((card) => card.instanceId === instanceId); if (instance) { const card = cardFor(state, instance); return card.category === "energy" && card.basic; } } return false; }
function teamRocketKnockedOutLastOpponentTurn(state: GameState, playerId: PlayerId): boolean { return state.events.some((event) => { const card = event.detail ? state.cardDefinitions[event.detail] : undefined; return event.type === "pokemon-knocked-out" && event.turn === state.turn - 1 && event.targetPlayerId === playerId && event.playerId !== playerId && Boolean(card && hasCardTrait(card, "team-rocket")); }); }
function playedTeamRocketSupporterThisTurn(state: GameState, playerId: PlayerId): boolean { return state.events.some((event) => { const card = event.sourceCardId ? state.cardDefinitions[event.sourceCardId] : undefined; return event.type === "card-played" && event.turn === state.turn && event.playerId === playerId && card?.category === "trainer" && card.subtype === "supporter" && hasCardTrait(card, "team-rocket"); }); }

export function getLegalActions(state: GameState, playerId: PlayerId): GameAction[] {
  if (state.result || state.phase === "game-over") return [];
  const pending = state.pendingChoice;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === "setup-placement") return setupActions(state, playerId);
    if (pending.type === "mulligan-draw") { const actions: GameAction[] = []; if (pending.remaining > 0 && state.players[playerId].deck.length) actions.push({ id: actionId("mulligan-draw", String(pending.remaining)), type: "draw-mulligan", playerId, description: "Draw a mulligan bonus card" }); actions.push({ id: "finish-setup", type: "finish-setup", playerId, description: "Finish mulligan bonus draws" }); return actions; }
    if (pending.type === "choose-prize") return state.players[playerId].prizes.map((instance) => ({ id: actionId("choose-prize", instance.instanceId), type: "choose-prize", playerId, cardInstanceId: instance.instanceId, description: "Take a Prize card" }));
    if (pending.type === "promote") return state.players[playerId].bench.map((pokemon) => ({ id: actionId("promote", playId(pokemon)), type: "select-active", playerId, cardInstanceId: playId(pokemon), description: `Promote ${topCard(state, pokemon).name}` }));
    return effectChoiceActions(state, pending);
  }
  if (state.phase !== "main" || state.activePlayerId !== playerId) return [];
  const player = state.players[playerId]; const actions: GameAction[] = [];
  for (const instance of player.hand) {
    const card = cardFor(state, instance);
    if (card.category === "pokemon" && card.stage === "basic" && player.bench.length < 5) actions.push({ id: actionId("bench", instance.instanceId), type: "bench-basic", playerId, cardInstanceId: instance.instanceId, description: `Bench ${card.name}` });
    if (card.category === "energy" && !player.energyAttachedThisTurn) for (const target of pokemonTargets(player)) if (canAttachEnergyToPokemon(state, instance, target)) actions.push({ id: actionId("attach", instance.instanceId, playId(target)), type: "attach-energy", playerId, cardInstanceId: instance.instanceId, targetId: playId(target), description: `Attach ${card.name} to ${topCard(state, target).name}` });
    if (card.category === "pokemon" && card.stage !== "basic") for (const target of pokemonTargets(player)) if (player.turnsTaken > 1 && target.enteredPlayTurn < state.turn && !target.evolvedThisTurn && topCard(state, target).name === card.evolvesFrom) actions.push({ id: actionId("evolve", instance.instanceId, playId(target)), type: "evolve", playerId, cardInstanceId: instance.instanceId, targetId: playId(target), description: `Evolve ${topCard(state, target).name} into ${card.name}` });
    if (card.category === "trainer") {
      if (card.subtype === "item" && hasItemLock(state, playerId)) continue;
      if (card.subtype === "supporter" && (player.supporterPlayedThisTurn || (playerId === state.startingPlayer && player.turnsTaken === 1 && !card.canPlayGoingFirstFirstTurn))) continue;
      if (card.subtype === "stadium") { const current = state.stadium ? cardFor(state, state.stadium) : null; if (player.stadiumPlayedThisTurn || current?.name === card.name) continue; }
      if (card.effectProgramId === "trainer:ultra-ball" && player.hand.length < 3) continue;
      if (card.effectProgramId === "trainer:nest-ball" && player.bench.length >= 5) continue;
      if (card.effectProgramId === "trainer:boss-orders" && !state.players[playerId === "player-one" ? "player-two" : "player-one"].bench.length) continue;
      if (card.effectProgramId === "trainer:night-stretcher" && !player.discard.some((candidate) => { const def = cardFor(state, candidate); return def.category === "pokemon" || def.category === "energy" && def.basic; })) continue;
      if (card.effectProgramId === "trainer:energy-switch" && (!pokemonTargets(player).some((pokemon) => pokemon.attachedEnergy.some((energy) => isBasicEnergy(state, energy.instanceId))) || pokemonTargets(player).length < 2)) continue;
      if (card.effectProgramId === "trainer:buddy-buddy-poffin" && player.bench.length >= 5) continue;
      if (card.effectProgramId === "trainer:earthen-vessel" && player.hand.length < 2) continue;
      if (card.effectProgramId === "trainer:rare-candy" && !legalRareCandyBasics(state, playerId).length) continue;
      if (card.effectProgramId === "trainer:team-rocket-archer" && !teamRocketKnockedOutLastOpponentTurn(state, playerId)) continue;
      if (card.effectProgramId === "trainer:team-rocket-giovanni" && (!player.active || !pokemonHasTrait(state, player.active, "team-rocket") || !player.bench.some((pokemon) => pokemonHasTrait(state, pokemon, "team-rocket")))) continue;
      if (card.effectProgramId === "trainer:switch" || card.effectProgramId === "switch-active-with-bench") for (const target of player.bench) actions.push({ id: actionId("trainer", instance.instanceId, playId(target)), type: "play-trainer", playerId, cardInstanceId: instance.instanceId, targetId: playId(target), description: `Play ${card.name}: switch to ${topCard(state, target).name}` });
      else if (card.subtype === "tool") for (const target of pokemonTargets(player).filter((pokemon) => !pokemon.tool)) actions.push({ id: actionId("trainer", instance.instanceId, playId(target)), type: "play-trainer", playerId, cardInstanceId: instance.instanceId, targetId: playId(target), description: `Attach ${card.name} to ${topCard(state, target).name}` });
      else if (card.effectProgramId === "heal-30-selected-pokemon") for (const target of pokemonTargets(player).filter((pokemon) => pokemon.damage > 0)) actions.push({ id: actionId("trainer", instance.instanceId, playId(target)), type: "play-trainer", playerId, cardInstanceId: instance.instanceId, targetId: playId(target), description: `Play ${card.name}: heal ${topCard(state, target).name}` });
      else actions.push({ id: actionId("trainer", instance.instanceId), type: "play-trainer", playerId, cardInstanceId: instance.instanceId, description: `Play ${card.name}` });
    }
  }
  for (const source of pokemonTargets(player)) for (const ability of topCard(state, source).abilities) {
    const sourceIsActive = source === player.active;
    if (ability.category !== "activated" || sourceIsActive && !ability.targeting.sourceMayBeActive || !sourceIsActive && !ability.targeting.sourceMayBeBenched) continue;
    if (ability.usageLimit === "once-per-turn-per-pokemon" && source.abilityUsage[ability.id] === state.turn || ability.usageLimit === "once-per-turn-by-name" && player.abilityUsageByName[ability.name] === state.turn) continue;
    if (ability.effectProgramId === "ability:fire-off") { if (!player.active) continue; for (const donor of player.bench) for (const energy of donor.attachedEnergy) { const def = cardFor(state, energy); if (def.category === "energy" && def.energyType === "fire") actions.push({ id: actionId("ability", ability.id, playId(source), playId(donor), energy.instanceId), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, targetId: playId(donor), cardInstanceId: energy.instanceId, description: `Use Fire Off: move Fire Energy from ${topCard(state, donor).name} to the Active Pokémon` }); } }
    else if (ability.effectProgramId === "ability:elegant-heal" && pokemonTargets(player).some((pokemon) => pokemon.damage > 0)) actions.push({ id: actionId("ability", ability.id, playId(source)), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, description: `Use ${ability.name}` });
    else if (ability.effectProgramId === "ability:subjugating-chains") for (const target of player.bench.filter((pokemon) => topCard(state, pokemon).pokemonType === "darkness" && topCard(state, pokemon).id !== "sv6pt5-39")) actions.push({ id: actionId("ability", ability.id, playId(source), playId(target)), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, targetId: playId(target), description: `Use Subjugating Chains: switch to ${topCard(state, target).name}` });
    else if (ability.effectProgramId === "ability:adrena-brain" && source.attachedEnergy.some((energy) => { const def = cardFor(state, energy); return def.category === "energy" && def.energyType === "darkness"; }) && pokemonTargets(player).some((pokemon) => pokemon.damage >= 10) && pokemonTargets(state.players[playerId === "player-one" ? "player-two" : "player-one"]).length) actions.push({ id: actionId("ability", ability.id, playId(source)), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, description: "Use Adrena-Brain" });
    else if (ability.effectProgramId === "ability:flip-the-script" && state.events.some((event) => event.type === "pokemon-knocked-out" && event.targetPlayerId === playerId && event.turn === state.turn - 1)) actions.push({ id: actionId("ability", ability.id, playId(source)), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, description: "Use Flip the Script" });
    else if (ability.effectProgramId === "ability:attract-customers" && source === player.active) actions.push({ id: actionId("ability", ability.id, playId(source)), type: "use-ability", playerId, sourcePokemonId: playId(source), abilityId: ability.id, description: "Use Attract Customers" });
  }
  const stadium = state.stadium ? cardFor(state, state.stadium) : null;
  if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:team-rocket-factory" && !player.stadiumAbilityUsedThisTurn && playedTeamRocketSupporterThisTurn(state, playerId)) actions.push({ id: actionId("stadium", state.stadium!.instanceId, "factory"), type: "use-stadium", playerId, cardInstanceId: state.stadium!.instanceId, targetId: "factory", description: "Use Team Rocket's Factory: draw 2 cards" });
  if (stadium?.category === "trainer" && stadium.effectProgramId === "stadium:magma-basin" && !player.stadiumAbilityUsedThisTurn) for (const target of player.bench.filter((pokemon) => topCard(state, pokemon).pokemonType === "fire")) for (const energy of player.discard) { const def = cardFor(state, energy); if (def.category === "energy" && def.energyType === "fire") actions.push({ id: actionId("stadium", energy.instanceId, playId(target)), type: "use-stadium", playerId, cardInstanceId: energy.instanceId, targetId: playId(target), description: `Use Magma Basin on ${topCard(state, target).name}` }); }
  if (player.active) {
    const activeCard = topCard(state, player.active); const blocked = player.active.specialConditions.includes("asleep") || player.active.specialConditions.includes("paralyzed");
    for (const attack of activeCard.attacks) if (!(playerId === state.startingPlayer && player.turnsTaken === 1) && !blocked && !hasAttackLock(state, playerId, playId(player.active), attack.id) && canPayAttackCost(state, player.active, attack)) {
      if (attack.effectProgramId === "attack:cruel-arrow") for (const target of pokemonTargets(state.players[playerId === "player-one" ? "player-two" : "player-one"])) actions.push({ id: actionId("attack", attack.id, playId(target)), type: "attack", playerId, attackId: attack.id, targetId: playId(target), description: `Attack with ${attack.name}: target ${topCard(state, target).name}` });
      else actions.push({ id: actionId("attack", attack.id), type: "attack", playerId, attackId: attack.id, description: `Attack with ${attack.name}` });
    }
    const cost = retreatCost(state, player.active); if (!player.retreatedThisTurn && !blocked && !hasRetreatLock(state, playerId, playId(player.active)) && player.active.attachedEnergy.length >= cost) for (const target of player.bench) actions.push({ id: actionId("retreat", playId(target)), type: "retreat", playerId, targetId: playId(target), description: `Retreat to ${topCard(state, target).name}` });
  }
  actions.push({ id: "end-turn", type: "end-turn", playerId, description: "End turn" }); return actions;
}

export function attachedEnergyTypes(state: GameState, pokemon: PokemonInPlay): CardType[] { return pokemon.attachedEnergy.flatMap((instance) => { const card = cardFor(state, instance); return card.category === "energy" ? [card.energyType] : []; }); }
