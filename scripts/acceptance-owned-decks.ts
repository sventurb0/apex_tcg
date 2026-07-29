import { writeFileSync } from "node:fs";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition } from "../src/data/pokemon";
import { analyseDeck } from "../src/features/deck-builder/validation";
import type { OwnedDeckRoute } from "./collection-common";
import { buildOwnedRoutes, loadCatalogue, loadCollection } from "./collection-common";

interface RouteValidation {
  totalCopies: number;
  runtimeCopies: number;
  unsupportedCopies: number;
  legalCopyLimits: boolean;
  legalSpecialLimits: boolean;
  validBasicSetup: boolean;
  validEvolutionLines: boolean;
  compatibleEnergyPlan: boolean;
  ownedNonBasicShortage: number;
  aiStrategyPresent: boolean;
  everyCardHasRole: boolean;
  simulationReady: boolean;
  issues: string[];
}

const document = loadCollection();
const index = createCatalogueIndex(loadCatalogue().cards);
const routes = buildOwnedRoutes(document);
const owned = new Map<string, number>();
for (const entry of document.entries) owned.set(entry.canonicalBehaviourCardId, (owned.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
const basicEnergy = (cardId: string) => index.byId.get(cardId)?.supertype === "Energy" && index.byId.get(cardId)?.subtypes.includes("Basic");

function validateRoute(route: OwnedDeckRoute): RouteValidation {
  const deck = route.ownedOnly;
  const analysis = analyseDeck(deck, index);
  const issues = analysis.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  let runtimeCopies = 0, unsupportedCopies = 0, ownedNonBasicShortage = 0;
  for (const entry of deck.entries) {
    const card = index.byId.get(entry.cardId);
    const implementation = card ? compileCardImplementation(card) : undefined;
    const runtime = card ? toRuntimeCardDefinition(card) : null;
    if (card && runtime && implementation && ["complete", "generated"].includes(implementation.status)) runtimeCopies += entry.count;
    else unsupportedCopies += entry.count;
    if (!basicEnergy(entry.cardId)) ownedNonBasicShortage += Math.max(0, entry.count - (owned.get(entry.cardId) ?? 0));
  }
  const names = new Map<string, number>();
  for (const entry of deck.entries) { const name = index.byId.get(entry.cardId)?.name ?? entry.cardId; names.set(name, (names.get(name) ?? 0) + entry.count); }
  const legalCopyLimits = [...names].every(([name, count]) => count <= 4 || deck.entries.some((entry) => index.byId.get(entry.cardId)?.name === name && basicEnergy(entry.cardId)));
  const legalSpecialLimits = !analysis.issues.some((issue) => /Radiant|ACE SPEC/i.test(issue.message) && issue.severity === "error");
  const validBasicSetup = deck.entries.some((entry) => index.byId.get(entry.cardId)?.supertype === "Pokémon" && index.byId.get(entry.cardId)?.subtypes.includes("Basic") && entry.count > 0);
  const namesInDeck = new Set(deck.entries.map((entry) => index.byId.get(entry.cardId)?.name).filter(Boolean));
  const validEvolutionLines = deck.entries.every((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype !== "Pokémon" || !card.evolvesFrom || namesInDeck.has(card.evolvesFrom); });
  const energyTypes = new Set(deck.entries.flatMap((entry) => basicEnergy(entry.cardId) ? index.byId.get(entry.cardId)?.types ?? [] : []));
  const intendedAttackers = deck.entries.filter((entry) => ["primary-attacker", "secondary-attacker", "control-disruption"].includes(route.roleEdges[entry.cardId]?.role ?? ""));
  const compatibleEnergyPlan = intendedAttackers.every((entry) => (index.byId.get(entry.cardId)?.attacks ?? []).every((attack) => attack.cost.every((cost) => cost === "Colorless" || cost === "Free" || energyTypes.has(cost))));
  const aiStrategyPresent = Boolean(deck.architect?.explanation.length && deck.architect.selectedCardIds.length);
  const everyCardHasRole = deck.entries.every((entry) => Boolean(route.roleEdges[entry.cardId]?.explanation));
  const totalCopies = analysis.total;
  if (!validEvolutionLines) issues.push("An evolution card is missing its printed predecessor.");
  if (!compatibleEnergyPlan) issues.push("The bounded Energy plan cannot pay every intended attacker's printed attack costs.");
  if (ownedNonBasicShortage) issues.push(`${ownedNonBasicShortage} non-Basic copies exceed the imported inventory.`);
  if (!everyCardHasRole) issues.push("At least one card lacks a provider-to-requirement role edge.");
  const simulationReady = totalCopies === 60 && runtimeCopies === 60 && unsupportedCopies === 0 && legalCopyLimits && legalSpecialLimits && validBasicSetup && validEvolutionLines && compatibleEnergyPlan && ownedNonBasicShortage === 0 && aiStrategyPresent && everyCardHasRole && issues.length === 0;
  return { totalCopies, runtimeCopies, unsupportedCopies, legalCopyLimits, legalSpecialLimits, validBasicSetup, validEvolutionLines, compatibleEnergyPlan, ownedNonBasicShortage, aiStrategyPresent, everyCardHasRole, simulationReady, issues };
}

function usageFor(routeIndexes: readonly number[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const routeIndex of routeIndexes) for (const entry of routes[routeIndex].ownedOnly.entries) if (!basicEnergy(entry.cardId)) usage.set(entry.cardId, (usage.get(entry.cardId) ?? 0) + entry.count);
  return usage;
}
function fits(usage: Map<string, number>): boolean { return [...usage].every(([id, count]) => count <= (owned.get(id) ?? 0)); }

let maximumSimultaneousRoutes: number[] = [];
for (let mask = 0; mask < (1 << routes.length); mask += 1) {
  const selected = routes.map((_, index) => index).filter((index) => mask & (1 << index));
  if (selected.length > maximumSimultaneousRoutes.length && fits(usageFor(selected))) maximumSimultaneousRoutes = selected;
}
const totalUsage = usageFor(routes.map((_, index) => index));
const sharedCardConflicts = [...totalUsage].flatMap(([cardId, required]) => required > (owned.get(cardId) ?? 0) ? [{ cardId, name: index.byId.get(cardId)?.name ?? cardId, owned: owned.get(cardId) ?? 0, required, shortage: required - (owned.get(cardId) ?? 0) }] : []).sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name));
const baseUsage = usageFor(maximumSimultaneousRoutes);
const nextRouteOptions = routes.map((route, routeIndex) => ({ route, routeIndex })).filter(({ routeIndex }) => !maximumSimultaneousRoutes.includes(routeIndex)).map(({ route }) => {
  const combined = new Map(baseUsage);
  for (const entry of route.ownedOnly.entries) if (!basicEnergy(entry.cardId)) combined.set(entry.cardId, (combined.get(entry.cardId) ?? 0) + entry.count);
  const shopping = [...combined].flatMap(([cardId, count]) => count > (owned.get(cardId) ?? 0) ? [{ cardId, name: index.byId.get(cardId)?.name ?? cardId, quantity: count - (owned.get(cardId) ?? 0) }] : []);
  return { routeId: route.targetId, missingCopies: shopping.reduce((sum, item) => sum + item.quantity, 0), shopping };
}).sort((a, b) => a.missingCopies - b.missingCopies || a.routeId.localeCompare(b.routeId));

const routeResults = routes.map((route) => ({
  id: route.targetId,
  name: route.targetName,
  fullLibrary: { totalCopies: route.fullLibrary.entries.reduce((sum, entry) => sum + entry.count, 0), manifest: route.fullLibrary.entries },
  ownedOnly: { manifest: route.ownedOnly.entries, validation: validateRoute(route) },
  ownedPlusShopping: { totalCopies: route.shopping.entries.reduce((sum, entry) => sum + entry.count, 0), manifest: route.shopping.entries, missing: route.missing, substitutions: route.substitutions },
  roleEdges: route.roleEdges,
}));
const individualDecksBuildable = routeResults.filter((route) => route.ownedOnly.validation.simulationReady).length;
const result = {
  generatedAt: new Date().toISOString(),
  mandatoryTargets: 8,
  fullCandidates: routeResults.filter((route) => route.fullLibrary.totalCopies === 60).length,
  individualDecksBuildable,
  blockedRoutesWithFullShoppingCandidate: routeResults.filter((route) => !route.ownedOnly.validation.simulationReady && route.ownedPlusShopping.totalCopies === 60).length,
  fallbackSkeletons: routeResults.filter((route) => route.fullLibrary.totalCopies < 60 || route.ownedPlusShopping.totalCopies < 60).length,
  maximumSimultaneousRoutes: maximumSimultaneousRoutes.map((routeIndex) => routes[routeIndex].targetId),
  sharedCardConflicts,
  smallestShoppingListForAnotherSimultaneousRoute: nextRouteOptions[0] ?? null,
  routes: routeResults,
};
writeFileSync("public/data/owned-deck-acceptance.json", `${JSON.stringify(result, null, 2)}\n`);
writeFileSync("OWNED_DECKS.md", `# Owned Deck Routes\n\n${routeResults.map((route) => `- ${route.name}: full ${route.fullLibrary.totalCopies}/60 · owned ${route.ownedOnly.validation.totalCopies}/60 · runtime ${route.ownedOnly.validation.runtimeCopies}/60 · ${route.ownedOnly.validation.simulationReady ? "individually buildable" : `blocked (${route.ownedOnly.validation.issues.join("; ")})`}`).join("\n")}\n\nMaximum simultaneous allocation: ${maximumSimultaneousRoutes.length}/8.\n`);
console.log(JSON.stringify({ mandatoryTargets: result.mandatoryTargets, fullCandidates: result.fullCandidates, individualDecksBuildable, maximumSimultaneousRoutes: result.maximumSimultaneousRoutes, fallbackSkeletons: result.fallbackSkeletons, sharedCardConflicts: result.sharedCardConflicts, routes: routeResults.map((route) => ({ id: route.id, full: route.fullLibrary.totalCopies, shopping: route.ownedPlusShopping.totalCopies, ...route.ownedOnly.validation })) }, null, 2));
if (result.mandatoryTargets !== 8 || result.fullCandidates !== 8 || individualDecksBuildable < 6 || result.fallbackSkeletons !== 0 || routeResults.some((route) => !route.ownedOnly.validation.simulationReady)) process.exitCode = 1;
