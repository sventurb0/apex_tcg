import type { CardInstance, CardType, PokemonInPlay } from "../../../engine/model/cards";
import type { GameState } from "../../../engine/model/game-state";
import { cardFor, topCard } from "../../../engine/rules/helpers";
import type { CatalogueIndex, PokemonCardMetadata, PokemonType } from "../../data/pokemon";
import { EnergySymbol } from "./EnergySymbol";
import { PrintedCard } from "./PrintedCard";

interface CardViewProps {
  state: GameState;
  index: CatalogueIndex;
  instance?: CardInstance;
  pokemon?: PokemonInPlay;
  compact?: boolean;
  onOpen?: (card: PokemonCardMetadata) => void;
}

const printedType: Readonly<Record<CardType, PokemonType>> = {
  grass: "Grass", fire: "Fire", water: "Water", lightning: "Lightning", psychic: "Psychic", fighting: "Fighting",
  darkness: "Darkness", metal: "Metal", dragon: "Dragon", colorless: "Colorless", fairy: "Fairy",
};

export function CardView({ state, index, instance, pokemon, compact = false, onOpen }: CardViewProps) {
  const runtimeCard = pokemon ? topCard(state, pokemon) : instance ? cardFor(state, instance) : null;
  if (!runtimeCard) return <div className="card empty">Empty</div>;
  const metadata = index.byId.get(runtimeCard.id);
  if (metadata) {
    const overlay = pokemon ? <section className="runtime-overlay" aria-label={`Current game state for ${runtimeCard.name}`}>
      <div><span>Damage</span><b>{pokemon.damage}</b></div>
      {runtimeCard.category === "pokemon" && <div><span>Remaining HP</span><b>{Math.max(0, runtimeCard.hp - pokemon.damage)} / {runtimeCard.hp}</b></div>}
      <div className="attached-energy-state"><span>Attached Energy</span><b>{pokemon.attachedEnergy.length || "None"}</b><span>{pokemon.attachedEnergy.map((energy) => { const card = cardFor(state, energy); return card?.category === "energy" ? <EnergySymbol type={printedType[card.energyType]} key={energy.instanceId} /> : null; })}</span></div>
      <div><span>Tool</span><b>{pokemon.tool ? cardFor(state, pokemon.tool)?.name ?? "Unknown" : "None"}</b></div>
      <div><span>Conditions</span><b>{pokemon.specialConditions.length ? pokemon.specialConditions.join(" · ") : "None"}</b></div>
    </section> : undefined;
    return <PrintedCard card={metadata} mode={compact ? "compact" : "full"} overlay={overlay} onOpen={onOpen ? () => onOpen(metadata) : undefined} className="game-card" />;
  }
  return <article className={`card card-${runtimeCard.category} ${compact ? "compact" : ""}`}>
    <div className="card-heading"><strong>{runtimeCard.name}</strong><span>{runtimeCard.id}</span></div>
    {runtimeCard.category === "pokemon" && <><div className="card-meta"><span>{runtimeCard.stage}</span><span>{runtimeCard.pokemonType}</span><span>{runtimeCard.hp} HP</span></div>{pokemon && <div className="damage">Damage: {pokemon.damage} · Energy: {pokemon.attachedEnergy.length}</div>}{!compact && runtimeCard.attacks.map((attack) => <div className="attack" key={attack.id}><b>{attack.name}</b><span>{attack.damage.printed || "—"}</span></div>)}{!compact && runtimeCard.abilities.map((ability) => <p key={ability.id}><b>Ability — {ability.name}:</b> {ability.text}</p>)}</>}
    {runtimeCard.category === "trainer" && !compact && <p><b>{runtimeCard.subtype}:</b> {runtimeCard.text}</p>}
    {runtimeCard.category === "energy" && <p>{runtimeCard.energyType} Energy</p>}
  </article>;
}
