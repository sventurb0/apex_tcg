import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "../../engine";
import { action, applyWhere, freshGame, moveCardToHand, setupGame } from "../helpers";

function attachAndAttack(state: ReturnType<typeof freshGame>, playerId: "player-one" | "player-two", energyId: string) {
  state.players[playerId].turnsTaken = Math.max(2, state.players[playerId].turnsTaken);
  moveCardToHand(state, playerId, energyId);
  state = applyWhere(state, playerId, (candidate) => candidate.type === "attach-energy" && candidate.targetId === state.players[playerId].active?.stack.at(-1)?.instanceId);
  return applyWhere(state, playerId, (candidate) => candidate.type === "attack");
}

describe("combat", () => {
  it("validates attack costs and applies Resistance", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one" }), "demo-001", "demo-011");
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "attack")).toBe(false);
    state = attachAndAttack(state, "player-one", "demo-e-fire");
    expect(state.players["player-two"].active?.damage).toBe(0);
  });

  it("applies Weakness", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-two" }), "demo-001", "demo-011");
    state = attachAndAttack(state, "player-two", "demo-e-water");
    expect(state.players["player-one"].active?.damage).toBe(40);
  });

  it("pays retreat cost and switches Active creatures", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one" }));
    moveCardToHand(state, "player-one", "demo-003");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "bench-basic");
    moveCardToHand(state, "player-one", "demo-e-fire");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "attach-energy" && candidate.targetId === state.players["player-one"].active?.stack.at(-1)?.instanceId);
    const oldActive = state.players["player-one"].active!.stack[0]!.cardId;
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "retreat");
    expect(state.players["player-one"].active!.stack[0]!.cardId).not.toBe(oldActive);
    expect(state.players["player-one"].discard.some((card) => card.cardId === "demo-e-fire")).toBe(true);
    expect(getLegalActions(state, "player-one").some((candidate) => candidate.type === "retreat")).toBe(false);
  });

  it("handles Knock Outs, Prize choice, and promotion", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one", deckOne: "demo-cinder", deckTwo: "demo-cinder" }), "demo-001", "demo-001");
    moveCardToHand(state, "player-two", "demo-003");
    const benched = state.players["player-two"].hand.find((card) => card.cardId === "demo-003")!;
    state.players["player-two"].hand = state.players["player-two"].hand.filter((card) => card !== benched);
    state.players["player-two"].bench.push({ stack: [benched], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} });
    state.players["player-two"].active!.damage = 60;
    moveCardToHand(state, "player-one", "demo-e-fire");
    state.players["player-one"].turnsTaken = 2;
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "attach-energy");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "attack");
    expect(state.pendingChoice?.type).toBe("choose-prize");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "choose-prize");
    expect(state.pendingChoice?.type).toBe("promote");
    state = applyWhere(state, "player-two", (candidate) => candidate.type === "select-active");
    expect(state.players["player-two"].active).not.toBeNull();
  });

  it("wins when the opponent has no creature in play and by final Prize", () => {
    let noPokemon = setupGame(freshGame({ startingPlayer: "player-one", deckOne: "demo-cinder", deckTwo: "demo-cinder" }), "demo-001", "demo-001");
    noPokemon.players["player-two"].active!.damage = 60;
    moveCardToHand(noPokemon, "player-one", "demo-e-fire");
    noPokemon.players["player-one"].turnsTaken = 2;
    noPokemon = applyWhere(noPokemon, "player-one", (candidate) => candidate.type === "attach-energy");
    noPokemon = applyWhere(noPokemon, "player-one", (candidate) => candidate.type === "attack");
    expect(noPokemon.result).toMatchObject({ winnerId: "player-one", reason: "no-pokemon" });

    let prizes = setupGame(freshGame({ startingPlayer: "player-one", deckOne: "demo-cinder", deckTwo: "demo-cinder" }), "demo-001", "demo-001");
    moveCardToHand(prizes, "player-two", "demo-003");
    const benchCard = prizes.players["player-two"].hand.pop()!;
    prizes.players["player-two"].bench.push({ stack: [benchCard], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} });
    prizes.players["player-one"].prizes = [prizes.players["player-one"].prizes[0]!];
    prizes.players["player-two"].active!.damage = 60;
    moveCardToHand(prizes, "player-one", "demo-e-fire");
    prizes.players["player-one"].turnsTaken = 2;
    prizes = applyAction(prizes, action(prizes, "player-one", (candidate) => candidate.type === "attach-energy"));
    prizes = applyWhere(prizes, "player-one", (candidate) => candidate.type === "attack");
    prizes = applyWhere(prizes, "player-one", (candidate) => candidate.type === "choose-prize");
    expect(prizes.result).toMatchObject({ winnerId: "player-one", reason: "prizes" });
  });

  it("takes the printed number of Prize cards for a multi-Prize Pokémon", () => {
    let state = setupGame(freshGame({ startingPlayer: "player-one", deckOne: "demo-cinder", deckTwo: "demo-cinder" }), "demo-001", "demo-001");
    moveCardToHand(state, "player-two", "demo-003");
    const benchCard = state.players["player-two"].hand.find((card) => card.cardId === "demo-003")!;
    state.players["player-two"].hand = state.players["player-two"].hand.filter((card) => card !== benchCard);
    state.players["player-two"].bench.push({ stack: [benchCard], damage: 0, attachedEnergy: [], specialConditions: [], enteredPlayTurn: 0, evolvedThisTurn: false, abilityUsage: {} });
    state.cardDefinitions["demo-001"] = { ...state.cardDefinitions["demo-001"]!, prizeValue: 2 } as typeof state.cardDefinitions[string];
    state.players["player-two"].active!.damage = 60;
    moveCardToHand(state, "player-one", "demo-e-fire");
    state.players["player-one"].turnsTaken = 2;
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "attach-energy");
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "attack");
    expect(state.pendingChoice).toMatchObject({ type: "choose-prize", claims: [{ remaining: 2 }] });
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "choose-prize");
    expect(state.pendingChoice).toMatchObject({ type: "choose-prize", claims: [{ remaining: 1 }] });
    state = applyWhere(state, "player-one", (candidate) => candidate.type === "choose-prize");
    expect(state.players["player-one"].prizes).toHaveLength(4);
    expect(state.pendingChoice?.type).toBe("promote");
  });
});
