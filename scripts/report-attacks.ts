import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCoverageContext } from "./coverage-context";

const { catalogue, signatures } = await loadCoverageContext();
const totalExactAttacks = catalogue.cards.reduce((sum, card) => sum + (card.attacks?.length ?? 0), 0);
const fixedNoText = signatures.attacks.filter((signature) => !signature.normalizedText && /^\d*$/.test(signature.printedDamage ?? ""));
const effectSignatures = signatures.attacks.filter((signature) => signature.normalizedText || !/^\d*$/.test(signature.printedDamage ?? ""));
const executable = effectSignatures.filter((signature) => signature.support === "complete");
const unsupported = effectSignatures.filter((signature) => signature.support !== "complete");
await writeFile(resolve("public/data/attack-signatures.json"), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), sourceCommit: catalogue.source.commit, signatures: signatures.attacks }, null, 2)}\n`, "utf8");
console.log(`Attack coverage report\nTotal exact attacks: ${totalExactAttacks.toLocaleString()}\nDistinct attack signatures: ${signatures.attacks.length.toLocaleString()}\nFixed no-text signatures: ${fixedNoText.length.toLocaleString()}\nExecutable effect signatures: ${executable.length.toLocaleString()}\nUnsupported or partial effect signatures: ${unsupported.length.toLocaleString()}`);
console.log("\nMost common unsupported attack-effect signatures:");
for (const signature of unsupported.slice(0, 15)) console.log(`${signature.exactOccurrenceCount.toString().padStart(4)}  ${signature.displayName} [${signature.printedDamage || "—"}] — ${signature.normalizedText || "variable printed damage"}`);
console.log(`\nUnsupported signatures used by favourite Pokémon: ${unsupported.filter((signature) => signature.favouriteNames.length).length.toLocaleString()}\nUnsupported signatures used by premade decks: ${unsupported.filter((signature) => signature.referencedByDecks.length).length.toLocaleString()}\nSignatures blocking saved decks: 0 (browser-local saved decks are unavailable to the CLI)\nSignatures blocking Deck Architect candidates: 0 (populated by candidate audits)`);
