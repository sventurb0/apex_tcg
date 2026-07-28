import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { startEffectProgram } from "../../engine/effects/program-runner";
import type { CardDefinition, CardInstance, PokemonInPlay } from "../../engine/model/cards";
import type { GameState, PlayerState } from "../../engine/model/game-state";

const card = (id: string, name: string, category: "pokemon" | "trainer" | "energy", extra: Record<string, unknown> = {}): CardDefinition => ({ id, name, category, implementationStatus: "complete", ...(category === "pokemon" ? { pokemonType: "colorless", stage: "basic", hp: 100, attacks: [], abilities: [], retreatCost: 1 } : {}), ...(category === "trainer" ? { subtype: "item", effectProgramId: id } : {}), ...(category === "energy" ? { energyType: "fire", basic: true } : {}), ...extra } as CardDefinition);
const instance = (cardId: string, suffix: string): CardInstance => ({ cardId, instanceId: `${cardId}-${suffix}` });
const pokemon = (cardId: string, suffix: string): PokemonInPlay => ({ stack: [instance(cardId, suffix)], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 1, evolvedThisTurn: false, abilityUsage: {} });
const player = (id: "player-one" | "player-two"): PlayerState => ({ id, deckId: id, deck: [], hand: [], prizes: [], discard: [], active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, stadiumPlayedThisTurn: false, stadiumAbilityUsedThisTurn: false, retreatedThisTurn: false, turnsTaken: 1, mulligans: 0, prizesTaken: 0, abilityUsageByName: {} });
function state(definitions: Record<string, CardDefinition>): GameState { return { seed: 1, rngState: 1, players: { "player-one": player("player-one"), "player-two": player("player-two") }, startingPlayer: "player-one", activePlayerId: "player-one", turn: 3, phase: "main", pendingChoice: null, actionLog: [], actionHistory: [], events: [], result: null, detailedLogs: true, cardDefinitions: definitions, stadium: null, temporaryEffects: [], pendingKnockOutCause: null }; }

describe("Play presentation and zone corrections", () => {
  it("puts Precious Trolley selections directly onto the Bench and explains the cap", () => {
    const definitions = { trolley: card("trolley", "Precious Trolley", "trainer", { effectProgramId: "trainer:precious-trolley" }), basic: card("basic", "Basic Pokémon", "pokemon") };
    const game = state(definitions); game.players["player-one"].deck = [instance("basic", "a"), instance("basic", "b"), instance("basic", "c")];
    startEffectProgram(game, { programId: "trainer:precious-trolley", actingPlayerId: "player-one", sourceCardId: "trolley", after: "resume-main" });
    const choice = game.pendingChoice; expect(choice?.type).toBe("effect-choice"); if (choice?.type !== "effect-choice") throw new Error("Expected Trolley choice"); expect(choice.instruction).toMatch(/eligible Basic Pokémon remain|open Bench spaces/);
    const select = getLegalActions(game, "player-one").find((action) => action.type === "select-card"); expect(select?.description).toContain("Basic Pokémon");
    const resolved = applyAction(applyAction(game, select!), getLegalActions(applyAction(game, select!), "player-one").find((action) => action.type === "confirm-choice")!);
    expect(resolved.players["player-one"].bench).toHaveLength(1); expect(resolved.players["player-one"].hand).toHaveLength(0); expect(resolved.players["player-one"].bench[0]!.stack[0]!.instanceId).toBe(choice.eligibleIds[0]); expect(resolved.events.some((event) => event.detail?.includes("deck-to-bench"))).toBe(true);
  });

  it("names opponent Boss's Orders targets and damage-allocation targets", () => {
    const definitions = { boss: card("boss", "Boss's Orders", "trainer", { effectProgramId: "trainer:boss-orders" }), dusk: card("dusk", "Dusknoir", "pokemon") };
    const game = state(definitions); game.players["player-two"].bench = [pokemon("dusk", "one"), pokemon("dusk", "two")];
    startEffectProgram(game, { programId: "trainer:boss-orders", actingPlayerId: "player-one", sourceCardId: "boss", after: "resume-main" });
    const actions = getLegalActions(game, "player-one"); expect(actions.filter((action) => action.type === "select-pokemon").map((action) => action.description)).toEqual(["Select Opponent's Bench 1 Dusknoir", "Select Opponent's Bench 2 Dusknoir"]);
  });
});
