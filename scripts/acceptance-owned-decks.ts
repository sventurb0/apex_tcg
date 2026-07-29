import { writeFileSync } from "node:fs";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition } from "../src/data/pokemon";
import { analyseDeck } from "../src/features/deck-builder/validation";
import { buildOwnedDecks, loadCatalogue, loadCollection } from "./collection-common";

export interface OwnedDeckValidation {
  totalCopies: number;
  runtimeUniqueCards: number;
  runtimeCopies: number;
  unsupportedUniqueCards: number;
  unsupportedCopies: number;
  legalCopyLimits: boolean;
  legalSpecialLimits: boolean;
  validBasicSetup: boolean;
  validEvolutionLines: boolean;
  compatibleEnergyPlan: boolean;
  ownedQuantitySatisfied: boolean;
  aiStrategyPresent: boolean;
  simulationGames: number;
  simulationReady: boolean;
  issues: string[];
}

function validateOwnedDeck(deck: ReturnType<typeof buildOwnedDecks>[number], document: ReturnType<typeof loadCollection>, index: ReturnType<typeof createCatalogueIndex>): OwnedDeckValidation {
  const analysis = analyseDeck(deck, index);
  const quantities = new Map<string, number>();
  for (const entry of document.entries) quantities.set(entry.canonicalBehaviourCardId, (quantities.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
  const runtimeIds = new Set<string>();
  let runtimeCopies = 0;
  let unsupportedCopies = 0;
  const unsupportedIds = new Set<string>();
  const issues = analysis.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  for (const entry of deck.entries) {
    const card = index.byId.get(entry.cardId);
    const implementation = card ? compileCardImplementation(card) : undefined;
    const runtime = card ? toRuntimeCardDefinition(card) : null;
    const supported = Boolean(card && runtime && implementation && ["complete", "generated"].includes(implementation.status));
    if (supported) { runtimeIds.add(entry.cardId); runtimeCopies += entry.count; }
    else { unsupportedCopies += entry.count; if (card) unsupportedIds.add(card.id); }
    if (!/^sve-\d+$/.test(entry.cardId) && (quantities.get(entry.cardId) ?? 0) < entry.count) issues.push(`Owned quantity shortage for ${card?.name ?? entry.cardId}: ${entry.count} required, ${quantities.get(entry.cardId) ?? 0} owned.`);
  }
  const evolutionWarnings = analysis.issues.filter((issue) => /evolves from .*not in this deck/i.test(issue.message));
  const totalCopies = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
  const legalCopyLimits = !analysis.issues.some((issue) => /same name|copies/i.test(issue.message) && issue.severity === "error");
  const legalSpecialLimits = !analysis.issues.some((issue) => /Radiant|ACE SPEC/i.test(issue.message) && issue.severity === "error");
  const validBasicSetup = deck.entries.some((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" && card.subtypes.includes("Basic") && entry.count > 0; });
  const validEvolutionLines = evolutionWarnings.length === 0;
  const energyTypes = new Set(deck.entries.flatMap((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Energy" ? (card.types ?? []) : []; }));
  const compatibleEnergyPlan = deck.entries.filter((entry) => index.byId.get(entry.cardId)?.supertype === "Pokémon").every((entry) => (index.byId.get(entry.cardId)?.attacks ?? []).every((attack) => attack.cost.filter((cost) => cost !== "Free").every((cost) => cost === "Colorless" || energyTypes.has(cost))));
  const ownedQuantitySatisfied = deck.entries.every((entry) => /^sve-\d+$/.test(entry.cardId) || (quantities.get(entry.cardId) ?? 0) >= entry.count);
  const aiStrategyPresent = Boolean(deck.architect?.explanation.length);
  const simulationGames = 0;
  const simulationReady = totalCopies === 60 && runtimeCopies === 60 && unsupportedCopies === 0 && legalCopyLimits && legalSpecialLimits && validBasicSetup && validEvolutionLines && compatibleEnergyPlan && ownedQuantitySatisfied && aiStrategyPresent && simulationGames >= 250 && issues.length === 0;
  return { totalCopies, runtimeUniqueCards: runtimeIds.size, runtimeCopies, unsupportedUniqueCards: unsupportedIds.size, unsupportedCopies, legalCopyLimits, legalSpecialLimits, validBasicSetup, validEvolutionLines, compatibleEnergyPlan, ownedQuantitySatisfied, aiStrategyPresent, simulationGames, simulationReady, issues };
}

const document = loadCollection();
const index = createCatalogueIndex(loadCatalogue().cards);
const decks = buildOwnedDecks(document);
const quantities = new Map<string, number>(); for (const entry of document.entries) quantities.set(entry.canonicalBehaviourCardId, (quantities.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
const result = { mandatoryTargets: 8, individualDecksBuildable: decks.filter((deck) => validateOwnedDeck(deck, document, index).simulationReady).length, maximumSimultaneousSubset: [], decks: decks.map((deck) => { const validation = validateOwnedDeck(deck, document, index); const shoppingList = deck.entries.flatMap((entry) => /^sve-\d+$/.test(entry.cardId) ? [] : Math.max(0, entry.count - (quantities.get(entry.cardId) ?? 0)) ? [{ cardId: entry.cardId, count: Math.max(0, entry.count - (quantities.get(entry.cardId) ?? 0)) }] : []).concat(validation.totalCopies < 60 ? [{ cardId: "sve-basic-energy", count: 60 - validation.totalCopies }] : []); return { id: deck.id, name: deck.name, manifest: deck.entries, shoppingList, validation }; }) };
writeFileSync("public/data/owned-deck-acceptance.json", `${JSON.stringify(result, null, 2)}\n`);
writeFileSync("OWNED_DECKS.md", `# Owned-only Decks\n\n${result.decks.map((deck) => `- ${deck.name}: ${deck.validation.totalCopies}/60 copies · runtime ${deck.validation.runtimeCopies}/60 · ${deck.validation.simulationReady ? "ready" : `blocked (${deck.validation.issues.join("; ") || "real simulations not yet run"})`}`).join("\n")}\n`);
console.log(JSON.stringify({ mandatoryTargets: result.mandatoryTargets, individualDecksBuildable: result.individualDecksBuildable, decks: result.decks.map(({ id, name, validation }) => ({ id, name, ...validation })) }, null, 2));
if (result.mandatoryTargets !== 8 || result.decks.length !== 8) process.exitCode = 1;
