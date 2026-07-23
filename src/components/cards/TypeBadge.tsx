import type { PokemonType } from "../../data/pokemon";
import { TYPE_THEME_MAP, themeStyle } from "./cardThemes";

export function TypeBadge({ type }: { type: PokemonType }) {
  return <span className="type-badge" data-card-type={type.toLocaleLowerCase("en-US")} style={themeStyle(TYPE_THEME_MAP[type])}>{type}</span>;
}
