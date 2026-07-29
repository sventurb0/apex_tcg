import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DeckManifest } from "../src/data/decks/types";
import { tournamentDecks } from "../src/data/decks/corpus";
import { engineDefinitions } from "../src/features/deck-architect/engines/definitions";
import type { ArchitectCandidate } from "../src/features/deck-architect";
import { benchmarkAnchors, generateAnchor, index } from "./architect-acceptance-common";

export const SKELEDIRGE = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8")) as DeckManifest;
export const OKIDOGI = JSON.parse(readFileSync("src/data/decks/premade/okidogi-ex-poison.json", "utf8")) as DeckManifest;
export const NIDOKING = JSON.parse(readFileSync("src/data/decks/premade/team-rockets-nidoking.json", "utf8")) as DeckManifest;
const architectureFiles = [
  "src/features/deck-architect/semantic-generator.ts", "src/features/deck-architect/original-builder.ts",
  "src/features/deck-architect/hybrid-builder.ts", "src/features/deck-architect/trainer-plan.ts",
  "src/features/deck-architect/energy-planner.ts", "src/features/deck-architect/coherence.ts",
  "src/features/deck-architect/anchor-contribution.ts", "src/features/deck-architect/engines/definitions.ts",
  "src/features/deck-architect/packages.ts", "src/features/deck-architect/reviewed-packages.ts",
  "src/data/pokemon/implementations/registry.ts", "src/data/pokemon/runtime-adapter.ts", "engine/ai/heuristic-agent.ts",
  "engine/effects/program-runner.ts", "engine/rules/reducer.ts", "engine/simulation/game-runner.ts",
];

export function architectRevisionHash(): string {
  const hash = createHash("sha256");
  for (const file of architectureFiles) hash.update(file).update(readFileSync(file));
  return hash.digest("hex").slice(0, 20);
}

function exactEngine(cardId: string) {
  return engineDefinitions.find((engine) => engine.coreCardIds.includes(cardId) || engine.providers.some((provider) => provider.cardId === cardId) || engine.consumers.some((consumer) => consumer.cardId === cardId));
}

export function relevantTournamentOpponent(cardId: string): DeckManifest {
  const engine = exactEngine(cardId);
  const type = index.byId.get(cardId)?.types?.[0];
  const source = engine?.sourceDeckIds.flatMap((id) => tournamentDecks.find((deck) => deck.id === id && deck.simulationReady && deck.manifest)?.manifest ?? [])[0];
  if (source) return source;
  const typed = tournamentDecks.find((deck) => deck.simulationReady && deck.manifest && type && deck.tags.energyTypes.some((energyType) => energyType.toLocaleLowerCase() === type.toLocaleLowerCase()));
  return typed?.manifest ?? tournamentDecks.find((deck) => deck.simulationReady && deck.manifest)?.manifest ?? SKELEDIRGE;
}

export function screeningOpponents(cardId: string): [DeckManifest, DeckManifest] {
  const card = index.byId.get(cardId);
  const text = `${card?.name ?? ""} ${(card?.attacks ?? []).map((attack) => attack.text).join(" ")}`;
  const premade = /Team Rocket/i.test(text) ? NIDOKING : card?.types?.includes("Darkness") ? OKIDOGI : SKELEDIRGE;
  const tournament = relevantTournamentOpponent(cardId);
  return tournament.id === premade.id ? [premade, premade === SKELEDIRGE ? OKIDOGI : SKELEDIRGE] : [premade, tournament];
}

export function generateScreeningCandidates(cardId: string): ArchitectCandidate[] {
  const profiles = ["balanced", "turbo", "resilient", "control", "aggressive"] as const;
  const generated = profiles.flatMap((profile) => generateAnchor(cardId, profile, 5).candidates);
  return [...new Map(generated.map((candidate) => [candidate.fingerprint, candidate])).values()]
    .filter((candidate) => candidate.simulationReady && candidate.coherence?.coherent)
    .slice(0, 5);
}

export function selectedTargets(): typeof benchmarkAnchors {
  const indexArg = Number(process.argv.find((arg) => arg.startsWith("--anchor-index="))?.split("=")[1] ?? "NaN");
  return (Number.isInteger(indexArg) ? benchmarkAnchors.slice(indexArg, indexArg + 1) : benchmarkAnchors) as typeof benchmarkAnchors;
}
