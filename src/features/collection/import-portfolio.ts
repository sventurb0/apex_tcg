import { compileCardImplementation, createCatalogueIndex, gameplaySignature, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../../data/pokemon";
import type { OwnedCardEntry, OwnedCollectionDocument, CollectionResolutionType } from "./types";

const ALIASES: Readonly<Record<string, string>> = {
  "Battle Academy 2024 Switch": "sv1-194", "Battle Academy 2024 Potion": "sv1-188", "Battle Academy 2024 Nest Ball": "sv1-181",
  "Battle Academy 2024 Jacq": "sv1-175", "Battle Academy 2024 Youngster": "sv1-198", "Worlds 2023 Escape Rope": "swsh5-125",
  "Prize Pack Iono": "sv2-185", "Battle Academy 2022 Switch": "swsh1-183", "Prize Pack Munkidori": "sv6-95",
  "Prize Pack Night Stretcher": "sv6pt5-61", "Prize Pack Earthen Vessel": "sv4-163",
};

function normaliseSet(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "m1") return "me1";
  if (trimmed === "me02") return "me2";
  if (trimmed === "me04") return "me4";
  if (trimmed === "me05") return "me5";
  return trimmed;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]!;
    if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ",") { row.push(field); field = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(field); field = ""; if (row.some(Boolean)) rows.push(row); row = []; continue; }
    field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function amount(value: string): number { const parsed = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10); return Number.isFinite(parsed) ? parsed : 0; }
function field(headers: string[], row: string[], name: string): string { return row[headers.indexOf(name)]?.trim() ?? ""; }

export function importPortfolioCsv(csv: string, catalogue: PokemonCardCatalogue, sourceFile = "owned_collection_normalized_2026-07-27.csv"): OwnedCollectionDocument {
  const rows = parseCsv(csv); const headers = rows.shift() ?? []; const index = createCatalogueIndex(catalogue.cards); const invalidRows: Array<{ sourceRow: number; reason: string }> = [];
  const entries: OwnedCardEntry[] = [];
  for (const [offset, row] of rows.entries()) {
    const sourceRow = amount(field(headers, row, "source_row")) || offset + 2; const productName = field(headers, row, "product_name"); const suppliedId = field(headers, row, "catalogue_card_id");
    const aliasId = ALIASES[productName]; const setId = normaliseSet(field(headers, row, "source_set_id")); const collector = (field(headers, row, "card_number").split("/")[0] ?? "").replace(/^0+/, "") || "0";
    const resolved = (suppliedId && index.byId.get(suppliedId)) || (aliasId && index.byId.get(aliasId)) || index.byPrinting.get(`${setId}-${collector}`)?.find((card) => card.name.toLocaleLowerCase() === productName.toLocaleLowerCase());
    const canonicalId = field(headers, row, "canonical_behaviour_card_id") || resolved?.id;
    const canonical = canonicalId ? index.byId.get(canonicalId) : undefined;
    if (!resolved || !canonical) { invalidRows.push({ sourceRow, reason: `Could not resolve ${productName} (${setId}-${collector}).` }); continue; }
    const resolutionType = (field(headers, row, "resolution_type") || (aliasId ? "functional-reprint-alias" : suppliedId === resolved.id ? "exact" : "set-id-alias")) as CollectionResolutionType;
    const implementation = compileCardImplementation(canonical); const runtime = toRuntimeCardDefinition(canonical);
    if (!runtime) invalidRows.push({ sourceRow, reason: `${canonical.id} has no executable runtime definition.` });
    entries.push({ ownedProductId: field(headers, row, "owned_product_id") || `row:${sourceRow}`, catalogueCardId: resolved.id, canonicalBehaviourCardId: canonical.id, resolutionType, productName, setName: field(headers, row, "set_name"), sourceSetId: field(headers, row, "source_set_id"), cardNumber: field(headers, row, "card_number"), material: field(headers, row, "material"), rarity: field(headers, row, "rarity"), condition: field(headers, row, "condition"), quantity: amount(field(headers, row, "quantity")), pricePerUnit: field(headers, row, "price_per_unit"), totalCost: field(headers, row, "total_cost"), sourceRow, metadata: resolved, canonicalMetadata: canonical, implementation });
  }
  const breakdown = { exact: 0, "set-id-alias": 0, "functional-reprint-alias": 0 } as Record<CollectionResolutionType, number>; entries.forEach((entry) => { breakdown[entry.resolutionType] += 1; });
  const diagnostics = { csvRows: rows.length, physicalCopies: entries.reduce((sum, entry) => sum + entry.quantity, 0), distinctOwnedProducts: new Set(entries.map((entry) => entry.ownedProductId)).size, distinctCatalogueCardIds: new Set(entries.map((entry) => entry.catalogueCardId)).size, distinctCardNames: new Set(entries.map((entry) => entry.metadata.name)).size, unresolvedRows: invalidRows.length, invalidRows, resolutionBreakdown: breakdown };
  return { version: 1, generatedAt: new Date().toISOString(), sourceFile, basicEnergyInventory: "unlimited", basicEnergyAssumption: "Basic Energy is unlimited unless the user switches collection settings to exact quantities.", entries, diagnostics };
}

export function collectionIndex(document: OwnedCollectionDocument): Map<string, OwnedCardEntry[]> { const grouped = new Map<string, OwnedCardEntry[]>(); for (const entry of document.entries) grouped.set(entry.catalogueCardId, [...(grouped.get(entry.catalogueCardId) ?? []), entry]); return grouped; }
export function cardGameplaySignature(entry: OwnedCardEntry): string { return gameplaySignature(entry.canonicalMetadata); }
