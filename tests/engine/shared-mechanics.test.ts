import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance, PokemonInPlay } from "../../engine/model/cards";
import type { GameState, PlayerState } from "../../engine/model/game-state";
import { benchCapacity, canUseAttackCondition, copiedAttacks, discardAttachedEnergy, placeDistributedDamageCounters, putCardOnTop, reorderTopDeck } from "../../engine/rules/shared-mechanics";

const pokemon = (id: string, cardId: string): PokemonInPlay => ({ stack: [{ instanceId: id, cardId }], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 1, evolvedThisTurn: false, abilityUsage: {} });
const player = (id: "player-one" | "player-two"): PlayerState => ({ id, deckId: id, deck: [], hand: [], prizes: [], discard: [], active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, stadiumPlayedThisTurn: false, stadiumAbilityUsedThisTurn: false, retreatedThisTurn: false, turnsTaken: 1, mulligans: 0, prizesTaken: 0, abilityUsageByName: {} });
function state(definitions: Record<string, CardDefinition>): GameState { return { seed: 1, rngState: 1, players: { "player-one": player("player-one"), "player-two": player("player-two") }, startingPlayer: "player-one", activePlayerId: "player-one", turn: 1, phase: "main", pendingChoice: null, actionLog: [], actionHistory: [], events: [], result: null, detailedLogs: true, cardDefinitions: definitions, stadium: null, temporaryEffects: [], pendingKnockOutCause: null }; }
const basic = (id: string, name: string, type: "water" | "colorless" = "colorless"): CardDefinition => ({ id, name, category: "pokemon", pokemonType: type, stage: "basic", hp: 100, attacks: [{ id: `${id}-attack`, name: "Hit", cost: { colorless: 1 }, damage: { kind: "fixed", amount: 10, printed: "10" } }], abilities: [], retreatCost: 1, implementationStatus: "complete" });
const energy = (id: string): CardInstance => ({ instanceId: `${id}-instance`, cardId: id });

describe("shared runtime mechanics", () => {
  it("orders the top deck without exposing or changing the remainder", () => {
    const defs = { a: basic("a", "A"), b: basic("b", "B"), c: basic("c", "C") };
    const game = state(defs); game.players["player-one"].deck = [{ instanceId: "a", cardId: "a" }, { instanceId: "b", cardId: "b" }, { instanceId: "c", cardId: "c" }];
    expect(reorderTopDeck(game, "player-one", ["b", "a"])).toBe(true);
    expect(game.players["player-one"].deck.map((card) => card.instanceId)).toEqual(["b", "a", "c"]);
    game.players["player-one"].hand.push({ instanceId: "c", cardId: "c" }); expect(putCardOnTop(game, "player-one", "c")).toBe(true); expect(game.players["player-one"].deck[0]?.instanceId).toBe("c");
  });

  it("distributes counters and discards arbitrary attached Energy", () => {
    const defs = { p: basic("p", "P"), q: basic("q", "Q"), w: { id: "w", name: "Water", category: "energy", energyType: "water", basic: true, implementationStatus: "complete" } as CardDefinition };
    const game = state(defs); const target = pokemon("q-play", "q"); game.players["player-two"].bench.push(target); const source = pokemon("p-play", "p"); source.attachedEnergy.push(energy("w")); game.players["player-one"].active = source;
    expect(placeDistributedDamageCounters(game, "player-one", "player-two", [{ targetId: "q-play", counters: 3 }], "p")).toBe(3); expect(target.damage).toBe(30);
    expect(discardAttachedEnergy(game, "player-one", "p-play", 1)).toHaveLength(1); expect(game.players["player-one"].discard).toHaveLength(1);
  });

  it("recognises conditional attacks and visible copied attacks", () => {
    const attacker = basic("p", "P"); const source = basic("q", "Q"); if (attacker.category !== "pokemon" || source.category !== "pokemon") throw new Error("Expected Pokémon fixtures"); source.attacks[0] = { ...source.attacks[0]!, id: "q-hit", name: "Copied Hit" };
    const defs = { p: attacker, q: source, w: { id: "w", name: "Water", category: "energy", energyType: "water", basic: true, implementationStatus: "complete" } as CardDefinition }; const game = state(defs); game.players["player-one"].active = pokemon("p-play", "p"); game.players["player-two"].active = pokemon("q-play", "q"); game.players["player-two"].active!.damage = 10; game.players["player-one"].active!.attachedEnergy.push(energy("w"));
    expect(canUseAttackCondition(game, "player-one", game.players["player-one"].active!, { kind: "opponent-damaged" })).toBe(true); expect(copiedAttacks(game, [game.players["player-two"].active!])[0]?.attack.name).toBe("Copied Hit");
  });

  it("expands the Bench only with an exact Tera Pokémon", () => {
    const tera: CardDefinition = { ...basic("t", "Tera Support"), traits: ["tera"] }; const stadium: CardDefinition = { id: "area", name: "Area Zero", category: "trainer", subtype: "stadium", text: "", effectProgramId: "stadium:area-zero-underdepths", implementationStatus: "complete" }; const game = state({ t: tera, area: stadium }); game.stadium = { instanceId: "area-play", cardId: "area" }; game.players["player-one"].bench.push(pokemon("t-play", "t")); expect(benchCapacity(game, "player-one")).toBe(8);
  });
});
