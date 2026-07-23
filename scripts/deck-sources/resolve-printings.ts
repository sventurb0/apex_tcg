import {
  canonicalBasicEnergy, choosePreferredPrinting, createCatalogueIndex, gameplaySignature,
  normalizeCardName, resolvePrinting,
} from "../../src/data/pokemon/index";
import { createImplementationResolver } from "../../src/data/pokemon/implementations/resolver";
import type { PokemonCardCatalogue, PokemonCardMetadata, SimulationSupport } from "../../src/data/pokemon/types";
import type { DeckManifest } from "../../src/data/decks/types";
import type { CorpusDeckTags, DeckPrintingResolution, DeckSourceSnapshot, NormalizedCorpusDeck } from "./types";

function emptySupport(): Record<SimulationSupport, number> { return { complete: 0, generated: 0, partial: 0, unsupported: 0 }; }
function stableFingerprint(entries: Array<{ cardId: string; count: number }>): string {
  const value = entries.slice().sort((a, b) => a.cardId.localeCompare(b.cardId)).map((entry) => `${entry.cardId}:${entry.count}`).join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `composition-${(hash >>> 0).toString(36)}`;
}
function tagsFor(cards: PokemonCardMetadata[]): CorpusDeckTags {
  const energyTypes = [...new Set(cards.flatMap((card) => card.supertype === "Energy" ? card.types ?? [] : []))].sort();
  const names = cards.map((card) => normalizeCardName(card.name));
  const strategic: CorpusDeckTags["strategic"] = [];
  if (names.some((name) => /snorlax|crustle|slowking|control/.test(name))) strategic.push("control");
  if (names.some((name) => /ogerpon|clefairy|area zero|wellspring/.test(name))) strategic.push("toolbox");
  if (cards.some((card) => card.stage === "Stage 2")) strategic.push("setup");
  if (!strategic.length) strategic.push("aggressive");
  const ruleBox = cards.filter((card) => card.supertype === "Pokémon" && (card.ruleBoxText?.length || /\bex\b/i.test(card.name))).length;
  const pokemon = cards.filter((card) => card.supertype === "Pokémon").length;
  return { energyTypes, strategic, prizeProfile: ruleBox === 0 ? "single-prize" : ruleBox === pokemon ? "multi-prize" : "mixed" };
}

export function resolveSourceSnapshot(snapshot: DeckSourceSnapshot, catalogue: PokemonCardCatalogue): NormalizedCorpusDeck {
  const index = createCatalogueIndex(catalogue.cards);
  const implementationResolver = createImplementationResolver(catalogue.cards);
  const resolutions: DeckPrintingResolution[] = [];
  const entries = new Map<string, number>();
  const resolvedCards: PokemonCardMetadata[] = [];
  const supportCounts = emptySupport();
  for (const sourceCard of snapshot.sourceCards) {
    let chosen = sourceCard.setCode && sourceCard.collectorNumber ? resolvePrinting(index, sourceCard.cardName, sourceCard.setCode, sourceCard.collectorNumber) : undefined;
    let resolution: DeckPrintingResolution["resolution"] = chosen ? "exact" : "unresolved";
    let reason = chosen ? "Source set code and collector number matched the exact local catalogue printing." : "";
    if (!chosen) {
      const basicEnergy = canonicalBasicEnergy(index, sourceCard.cardName);
      if (basicEnergy) { chosen = basicEnergy; resolution = "canonical-equivalent"; reason = "Basic Energy resolved to the reviewed canonical basic printing."; }
    }
    if (!chosen) {
      const candidates = index.byName.get(normalizeCardName(sourceCard.cardName)) ?? [];
      const sourcePrinting = sourceCard.setCode && sourceCard.collectorNumber ? index.byPrinting.get(`${sourceCard.setCode.toLowerCase()}-${sourceCard.collectorNumber.replace(/^0+(?=\d)/, "")}`)?.[0] : undefined;
      const signature = sourcePrinting ? gameplaySignature(sourcePrinting) : undefined;
      const equivalent = signature ? candidates.filter((candidate) => gameplaySignature(candidate) === signature) : [];
      if (equivalent.length) { chosen = choosePreferredPrinting(equivalent); resolution = "canonical-equivalent"; reason = "Source printing was unavailable; chose a deterministic regular printing with identical gameplay text."; }
      else if (!sourceCard.setCode && candidates.length) {
        const signatures = new Map(candidates.map((candidate) => [gameplaySignature(candidate), candidate]));
        if (signatures.size === 1) { chosen = choosePreferredPrinting(candidates); resolution = "canonical-equivalent"; reason = "All exact-name catalogue printings have identical gameplay; chose the deterministic preferred printing."; }
      }
    }
    if (!chosen) {
      resolutions.push({ quantity: sourceCard.quantity, sourceCardName: sourceCard.cardName, sourceSetCode: sourceCard.setCode, sourceCollectorNumber: sourceCard.collectorNumber, resolution: "unresolved", reason: "No exact printing or provably gameplay-identical canonical printing exists in the local catalogue." });
      continue;
    }
    const implementation = implementationResolver.resolve(chosen);
    const family = implementationResolver.familyFor(chosen.id);
    entries.set(chosen.id, (entries.get(chosen.id) ?? 0) + sourceCard.quantity);
    resolvedCards.push(chosen);
    supportCounts[implementation.status] += sourceCard.quantity;
    resolutions.push({ quantity: sourceCard.quantity, sourceCardName: sourceCard.cardName, sourceSetCode: sourceCard.setCode, sourceCollectorNumber: sourceCard.collectorNumber, chosenCardId: chosen.id, chosenCardName: chosen.name, behaviourFamilyId: family?.id ?? implementation.behaviourFamilyId, resolution, reason, support: implementation.status });
  }
  const manifestEntries = [...entries].map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId));
  const resolvedCopies = manifestEntries.reduce((sum, entry) => sum + entry.count, 0);
  const manifest: DeckManifest | undefined = resolvedCopies === 60 ? {
    id: snapshot.resolvedManifestId ?? `corpus-${snapshot.id}`,
    name: snapshot.player ? `${snapshot.archetype} — ${snapshot.player}` : snapshot.archetype,
    description: `${snapshot.eventName ?? "Tournament deck"}${snapshot.placement ? ` · place ${snapshot.placement}` : ""}. Composition-exact; printing choices follow the recorded resolution policy.`,
    format: snapshot.format === "standard" ? "standard" : "none",
    entries: manifestEntries,
    source: "premade",
  } : undefined;
  const exactResolvedCopies = resolutions.filter((row) => row.resolution === "exact").reduce((sum, row) => sum + row.quantity, 0);
  const canonicalEquivalentCopies = resolutions.filter((row) => row.resolution === "canonical-equivalent").reduce((sum, row) => sum + row.quantity, 0);
  const unresolvedCopies = resolutions.filter((row) => row.resolution === "unresolved").reduce((sum, row) => sum + row.quantity, 0);
  const missingBehaviourFamilyIds = [...new Set(resolutions.filter((row) => row.support === "partial" || row.support === "unsupported").map((row) => row.behaviourFamilyId ?? `unimplemented:${row.chosenCardId}`))].sort();
  const blockers = [
    ...resolutions.filter((row) => row.resolution === "unresolved").map((row) => `${row.quantity}× ${row.sourceCardName}: ${row.reason}`),
    ...resolutions.filter((row) => row.support === "partial" || row.support === "unsupported").map((row) => `${row.quantity}× ${row.chosenCardName} (${row.chosenCardId}): ${row.support}; ${row.behaviourFamilyId ?? "no executable behaviour family"}`),
  ];
  return {
    id: snapshot.id, snapshot, manifest, resolutions, compositionFingerprint: manifest ? stableFingerprint(manifest.entries) : undefined,
    sourceSnapshotIds: [snapshot.id], exactResolvedCopies, canonicalEquivalentCopies, unresolvedCopies,
    simulationReady: Boolean(manifest && unresolvedCopies === 0 && supportCounts.partial === 0 && supportCounts.unsupported === 0),
    supportCounts, missingBehaviourFamilyIds, blockers, tags: tagsFor(resolvedCards),
  };
}

