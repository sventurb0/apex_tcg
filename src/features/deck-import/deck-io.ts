import type { DeckManifest } from "../../data/decks/types";
import type { CatalogueIndex } from "../../data/pokemon";
import type { DeckImportReport, FormatProfile } from "./types";

export function exportDeckList(deck: DeckManifest, index: CatalogueIndex): string {
  return (["Pokémon", "Trainer", "Energy"] as const).flatMap((supertype) => {
    const lines = deck.entries.flatMap((entry) => {
      const card = index.byId.get(entry.cardId);
      return card?.supertype === supertype ? [`${entry.count} ${card.name} ${card.setCode} ${card.collectorNumber}`] : [];
    });
    return lines.length ? [supertype, ...lines, ""] : [];
  }).join("\n").trim();
}

export function manifestFromImport(report: DeckImportReport, name: string, format: FormatProfile, id = `deck-${Date.now()}`): DeckManifest {
  if (!report.canSave) throw new Error("Cannot create a deck manifest while card identities remain unresolved or ambiguous.");
  const counts = new Map<string, number>();
  for (const line of report.resolved) counts.set(line.card.id, (counts.get(line.card.id) ?? 0) + line.quantity);
  const now = new Date().toISOString();
  return {
    id, name: name.trim() || "Imported deck", description: "Imported text deck", format,
    entries: [...counts].map(([cardId, count]) => ({ cardId, count })), source: "saved", createdAt: now, updatedAt: now,
  };
}
