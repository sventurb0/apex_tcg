import type { PokemonCardMetadata } from "../../data/pokemon";
import { CardSetFooter } from "./CardSetFooter";
import { EnergySymbol } from "./EnergySymbol";
import { SimulationSupportBadge, SimulationSupportDetails } from "./SimulationSupportBadge";

export function EnergyCardFace({ card, mode }: { card: PokemonCardMetadata; mode: "full" | "compact" }) {
  const full = mode === "full";
  const basic = card.subtypes.includes("Basic");
  return <>
    <header className="printed-card-header">
      <div><span className="printed-kicker">{basic ? "Basic Energy" : "Special Energy"}</span><h3>{card.name}</h3></div>
      <div className="energy-identity">{card.types?.map((type) => <EnergySymbol type={type} key={type} />)}{!card.types?.length && <span>Special</span>}</div>
    </header>
    <div className="printed-card-body">
      {full ? <>
        <section className="energy-rules" aria-label="Printed Energy rules">
          {(card.rules?.length ? card.rules : card.energyText ? [card.energyText] : []).map((rule, index) => <p key={`${rule}-${index}`}>{rule}</p>)}
          {!card.rules?.length && !card.energyText && <p>{basic ? `Provides 1 ${card.types?.[0] ?? "basic"} Energy.` : "No printed Energy rules are listed."}</p>}
        </section>
        {card.flavorText && <p className="flavor-text">{card.flavorText}</p>}
        <div className="card-support"><SimulationSupportBadge card={card} /><SimulationSupportDetails card={card} /></div>
        <CardSetFooter card={card} />
      </> : <p className="compact-summary">{basic ? `${card.types?.[0] ?? "Basic"} Energy` : card.rules?.[0] ?? card.energyText ?? "Special Energy"}</p>}
    </div>
    {!full && <div className="compact-footer"><SimulationSupportBadge card={card} /><span>{card.setCode} {card.collectorNumber}</span></div>}
  </>;
}
