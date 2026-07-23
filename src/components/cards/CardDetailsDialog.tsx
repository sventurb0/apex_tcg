import { useEffect, useRef, useState } from "react";
import type { PokemonCardMetadata } from "../../data/pokemon";
import { PrintedCard } from "./PrintedCard";
import { CardImage } from "./CardImage";

export function CardDetailsDialog({ card, onClose, onAdd, onPrevious, onNext }: { card: PokemonCardMetadata; onClose: () => void; onAdd?: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); };
  }, [onClose]);
  return <div className="details-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="card-details-dialog" role="dialog" aria-modal="true" aria-labelledby="card-details-title">
      <header className="card-details-dialog-head"><div><span>Full printed card details</span><h2 id="card-details-title">{card.name}</h2></div><div className="details-navigation">{onPrevious && <button onClick={onPrevious} aria-label="Previous card">Previous</button>}{onNext && <button onClick={onNext} aria-label="Next card">Next</button>}<button onClick={() => setZoomed((value) => !value)} aria-pressed={zoomed}>{zoomed ? "Fit" : "Zoom"}</button><button ref={closeButton} onClick={onClose} aria-label={`Close ${card.name} details`}>Close</button></div></header>
      <div className={`card-details-content ${zoomed ? "card-details-content--zoomed" : ""}`}><CardImage card={card} size="large" priority /><PrintedCard card={card} mode="full" /></div>
      {onAdd && <button className="primary dialog-add" onClick={onAdd}>Add one copy</button>}
    </section>
  </div>;
}
