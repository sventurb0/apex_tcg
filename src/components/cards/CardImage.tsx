import { useState } from "react";
import type { PokemonCardMetadata } from "../../data/pokemon";
import { cardImageAlt, hasFailedCardImage, markCardImageFailed, selectCardImageUrl, type CardImageSize } from "../../data/pokemon/card-image-urls";

export interface CardImageProps { card: PokemonCardMetadata; size?: CardImageSize; priority?: boolean; className?: string; onOpen?: () => void; }

function TextFallback({ card }: { card: PokemonCardMetadata }) {
  const identity = card.supertype === "Pokémon" ? card.types?.join(" / ") || "Pokémon" : card.supertype === "Trainer" ? card.subtypes.join(" · ") || "Trainer" : card.types?.[0] ? `${card.types[0]} Energy` : "Energy";
  return <span className="card-image-fallback" data-testid="card-image-fallback"><b>{card.name}</b><small>{identity}</small><small>{card.setCode} {card.collectorNumber}</small></span>;
}

export function CardImage({ card, size = "small", priority = false, className = "", onOpen }: CardImageProps) {
  const url = selectCardImageUrl(card, size);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(url && (failedUrl === url || hasFailedCardImage(url)));
  const loaded = Boolean(url && loadedUrl === url);
  const content = <span className={`card-image card-image--${size} ${className}`.trim()}>{(!url || failed || !loaded) && <TextFallback card={card} />}{url && !failed && <img src={url} alt={cardImageAlt(card)} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} referrerPolicy="no-referrer" onLoad={() => setLoadedUrl(url)} onError={() => { markCardImageFailed(url); setFailedUrl(url); }} />}</span>;
  return onOpen ? <button type="button" className="card-image-button" onClick={onOpen} aria-label={`Open full details for ${card.name}`}>{content}</button> : content;
}
