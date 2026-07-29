import type { CatalogueIndex } from "../../data/pokemon";
import { engineDefinitions } from "./engines/definitions";
import type { ArchitectCandidate, ArchitectCardRole, CandidateCoherenceReport } from "./types";

const POISON_ENGINE_CARDS = new Set(["sv6pt5-36", "sv6pt5-39", "sv6-95", "sv8pt5-95", "svp-129", "me2pt5-142"]);

function cardText(card: ReturnType<CatalogueIndex["byId"]["get"]>): string {
  return `${card?.trainerText ?? ""} ${(card?.rules ?? []).join(" ")} ${(card?.abilities ?? []).map((ability) => `${ability.name} ${ability.text}`).join(" ")} ${(card?.attacks ?? []).map((attack) => `${attack.name} ${attack.text}`).join(" ")}`;
}

function trainerRole(text: string, subtype: readonly string[]): ArchitectCardRole | undefined {
  if (/switch your active|retreat/i.test(text)) return "switching";
  if (/opponent.*benched.*active|switch.*opponent/i.test(text)) return "gust";
  if (/energy.*discard pile|energy.*discard.*hand|recover.*energy/i.test(text)) return "energy-recovery";
  if (/pok.mon.*discard pile|recover.*pok.mon/i.test(text)) return "pokemon-recovery";
  if (/energy.*deck|basic energy/i.test(text)) return "energy-search";
  if (/evolution|rare candy|evolves?/i.test(text)) return "evolution-search";
  if (/search your deck.*pok.mon|basic pok.mon/i.test(text)) return "basic-setup";
  if (/draw until|shuffle your hand/i.test(text)) return "hand-refresh";
  if (/draw \d|draw cards|put.*hand/i.test(text)) return "draw";
  if (/tool/i.test(text) || subtype.includes("Pokémon Tool")) return "tool-access";
  if (subtype.includes("Stadium")) return "stadium-access";
  if (/damage|more hp/i.test(text)) return "damage-modifier";
  if (/discard.*opponent|confused|poisoned|paralyzed|can't retreat|cannot retreat/i.test(text)) return "control-disruption";
  return undefined;
}

function requiredEnergyTypes(candidate: ArchitectCandidate, index: CatalogueIndex): Set<string> {
  const types = new Set<string>();
  for (const entry of candidate.deck.entries) {
    const card = index.byId.get(entry.cardId);
    if (card?.supertype !== "Pokémon") continue;
    for (const attack of card.attacks ?? []) for (const type of attack.cost) if (type !== "Colorless") types.add(type.toLowerCase());
  }
  return types;
}

function anchorEvolutionNames(candidate: ArchitectCandidate, index: CatalogueIndex): Set<string> {
  const names = new Set<string>();
  let card = index.byId.get(candidate.requiredCardIds[0] ?? "");
  while (card) {
    names.add(card.name.toLocaleLowerCase());
    if (!card.evolvesFrom) break;
    names.add(card.evolvesFrom.toLocaleLowerCase());
    card = index.byName.get(card.evolvesFrom.toLocaleLowerCase())?.[0];
  }
  return names;
}

export function analyseCandidateCoherence(candidate: ArchitectCandidate, index: CatalogueIndex): CandidateCoherenceReport {
  const anchorId = candidate.requiredCardIds[0] ?? "";
  const anchor = index.byId.get(anchorId);
  const anchorText = cardText(anchor);
  const exactEngines = engineDefinitions.filter((engine) => engine.coreCardIds.includes(anchorId) || engine.providers.some((provider) => provider.cardId === anchorId) || engine.consumers.some((consumer) => consumer.cardId === anchorId));
  const engineIds = exactEngines.length ? exactEngines.map((engine) => engine.id) : [`anchor-capability:${anchorId}`];
  const allowedPoison = exactEngines.some((engine) => engine.id === "darkness-poison") || /poison/i.test(anchorText) || /poison/i.test(candidate.variant);
  const requiredTypes = requiredEnergyTypes(candidate, index);
  const familyNames = anchorEvolutionNames(candidate, index);
  const cardRoles: CandidateCoherenceReport["cardRoles"] = {};
  const cardsWithNoRoleEdge: string[] = [], offPlanEnergyCards: string[] = [], unusedEvolutionLines: string[] = [], unusedAttackers: string[] = [], contamination: string[] = [];
  let offTypeEnergyCount = 0;
  for (const entry of candidate.deck.entries) {
    const card = index.byId.get(entry.cardId);
    if (!card) { cardsWithNoRoleEdge.push(entry.cardId); continue; }
    let role: ArchitectCardRole | undefined;
    let edge = "";
    if (entry.cardId === anchorId) { role = "anchor"; edge = `selected favourite fulfils ${candidate.selectedRoles?.[anchorId] ?? "anchor strategy"}`; }
    else if (card.supertype === "Energy") {
      role = "energy"; const type = card.types?.[0]?.toLowerCase(); edge = `pays ${type ?? "flexible"} attack requirements`;
      if (card.subtypes.includes("Basic") && type && !requiredTypes.has(type) && requiredTypes.size) { offPlanEnergyCards.push(entry.cardId); offTypeEnergyCount += entry.count; }
    } else if (familyNames.has(card.name.toLocaleLowerCase())) { role = "evolution-line"; edge = `evolves into the selected ${anchor?.name ?? anchorId} line`; }
    else if (card.supertype === "Trainer") { role = trainerRole(cardText(card), card.subtypes); edge = role ? `provides the declared ${role} requirement` : ""; }
    else if ((card.abilities?.length ?? 0) > 0) { role = "matchup-tech"; edge = `provides ${card.abilities!.map((ability) => ability.name).join(" / ")}`; }
    else if ((card.attacks?.length ?? 0) > 0) {
      const attackTypes = new Set(card.attacks!.flatMap((attack) => attack.cost.filter((type) => type !== "Colorless").map((type) => type.toLowerCase())));
      const compatible = !attackTypes.size || [...attackTypes].every((type) => requiredTypes.has(type));
      if (compatible) { role = "secondary-attacker"; edge = "shares the bounded Energy plan with the selected anchor"; }
      else unusedAttackers.push(entry.cardId);
    }
    if (!role || !edge) cardsWithNoRoleEdge.push(entry.cardId);
    else cardRoles[entry.cardId] = { role, providerToRequirementEdge: edge, allowedCount: card.supertype === "Energy" ? [0, 15] : [1, 4], explanation: `${card.name}: ${edge}.` };
    if (POISON_ENGINE_CARDS.has(entry.cardId) && !allowedPoison) contamination.push(`${entry.cardId} is part of the Darkness Poison shell but ${anchor?.name ?? anchorId} has no Poison requirement.`);
    if (card.supertype === "Pokémon" && card.evolvesFrom && !candidate.deck.entries.some((other) => index.byId.get(other.cardId)?.name === card.evolvesFrom)) {
      const rareCandyStageTwo = card.subtypes.includes("Stage 2") && candidate.deck.entries.some((other) => index.byId.get(other.cardId)?.name === "Rare Candy") && familyNames.size >= 3 && candidate.deck.entries.some((other) => familyNames.has(index.byId.get(other.cardId)?.name.toLocaleLowerCase() ?? "") && index.byId.get(other.cardId)?.subtypes.includes("Basic"));
      if (!rareCandyStageTwo) unusedEvolutionLines.push(entry.cardId);
    }
  }
  const basics = candidate.deck.entries.filter((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" && card.subtypes.includes("Basic"); }).length;
  const benchCapacity = candidate.deck.entries.some((entry) => entry.cardId === "sv7-131") ? 8 : 6;
  const stadiums = candidate.deck.entries.filter((entry) => index.byId.get(entry.cardId)?.subtypes.includes("Stadium")).map((entry) => entry.cardId);
  const tools = candidate.deck.entries.filter((entry) => index.byId.get(entry.cardId)?.subtypes.includes("Pokémon Tool")).map((entry) => entry.cardId);
  const packageConflicts = exactEngines.flatMap((engine) => engine.conflicts.filter((conflict) => exactEngines.some((other) => other.id === conflict.withEngineId)).map((conflict) => conflict.explanation));
  const stadiumConflicts = stadiums.length > 2 ? [`${stadiums.length} distinct Stadium plans compete for the active Stadium slot.`] : [];
  const toolConflicts = tools.length > 3 ? [`${tools.length} distinct Tool plans exceed a focused Tool package.`] : [];
  const benchDemandOverflow = basics > benchCapacity;
  const coherent = !cardsWithNoRoleEdge.length && !offPlanEnergyCards.length && !unusedEvolutionLines.length && !unusedAttackers.length && !packageConflicts.length && !stadiumConflicts.length && !toolConflicts.length && !benchDemandOverflow && !contamination.length;
  return { coherent, engineIds, cardRoles, unrelatedEnginePackages: contamination.length ? ["darkness-poison"] : [], cardsWithNoRoleEdge, offPlanEnergyCards, unusedEvolutionLines, unusedAttackers, packageConflicts, stadiumConflicts, toolConflicts, benchDemand: basics, benchDemandOverflow, contamination, energyTypesRequired: [...requiredTypes].sort(), offTypeEnergyCount };
}

export function withCoherence(candidate: ArchitectCandidate, index: CatalogueIndex): ArchitectCandidate {
  const coherence = analyseCandidateCoherence(candidate, index);
  return { ...candidate, coherence, explanations: [...candidate.explanations, `Coherence: ${Object.keys(coherence.cardRoles).length} cards assigned explicit provider-to-requirement roles; engines ${coherence.engineIds.join(", ")}.`] };
}
