import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { MissingEffectProgramError } from "../../engine/effects/errors";
import { startEffectProgram } from "../../engine/effects/program-runner";
import type { CardDefinition } from "../../engine/model/cards";
import type { GameState, PlayerState } from "../../engine/model/game-state";

const player = (id: "player-one" | "player-two"): PlayerState => ({ id, deckId: id, deck: [], hand: [], prizes: [], discard: [], active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, stadiumPlayedThisTurn: false, stadiumAbilityUsedThisTurn: false, retreatedThisTurn: false, turnsTaken: 1, mulligans: 0, prizesTaken: 0, abilityUsageByName: {} });
const basePokemon: CardDefinition = { id: "basic", name: "Basic", category: "pokemon", pokemonType: "colorless", stage: "basic", hp: 100, attacks: [], abilities: [], retreatCost: 0, implementationStatus: "complete" };
const academy: CardDefinition = { id: "academy", name: "Academy at Night", category: "trainer", subtype: "stadium", text: "Once during each player's turn, that player may put a card from their hand on top of their deck.", effectProgramId: "stadium:academy-at-night", implementationStatus: "complete" };
const fixture = (): GameState => ({ seed: 1, rngState: 1, players: { "player-one": player("player-one"), "player-two": player("player-two") }, startingPlayer: "player-one", activePlayerId: "player-one", turn: 2, phase: "main", pendingChoice: null, actionLog: [], actionHistory: [], events: [], result: null, detailedLogs: true, cardDefinitions: { basic: basePokemon, academy }, stadium: { instanceId: "academy-play", cardId: "academy" }, temporaryEffects: [], pendingKnockOutCause: null });

describe("final runtime hardening", () => {
  it("allows Academy at Night on nine separate turns without an invented lifetime cap", () => {
    let state = fixture();
    for (let turn = 0; turn < 9; turn += 1) {
      const card = { instanceId: `hand-${turn}`, cardId: "basic" };
      state.players["player-one"].hand = [card];
      const action = getLegalActions(state, "player-one").find((candidate) => candidate.type === "use-stadium");
      expect(action).toBeDefined();
      state = applyAction(state, action!);
      expect(state.players["player-one"].deck[0]).toEqual(card);
      state = { ...state, turn: state.turn + 1, phase: "main", pendingChoice: null, players: { ...state.players, "player-one": { ...state.players["player-one"], stadiumAbilityUsedThisTurn: false, turnsTaken: state.players["player-one"].turnsTaken + 1 } } };
    }
    expect(state.events.filter((event) => event.type === "stadium-ability-used")).toHaveLength(9);
  });

  it.each(["trainer:missing", "ability:missing", "attack:missing"])("propagates a missing %s program", (programId) => {
    const state = fixture();
    expect(() => startEffectProgram(state, { programId, actingPlayerId: "player-one", sourceCardId: "source-card", after: "resume-main" })).toThrow(MissingEffectProgramError);
  });
});
