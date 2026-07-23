import type { DeckLaunchEligibility } from "../../features/deck-builder/launch-eligibility";

export function DeckEligibilityPanel({ eligibility, onEdit, onDevelopment }: { eligibility: DeckLaunchEligibility; onEdit: () => void; onDevelopment: () => void }) {
  if (eligibility.playable) return <p className="deck-ready-status">Ready to play · {eligibility.cardCount} cards · all exact printings executable</p>;
  return <section className="deck-eligibility-panel" role="status">
    <div><strong>{eligibility.deck.name} is visible, but unavailable to launch.</strong><span>{eligibility.cardCount} / 60 cards · {eligibility.unsupportedCards.length} unsupported exact printings</span></div>
    <p>{eligibility.reason}</p>
    {eligibility.constructionErrors.length > 0 && <ul>{eligibility.constructionErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul>}
    {eligibility.unsupportedCards.length > 0 && <div className="unsupported-preview">{eligibility.unsupportedCards.slice(0, 6).map((card) => <span key={card.id}>{card.name} · {card.setCode} {card.collectorNumber}</span>)}{eligibility.unsupportedCards.length > 6 && <span>+ {eligibility.unsupportedCards.length - 6} more</span>}</div>}
    <div className="eligibility-actions"><button onClick={onEdit}>Return to Deck Builder</button><button onClick={onDevelopment}>Open Development diagnostics</button></div>
  </section>;
}
