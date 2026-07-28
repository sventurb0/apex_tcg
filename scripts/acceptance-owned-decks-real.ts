import { readFileSync } from "node:fs";

interface AcceptanceReport { decks: Array<{ id: string; validation: { simulationGames: number; simulationReady: boolean; [key: string]: unknown } }> }
const report = JSON.parse(readFileSync("public/data/owned-deck-acceptance.json", "utf8")) as AcceptanceReport;
const missingSimulationGames = report.decks.filter((deck) => deck.validation.simulationGames < 250).map((deck) => deck.id);
const result = { decks: report.decks.length, realDecks: report.decks.filter((deck) => deck.validation.simulationReady).length, requiredGamesPerDeck: 250, simulationGames: Object.fromEntries(report.decks.map((deck) => [deck.id, deck.validation.simulationGames])), missingSimulationGames };
console.log(JSON.stringify(result, null, 2));
if (result.decks !== 6 || missingSimulationGames.length) process.exitCode = 1;
