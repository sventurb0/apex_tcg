// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLegalActions } from "../../engine";
import type { GameAction } from "../../engine/model/actions";
import { PlayView, SimulationLab } from "../../src/app/App";
import { GameBoard } from "../../src/components/board/GameBoard";
import type { DeckManifest } from "../../src/data/decks/types";
import { loadSavedDecks, saveDeck } from "../../src/features/deck-builder/storage";
import { forceMain, freshSkeledirgeGame, inPlay, instance, skeledirgeIndex, skeledirgeManifest } from "../fixtures/skeledirgeRuntime";

const noOp = () => undefined;

function activeBoardState() {
  const state = forceMain(freshSkeledirgeGame(311));
  state.players["player-one"].active = inPlay("swsh12-16", "player-tsareena");
  state.players["player-one"].bench = [inPlay("sv4-26", "player-charcadet")];
  state.players["player-one"].hand = [instance("sve-2", "fire-a"), instance("sve-2", "fire-b"), instance("sv4pt5-80", "iono")];
  state.players["player-two"].active = inPlay("sv2-35", "opponent-fuecoco");
  return state;
}

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe("compact Play interface", () => {
  it("dispatches the first deterministic atomic action from a grouped button", () => {
    const state = activeBoardState();
    const actions = getLegalActions(state, "player-one");
    const onAction = vi.fn();
    render(<GameBoard state={state} index={skeledirgeIndex} actions={actions} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Attach Basic Fire Energy to Radiant Tsareena ×2" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: "attach-energy", cardInstanceId: "fire-a-sve-2" }));
  });

  it("uses compact battle visuals and opens complete printed details on click", () => {
    const state = activeBoardState();
    render(<GameBoard state={state} index={skeledirgeIndex} actions={[]} onAction={noOp} />);
    expect(screen.getByTestId("compact-game-board")).toBeInTheDocument();
    expect(document.querySelector(".game-card.printed-card--full")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open full details for Radiant Tsareena" }));
    expect(screen.getByRole("dialog", { name: "Radiant Tsareena" })).toBeInTheDocument();
    expect(screen.getByText("Full printed card details")).toBeInTheDocument();
  });

  it("collapses the action log by default", () => {
    const state = activeBoardState();
    render(<GameBoard state={state} index={skeledirgeIndex} actions={[]} onAction={noOp} />);
    const details = screen.getByText(/Details \/ Log/).closest("details");
    expect(details).not.toHaveAttribute("open");
  });

  it("selects the first exact eligible instance from a quantity-aware pending choice", () => {
    const state = activeBoardState();
    const eligible = state.players["player-one"].hand.filter((card) => card.cardId === "sve-2").map((card) => card.instanceId);
    state.phase = "choice";
    state.pendingChoice = { type: "effect-choice", choiceId: "pick-energy", playerId: "player-one", selectionKind: "card", min: 0, max: 2, eligibleIds: eligible, selectedIds: [], optional: true, instruction: "Choose Fire Energy", sourceCardId: "test", sourceEffectId: "test-choice", continuation: { programId: "test", step: 1, actingPlayerId: "player-one", sourceCardId: "test", variables: {}, after: "resume-main" } };
    const actions: GameAction[] = eligible.map((selectionId) => ({ id: `select-${selectionId}`, type: "select-card", playerId: "player-one", selectionId, description: "Select Basic Fire Energy" }));
    const onAction = vi.fn();
    render(<GameBoard state={state} index={skeledirgeIndex} actions={actions} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Select one Basic Fire Energy" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: "select-card", selectionId: "fire-a-sve-2" }));
  });

  it("launches a one-deck mirror and removes the large Play heading from the active view", () => {
    render(<PlayView decks={[skeledirgeManifest]} index={skeledirgeIndex} preferredDeckId={skeledirgeManifest.id} onEditDeck={noOp} onDevelopment={noOp} onGameActiveChange={noOp} />);
    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(screen.queryByRole("heading", { level: 1, name: "Play" })).not.toBeInTheDocument();
    expect(screen.getByTestId("compact-game-board")).toBeInTheDocument();
    expect(screen.getAllByText("Skeledirge ex / Armarouge")).toHaveLength(2);
  });
});

describe("saved and current deck launch visibility", () => {
  it("lists, selects, and launches a newly saved simulation-ready deck", () => {
    const saved: DeckManifest = { ...structuredClone(skeledirgeManifest), id: "saved-fire", name: "My Saved Fire Deck", source: "saved" };
    saveDeck(saved);
    const decks = [skeledirgeManifest, ...loadSavedDecks()];
    render(<PlayView decks={decks} index={skeledirgeIndex} preferredDeckId={saved.id} onEditDeck={noOp} onDevelopment={noOp} onGameActiveChange={noOp} />);
    const subject = screen.getByLabelText("Your deck");
    expect(within(subject).getByRole("option", { name: "My Saved Fire Deck" })).toBeEnabled();
    expect(subject).toHaveValue(saved.id);
    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(screen.getByTestId("compact-game-board")).toBeInTheDocument();
  });

  it("keeps a non-ready saved deck visible with an unavailable reason", () => {
    const unsupported: DeckManifest = { ...structuredClone(skeledirgeManifest), id: "saved-short", name: "My Short Deck", source: "saved", entries: skeledirgeManifest.entries.map((entry) => ({ ...entry })).slice(0, -1) };
    saveDeck(unsupported);
    render(<PlayView decks={[skeledirgeManifest, ...loadSavedDecks()]} index={skeledirgeIndex} preferredDeckId={unsupported.id} onEditDeck={noOp} onDevelopment={noOp} onGameActiveChange={noOp} />);
    const subject = screen.getByLabelText("Your deck");
    const option = within(subject).getByRole("option", { name: /My Short Deck/ });
    expect(option).toBeDisabled();
    expect(subject).toHaveValue(unsupported.id);
    expect(screen.getByText(/is visible, but unavailable to launch/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
  });

  it("keeps the exact current unsaved editor deck selected on Play", () => {
    const current: DeckManifest = { ...structuredClone(skeledirgeManifest), id: "editor-current", name: "Unsaved Editor Deck", source: "saved", entries: [] };
    render(<PlayView decks={[skeledirgeManifest, current]} index={skeledirgeIndex} preferredDeckId={current.id} onEditDeck={noOp} onDevelopment={noOp} onGameActiveChange={noOp} />);
    const subject = screen.getByLabelText("Your deck");
    expect(subject).toHaveValue(current.id);
    expect(within(subject).getByRole("option", { name: /Unsaved Editor Deck/ })).toBeDisabled();
  });

  it("shows ready and unavailable saved decks in Simulation Lab", () => {
    const saved: DeckManifest = { ...structuredClone(skeledirgeManifest), id: "sim-ready", name: "Saved Simulation Deck", source: "saved" };
    const short: DeckManifest = { ...structuredClone(saved), id: "sim-short", name: "Saved Unsupported Deck", entries: [] };
    render(<SimulationLab decks={[skeledirgeManifest, saved, short]} index={skeledirgeIndex} preferredDeckId={saved.id} onEditDeck={noOp} onDevelopment={noOp} />);
    expect(screen.getByRole("option", { name: "Saved Simulation Deck" })).toBeEnabled();
    expect(screen.getByRole("option", { name: /Saved Unsupported Deck/ })).toBeDisabled();
    expect(screen.getByLabelText("Subject deck")).toHaveValue(saved.id);
  });
});
