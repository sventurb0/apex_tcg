import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCoverageContext } from "./coverage-context";

const { catalogue, signatures } = await loadCoverageContext();
const all = [...signatures.trainerEffects, ...signatures.energyEffects];
await writeFile(resolve("public/data/effect-signatures.json"), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), sourceCommit: catalogue.source.commit, trainerSignatures: signatures.trainerEffects, energySignatures: signatures.energyEffects }, null, 2)}\n`, "utf8");
const row = (name: string, values: typeof all) => `${name}: ${values.length.toLocaleString()} distinct; ${values.filter((signature) => signature.support === "complete").length.toLocaleString()} complete; ${values.filter((signature) => signature.support === "partial").length.toLocaleString()} partial; ${values.filter((signature) => signature.support === "unsupported").length.toLocaleString()} unsupported`;
console.log(`Trainer and Special Energy effect coverage\n${row("Trainer effects", signatures.trainerEffects)}\n${row("Special Energy effects", signatures.energyEffects)}\n${row("Combined", all)}`);
console.log("\nMost common unsupported Trainer/Energy signatures:");
for (const signature of all.filter((value) => value.support !== "complete").sort((a, b) => b.exactOccurrenceCount - a.exactOccurrenceCount).slice(0, 20)) console.log(`${signature.exactOccurrenceCount.toString().padStart(4)}  ${signature.kind} · ${signature.displayName} — ${signature.normalizedText || "no non-reminder effect text"}`);
