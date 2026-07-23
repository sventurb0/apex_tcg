import { parseLimitlessDeckPage } from "./limitless-parser";
import type { ParsedLimitlessDeck } from "./limitless-parser";

export async function fetchLimitlessDeck(url: string, sourceDeckId: string, accessedAt = new Date().toISOString()): Promise<{ html: string; parsed: ParsedLimitlessDeck }> {
  const response = await fetch(url, { headers: { "user-agent": "TCG-DeckLab development corpus sync/1.0" } });
  if (!response.ok) throw new Error(`Limitless source ${sourceDeckId} returned HTTP ${response.status} (${url}).`);
  const html = await response.text();
  return { html, parsed: parseLimitlessDeckPage(html, url, sourceDeckId, accessedAt) };
}

