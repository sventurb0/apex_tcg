import type { PokemonCardMetadata } from "../../data/pokemon";
import { CardSetFooter } from "./CardSetFooter";
import { SimulationSupportBadge, SimulationSupportDetails } from "./SimulationSupportBadge";

export function TrainerCardFace({ card, mode }: { card: PokemonCardMetadata; mode: "full" | "compact" }) {
  const full = mode === "full";
  const subtype = card.subtypes.join(" · ") || "Item";
  const aceSpec = card.subtypes.some((item) => /ACE SPEC/i.test(item)) || card.rules?.some((rule) => /ACE SPEC/i.test(rule));
  return <>
    <header className="printed-card-header">
      <div><span className="printed-kicker">Trainer · {subtype}</span><h3>{card.name}</h3></div>
      {aceSpec && <strong className="ace-spec">ACE SPEC</strong>}
    </header>
    <div className="printed-card-body">
      {full ? <>
        <section className="trainer-rules" aria-label="Printed Trainer rules">
          {(card.rules?.length ? card.rules : card.trainerText ? [card.trainerText] : []).map((rule, index) => <p key={`${rule}-${index}`}>{rule}</p>)}
          {!card.rules?.length && !card.trainerText && <p className="metadata-empty">No printed Trainer rules are listed.</p>}
        </section>
        {card.flavorText && <p className="flavor-text">{card.flavorText}</p>}
        <div className="card-support"><SimulationSupportBadge card={card} /><SimulationSupportDetails card={card} /></div>
        <CardSetFooter card={card} />
      </> : <p className="compact-summary">{card.rules?.[0] ?? card.trainerText ?? "No printed rules listed."}</p>}
    </div>
    {!full && <div className="compact-footer"><SimulationSupportBadge card={card} /><span>{card.setCode} {card.collectorNumber}</span></div>}
  </>;
}
