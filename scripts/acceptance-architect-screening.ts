import { readFileSync } from "node:fs";
import { benchmarkAnchors, generateAnchor, index } from "./architect-acceptance-common";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
const opponent = JSON.parse(readFileSync("src/data/decks/premade/okidogi-ex-poison.json", "utf8"));
const results = benchmarkAnchors.filter(([cardId]) => index.byId.has(cardId)).map(([cardId, name]) => { const candidates = generateAnchor(cardId).candidates; const candidate = candidates.find((value) => value.simulationReady); if (!candidate) return { cardId, name, candidates: candidates.length, unresolved: null, ready: false, screening: "skipped: no simulation-ready candidate" }; const summary = runQuickGauntlet(candidate, [opponent], index, 1); return { cardId, name, candidates: candidates.length, unresolved: summary.then((value) => value.unresolved), ready: true, screening: "one deterministic game against Okidogi" }; });
const resolved = await Promise.all(results.map(async (result) => ({ ...result, unresolved: await result.unresolved })));
console.log(JSON.stringify({ screeningMode: "gameplay", screenedAnchors: resolved.length, candidates: resolved.reduce((sum, result) => sum + result.candidates, 0), unresolved: resolved.reduce((sum, result) => sum + (result.unresolved ?? 0), 0), results: resolved }, null, 2));
