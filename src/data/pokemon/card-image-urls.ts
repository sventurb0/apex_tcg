import type { PokemonCardMetadata } from "./types";

const allowedImageHosts = new Set(["images.pokemontcg.io"]);
const failedImageUrls = new Set<string>();
export type CardImageSize = "thumbnail" | "small" | "large";

export function isApprovedCardImageUrl(value: string | undefined): value is string {
  if (!value) return false;
  try { const url = new URL(value); return url.protocol === "https:" && allowedImageHosts.has(url.hostname); } catch { return false; }
}

export function selectCardImageUrl(card: PokemonCardMetadata, size: CardImageSize): string | undefined { const candidate = size === "large" ? card.images?.large : card.images?.small; return isApprovedCardImageUrl(candidate) ? candidate : undefined; }
export function cardImageAlt(card: PokemonCardMetadata): string { return `${card.name}, ${card.setName} ${card.collectorNumber}`; }
export function hasFailedCardImage(url: string): boolean { return failedImageUrls.has(url); }
export function markCardImageFailed(url: string): void { failedImageUrls.add(url); }
export function resetFailedCardImagesForTests(): void { failedImageUrls.clear(); }
