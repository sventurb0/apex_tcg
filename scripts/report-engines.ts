import { writeFile } from "node:fs/promises";
import { engineSynergyEdges } from "../src/features/deck-architect/engines/capability-graph";
import { engineDefinitions } from "../src/features/deck-architect/engines/definitions";

async function main(): Promise<void> {
  const rows = engineDefinitions.map((engine) => `| ${engine.name} | ${engine.energyTypes.join(", ")} | ${engine.strategicRoles.join(", ")} | ${engine.providers.length} | ${engine.consumers.length} | ${engineSynergyEdges(engine).length} | ${engine.sourceDeckIds.length} | ${engine.reviewed ? "reviewed" : "draft"} |`).join("\n");
  const details = engineDefinitions.map((engine) => `## ${engine.name}\n\n- ID: \`${engine.id}\`\n- Core exact IDs: ${engine.coreCardIds.map((id) => `\`${id}\``).join(", ")}\n- Required packages: ${engine.requiredPackages.join(", ")}\n- Bench demand: ${engine.benchDemand}; setup: ${engine.setupSpeed}; prizes: ${engine.prizeProfile}\n- Source decks: ${engine.sourceDeckIds.join(", ") || "none (catalogue-reviewed only)"}\n- Review: ${engine.reviewNotes.join(" ")}\n`).join("\n");
  await writeFile("TYPE_ENGINE_LIBRARY.md", `# Type Engine Library\n\nEngines are defined by exact capabilities and requirements. Shared Pokémon type alone never creates a synergy edge.\n\n| Engine | Energy | Roles | Providers | Requirements | Semantic edges | Sources | Status |\n|---|---|---|---:|---:|---:|---:|---|\n${rows}\n\n${details}`, "utf8");
  console.log(`Engine report: ${engineDefinitions.length} reviewed definitions, ${engineDefinitions.reduce((sum, engine) => sum + engineSynergyEdges(engine).length, 0)} semantic edges.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

