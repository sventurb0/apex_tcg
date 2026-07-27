import type { AttackDamage, AttackDefinition, CardType, PokemonCard, PokemonInPlay } from "../model/cards";
import type { GameState } from "../model/game-state";
import type { PlayerId } from "../model/actions";
import { cardFor, playId, topCard } from "./helpers";
import { effectiveMaxHp } from "./modifiers";
import { nextRandom } from "../random/seeded-rng";
import { pokemonTargets } from "./helpers";

export function canPayAttackCost(state: GameState, pokemon: PokemonInPlay, attack: AttackDefinition): boolean {
  const energy = pokemon.attachedEnergy.map((instance) => cardFor(state, instance)).filter((card) => card.category === "energy");
  let totals: Partial<Record<CardType, number>>[] = [{}];
  for (const card of energy) { const options = card.supplyOptions?.length ? card.supplyOptions : [{ [card.energyType]: 1 }]; totals = totals.flatMap((total) => options.map((option) => { const combined = { ...total }; for (const [type, units] of Object.entries(option) as [CardType, number][]) combined[type] = (combined[type] ?? 0) + units; return combined; })); }
  const effectiveCost = { ...attack.cost };
  if (attack.name === "Blood Moon" && topCard(state, pokemon).abilities.some((ability) => ability.effectProgramId === "passive:seasoned-skill")) effectiveCost.colorless = Math.max(0, (effectiveCost.colorless ?? 0) - state.players[pokemon === state.players["player-one"].active || state.players["player-one"].bench.includes(pokemon) ? "player-two" : "player-one"].prizesTaken);
  const ownerId: PlayerId = state.players["player-one"].active === pokemon || state.players["player-one"].bench.includes(pokemon) ? "player-one" : "player-two";
  const extraColorless = state.temporaryEffects.filter((effect) => effect.kind === "attack-cost-increase" && effect.playerId === ownerId && effect.pokemonId === playId(pokemon) && effect.appliesOnPlayerTurn === state.players[ownerId].turnsTaken).reduce((sum, effect) => sum + (effect.kind === "attack-cost-increase" ? effect.amount : 0), 0);
  if (extraColorless) effectiveCost.colorless = (effectiveCost.colorless ?? 0) + extraColorless;
  return totals.some((available) => { let typedUsed = 0; for (const [type, required] of Object.entries(effectiveCost) as [CardType, number][]) { if (type === "colorless") continue; if ((available[type] ?? 0) < required) return false; typedUsed += required; } const total = Object.values(available).reduce((sum, value) => sum + (value ?? 0), 0); return total - typedUsed >= (effectiveCost.colorless ?? 0); });
}

export function resolveBaseDamage(damage: AttackDamage, attacker: PokemonInPlay, state?: GameState, attackingPlayerId?: PlayerId): number {
  if (damage.kind === "none") return 0;
  if (damage.kind === "fixed") return damage.amount;
  if (damage.resolverId === "burning-voice-damage") return Math.max(0, 270 - attacker.damage);
  if (damage.resolverId === "chain-crazed-damage") return 130 + (attacker.specialConditions.includes("poisoned") ? 130 : 0);
  if (damage.resolverId === "irritated-outburst-damage" && state && attackingPlayerId) { const opponentId = attackingPlayerId === "player-one" ? "player-two" : "player-one"; return 60 * state.players[opponentId].prizesTaken; }
  if (damage.resolverId === "horn-rend-damage" && state && attackingPlayerId) { const opponentId = attackingPlayerId === "player-one" ? "player-two" : "player-one"; return state.players[opponentId].active && state.players[opponentId].active.damage > 0 ? 120 : 60; }
  if (damage.resolverId === "rapid-fire-combo-damage" && state) { let total = 200; do { const flip = nextRandom(state.rngState); state.rngState = flip.state; if (flip.value >= .5) break; total += 50; } while (total < 2_000); return total; }
  if (damage.resolverId === "passimian-basic-damage" && state && attackingPlayerId) { const basic = pokemonTargets(state.players[attackingPlayerId]).filter((pokemon) => pokemon.stack.length && state.cardDefinitions[pokemon.stack.at(-1)!.cardId]?.category === "pokemon" && state.cardDefinitions[pokemon.stack.at(-1)!.cardId]!.category === "pokemon" && (state.cardDefinitions[pokemon.stack.at(-1)!.cardId] as PokemonCard).stage === "basic").length; return basic * 20; }
  if (damage.resolverId === "moltres-fighting-wings-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return 20 + (opponent.active && topCard(state, opponent.active).isPokemonEx ? 90 : 0); }
  if (damage.resolverId === "rabsca-psychic-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return 10 + (opponent.active?.attachedEnergy.length ?? 0) * 30; }
  if (damage.resolverId === "darmanitan-back-draft-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return opponent.discard.filter((card) => { const definition = cardFor(state, card); return definition.category === "energy" && definition.basic; }).length * 30; }
  if (damage.resolverId === "reshiram-powerful-rage-damage") return Math.floor(attacker.damage / 10) * 20;
  if (damage.resolverId === "hoothoot-triple-stab-damage" && state) { let heads = 0; for (let flip = 0; flip < 3; flip += 1) { const result = nextRandom(state.rngState); state.rngState = result.state; if (result.value < .5) heads += 1; } return heads * 10; }
  if (damage.resolverId === "combusken-double-kick-damage" && state) { let heads = 0; for (let flip = 0; flip < 2; flip += 1) { const result = nextRandom(state.rngState); state.rngState = result.state; if (result.value < .5) heads += 1; } return heads * 40; }
  if (damage.resolverId === "chi-yu-ground-melter-damage" && state) return 60 + (state.stadium ? 60 : 0);
  if (damage.resolverId === "koraidon-orichalcum-fang-damage" && state && attackingPlayerId) { const knockedOutLastTurn = state.events.some((event) => event.type === "pokemon-knocked-out" && event.targetPlayerId === attackingPlayerId && event.turn === state.turn - 1); return 50 + (knockedOutLastTurn ? 120 : 0); }
  if (damage.resolverId === "quick-attack-damage" && state) { const flip = nextRandom(state.rngState); state.rngState = flip.state; return 10 + (flip.value < .5 ? 20 : 0); }
  if (damage.resolverId === "tenacious-tail-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return 60 * pokemonTargets(opponent).filter((pokemon) => topCard(state, pokemon).isPokemonEx).length; }
  if (damage.resolverId === "metallic-hammer-damage") return 150;
  if (damage.resolverId === "comet-punch-damage" && state) { let heads = 0; for (let flip = 0; flip < 4; flip += 1) { const result = nextRandom(state.rngState); state.rngState = result.state; if (result.value < .5) heads += 1; } return heads * 30; }
  if (damage.resolverId === "wicked-impact-damage" && state && attackingPlayerId) return 120 + (state.events.some((event) => event.type === "card-played" && event.playerId === attackingPlayerId && event.turn === state.turn && event.sourceCardId?.startsWith("sv10-")) ? 100 : 0);
  if (damage.resolverId === "steel-burst-damage" && state) return attacker.attachedEnergy.length * 50;
  if (damage.resolverId === "jewel-breaker-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return opponent.active && topCard(state, opponent.active).traits?.includes("tera") ? 330 : 100; }
  if (damage.resolverId === "ninja-spinner-damage") return 120;
  if (damage.resolverId === "shocking-web-damage" && attacker.attachedEnergy.length > 0) return 130;
  if (damage.resolverId === "alakazam-psychic-damage" && state && attackingPlayerId) { const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"]; return 10 + (opponent.active?.attachedEnergy.length ?? 0) * 50; }
  // Bellowing Thunder resolves its selected physical Energy cards in the
  // effect continuation; the printed attack damage is therefore deferred.
  if (damage.resolverId === "raging-bolt-damage") return 0;
  if (damage.resolverId === "rocket-rush-damage" && state && attackingPlayerId) { const player = state.players[attackingPlayerId]; const count = [player.active, ...player.bench].filter((pokemon): pokemon is PokemonInPlay => Boolean(pokemon)).filter((pokemon) => topCard(state, pokemon).traits?.includes("team-rocket")).length; return 30 * count; }
  if (damage.resolverId === "cosmic-beam-damage" && state && attackingPlayerId) { const player = state.players[attackingPlayerId]; return player.bench.some((pokemon) => topCard(state, pokemon).name === "Lunatone") ? 70 : 0; }
  if (damage.resolverId === "erasure-ball-damage") return 160;
  if (damage.resolverId === "dark-frost-damage" && state && attackingPlayerId) { const source = attacker.attachedEnergy.some((energy) => cardFor(state, energy).id === "sv10-182"); return source ? 120 : 60; }
  if (damage.resolverId === "full-moon-rondo-damage" && state && attackingPlayerId) { const own = state.players[attackingPlayerId].bench.length; const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"].bench.length; return 20 + 20 * (own + opponent); }
  if (damage.resolverId === "teal-leaf-shower-damage" && state && attackingPlayerId) {
    const opponent = state.players[attackingPlayerId === "player-one" ? "player-two" : "player-one"];
    return 30 + attacker.attachedEnergy.length * 30 + (opponent.active?.attachedEnergy.length ?? 0) * 30;
  }
  if (damage.resolverId === "syrup-storm-damage" && state && attackingPlayerId) {
    const own = state.players[attackingPlayerId];
    const grass = [...(own.active ? [own.active] : []), ...own.bench].reduce((sum, pokemon) => sum + pokemon.attachedEnergy.filter((energy) => { const definition = cardFor(state, energy); return definition.category === "energy" && definition.energyType === "grass"; }).length, 0);
    return 30 + grass * 30;
  }
  if (damage.resolverId === "dipplin-wave-damage" && state && attackingPlayerId) return 20 * state.players[attackingPlayerId].bench.length;
  if (damage.resolverId === "applin-tumbling-damage") return 10;
  throw new Error(`Unknown attack damage resolver: ${damage.resolverId}`);
}

export function calculateDamage(attacker: PokemonCard, defender: PokemonCard, baseDamage: number): number {
  let damage = baseDamage;
  if (defender.weakness?.type === attacker.pokemonType) damage *= defender.weakness.multiplier;
  if (defender.resistance?.type === attacker.pokemonType) damage -= defender.resistance.amount;
  return Math.max(0, damage);
}

export function isKnockedOut(state: GameState, pokemon: PokemonInPlay): boolean { return pokemon.damage >= effectiveMaxHp(state, pokemon); }
