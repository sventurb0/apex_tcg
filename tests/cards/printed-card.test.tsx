// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardDetailsDialog, PrintedCard } from "../../src/components/cards";
import { realCardFixtures } from "../fixtures/realCards";
import { basicEnergyPresentationCard, fightingPresentationCard, firePresentationCard, itemPresentationCard, specialEnergyPresentationCard, stadiumPresentationCard, supporterPresentationCard, toolPresentationCard, waterPresentationCard } from "../fixtures/presentationCards";

afterEach(cleanup);

describe("shared printed-card presentation", () => {
  it("applies distinct central themes for Fire, Fighting, and Water", () => {
    const { rerender, container } = render(<PrintedCard card={firePresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("fire");
    rerender(<PrintedCard card={fightingPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("fighting");
    rerender(<PrintedCard card={waterPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("water");
  });

  it("themes every requested Trainer subtype independently", () => {
    const { rerender, container } = render(<PrintedCard card={itemPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("trainer-item");
    rerender(<PrintedCard card={supporterPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("trainer-supporter");
    rerender(<PrintedCard card={stadiumPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("trainer-stadium");
    rerender(<PrintedCard card={toolPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("trainer-tool");
  });

  it("uses the printed type for Basic Energy and a neutral special theme for Special Energy", () => {
    const { rerender, container } = render(<PrintedCard card={basicEnergyPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("fire");
    expect(screen.getByRole("img", { name: "Fire Energy" })).toBeTruthy();
    rerender(<PrintedCard card={specialEnergyPresentationCard} />);
    expect(container.querySelector(".printed-card")?.getAttribute("data-theme")).toBe("special-energy");
  });

  it("renders every Ability, attack, printed cost symbol, matchup value, and footer field in full mode", () => {
    const { container } = render(<PrintedCard card={firePresentationCard} />);
    for (const text of ["Archive Flame", "Once during your turn, you may draw a card.", "Warm Insight", "This Pokémon takes 10 less damage from attacks.", "Careful Spark", "Study Blaze", "Test Illustrator", "Presentation Test", "TST 1", "Rare", "Regulation I", "It records every spark it sees."]) expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-energy-type="fire"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-energy-type="colorless"]')).toHaveLength(4);
    expect(screen.getByRole("img", { name: "Water Weakness" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Grass Resistance" })).toBeTruthy();
    expect(screen.getByLabelText("Retreat cost: Colorless, Colorless")).toBeTruthy();
  });

  it("shows full Trainer and Special Energy rules with truthful support labels", () => {
    const { rerender } = render(<PrintedCard card={toolPresentationCard} />);
    expect(screen.getAllByText("The Pokémon this card is attached to can use the attack on this card.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Discard this card at the end of your turn.").length).toBeGreaterThan(0);
    expect(screen.getByText("Effect not coded")).toBeTruthy();
    rerender(<PrintedCard card={specialEnergyPresentationCard} />);
    expect(screen.getAllByText("This card provides 2 Energy only while attached to an Alliance Pokémon.").length).toBeGreaterThan(0);
    expect(screen.getByText("Not represented in simulation")).toBeTruthy();
  });

  it("uses the four user-facing support labels without overstating behavior", () => {
    const switchCard = realCardFixtures.find((card) => card.id === "sv1-194")!;
    const partialCard = { ...firePresentationCard, attacks: [{ name: "Plain Hit", cost: ["Fire" as const], energy: 1, damage: "20", text: "" }] };
    const { rerender } = render(<PrintedCard card={switchCard} />);
    expect(screen.getByText("Simulation ready")).toBeTruthy();
    rerender(<PrintedCard card={basicEnergyPresentationCard} />);
    expect(screen.getByText("Simulation ready — standard effect")).toBeTruthy();
    rerender(<PrintedCard card={partialCard} />);
    expect(screen.getByText("Partially coded")).toBeTruthy();
    rerender(<PrintedCard card={specialEnergyPresentationCard} />);
    expect(screen.getByText("Effect not coded")).toBeTruthy();
  });

  it("is keyboard-openable and exposes an Escape-closeable modal dialog", () => {
    const open = vi.fn();
    const { rerender } = render(<PrintedCard card={firePresentationCard} onOpen={open} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open full details for Ember Scholar" }), { key: "Enter" });
    expect(open).toHaveBeenCalledOnce();
    const close = vi.fn();
    rerender(<CardDetailsDialog card={firePresentationCard} onClose={close} />);
    expect(screen.getByRole("dialog", { name: "Ember Scholar" }).getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
