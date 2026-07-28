import { readFileSync } from "node:fs";
import { benchmarkAnchors, generateAnchor, index } from "./architect-acceptance-common";
import { runQuickGauntlet } from "../src/features/deck-architect/gauntlet";
const profiles = ["balanced", "turbo", "resilient", "control", "aggressive"] as const;
const opponent = JSON.parse(readFileSync("src/data/decks/premade/skeledirge-armarouge.json", "utf8"));
const results = await Promise.all(benchmarkAnchors.map(async ([cardId, name]) => { if (!index.byId.has(cardId)) return { cardId, name, status: "missing-anchor" }; const variants = profiles.map((profile) => generateAnchor(cardId, profile).candidates[0]).filter(Boolean); const candidate = variants.find((value) => value!.simulationReady); const summary = candidate ? await runQuickGauntlet(candidate!, [opponent], index, 1) : undefined; return { cardId, name, profiles: variants.length, routes: [...new Set(variants.map((value) => value!.route))], distinct: new Set(variants.map((value) => value!.fingerprint)).size, sourceBacked: variants.some((value) => value!.route === "proven"), screenedGames: summary?.games ?? 0, unresolved: summary?.unresolved ?? null }; }));
console.log(JSON.stringify({ anchors: results.length, results }, null, 2));
