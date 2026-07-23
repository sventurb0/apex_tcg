import type { PokemonType } from "../../data/pokemon";
import { TYPE_THEME_MAP, themeStyle } from "./cardThemes";

const SYMBOLS: Readonly<Record<PokemonType, string>> = {
  Grass: "G", Fire: "Fi", Water: "W", Lightning: "L", Psychic: "P", Fighting: "Ft",
  Darkness: "D", Metal: "M", Dragon: "Dr", Colorless: "C", Fairy: "Fa",
};

export function EnergySymbol({ type, context = "Energy" }: { type: PokemonType; context?: string }) {
  const label = `${type} ${context}`;
  return <span className="energy-symbol" data-energy-type={type.toLocaleLowerCase("en-US")} style={themeStyle(TYPE_THEME_MAP[type])} role="img" aria-label={label} title={label}>{SYMBOLS[type]}</span>;
}

export function EnergyCost({ types, emptyLabel = "Free", label = "Energy cost" }: { types?: readonly (PokemonType | "Free")[]; emptyLabel?: string; label?: string }) {
  if (!types?.length || types.every((type) => type === "Free")) return <span className="energy-cost energy-cost-empty">{emptyLabel}</span>;
  return <span className="energy-cost" aria-label={`${label}: ${types.join(", ")}`}>{types.map((type, index) => type === "Free" ? <span className="energy-cost-empty" key={`free-${index}`}>Free</span> : <EnergySymbol type={type} context="Energy" key={`${type}-${index}`} />)}</span>;
}
