import { readFileSync } from "node:fs";
import { analyseDeck } from "../src/features/deck-builder/validation";
import { candidateManifest, createImplementationBacklog, generateCandidates, runQuickGauntlet, type ArchitectRequest } from "../src/features/deck-architect";
import { compileCardImplementation, createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue, type PokemonCardMetadata } from "../src/data/pokemon";
import { premadeDecks } from "../src/data/decks/premade";

const check = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const catalogue = JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue;
let index = createCatalogueIndex(catalogue.cards);
const request = (favourites: ArchitectRequest["favourites"], mode: ArchitectRequest["mode"] = "simulation-ready", candidateCount: 3 | 5 | 10 = 3): ArchitectRequest => ({ favourites, mode, candidateCount, seed: 42, format: "standard" });

const skeledirgeRequest = request([{ cardId: "sv2-233", exactPrintingRequired: true }]);
const skeledirgeA = generateCandidates(skeledirgeRequest, index);
const skeledirgeB = generateCandidates(skeledirgeRequest, index);
check(skeledirgeA.candidates.length === 3 && skeledirgeA.rejected.length === 0, "Scenario A did not generate three PAL 233 candidates.");
check(new Set(skeledirgeA.candidates.map((candidate) => candidate.fingerprint)).size === 3, "Scenario A candidates are not distinct.");
check(skeledirgeA.candidates.map((candidate) => candidate.fingerprint).join("|") === skeledirgeB.candidates.map((candidate) => candidate.fingerprint).join("|"), "Scenario A is not deterministic for seed 42.");
const skeledirgeCandidate = skeledirgeA.candidates[0]!;
check(skeledirgeCandidate.deck.entries.some((entry) => entry.cardId === "sv2-233"), "Scenario A changed the required exact printing.");
check(compileCardImplementation(index.byId.get("sv2-233")!).canonicalCardId === "sv2-37", "PAL 233 did not inherit PAL 37.");
check(toRuntimeCardDefinition(index.byId.get("sv2-233")!) !== null, "PAL 233 has no runtime definition.");
const handoff = candidateManifest(skeledirgeCandidate, skeledirgeRequest);
check(handoff.architect?.selectedCardIds[0] === "sv2-233" && analyseDeck(handoff, index).simulationReady, "Save/edit/play handoff lost Architect metadata or runtime readiness.");

const poisonRequest = request([{ cardId: "sv6pt5-36", exactPrintingRequired: true }, { cardId: "sv6pt5-39", exactPrintingRequired: true }]);
const poison = generateCandidates(poisonRequest, index);
check(poison.candidates.length === 3, "Scenario B did not generate three Okidogi/Pecharunt candidates.");
check(new Set(poison.candidates.map((candidate) => candidate.fingerprint)).size === 3, "Scenario B candidates are not distinct.");
const poisonCandidate = poison.candidates[0]!;
check(poisonCandidate.deck.entries.every((entry) => { const card = index.byId.get(entry.cardId); return card && ["complete", "generated"].includes(compileCardImplementation(card).status) && toRuntimeCardDefinition(card); }), "Scenario B contains an unsupported or missing runtime card.");
check(/Subjugating Chains.*Chain-Crazed/i.test(poisonCandidate.explanations.join(" ")), "Scenario B did not explain the reviewed Poison synergy.");
const gauntlet = await runQuickGauntlet(poisonCandidate, premadeDecks, index, 20);
check(gauntlet.games === 60, `Scenario B ran ${gauntlet.games}, expected 60 games.`);
check(gauntlet.unresolved === 0, `Scenario B produced ${gauntlet.unresolved} unresolved games.`);

const unsupported = catalogue.cards.find((card) => card.supertype === "Pokémon" && card.subtypes.includes("Basic") && card.legalities.standard === "Legal" && card.abilities?.length && compileCardImplementation(card).status === "unsupported");
check(unsupported, "Scenario C could not find an unsupported Standard-legal Ability favourite.");
const unsupportedFavourite = [{ cardId: unsupported.id, exactPrintingRequired: true }];
const blocked = generateCandidates(request(unsupportedFavourite), index);
check(blocked.candidates.length === 0 && blocked.rejected.some((entry) => entry.cardId === unsupported.id), "Scenario C did not reject unsupported simulation-ready input.");
const creative = generateCandidates(request(unsupportedFavourite, "creative"), index);
check(creative.candidates.length > 0 && !creative.candidates[0]!.simulationReady, "Scenario C did not produce a blocked creative candidate.");
const backlog = createImplementationBacklog(creative.candidates, index);
check(backlog.items.some((item) => item.cardId === unsupported.id), "Scenario C backlog omitted the unsupported favourite.");
let creativeSimulationBlocked = false;
try { await runQuickGauntlet(creative.candidates[0]!, premadeDecks, index, 2); } catch { creativeSimulationBlocked = true; }
check(creativeSimulationBlocked, "Scenario C allowed a creative candidate into simulation.");

const generated: PokemonCardMetadata = { id: "architect-acceptance-fixed", name: "Architect Acceptance Attacker", setId: "test", setName: "Acceptance", setCode: "TST", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Basic"], hp: 100, types: ["Darkness"], retreat: 1, attacks: [{ name: "Wait", cost: [], energy: 0, damage: "", text: "" }, { name: "Strike", cost: ["Darkness"], energy: 1, damage: "50", text: "" }], legalities: { standard: "Legal" } };
index = createCatalogueIndex([generated, ...catalogue.cards]);
check(compileCardImplementation(generated).status === "generated", "Scenario D card did not use the safe generated implementation.");
const generatedResult = generateCandidates(request([{ cardId: generated.id, exactPrintingRequired: true }]), index);
check(generatedResult.candidates.length === 3 && generatedResult.candidates.every((candidate) => candidate.simulationReady), "Scenario D did not produce simulation-ready generated-card candidates.");
const generatedGauntlet = await runQuickGauntlet(generatedResult.candidates[0]!, [premadeDecks[0]!], index, 2);
check(generatedGauntlet.games === 2 && generatedGauntlet.unresolved === 0, "Scenario D did not complete a safe generated-card simulation.");

console.log(JSON.stringify({
  scenarioA: { candidates: skeledirgeA.candidates.length, exactPrinting: "sv2-233", canonicalBehaviour: "sv2-37", deterministic: true, total: analyseDeck(skeledirgeCandidate.deck, createCatalogueIndex(catalogue.cards)).total },
  scenarioB: { candidates: poison.candidates.length, synergy: "Subjugating Chains -> Chain-Crazed", gauntlet },
  scenarioC: { cardId: unsupported.id, simulationReadyRejected: true, creativeCandidates: creative.candidates.length, backlogItems: backlog.items.length, simulationBlocked: creativeSimulationBlocked },
  scenarioD: { cardId: generated.id, implementation: "generated", candidates: generatedResult.candidates.length, simulationReady: true, simulationGames: generatedGauntlet.games, unresolved: generatedGauntlet.unresolved },
  handoffs: { savedManifestPreservesExactPrinting: true, editReady: true, playReady: true },
}, null, 2));
