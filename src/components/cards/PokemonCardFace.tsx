import type { PokemonCardMetadata } from "../../data/pokemon";
import { CardSetFooter } from "./CardSetFooter";
import { EnergyCost, EnergySymbol } from "./EnergySymbol";
import { SimulationSupportBadge, SimulationSupportDetails } from "./SimulationSupportBadge";
import { TypeBadge } from "./TypeBadge";

export function PokemonCardFace({ card, mode }: { card: PokemonCardMetadata; mode: "full" | "compact" }) {
  const full = mode === "full";
  const ruleCategory = card.subtypes.filter((subtype) => /ex|EX|GX|V|VMAX|VSTAR|Radiant|BREAK/i.test(subtype)).join(" · ");
  return <>
    <header className="printed-card-header">
      <div><span className="printed-kicker">{card.stage ?? card.subtypes[0] ?? "Pokémon"}{ruleCategory ? ` · ${ruleCategory}` : ""}</span><h3>{card.name}</h3></div>
      <div className="pokemon-vitals"><strong>{card.hp ?? "—"} HP</strong><span className="type-badge-row">{card.types?.map((type) => <TypeBadge type={type} key={type} />)}</span></div>
    </header>
    {card.evolvesFrom && <p className="evolution-line">Evolves from <b>{card.evolvesFrom}</b></p>}
    {card.evolvesTo?.length ? <p className="evolution-line">Evolves to <b>{card.evolvesTo.join(" · ")}</b></p> : null}
    <div className="printed-card-body">
      {card.abilities?.map((ability, index) => <section className="printed-effect ability-effect" key={`${ability.name}-${index}`}><span className="effect-label">{ability.type || "Ability"}</span><h4>{ability.name}</h4>{full && <p>{ability.text}</p>}</section>)}
      {card.attacks?.map((attack, index) => <section className="printed-effect attack-effect" key={`${attack.name}-${index}`}>
        <div className="attack-heading"><EnergyCost types={attack.cost} /><h4>{attack.name}</h4><strong>{attack.damage || "—"}</strong></div>
        {full && attack.text && <p>{attack.text}</p>}
      </section>)}
      {!card.abilities?.length && !card.attacks?.length && <p className="metadata-empty">No Ability or attack text is listed for this printing.</p>}
      {full && <>
        <div className="combat-metadata">
          <div><span>Weakness</span>{card.weaknesses?.length ? card.weaknesses.map((item, index) => <b key={`${item.type}-${index}`}><EnergySymbol type={item.type} context="Weakness" /> {item.value}</b>) : <b>None</b>}</div>
          <div><span>Resistance</span>{card.resistances?.length ? card.resistances.map((item, index) => <b key={`${item.type}-${index}`}><EnergySymbol type={item.type} context="Resistance" /> {item.value}</b>) : <b>None</b>}</div>
          <div><span>Retreat</span><EnergyCost types={card.retreatCost} emptyLabel="None" label="Retreat cost" /></div>
        </div>
        {card.rules?.map((rule, index) => <p className={card.ruleBoxText?.includes(rule) ? "printed-rule rule-box" : "printed-rule"} key={`${rule}-${index}`}>{rule}</p>)}
        {card.flavorText && <p className="flavor-text">{card.flavorText}</p>}
        <div className="card-support"><SimulationSupportBadge card={card} /><SimulationSupportDetails card={card} /></div>
        <CardSetFooter card={card} />
      </>}
    </div>
    {!full && <div className="compact-footer"><SimulationSupportBadge card={card} /><span>{card.setCode} {card.collectorNumber}</span></div>}
  </>;
}
