import skeledirge from "../../data/decks/premade/skeledirge-armarouge.json";
import okidogi from "../../data/decks/premade/okidogi-ex-poison.json";
import rockets from "../../data/decks/premade/team-rockets-nidoking.json";
import { tournamentDecks } from "../../data/decks/corpus";
import { engineDefinitions } from "./engines/definitions";
import type { ArchitectReferenceDeck } from "./types";
import type { DeckManifest } from "../../data/decks/types";

function plan(manifest: DeckManifest) {
  const ids = new Set(manifest.entries.map((entry) => entry.cardId)); const engines = engineDefinitions.filter((engine) => engine.coreCardIds.some((id) => ids.has(id)) || engine.sourceDeckIds.includes(manifest.id));
  return { deckId: manifest.id, engines: engines.map((engine) => engine.id), primaryAttackers: engines.flatMap((engine) => engine.consumers.filter((consumer) => consumer.kind === "energy").map((consumer) => consumer.cardId).filter((id) => ids.has(id))), secondaryAttackers: engines.flatMap((engine) => engine.coreCardIds).filter((id) => ids.has(id)), setupPriorities: engines.flatMap((engine) => engine.providers.filter((provider) => ids.has(provider.cardId)).map((provider, index) => ({ cardId: provider.cardId, priority: 100 - index, reason: provider.explanation }))), capabilityPriorities: [], protectedResources: [], benchPlan: { desiredSpaces: Math.min(8, Math.max(2, ...engines.map((engine) => engine.benchDemand))), setupCardIds: [], attackerCardIds: [], notes: engines.flatMap((engine) => engine.reviewNotes).slice(0, 4) }, targetSelectionRules: [{ priority: 100, rule: "Prefer a legal Knock Out visible from public state." }] };
}
function premade(manifest: DeckManifest, engineIds: string[], label: string): ArchitectReferenceDeck { return { id: manifest.id, source: "premade", manifest, engineIds, strategyPlan: plan(manifest), provenance: { label, reviewed: true } }; }
const reviewedPersonalGengar: DeckManifest = { id: "reviewed-personal-gengar-standard", name: "Reviewed Personal Gengar — Night Gate", description: "A reviewed Standard Gengar sv4pt5-57 baseline built around Night Gate switching and Nightmare sleep pressure.", format: "standard", source: "saved", entries: [
  { cardId: "sv4pt5-57", count: 3 }, { cardId: "sv4pt5-56", count: 2 }, { cardId: "sv4pt5-55", count: 4 },
  { cardId: "sv4pt5-80", count: 4 }, { cardId: "sv1-181", count: 4 }, { cardId: "sv1-189", count: 4 }, { cardId: "sv1-194", count: 2 }, { cardId: "sv5-144", count: 4 }, { cardId: "sv6pt5-61", count: 2 }, { cardId: "sv1-198", count: 3 }, { cardId: "sv4pt5-91", count: 4 }, { cardId: "sv2-188", count: 2 }, { cardId: "sv4-163", count: 2 }, { cardId: "sv1-175", count: 2 }, { cardId: "sv6pt5-57", count: 4 }, { cardId: "sve-1", count: 12 },
] };
export function buildArchitectReferenceDecks(): ArchitectReferenceDeck[] {
  const tournament = tournamentDecks.filter((deck) => deck.manifest).map((deck) => ({ id: deck.id, source: "tournament" as const, manifest: deck.manifest!, engineIds: engineDefinitions.filter((engine) => engine.sourceDeckIds.includes(deck.id) || engine.coreCardIds.some((id) => deck.manifest!.entries.some((entry) => entry.cardId === id))).map((engine) => engine.id), strategyPlan: plan(deck.manifest!), provenance: { label: deck.snapshot.archetype, event: deck.snapshot.eventName, player: deck.snapshot.player, placement: deck.snapshot.placement, reviewed: true } }));
  return [...tournament, premade(skeledirge as DeckManifest, ["grass-fast-evolution"], "Reviewed Skeledirge premade"), premade(okidogi as DeckManifest, ["darkness-poison"], "Reviewed Okidogi premade"), premade(rockets as DeckManifest, ["team-rocket-psychic"], "Reviewed Team Rocket's Nidoking premade"), premade(reviewedPersonalGengar, ["darkness-poison"], "Reviewed personal Standard Gengar baseline")];
}
