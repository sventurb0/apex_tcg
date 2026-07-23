import type { CatalogueIndex } from "../../data/pokemon";
import type { DeckManifest } from "../../data/decks/types";
import type { FavouriteSelection, ScoreBreakdown, SynergyEdge } from "./types";

export function scoreCandidate(deck: DeckManifest, favourites: readonly FavouriteSelection[], index: CatalogueIndex, edges: readonly SynergyEdge[], unsupportedCount: number): ScoreBreakdown {
  const cards = deck.entries.flatMap((entry) => Array.from({ length: entry.count }, () => index.byId.get(entry.cardId))).filter(Boolean);
  const unique = deck.entries.flatMap((entry) => index.byId.get(entry.cardId) ?? []); const total = cards.length;
  const requiredCards = favourites.every((favorite) => deck.entries.some((entry) => entry.cardId === favorite.cardId)) ? 20 : 0;
  const favouriteContribution = Math.min(10, favourites.reduce((sum, favourite) => sum + (deck.entries.find((entry) => entry.cardId === favourite.cardId)?.count ?? 0) * 2 + (edges.some((edge) => edge.fromCardId === favourite.cardId || edge.toCardId === favourite.cardId) ? 2 : 0), 0));
  const evolutionWarnings = unique.filter((card) => card.supertype === "Pokémon" && card.evolvesFrom && !unique.some((other) => other.name === card.evolvesFrom)).length;
  const evolution = Math.max(0, 12 - evolutionWarnings * 4); const basicCount = cards.filter((card) => card?.supertype === "Pokémon" && card.subtypes.includes("Basic")).length;
  const basics = Math.min(10, basicCount * 1.5); const searchCount = cards.filter((card) => /search your deck|look at the top/i.test(`${card?.trainerText ?? ""} ${(card?.rules ?? []).join(" ")}`)).length;
  const drawCount = cards.filter((card) => /draw \d|draw until/i.test(`${card?.trainerText ?? ""} ${(card?.rules ?? []).join(" ")}`)).length;
  const energyCount = cards.filter((card) => card?.supertype === "Energy").length;
  const recoveryCount = cards.filter((card) => /discard pile/i.test(`${card?.trainerText ?? ""} ${(card?.rules ?? []).join(" ")}`)).length;
  const search = Math.min(12, searchCount); const draw = Math.min(10, drawCount); const energy = energyCount >= 8 && energyCount <= 15 ? 10 : Math.max(0, 10 - Math.abs(11 - energyCount) * 2);
  const minimumAttackCost = Math.min(9, ...unique.flatMap((card) => card.attacks?.map((attack) => attack.energy) ?? [])); const hasAcceleration = unique.some((card) => /attach.*energy|move .*energy/i.test(`${card.trainerText ?? ""} ${(card.abilities ?? []).map((ability) => ability.text).join(" ")}`)); const attackReadiness = Math.max(0, 8 - minimumAttackCost * 1.5 + (hasAcceleration ? 3 : 0));
  const benchDemand = unique.filter((card) => card.supertype === "Pokémon" && card.subtypes.includes("Basic")).length; const benchSpace = Math.max(0, 6 - Math.max(0, benchDemand - 5)); const multiPrizeCopies = cards.filter((card) => card?.rules?.some((rule) => /takes? 2|takes? 3|prize cards?/i.test(rule))).length; const prizeLiability = Math.max(0, 6 - multiPrizeCopies * .4);
  const synergy = Math.min(16, edges.reduce((sum, edge) => sum + edge.score, 0) / 3); const recovery = Math.min(6, recoveryCount * 2); const unsupportedPenalty = unsupportedCount * 15; const deadCardPenalty = Math.max(0, total !== 60 ? 30 : 0);
  const totalScore = requiredCards + favouriteContribution + evolution + basics + search + draw + energy + attackReadiness + benchSpace + prizeLiability + synergy + recovery - unsupportedPenalty - deadCardPenalty;
  return { requiredCards, favouriteContribution, evolution, basics, search, draw, energy, attackReadiness, benchSpace, prizeLiability, synergy, recovery, unsupportedPenalty, deadCardPenalty, total: Math.round(totalScore * 10) / 10 };
}
