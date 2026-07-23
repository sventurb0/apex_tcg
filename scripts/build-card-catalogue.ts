import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { CATALOGUE_PATH, DATASET_ROOT, readAllSourceCards, readSourceSets, validateCatalogue, type CompactCatalogue } from "./card-data-utils";

const sets = await readSourceSets();
const cards = await readAllSourceCards();
const setById = new Map(sets.map((set) => [set.id, set]));
const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: DATASET_ROOT, encoding: "utf8" }).stdout.trim();

const basicEnergyTypes: Readonly<Record<string, string>> = {
  "Grass Energy": "Grass", "Basic Grass Energy": "Grass", "Fire Energy": "Fire", "Basic Fire Energy": "Fire",
  "Water Energy": "Water", "Basic Water Energy": "Water", "Lightning Energy": "Lightning", "Basic Lightning Energy": "Lightning",
  "Psychic Energy": "Psychic", "Basic Psychic Energy": "Psychic", "Fighting Energy": "Fighting", "Basic Fighting Energy": "Fighting",
  "Darkness Energy": "Darkness", "Basic Darkness Energy": "Darkness", "Metal Energy": "Metal", "Basic Metal Energy": "Metal",
  "Fairy Energy": "Fairy", "Basic Fairy Energy": "Fairy",
};

function verifiedImages(images: { small: string; large: string } | undefined) {
  if (!images) return undefined;
  try { const small = new URL(images.small); const large = new URL(images.large); return small.protocol === "https:" && large.protocol === "https:" ? { small: small.href, large: large.href } : undefined; } catch { return undefined; }
}

const compactCards = cards.map((card) => {
  const setId = card.id.slice(0, card.id.lastIndexOf("-"));
  const set = setById.get(setId);
  if (!set) throw new Error(`No set metadata for ${card.id} (${setId}).`);
  const rules = card.rules ?? [];
  const inferredBasicType = card.supertype === "Energy" && card.subtypes?.includes("Basic") ? basicEnergyTypes[card.name] : undefined;
  const types = card.types?.length ? card.types : inferredBasicType ? [inferredBasicType] : undefined;
  const images = verifiedImages(card.images);
  return {
    id: card.id,
    name: card.name,
    setId,
    setName: set.name,
    setCode: set.ptcgoCode ?? set.id.toUpperCase(),
    collectorNumber: card.number,
    supertype: card.supertype,
    subtypes: card.subtypes ?? [],
    ...(card.hp ? { hp: Number(card.hp) } : {}),
    ...(types?.length ? { types } : {}),
    ...(card.subtypes?.[0] ? { stage: card.subtypes[0] } : {}),
    ...(card.evolvesFrom ? { evolvesFrom: card.evolvesFrom } : {}),
    ...(card.evolvesTo?.length ? { evolvesTo: card.evolvesTo } : {}),
    ...(card.abilities?.length ? { abilities: card.abilities } : {}),
    ...(card.attacks?.length ? { attacks: card.attacks.map((attack) => ({ name: attack.name, cost: attack.cost ?? [], energy: attack.convertedEnergyCost ?? 0, damage: attack.damage ?? "", text: attack.text ?? "" })) } : {}),
    ...(card.weaknesses?.length ? { weaknesses: card.weaknesses } : {}),
    ...(card.resistances?.length ? { resistances: card.resistances } : {}),
    ...(card.retreatCost?.length ? { retreatCost: card.retreatCost } : {}),
    retreat: card.convertedRetreatCost ?? 0,
    ...(rules.length ? { rules } : {}),
    ...(rules.some((rule) => /\brule\s*:/i.test(rule)) ? { ruleBoxText: rules.filter((rule) => /\brule\s*:/i.test(rule)) } : {}),
    ...(card.supertype === "Trainer" && rules.length ? { trainerText: rules.join(" ") } : {}),
    ...(card.supertype === "Energy" && rules.length ? { energyText: rules.join(" ") } : {}),
    ...(card.regulationMark ? { regulationMark: card.regulationMark } : {}),
    ...(card.rarity ? { rarity: card.rarity } : {}),
    ...(card.artist?.trim() ? { artist: card.artist.trim() } : {}),
    ...(card.flavorText?.trim() ? { flavorText: card.flavorText.trim() } : {}),
    ...(images ? { images } : {}),
    releaseDate: set.releaseDate,
    legalities: card.legalities ?? set.legalities ?? {},
  };
});

compactCards.sort((a, b) => a.name.localeCompare(b.name) || a.setCode.localeCompare(b.setCode) || a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }));
const catalogue: CompactCatalogue = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: { repository: "https://github.com/PokemonTCG/pokemon-tcg-data", commit },
  sets: sets.map((set) => ({ id: set.id, name: set.name, code: set.ptcgoCode ?? set.id.toUpperCase(), series: set.series, releaseDate: set.releaseDate })),
  cards: compactCards,
};
const errors = validateCatalogue(catalogue);
if (errors.length) throw new Error(`Catalogue validation failed:\n${errors.slice(0, 50).join("\n")}`);
await mkdir(dirname(CATALOGUE_PATH), { recursive: true });
await writeFile(CATALOGUE_PATH, JSON.stringify(catalogue), "utf8");
const cardsWithImages = compactCards.filter((card) => "images" in card).length;
console.log(`Built ${compactCards.length.toLocaleString()} English card records at ${CATALOGUE_PATH}.`);
console.log(`Images: ${cardsWithImages.toLocaleString()} with both sizes; ${(compactCards.length - cardsWithImages).toLocaleString()} without images.`);
console.log(`Source commit: ${commit}`);
