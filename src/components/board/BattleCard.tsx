import type { CardType, PokemonInPlay } from "../../../engine/model/cards";
import type { GameState } from "../../../engine/model/game-state";
import { cardFor, topCard } from "../../../engine/rules/helpers";
import type { CatalogueIndex, PokemonCardMetadata, PokemonType } from "../../data/pokemon";
import { EnergySymbol } from "../cards/EnergySymbol";
import { TypeBadge } from "../cards/TypeBadge";
import type { HandCardGroup } from "./battle-card-presentation";
import { CardImage } from "../cards/CardImage";

export type GameCardDisplay = "images" | "text" | "hybrid";

const printedType: Readonly<Record<CardType, PokemonType>> = {
  grass: "Grass", fire: "Fire", water: "Water", lightning: "Lightning", psychic: "Psychic", fighting: "Fighting",
  darkness: "Darkness", metal: "Metal", dragon: "Dragon", colorless: "Colorless", fairy: "Fairy",
};

interface InPlayCardProps {
  state: GameState;
  index: CatalogueIndex;
  pokemon: PokemonInPlay;
  onOpen: (card: PokemonCardMetadata) => void;
  display: GameCardDisplay;
}

function TypeIdentity({ card }: { card: PokemonCardMetadata }) {
  return <span className="battle-card-types">{card.types?.map((type) => <TypeBadge type={type} key={type} />)}</span>;
}

function AttachedEnergy({ state, pokemon }: { state: GameState; pokemon: PokemonInPlay }) {
  return <span className="battle-energy" aria-label={`${pokemon.attachedEnergy.length} attached Energy`}>
    {pokemon.attachedEnergy.length ? pokemon.attachedEnergy.map((instance) => {
      const card = cardFor(state, instance);
      return card?.category === "energy" ? <EnergySymbol type={printedType[card.energyType]} key={instance.instanceId} /> : null;
    }) : <small>None</small>}
  </span>;
}

function matchupText(card: PokemonCardMetadata): string {
  const weakness = card.weaknesses?.map((item) => `${item.type} ${item.value}`).join(", ") || "None";
  const resistance = card.resistances?.map((item) => `${item.type} ${item.value}`).join(", ") || "None";
  return `Weak ${weakness} · Resist ${resistance}`;
}

export function ActiveBattleCard({ state, index, pokemon, onOpen, display }: InPlayCardProps) {
  const runtime = topCard(state, pokemon);
  const card = index.byId.get(runtime.id);
  if (!card) return <article className="battle-card battle-card-active"><strong>{runtime.name}</strong></article>;
  const remaining = Math.max(0, runtime.hp - pokemon.damage);
  return <button type="button" className="battle-card battle-card-active" onClick={() => onOpen(card)} aria-label={`Open full details for ${card.name}`}>
    {display !== "text" && <CardImage card={card} size="small" priority className="battle-card-image" />}
    {display !== "images" && <span className="battle-card-heading"><span><strong>{card.name}</strong><small>{card.stage ?? card.subtypes.join(" · ")}</small></span><TypeIdentity card={card} /></span>}
    <span className="battle-hp"><b>{remaining}</b> / {runtime.hp} HP{pokemon.damage > 0 && <em>{pokemon.damage} damage</em>}</span>
    {display !== "images" && card.abilities?.length ? <span className="battle-abilities">{card.abilities.map((ability) => <span key={ability.name}><small>Ability</small><b>{ability.name}</b></span>)}</span> : null}
    {display !== "images" && card.attacks?.length ? <span className="battle-attacks">{card.attacks.map((attack) => <span key={`${attack.name}-${attack.damage}`}><span className="battle-attack-cost">{attack.cost.length && !attack.cost.every((type) => type === "Free") ? attack.cost.map((type, position) => type === "Free" ? null : <EnergySymbol type={type} key={`${type}-${position}`} />) : <small>Free</small>}</span><b>{attack.name}</b><strong>{attack.damage || "—"}</strong></span>)}</span> : null}
    <span className="battle-status-grid">
      <span><small>Energy</small><AttachedEnergy state={state} pokemon={pokemon} /></span>
      <span><small>Tool</small><b>{pokemon.tool ? cardFor(state, pokemon.tool)?.name ?? "Attached" : "None"}</b></span>
      <span><small>Conditions</small><b>{pokemon.specialConditions.length ? pokemon.specialConditions.join(" · ") : "None"}</b></span>
    </span>
    <span className="battle-card-footer"><span>{matchupText(card)}</span><span>Retreat {card.retreatCost?.length ? card.retreatCost.map((type, position) => <EnergySymbol type={type} key={`${type}-${position}`} />) : "Free"}</span></span>
  </button>;
}

export function BenchBattleCard({ state, index, pokemon, onOpen, display }: InPlayCardProps) {
  const runtime = topCard(state, pokemon);
  const card = index.byId.get(runtime.id);
  if (!card) return <article className="battle-card battle-card-bench"><strong>{runtime.name}</strong></article>;
  const remaining = Math.max(0, runtime.hp - pokemon.damage);
  return <button type="button" className="battle-card battle-card-bench" onClick={() => onOpen(card)} aria-label={`Open full details for ${card.name}`}>
    {display !== "text" && <CardImage card={card} size="thumbnail" className="battle-card-image" />}
    {display !== "images" && <><span className="battle-card-heading"><strong>{card.name}</strong><TypeIdentity card={card} /></span><small>{card.stage ?? card.subtypes.join(" · ")}</small></>}
    <span className="bench-hp"><b>{remaining}</b> / {runtime.hp} HP</span>
    {pokemon.damage > 0 && <span className="bench-damage">{pokemon.damage} damage</span>}
    <span className="bench-indicators"><span>{pokemon.attachedEnergy.length ? <><AttachedEnergy state={state} pokemon={pokemon} /><small>×{pokemon.attachedEnergy.length}</small></> : <small>0 Energy</small>}</span>{pokemon.tool && <b title={cardFor(state, pokemon.tool)?.name}>Tool</b>}{pokemon.specialConditions.map((condition) => <b key={condition}>{condition}</b>)}</span>
  </button>;
}

export function HandBattleCard({ index, group, onOpen, display }: { index: CatalogueIndex; group: HandCardGroup; onOpen: (card: PokemonCardMetadata) => void; display: GameCardDisplay }) {
  const card = index.byId.get(group.cardId);
  if (!card) return <article className="battle-card battle-card-hand"><strong>{group.cardId}</strong></article>;
  const subtype = card.supertype === "Pokémon" ? `${card.stage ?? card.subtypes.join(" · ")} · ${card.hp ?? "—"} HP` : card.supertype === "Trainer" ? card.subtypes.join(" · ") || "Trainer" : card.types?.[0] ? `${card.types[0]} Energy` : card.subtypes.join(" · ") || "Energy";
  return <button type="button" className={`battle-card battle-card-hand battle-card-${card.supertype.toLocaleLowerCase("en-US")}`} onClick={() => onOpen(card)} aria-label={`Open full details for ${card.name}`}>
    {group.instances.length > 1 && <span className="hand-quantity">×{group.instances.length}</span>}
    {display !== "text" && <CardImage card={card} size="thumbnail" className="battle-card-image" />}
    {display !== "images" && <><span className="battle-card-heading"><strong>{card.name}</strong>{card.types?.[0] && <TypeBadge type={card.types[0]} />}</span><small>{subtype}</small></>}
  </button>;
}

export function EmptyBattleCard() {
  return <div className="battle-card battle-card-empty">Empty</div>;
}
