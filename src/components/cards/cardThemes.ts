import type { CSSProperties } from "react";
import type { PokemonCardMetadata, PokemonType } from "../../data/pokemon";

export interface CardTheme {
  key: string;
  label: string;
  accent: string;
  accentStrong: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
}

export const TYPE_THEME_MAP: Readonly<Record<PokemonType, CardTheme>> = {
  Grass: { key: "grass", label: "Grass", accent: "#79c85b", accentStrong: "#315f35", surface: "#14271b", surfaceRaised: "#1c3524", ink: "#f1fff2" },
  Fire: { key: "fire", label: "Fire", accent: "#ff815d", accentStrong: "#8a3b2b", surface: "#301b18", surfaceRaised: "#44231d", ink: "#fff5f0" },
  Water: { key: "water", label: "Water", accent: "#67baf3", accentStrong: "#275c86", surface: "#142536", surfaceRaised: "#1a334b", ink: "#f1f9ff" },
  Lightning: { key: "lightning", label: "Lightning", accent: "#f4d44e", accentStrong: "#806b1c", surface: "#2b2813", surfaceRaised: "#3b3616", ink: "#fffbe8" },
  Psychic: { key: "psychic", label: "Psychic", accent: "#cf82e8", accentStrong: "#713e83", surface: "#2c1a33", surfaceRaised: "#3b2245", ink: "#fff4ff" },
  Fighting: { key: "fighting", label: "Fighting", accent: "#e49a65", accentStrong: "#814c27", surface: "#2d2118", surfaceRaised: "#3d2c20", ink: "#fff7ef" },
  Darkness: { key: "darkness", label: "Darkness", accent: "#9e9bc2", accentStrong: "#4f4b72", surface: "#1d1c2c", surfaceRaised: "#29273b", ink: "#f5f4ff" },
  Metal: { key: "metal", label: "Metal", accent: "#a9bbc2", accentStrong: "#52676f", surface: "#1d282c", surfaceRaised: "#29383d", ink: "#f2fbff" },
  Dragon: { key: "dragon", label: "Dragon", accent: "#b9aa60", accentStrong: "#655b27", surface: "#292719", surfaceRaised: "#383521", ink: "#fffce8" },
  Colorless: { key: "colorless", label: "Colorless", accent: "#c5cad3", accentStrong: "#68717f", surface: "#252932", surfaceRaised: "#303641", ink: "#f8f9fc" },
  Fairy: { key: "fairy", label: "Fairy", accent: "#f3a4ca", accentStrong: "#8b4e6c", surface: "#321f29", surfaceRaised: "#442936", ink: "#fff5fa" },
};

export const TRAINER_THEME_MAP: Readonly<Record<string, CardTheme>> = {
  item: { key: "trainer-item", label: "Item", accent: "#6eb6f1", accentStrong: "#2f6289", surface: "#152636", surfaceRaised: "#1d3449", ink: "#f2f9ff" },
  supporter: { key: "trainer-supporter", label: "Supporter", accent: "#f58a62", accentStrong: "#8a442a", surface: "#301d18", surfaceRaised: "#42261e", ink: "#fff5ef" },
  stadium: { key: "trainer-stadium", label: "Stadium", accent: "#79c98b", accentStrong: "#356944", surface: "#172a1d", surfaceRaised: "#203925", ink: "#f2fff4" },
  tool: { key: "trainer-tool", label: "Pokémon Tool", accent: "#b49bd8", accentStrong: "#624d83", surface: "#251e32", surfaceRaised: "#332842", ink: "#faf5ff" },
};

export const NEUTRAL_CARD_THEME: CardTheme = { key: "neutral", label: "Neutral", accent: "#a7b3c4", accentStrong: "#526074", surface: "#1b222d", surfaceRaised: "#252f3d", ink: "#f4f7fb" };
export const SPECIAL_ENERGY_THEME: CardTheme = { key: "special-energy", label: "Special Energy", accent: "#8cd8cb", accentStrong: "#39786f", surface: "#172a2a", surfaceRaised: "#203938", ink: "#f0fffc" };

export function trainerTheme(card: PokemonCardMetadata): CardTheme {
  const subtype = card.subtypes.find((value) => /supporter|stadium|tool|item/i.test(value)) ?? "Item";
  if (/tool/i.test(subtype)) return TRAINER_THEME_MAP.tool!;
  return TRAINER_THEME_MAP[subtype.toLocaleLowerCase("en-US")] ?? TRAINER_THEME_MAP.item!;
}

export function cardTheme(card: PokemonCardMetadata): CardTheme {
  if (card.supertype === "Trainer") return trainerTheme(card);
  if (card.supertype === "Energy" && !card.subtypes.includes("Basic")) return SPECIAL_ENERGY_THEME;
  return card.types?.[0] ? TYPE_THEME_MAP[card.types[0]] : NEUTRAL_CARD_THEME;
}

export function themeStyle(theme: CardTheme): CSSProperties {
  return {
    "--card-accent": theme.accent,
    "--card-accent-strong": theme.accentStrong,
    "--card-surface": theme.surface,
    "--card-surface-raised": theme.surfaceRaised,
    "--card-ink": theme.ink,
  } as CSSProperties;
}
