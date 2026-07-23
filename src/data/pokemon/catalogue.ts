import type { PokemonCardCatalogue, PokemonCardMetadata, PokemonType } from "./types";

let cataloguePromise: Promise<PokemonCardCatalogue> | undefined;
let latestCatalogueIndex: CatalogueIndex | undefined;

export const CANONICAL_BASIC_ENERGY_IDS: Readonly<Record<string, string>> = {
  grass: "sve-1", fire: "sve-2", water: "sve-3", lightning: "sve-4",
  psychic: "sve-5", fighting: "sve-6", darkness: "sve-7", metal: "sve-8",
};

const basicEnergyAliases: Readonly<Record<string, keyof typeof CANONICAL_BASIC_ENERGY_IDS>> = {
  "grass energy": "grass", "basic grass energy": "grass",
  "fire energy": "fire", "basic fire energy": "fire",
  "water energy": "water", "basic water energy": "water",
  "lightning energy": "lightning", "basic lightning energy": "lightning",
  "psychic energy": "psychic", "basic psychic energy": "psychic",
  "fighting energy": "fighting", "basic fighting energy": "fighting",
  "darkness energy": "darkness", "basic darkness energy": "darkness",
  "metal energy": "metal", "basic metal energy": "metal",
};

export function loadCardCatalogue(): Promise<PokemonCardCatalogue> {
  cataloguePromise ??= fetch("/data/pokemon-cards.json").then(async (response) => {
    if (!response.ok) throw new Error(`Card catalogue failed to load (${response.status}). Run npm run cards:build.`);
    return await response.json() as PokemonCardCatalogue;
  });
  return cataloguePromise;
}

export function normalizeCardName(value: string): string {
  return value
    .replace(/Nidoran\s*(?:♂|\bM(?:ale)?\b)/giu, "Nidoran Male")
    .replace(/Nidoran\s*(?:♀|\bF(?:emale)?\b)/giu, "Nidoran Female")
    .normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim().toLocaleLowerCase("en-US");
}

export function normalizeCollectorNumber(value: string): string {
  const printed = value.trim().split("/")[0]!.toUpperCase();
  return /^\d+$/.test(printed) ? printed.replace(/^0+(?=\d)/, "") : printed;
}

function nameAliases(name: string): string[] {
  const normalized = normalizeCardName(name);
  const withoutParenthetical = normalizeCardName(name.replace(/\s+\([^()]+\)\s*$/u, ""));
  return normalized === withoutParenthetical ? [normalized] : [normalized, withoutParenthetical];
}

export interface CatalogueIndex {
  cards: readonly PokemonCardMetadata[];
  byId: Map<string, PokemonCardMetadata>;
  byName: Map<string, PokemonCardMetadata[]>;
  byPrinting: Map<string, PokemonCardMetadata[]>;
  setAliases: Set<string>;
}

function append(map: Map<string, PokemonCardMetadata[]>, key: string, card: PokemonCardMetadata): void {
  map.set(key, [...(map.get(key) ?? []), card]);
}

export function createCatalogueIndex(cards: readonly PokemonCardMetadata[]): CatalogueIndex {
  const byId = new Map<string, PokemonCardMetadata>();
  const byName = new Map<string, PokemonCardMetadata[]>();
  const byPrinting = new Map<string, PokemonCardMetadata[]>();
  const setAliases = new Set<string>();
  for (const card of cards) {
    byId.set(card.id, card);
    for (const alias of nameAliases(card.name)) append(byName, alias, card);
    const collector = normalizeCollectorNumber(card.collectorNumber);
    for (const setAlias of [card.setCode, card.setId]) {
      const alias = setAlias.toLocaleLowerCase("en-US");
      setAliases.add(alias);
      append(byPrinting, `${alias}-${collector}`, card);
    }
  }
  latestCatalogueIndex = { cards, byId, byName, byPrinting, setAliases };
  return latestCatalogueIndex;
}

export function currentCatalogueIndex(): CatalogueIndex | undefined { return latestCatalogueIndex; }

export function isCardNameMatch(card: PokemonCardMetadata, descriptorName: string): boolean {
  const wanted = normalizeCardName(descriptorName);
  return nameAliases(card.name).includes(wanted);
}

export function resolvePrinting(index: CatalogueIndex, name: string, setAlias: string, collectorNumber: string): PokemonCardMetadata | undefined {
  const key = `${setAlias.trim().toLocaleLowerCase("en-US")}-${normalizeCollectorNumber(collectorNumber)}`;
  return index.byPrinting.get(key)?.find((card) => isCardNameMatch(card, name));
}

export function canonicalBasicEnergy(index: CatalogueIndex, descriptor: string): PokemonCardMetadata | undefined {
  const energyType = basicEnergyAliases[normalizeCardName(descriptor)];
  const cardId = energyType ? CANONICAL_BASIC_ENERGY_IDS[energyType] : undefined;
  return cardId ? index.byId.get(cardId) : undefined;
}

export function gameplaySignature(card: PokemonCardMetadata): string {
  const boilerplate = /^(you may play (?:any number of|as many) item cards|you may play only 1 supporter card|you may play only 1 stadium card)/i;
  const gameplayText = (value: string): string => {
    const normalized = normalizeCardName(value).replace(/\s*([.,;:!?])\s*/g, "$1 ").trim();
    if (normalized.startsWith("switch ") && normalized.includes("active pokemon") && normalized.includes("benched pokemon") && !normalized.includes("opponent")) return "switch your active pokemon with one of your benched pokemon";
    return normalized;
  };
  const rules = (card.rules ?? []).filter((rule) => !boilerplate.test(rule)).map(gameplayText);
  const effectiveSubtypes = card.supertype === "Trainer" && card.subtypes.length === 0 ? ["Item"] : card.subtypes;
  return JSON.stringify({
    name: normalizeCardName(card.name), supertype: card.supertype, subtypes: effectiveSubtypes.map(normalizeCardName), stage: card.stage ? normalizeCardName(card.stage) : null, hp: card.hp ?? null,
    types: card.types ?? [], evolvesFrom: card.evolvesFrom ? normalizeCardName(card.evolvesFrom) : null,
    abilities: (card.abilities ?? []).map(({ name, text, type }) => ({ name: normalizeCardName(name), text: gameplayText(text), type: normalizeCardName(type) })),
    attacks: (card.attacks ?? []).map(({ name, cost, damage, text }) => ({ name: normalizeCardName(name), cost, damage, text: normalizeCardName(text) })),
    weaknesses: card.weaknesses ?? [], resistances: card.resistances ?? [], retreatCost: card.retreatCost ?? [], retreat: card.retreat,
    rules, trainerText: card.rules?.length ? "" : gameplayText(card.trainerText ?? ""),
    energyText: card.rules?.length ? "" : gameplayText(card.energyText ?? ""), ruleBoxText: (card.ruleBoxText ?? []).map(gameplayText),
  });
}

function cosmeticPenalty(card: PokemonCardMetadata): number {
  const rarity = card.rarity ?? "";
  if (/promo/i.test(card.setName) || /^(svp|swshp|smp|xyp|bwp|dpp)$/i.test(card.setId)) return 2;
  if (/illustration|secret|hyper|rainbow|shiny|ultra rare/i.test(rarity)) return 1;
  return 0;
}

function collectorSortValue(value: string): [number, string] {
  const normalized = normalizeCollectorNumber(value);
  return /^\d+$/.test(normalized) ? [Number(normalized), ""] : [Number.MAX_SAFE_INTEGER, normalized];
}

export function choosePreferredPrinting(cards: readonly PokemonCardMetadata[]): PokemonCardMetadata {
  if (!cards.length) throw new Error("Cannot choose a preferred printing from an empty list.");
  return [...cards].sort((a, b) => {
    const legalityA = a.legalities.standard === "Legal" ? 0 : a.legalities.expanded === "Legal" ? 1 : 2;
    const legalityB = b.legalities.standard === "Legal" ? 0 : b.legalities.expanded === "Legal" ? 1 : 2;
    if (legalityA !== legalityB) return legalityA - legalityB;
    const cosmetic = cosmeticPenalty(a) - cosmeticPenalty(b); if (cosmetic) return cosmetic;
    const date = (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""); if (date) return date;
    const [numberA, suffixA] = collectorSortValue(a.collectorNumber); const [numberB, suffixB] = collectorSortValue(b.collectorNumber);
    return numberA - numberB || suffixA.localeCompare(suffixB) || a.setId.localeCompare(b.setId) || a.id.localeCompare(b.id);
  })[0]!;
}

export const BASIC_ENERGY_TYPES: Readonly<Record<string, PokemonType>> = {
  grass: "Grass", fire: "Fire", water: "Water", lightning: "Lightning", psychic: "Psychic",
  fighting: "Fighting", darkness: "Darkness", metal: "Metal", fairy: "Fairy",
};
