import type { PlayerId } from "../model/actions";
import type { PokemonInPlay } from "../model/cards";
import type { GameState, KnockOutCause } from "../model/game-state";
import { cardFor, playId, pokemonTargets, topCard } from "./helpers";

export function effectiveMaxHp(state: GameState, pokemon: PokemonInPlay): number {
  const printed = topCard(state, pokemon).hp;
  const stadium = state.stadium ? cardFor(state, state.stadium) : undefined;
  const gravityReduction = stadium?.category === "trainer" && stadium.effectProgramId === "stadium:gravity-mountain" && topCard(state, pokemon).stage === "stage2" ? 30 : 0;
  const tool = pokemon.tool ? cardFor(state, pokemon.tool) : undefined;
  const cape = tool?.category === "trainer" && tool.effectProgramId === "tool:hero-cape" ? 100 : 0;
  return Math.max(10, printed - gravityReduction + cape + (pokemon.hpModifier ?? 0));
}

export function poisonCheckupDamage(state: GameState, poisonedPlayerId: PlayerId, pokemon: PokemonInPlay): { baseCounters: number; bonusCounters: number; totalDamage: number } {
  const opponentId = poisonedPlayerId === "player-one" ? "player-two" : "player-one";
  const opponentActive = state.players[opponentId].active;
  const toxicSubjugation = opponentActive && topCard(state, opponentActive).abilities.some((ability) => ability.effectProgramId === "passive:toxic-subjugation");
  const baseCounters = Math.max(1, pokemon.poison?.countersPerCheckup ?? 1); const bonusCounters = toxicSubjugation ? 5 : 0;
  return { baseCounters, bonusCounters, totalDamage: (baseCounters + bonusCounters) * 10 };
}

export function attackDamageBonus(state: GameState, attacker: PokemonInPlay, targetsActive: boolean): { amount: number; sourceCardId?: string } {
  if (!targetsActive) return { amount: 0 };
  const ownerId = state.players["player-one"].active === attacker ? "player-one" : "player-two";
  const opponent = state.players[ownerId === "player-one" ? "player-two" : "player-one"];
  const target = opponent.active;
  let amount = 0;
  let sourceCardId: string | undefined;
  const attackerCard = topCard(state, attacker);
  if (target && attackerCard.abilities.some((ability) => ability.effectProgramId === "passive:compound-eyes") && topCard(state, target).abilities.length) amount += 50;
  if (attackerCard.pokemonType && (attackerCard.pokemonType === "grass" || attackerCard.pokemonType === "fire") && pokemonTargets(state.players[ownerId]).some((pokemon) => topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:sunny-day"))) amount += 20;
  if (attacker.tool) {
    const tool = cardFor(state, attacker.tool);
    if (tool.category === "trainer" && tool.effectProgramId === "tool:maximum-belt" && target && topCard(state, target).isPokemonEx) { amount += 50; sourceCardId = tool.id; }
    if (tool.category === "trainer" && tool.effectProgramId === "tool:binding-mochi" && attacker.specialConditions.includes("poisoned")) { amount += 40; sourceCardId = tool.id; }
  }
  const reduction = state.temporaryEffects
    .filter((effect) => effect.kind === "damage-reduction" && effect.playerId === ownerId && effect.pokemonId === playId(attacker) && effect.appliesOnPlayerTurn === state.players[ownerId].turnsTaken)
    .reduce((total, effect) => total + (effect.kind === "damage-reduction" ? effect.amount : 0), 0);
  if (reduction) amount -= reduction;
  amount += state.temporaryEffects
    .filter((effect) => effect.kind === "attack-damage-bonus" && effect.playerId === ownerId && effect.appliesOnPlayerTurn === state.players[ownerId].turnsTaken && (!effect.pokemonType || effect.pokemonType === attackerCard.pokemonType))
    .reduce((total, effect) => total + (effect.kind === "attack-damage-bonus" ? effect.amount : 0), 0);
  return { amount, sourceCardId };
}

export function modifiedPrizeValue(state: GameState, ownerId: PlayerId, pokemon: PokemonInPlay, cause: KnockOutCause, sourcePlayerId: PlayerId): { value: number; reduction: number } {
  const card = topCard(state, pokemon);
  // Mega Evolution ex cards are three-Prize Pokémon even when an older
  // catalogue snapshot did not carry an explicit prizeValue field.
  const printed = Math.max(1, (card.prizeValue ?? (card.isMega && card.isPokemonEx ? 3 : card.ruleBox === "multi-prize" ? 2 : 1)) + (pokemon.prizeValueModifier ?? 0));
  const hasPecharuntEx = pokemonTargets(state.players[ownerId]).some((candidate) => topCard(state, candidate).id === "sv6pt5-39");
  const ohNo = topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:oh-no-you-dont");
  const tool = pokemon.tool ? cardFor(state, pokemon.tool) : undefined;
  const lilliesPearl = tool?.category === "trainer" && tool.effectProgramId === "tool:lillies-pearl" && topCard(state, pokemon).name.toLowerCase().includes("lillie") && cause === "attack-damage";
  const reduction = (ohNo && hasPecharuntEx && cause === "attack-damage" && sourcePlayerId !== ownerId ? 1 : 0) + (lilliesPearl ? 1 : 0);
  return { value: Math.max(0, printed - reduction), reduction };
}
