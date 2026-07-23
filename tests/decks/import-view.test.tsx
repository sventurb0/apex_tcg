// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckManifest } from "../../src/data/decks/types";
import { loadSavedDecks } from "../../src/features/deck-builder/storage";
import { DeckImportView } from "../../src/features/deck-import/DeckImportView";
import { testCatalogueIndex } from "../fixtures/catalogue";

describe("DeckImportView acceptance workflow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("saves the four-line screenshot example and hands all 20 cards to Deck Builder", () => {
    const onSaved = vi.fn();
    const onEdit = vi.fn<(deck: DeckManifest) => void>();
    render(<DeckImportView index={testCatalogueIndex} onSaved={onSaved} onEdit={onEdit} />);

    expect(screen.getByText("4/4 lines")).toBeTruthy();
    expect(screen.getByText("20 copies · 0 unknown · 0 ambiguous")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save and edit imported deck" });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);

    expect(onSaved).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    const deck = onEdit.mock.calls[0]![0];
    expect(deck.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(20);
    expect(new Map(deck.entries.map((entry) => [entry.cardId, entry.count]))).toEqual(new Map([["sv2-35", 4], ["sv2-37", 2], ["sv1-194", 2], ["sve-2", 12]]));
    expect(loadSavedDecks()[0]?.entries).toEqual(deck.entries);
  });
});
