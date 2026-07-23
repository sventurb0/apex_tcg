import type { PokemonCardMetadata } from "../../data/pokemon";

export function CardSetFooter({ card }: { card: PokemonCardMetadata }) {
  const legalities = Object.entries(card.legalities).filter(([, value]) => value).map(([format, value]) => `${format}: ${value}`).join(" · ");
  return <footer className="card-set-footer">
    <span className="set-identity"><b>{card.setName}</b><span>{card.setCode} {card.collectorNumber}</span></span>
    <span>{card.rarity ?? "Rarity not listed"}</span>
    <span>{card.regulationMark ? `Regulation ${card.regulationMark}` : "No regulation mark"}</span>
    <span>{card.artist ? `Illustrator: ${card.artist}` : "Illustrator not listed"}</span>
    <span>{card.releaseDate ? `Released ${card.releaseDate}` : "Release date not listed"}</span>
    {legalities && <span title={legalities}>{legalities}</span>}
  </footer>;
}
