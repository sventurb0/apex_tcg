import type { KeyboardEvent, ReactNode } from "react";
import type { PokemonCardMetadata } from "../../data/pokemon";
import { cardTheme, themeStyle } from "./cardThemes";
import { EnergyCardFace } from "./EnergyCardFace";
import { PokemonCardFace } from "./PokemonCardFace";
import { TrainerCardFace } from "./TrainerCardFace";

export interface PrintedCardProps {
  card: PokemonCardMetadata;
  mode?: "full" | "compact";
  onOpen?: () => void;
  onAdd?: () => void;
  overlay?: ReactNode;
  className?: string;
}

export function PrintedCard({ card, mode = "full", onOpen, onAdd, overlay, className = "" }: PrintedCardProps) {
  const theme = cardTheme(card);
  function openFromKeyboard(event: KeyboardEvent<HTMLElement>): void {
    if (!onOpen || event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); onOpen();
  }
  return <article
    className={`printed-card printed-card--${mode} ${className}`.trim()}
    data-theme={theme.key}
    style={themeStyle(theme)}
    onClick={onOpen}
    onKeyDown={openFromKeyboard}
    role={onOpen ? "button" : undefined}
    tabIndex={onOpen ? 0 : undefined}
    aria-label={onOpen ? `Open full details for ${card.name}` : undefined}
  >
    {card.supertype === "Pokémon" ? <PokemonCardFace card={card} mode={mode} /> : card.supertype === "Trainer" ? <TrainerCardFace card={card} mode={mode} /> : <EnergyCardFace card={card} mode={mode} />}
    {overlay}
    {onAdd && <button className="printed-card-add" onClick={(event) => { event.stopPropagation(); onAdd(); }}>+ Add</button>}
  </article>;
}
