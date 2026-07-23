// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { validateCatalogue, type CompactCatalogue } from "../../scripts/card-data-utils";
import { CardDetailsDialog, CardImage } from "../../src/components/cards";
import { GameBoard } from "../../src/components/board/GameBoard";
import { createCatalogueIndex, type PokemonCardCatalogue } from "../../src/data/pokemon";
import { resetFailedCardImagesForTests, selectCardImageUrl } from "../../src/data/pokemon/card-image-urls";
import { DeckBuilder } from "../../src/features/deck-builder/DeckBuilder";
import { forceTeamRocketMain, freshTeamRocketGame, teamRocketIndex, trInPlay, trInstance } from "../fixtures/teamRocketRuntime";

const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const acceptanceIds = ["sv2-35", "sv2-37", "sv1-194", "sve-2"];
const card = catalogue.cards.find((item) => item.id === "sv2-37")!;

afterEach(() => {
  cleanup();
  resetFailedCardImagesForTests();
});

describe("exact card image metadata and presentation", () => {
  it("preserves both HTTPS source sizes and exact identity for every acceptance printing", () => { for (const id of acceptanceIds) { const exact = catalogue.cards.find((item) => item.id === id)!; expect(exact.images?.small).toMatch(/^https:\/\/images\.pokemontcg\.io\//); expect(exact.images?.large).toMatch(/^https:\/\/images\.pokemontcg\.io\//); expect(exact.id).toBe(id); expect(exact.name).toBeTruthy(); } });
  it("accepts missing images but rejects non-HTTPS or filesystem image metadata", () => { const base: CompactCatalogue = { version: 1, generatedAt: "test", source: { repository: "test", commit: "test" }, sets: [], cards: [{ id: "x", name: "Test", setId: "x", setCode: "X", collectorNumber: "1", supertype: "Trainer", subtypes: [] }] }; expect(validateCatalogue(base)).toEqual([]); expect(validateCatalogue({ ...base, cards: [{ ...base.cards[0], images: { small: "http://bad.test/a.png", large: "C:\\bad.png" } }] }).join(" ")).toMatch(/HTTPS|filesystem/); });
  it("selects small and large URLs, supplies concise alt text, and lazy-loads by default", () => { render(<CardImage card={card} size="thumbnail" />); const image = screen.getByRole("img", { name: `${card.name}, ${card.setName} ${card.collectorNumber}` }); expect(image).toHaveAttribute("src", card.images!.small); expect(image).toHaveAttribute("loading", "lazy"); expect(selectCardImageUrl(card, "large")).toBe(card.images!.large); });
  it("eager-loads priority details and keeps complete searchable text beside the image", () => { render(<CardDetailsDialog card={card} onClose={() => undefined} />); const dialog = screen.getByRole("dialog"); const image = within(dialog).getByRole("img", { name: `${card.name}, ${card.setName} ${card.collectorNumber}` }); expect(image).toHaveAttribute("src", card.images!.large); expect(image).toHaveAttribute("loading", "eager"); expect(within(dialog).getByText("Burning Voice")).toBeInTheDocument(); expect(within(dialog).getAllByText(/PAL 37/).length).toBeGreaterThan(0); });
  it("replaces failed and unapproved images with a stable text fallback", () => { resetFailedCardImagesForTests(); const view = render(<CardImage card={card} />); fireEvent.error(screen.getByRole("img")); expect(screen.getByTestId("card-image-fallback")).toHaveTextContent(card.name); view.unmount(); const malicious = { ...card, images: { small: "https://evil.example/card.png", large: "https://evil.example/card-large.png" } }; render(<CardImage card={malicious} />); expect(screen.queryByRole("img")).not.toBeInTheDocument(); expect(screen.getByTestId("card-image-fallback")).toBeInTheDocument(); });
  it("renders hybrid Deck Builder results and opens details from the deck-row thumbnail", () => { const one: PokemonCardCatalogue = { ...catalogue, cards: [card], sets: catalogue.sets.filter((set) => set.id === card.setId) }; const index = createCatalogueIndex(one.cards); render(<DeckBuilder catalogue={one} index={index} initialDeck={{ id: "image-test", name: "Images", description: "", format: "custom", source: "saved", entries: [{ cardId: card.id, count: 1 }] }} onSaved={() => undefined} onPlay={() => undefined} onSimulate={() => undefined} />); expect(document.querySelector(".catalogue-hybrid-tile img")).toHaveAttribute("src", card.images!.small); fireEvent.click(document.querySelector(".deck-row .card-image-button")!); expect(screen.getByRole("dialog")).toHaveTextContent("Burning Voice"); });
  it("shows visible card images with state overlays while opponent hand remains hidden and grouped hand IDs request one thumbnail", () => { const state = forceTeamRocketMain(freshTeamRocketGame()); state.players["player-one"].active = trInPlay("sv10-119", "active"); state.players["player-one"].active!.damage = 40; state.players["player-one"].hand = [trInstance("sv10-117", "hand-a"), trInstance("sv10-117", "hand-b")]; state.players["player-two"].active = trInPlay("sv10-117", "opponent-active"); state.players["player-two"].hand = [trInstance("sv10-119", "hidden")]; localStorage.setItem("tcg-decklab-game-card-display", "images"); render(<GameBoard state={state} index={teamRocketIndex} actions={[]} onAction={() => undefined} />); const own = document.querySelector(".player-field.player")!; expect(within(own as HTMLElement).getByText(/40 damage/)).toBeInTheDocument(); expect(own.querySelectorAll(`.hand-zone img[src="${teamRocketIndex.byId.get("sv10-117")!.images!.small}"]`)).toHaveLength(1); expect(document.querySelector(".hidden-hand img")).toBeNull(); });
});
