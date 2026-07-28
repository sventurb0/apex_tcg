import { readFileSync } from "node:fs";
import { createCatalogueIndex, type PokemonCardCatalogue } from "../src/data/pokemon";
import { generateCandidates, rankCandidates, type ArchitectRequest, type ArchitectCandidate } from "../src/features/deck-architect";

export const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const index = createCatalogueIndex(catalogue.cards);
export const benchmarkAnchors = [
  ["me1-56", "Alakazam"], ["sv6pt5-36", "Okidogi ex"], ["sv2-233", "Skeledirge ex"], ["sv1-32", "Arcanine ex"],
  ["sv4pt5-57", "Gengar"], ["sv2-79", "Bellibolt ex"], ["sv7-92", "Swalot"], ["sm12-131", "Alolan Muk"],
  ["sv10-124", "Team Rocket's Muk"], ["sv10-119", "Team Rocket's Nidoking ex"], ["sv10-116", "Team Rocket's Nidoqueen"], ["sv2-148", "Corviknight"],
  ["sv10-92", "Annihilape"], ["sv3pt5-68", "Machamp"], ["sv4pt5-175", "Hawlucha"], ["sv3pt5-130", "Gyarados"],
  ["sv3pt5-149", "Dragonite"], ["sv7-14", "Hydrapple ex"], ["sv6-130", "Dragapult ex"], ["sv7-58", "Slowking"],
  ["sv9-98", "N's Zoroark ex"], ["me4-61", "Metagross"], ["me4-22", "Mega Greninja ex"], ["sv7-50", "Joltik"],
] as const;
export function request(cardId: string, profile: ArchitectRequest["profile"] = "balanced", candidateCount: ArchitectRequest["candidateCount"] = 5): ArchitectRequest { return { favourites: [{ cardId, exactPrintingRequired: true }], format: "standard", mode: "simulation-ready", candidateCount, seed: 13013, profile }; }
export function generateAnchor(cardId: string, profile?: ArchitectRequest["profile"], candidateCount: ArchitectRequest["candidateCount"] = 5): { candidates: ArchitectCandidate[]; request: ArchitectRequest } { const input = request(cardId, profile, candidateCount); return { candidates: rankCandidates(generateCandidates(input, index).candidates), request: input }; }
