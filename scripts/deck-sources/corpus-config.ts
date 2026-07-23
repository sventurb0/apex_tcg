export interface CorpusSourceConfig {
  sourceDeckId: string;
  mandatory?: boolean;
  expected?: { archetype?: string; player?: string; placement?: number };
  reviewedOverride?: { player?: string; notes?: string[] };
}

const mandatory: CorpusSourceConfig[] = [
  { sourceDeckId: "28249", mandatory: true, expected: { archetype: "Lillie's Clefairy", player: "James Kowalski", placement: 1 } },
  { sourceDeckId: "28236", mandatory: true, expected: { archetype: "Dragapult Dusknoir", player: "Neddy Kosek", placement: 2 }, reviewedOverride: { player: "Neddy Kosek", notes: ["NAIC event results identify Neddy Kosek as the second-place player; the shared deck-list page separately credits Roman G. as list author."] } },
  { sourceDeckId: "28250", mandatory: true, expected: { archetype: "Dragapult", player: "Justin Newdorf", placement: 3 } },
  { sourceDeckId: "28251", mandatory: true, expected: { archetype: "Slowking", player: "Ross Cawthon", placement: 4 } },
  { sourceDeckId: "28252", mandatory: true, expected: { archetype: "Crustle", player: "Rahul Reddy", placement: 5 } },
  { sourceDeckId: "28254", mandatory: true, expected: { archetype: "Rocket's Mewtwo", player: "Juho Kallama", placement: 7 } },
  { sourceDeckId: "28257", mandatory: true, expected: { archetype: "N's Zoroark", player: "Tord Reklev", placement: 10 } },
  { sourceDeckId: "28262", mandatory: true, expected: { archetype: "Ogerpon Box", player: "Mees Brenninkmeijer", placement: 18 } },
  { sourceDeckId: "28266", mandatory: true, expected: { archetype: "Hydrapple", player: "Grant Walworth", placement: 25 } },
  { sourceDeckId: "28405", mandatory: true, expected: { archetype: "Alakazam Dudunsparce" } },
];

// Deliberately samples a broad NAIC placing range. Sync retains every source
// snapshot but fingerprints identical 60-card compositions for deduplication.
const additionalNaic: CorpusSourceConfig[] = [
  "28253", "28255", "28256", "28258", "28259", "28260", "28261", "28263", "28264", "28265",
  "28267", "28268", "28269", "28270", "28271", "28272", "28273", "28274", "28275", "28276",
  // Type and prize-profile coverage selected from the same NAIC 2026 results.
  "27961", // Mega Lucario — Fighting
  "28423", // Metagross — Metal
  "28571", // Mega Greninja — Water
  "28692", // Joltik Box — Lightning
  "28371", // Festival Lead — single-Prize
  "28675", // second Lillie's Clefairy composition
  "28351", // second Rocket's Mewtwo composition
].map((sourceDeckId) => ({ sourceDeckId }));

export const CORPUS_SOURCES: readonly CorpusSourceConfig[] = [...mandatory, ...additionalNaic];
export const MANDATORY_SOURCE_IDS = new Set(mandatory.map((source) => source.sourceDeckId));
export function limitlessDeckUrl(id: string): string { return `https://limitlesstcg.com/decks/list/${id}`; }
