import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

export const DATASET_ROOT = resolve(".cache/pokemon-tcg-data");
export const CATALOGUE_PATH = resolve("public/data/pokemon-cards.json");

export interface SourceSet {
  id: string;
  name: string;
  series: string;
  ptcgoCode?: string;
  releaseDate: string;
  legalities: Record<string, string>;
}

export interface SourceCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  abilities?: Array<{ name: string; text: string; type: string }>;
  attacks?: Array<{ name: string; cost?: string[]; convertedEnergyCost?: number; damage?: string; text?: string }>;
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  number: string;
  legalities?: Record<string, string>;
  regulationMark?: string;
  rules?: string[];
  rarity?: string;
  artist?: string;
  flavorText?: string;
  images?: { small: string; large: string };
}

export interface CompactCatalogue {
  version: 1;
  generatedAt: string;
  source: { repository: string; commit: string };
  sets: Array<{ id: string; name: string; code: string; series: string; releaseDate: string }>;
  cards: Array<Record<string, unknown>>;
}

export async function readSourceSets(): Promise<SourceSet[]> {
  return JSON.parse(await readFile(resolve(DATASET_ROOT, "sets/en.json"), "utf8")) as SourceSet[];
}

export async function readAllSourceCards(): Promise<SourceCard[]> {
  const directory = resolve(DATASET_ROOT, "cards/en");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const groups = await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(directory, file), "utf8")) as SourceCard[]));
  return groups.flat();
}

export function validateCatalogue(catalogue: CompactCatalogue): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, raw] of catalogue.cards.entries()) {
    const card = raw as { id?: string; name?: string; setId?: string; setCode?: string; collectorNumber?: string; supertype?: string; subtypes?: string[]; hp?: number; types?: string[]; images?: { small?: unknown; large?: unknown } };
    const label = card.id ?? `record ${index + 1}`;
    if (!card.id) errors.push(`${label}: missing canonical source ID.`);
    else if (ids.has(card.id)) errors.push(`${label}: duplicate canonical source ID.`);
    else ids.add(card.id);
    if (!card.name?.trim()) errors.push(`${label}: missing English card name.`);
    if (!card.setId || !card.setCode || !card.collectorNumber) errors.push(`${label}: missing set identity.`);
    if (!card.supertype || !["Pokémon", "Trainer", "Energy"].includes(card.supertype)) errors.push(`${label}: invalid supertype.`);
    if (card.supertype === "Pokémon" && (!card.hp || !card.types?.length)) errors.push(`${label}: Pokémon requires HP and type.`);
    if (!Array.isArray(card.subtypes)) errors.push(`${label}: subtypes must be an array.`);
    if (card.images !== undefined) {
      if (typeof card.images.small !== "string" || typeof card.images.large !== "string") errors.push(`${label}: image URLs must be strings.`);
      else for (const [size, value] of Object.entries(card.images) as [string, string][]) { let url: URL | undefined; try { url = new URL(value); } catch { /* reported below */ } if (!url || url.protocol !== "https:") errors.push(`${label}: ${size} image must use HTTPS.`); if (/^[a-z]:[\\/]|^file:/i.test(value)) errors.push(`${label}: ${size} image must not be a local filesystem path.`); }
    }
    if (card.supertype === "Energy" && card.subtypes?.includes("Basic")) {
      const valid = new Set(["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Fairy"]);
      if (card.types?.length !== 1 || !valid.has(card.types[0]!)) errors.push(`${label}: Basic Energy requires exactly one verified Energy type.`);
    }
  }
  return errors;
}
