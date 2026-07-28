import { readFileSync } from "node:fs";
import { createCatalogueIndex, type PokemonCardCatalogue } from "../src/data/pokemon";
import { generateCandidates, rankCandidates, type ArchitectRequest, type ArchitectCandidate } from "../src/features/deck-architect";

export const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
export const index = createCatalogueIndex(catalogue.cards);
export const benchmarkAnchors = [
  ["sv2-233", "Skeledirge ex"], ["sv6pt5-36", "Okidogi ex"], ["sv9-98", "N's Zoroark ex"], ["sv10-81", "Team Rocket's Mewtwo ex"],
  ["sv7-14", "Hydrapple ex"], ["sv10-12", "Crustle"], ["sv6-64", "Wellspring Mask Ogerpon ex"], ["me4-22", "Mega Greninja ex"],
  ["sv7-58", "Slowking"], ["sv9-56", "Lillie's Clefairy ex"], ["sv6-130", "Dragapult ex"], ["me1-77", "Mega Lucario ex"],
  ["me4-61", "Metagross"], ["sv7-50", "Joltik"], ["me1-56", "Alakazam"], ["sv4pt5-57", "Gengar"],
] as const;
export function request(cardId: string, profile: ArchitectRequest["profile"] = "balanced"): ArchitectRequest { return { favourites: [{ cardId, exactPrintingRequired: true }], format: "standard", mode: "simulation-ready", candidateCount: 3, seed: 13013, profile }; }
export function generateAnchor(cardId: string, profile?: ArchitectRequest["profile"]): { candidates: ArchitectCandidate[]; request: ArchitectRequest } { const input = request(cardId, profile); return { candidates: rankCandidates(generateCandidates(input, index).candidates), request: input }; }
