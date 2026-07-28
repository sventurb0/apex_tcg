import { readFileSync } from "node:fs";
import { benchmarkAnchors, generateAnchor, index } from "./architect-acceptance-common";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
const profiles = ["balanced", "turbo", "resilient", "control", "aggressive"] as const;
const opponent = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8"));
const results = await Promise.all(benchmarkAnchors.map(async ([cardId, name]) => {
  if (!index.byId.has(cardId)) return { cardId, name, status: "missing-anchor" };
  const generated = profiles.flatMap((profile) => generateAnchor(cardId, profile, 5).candidates);
  const distinct = [...new Map(generated.map((candidate) => [candidate.fingerprint, candidate])).values()].slice(0, 5);
  const candidate = distinct.find((value) => value.simulationReady);
  const summary = candidate ? await runQuickGauntlet(candidate, [opponent], index, 1) : undefined;
  return {
    cardId, name, generatedCandidates: generated.length, candidateCount: distinct.length,
    playableCandidates: distinct.filter((value) => value.simulationReady).length,
    profiles: profiles.length,
    routes: [...new Set(distinct.map((value) => value.route))],
    sourceBacked: distinct.some((value) => value.route === "proven"),
    screenedGames: summary?.games ?? 0,
    unresolved: summary?.unresolved ?? null,
  };
}));
const playableAnchors = results.filter((result) => result.status !== "missing-anchor" && result.playableCandidates > 0).length;
const generatedCandidateDecks = results.reduce((total, result) => total + (result.generatedCandidates ?? 0), 0);
const uniqueCandidateDecks = results.reduce((total, result) => total + (result.candidateCount ?? 0), 0);
const gate = { anchors: results.length >= 24, playableAnchors: playableAnchors >= 20, generatedCandidateDecks: generatedCandidateDecks >= 100 };
console.log(JSON.stringify({ anchors: results.length, playableAnchors, generatedCandidateDecks, uniqueCandidateDecks, gate, minimums: { anchors: 24, playableAnchors: 20, generatedCandidateDecks: 100 }, results }, null, 2));
if (!gate.anchors || !gate.playableAnchors || !gate.generatedCandidateDecks) process.exitCode = 1;
