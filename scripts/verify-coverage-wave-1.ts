import { readFileSync, writeFileSync } from "node:fs";
import { premadeDecks } from "../src/data/decks/premade";
import { buildCoverageReport, buildCoverageSignatureIndex, buildFavouriteCoverage, createCatalogueIndex, type PokemonCardCatalogue } from "../src/data/pokemon";
import { analyseDeck } from "../src/features/deck-builder/validation";
import { generateCandidates, runQuickGauntlet, type ArchitectCandidate, type ArchitectRequest } from "../src/features/deck-architect";

const check = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
const index = createCatalogueIndex(catalogue.cards);
const signatures = buildCoverageSignatureIndex(catalogue.cards, Object.fromEntries(premadeDecks.map((deck) => [deck.name, deck.entries.map((entry) => entry.cardId)])));
const favourites = buildFavouriteCoverage(catalogue.cards, signatures);
const coverage = buildCoverageReport(catalogue.cards, signatures, favourites);
const abilityTemplates = signatures.abilities.filter((signature) => signature.implementedTemplateId).length;
const attackEffectTemplates = signatures.attacks.filter((signature) => signature.implementedTemplateId && signature.implementedTemplateId !== "attack-printed-fixed-or-no-damage").length;
const trainerEnergyTemplates = [...signatures.trainerEffects, ...signatures.energyEffects].filter((signature) => signature.implementedTemplateId).length;

check(abilityTemplates >= 40, `Only ${abilityTemplates} reviewed Ability signatures were implemented; expected at least 40.`);
check(attackEffectTemplates >= 75, `Only ${attackEffectTemplates} reviewed attack-effect signatures were implemented; expected at least 75.`);
check(trainerEnergyTemplates >= 40, `Only ${trainerEnergyTemplates} reviewed Trainer/Energy signatures were implemented; expected at least 40.`);
for (const deck of premadeDecks) check(analyseDeck(deck, index).simulationReady, `${deck.name} regressed from simulation-ready status.`);

const targets = [{ name: "Arcanine", cardId: "swsh8-33" }, { name: "Gengar", cardId: "sv4pt5-57" }] as const;
const requestFor = (cardId: string): ArchitectRequest => ({ favourites: [{ cardId, exactPrintingRequired: true }], format: "custom", mode: "simulation-ready", candidateCount: 3, seed: 73_001 });
const candidates: Array<{ name: string; candidate: ArchitectCandidate }> = targets.map((target) => {
  const generated = generateCandidates(requestFor(target.cardId), index);
  check(!generated.rejected.length && generated.candidates.length >= 3, `${target.name} did not produce three simulation-ready candidates.`);
  const candidate = generated.candidates[0]!;
  check(candidate.deck.entries.reduce((sum, entry) => sum + entry.count, 0) === 60 && candidate.simulationReady && !candidate.unsupportedCardIds.length, `${target.name} candidate is not an exact 60-card executable deck.`);
  return { name: target.name, candidate };
});

const creativeTargets = [
  { name: "Bellibolt Lightning", cardIds: ["sv3-77"] },
  { name: "Alolan Muk / Swalot control", cardIds: ["sm12-131", "sv7-92"] },
  { name: "Corviknight defensive", cardIds: ["swsh1-135"] },
  { name: "Alakazam Psychic", cardIds: ["me1-56"] },
  { name: "Annihilape / Machamp Fighting", cardIds: ["sv1-109", "base1-8"] },
] as const;
const creativeOnly = Object.fromEntries(creativeTargets.map((target) => {
  const request: ArchitectRequest = { favourites: target.cardIds.map((cardId) => ({ cardId, exactPrintingRequired: true })), format: "custom", mode: "creative", candidateCount: 3, seed: 73_001 };
  const generated = generateCandidates(request, index);
  check(generated.candidates.length >= 1, `${target.name} did not produce a Creative-mode candidate.`);
  const candidate = generated.candidates[0]!;
  check(!candidate.simulationReady && candidate.unsupportedCardIds.length > 0, `${target.name} was incorrectly promoted to simulation-ready.`);
  return [target.name, { selectedCardIds: target.cardIds, candidateId: candidate.deck.id, exactCards: candidate.deck.entries.reduce((sum, entry) => sum + entry.count, 0), simulationReady: false, blockers: candidate.unsupportedCardIds }];
}));

const results: Record<string, unknown> = {};
for (const { name, candidate } of candidates) {
  const quick = await runQuickGauntlet(candidate, premadeDecks, index, 20);
  const deep = await runQuickGauntlet(candidate, premadeDecks, index, 100);
  const replayA = await runQuickGauntlet(candidate, premadeDecks, index, 2);
  const replayB = await runQuickGauntlet(candidate, premadeDecks, index, 2);
  check(quick.unresolved === 0 && deep.unresolved === 0, `${name} produced unresolved games.`);
  check(JSON.stringify(replayA) === JSON.stringify(replayB), `${name} deterministic replay batch diverged.`);
  results[name] = { cardId: candidate.requiredCardIds[0], deckId: candidate.deck.id, exactCards: 60, behaviourFamiliesExecutable: true, quick, deep, deterministicReplay: true, safetyLimitGames: deep.commonLossReasons["safety-limit"] ?? 0 };
}

const output = { generatedAt: new Date().toISOString(), coverage, wave1: { abilityTemplates, attackEffectTemplates, trainerEnergyTemplates }, existingDecks: premadeDecks.map((deck) => ({ id: deck.id, simulationReady: analyseDeck(deck, index).simulationReady })), newArchetypes: results, creativeOnlyArchetypes: creativeOnly };
writeFileSync("public/data/coverage-wave-1-acceptance.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output, null, 2));
