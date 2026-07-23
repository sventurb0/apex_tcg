import { useMemo, useState } from "react";
import { CardDetailsDialog, CardImage, PrintedCard, SimulationSupportBadge, TypeBadge } from "../../components/cards";
import type { DeckManifest, DeckCardEntry } from "../../data/decks/types";
import { compileCardImplementation, type CatalogueIndex, type PokemonCardCatalogue, type PokemonCardMetadata, type SimulationSupport } from "../../data/pokemon";
import type { FormatProfile } from "../deck-import/types";
import { exportDeckList } from "../deck-import/deck-io";
import { analyseDeck } from "./validation";
import { createBlankDeck, deleteDeck, duplicateDeck, saveDeck } from "./storage";

type CatalogueSort = "name" | "set" | "hp" | "number";
type DeckSort = "name" | "type" | "quantity";

interface Filters {
  text: string; attack: string; ability: string; type: string; supertype: string; stage: string; set: string;
  regulation: string; legality: string; ruleBox: string; support: string; sort: CatalogueSort;
}

const emptyFilters: Filters = { text: "", attack: "", ability: "", type: "", supertype: "", stage: "", set: "", regulation: "", legality: "", ruleBox: "", support: "", sort: "name" };

function hasRuleBox(card: PokemonCardMetadata): boolean {
  return card.subtypes.some((subtype) => /\b(ex|EX|V|VMAX|VSTAR|Radiant|BREAK|GX)\b/i.test(subtype)) || Boolean(card.ruleBoxText?.length);
}

export interface DeckBuilderProps {
  catalogue: PokemonCardCatalogue;
  index: CatalogueIndex;
  initialDeck?: DeckManifest;
  onSaved: () => void;
  onPlay: (deck: DeckManifest) => void;
  onSimulate: (deck: DeckManifest) => void;
}

export function DeckBuilder({ catalogue, index, initialDeck, onSaved, onPlay, onSimulate }: DeckBuilderProps) {
  const [deck, setDeck] = useState<DeckManifest>(() => structuredClone(initialDeck ?? createBlankDeck()));
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<PokemonCardMetadata>();
  const [undo, setUndo] = useState<DeckCardEntry[][]>([]);
  const [redo, setRedo] = useState<DeckCardEntry[][]>([]);
  const [deckSearch, setDeckSearch] = useState("");
  const [deckSort, setDeckSort] = useState<DeckSort>("type");
  const [notice, setNotice] = useState("");
  const [cardMode, setCardMode] = useState<"hybrid" | "image" | "full" | "compact">("hybrid");

  const analysis = useMemo(() => analyseDeck(deck, index), [deck, index]);
  const sets = useMemo(() => [...catalogue.sets].sort((a, b) => a.name.localeCompare(b.name)), [catalogue.sets]);
  const stages = useMemo(() => [...new Set(catalogue.cards.map((card) => card.stage).filter((stage): stage is string => Boolean(stage)))].sort(), [catalogue.cards]);
  const marks = useMemo(() => [...new Set(catalogue.cards.map((card) => card.regulationMark).filter((mark): mark is string => Boolean(mark)))].sort(), [catalogue.cards]);

  const results = useMemo(() => {
    const text = filters.text.toLocaleLowerCase("en-US");
    const attack = filters.attack.toLocaleLowerCase("en-US");
    const ability = filters.ability.toLocaleLowerCase("en-US");
    const cards = catalogue.cards.filter((card) =>
      (!text || card.name.toLocaleLowerCase("en-US").includes(text) || card.rules?.some((rule) => rule.toLocaleLowerCase("en-US").includes(text))) &&
      (!attack || card.attacks?.some((item) => item.name.toLocaleLowerCase("en-US").includes(attack))) &&
      (!ability || card.abilities?.some((item) => item.name.toLocaleLowerCase("en-US").includes(ability))) &&
      (!filters.type || card.types?.includes(filters.type as never)) && (!filters.supertype || card.supertype === filters.supertype) &&
      (!filters.stage || card.stage === filters.stage) && (!filters.set || card.setId === filters.set) && (!filters.regulation || card.regulationMark === filters.regulation) &&
      (!filters.legality || card.legalities[filters.legality as "standard" | "expanded"] === "Legal") &&
      (!filters.ruleBox || (filters.ruleBox === "yes" ? hasRuleBox(card) : !hasRuleBox(card))) &&
      (!filters.support || compileCardImplementation(card).status === filters.support)
    );
    cards.sort((a, b) => filters.sort === "set" ? a.setName.localeCompare(b.setName) || a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }) : filters.sort === "hp" ? (b.hp ?? 0) - (a.hp ?? 0) : filters.sort === "number" ? a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }) : a.name.localeCompare(b.name));
    return cards;
  }, [catalogue.cards, filters]);

  function commitEntries(entries: DeckCardEntry[]): void {
    setUndo((history) => [...history.slice(-49), structuredClone(deck.entries)]);
    setRedo([]);
    setDeck((current) => ({ ...current, entries }));
  }
  function setQuantity(cardId: string, count: number): void {
    const next = deck.entries.filter((entry) => entry.cardId !== cardId);
    if (count > 0) next.push({ cardId, count: Math.min(99, count) });
    commitEntries(next);
  }
  function undoEdit(): void { const previous = undo.at(-1); if (!previous) return; setRedo((items) => [...items, structuredClone(deck.entries)]); setUndo((items) => items.slice(0, -1)); setDeck((current) => ({ ...current, entries: previous })); }
  function redoEdit(): void { const next = redo.at(-1); if (!next) return; setUndo((items) => [...items, structuredClone(deck.entries)]); setRedo((items) => items.slice(0, -1)); setDeck((current) => ({ ...current, entries: next })); }
  function save(): void { saveDeck(deck); onSaved(); setNotice("Deck saved locally."); }
  function exportDeck(): void {
    const blob = new Blob([`${exportDeckList(deck, index)}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${deck.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }

  const deckRows = deck.entries.map((entry) => ({ entry, card: index.byId.get(entry.cardId) })).filter((row): row is { entry: DeckCardEntry; card: PokemonCardMetadata } => Boolean(row.card)).filter(({ card }) => card.name.toLocaleLowerCase("en-US").includes(deckSearch.toLocaleLowerCase("en-US"))).sort((a, b) => deckSort === "quantity" ? b.entry.count - a.entry.count : deckSort === "type" ? a.card.supertype.localeCompare(b.card.supertype) || a.card.name.localeCompare(b.card.name) : a.card.name.localeCompare(b.card.name));
  const selectedResultIndex = selected ? results.findIndex((card) => card.id === selected.id) : -1;

  return <main className="builder-page">
    <header className="page-heading"><div><p className="eyebrow">COMPLETE TEXT CATALOGUE</p><h1>Deck Builder</h1></div><p>{catalogue.cards.length.toLocaleString()} English card printings are available for search, construction, saving and export. Simulation support is shown separately.</p></header>
    <div className="builder-layout">
      <section className="catalogue-panel">
        <div className="panel-title"><div><h2>Card catalogue</h2><small>{results.length.toLocaleString()} matches · showing {Math.min(results.length, 120)}</small></div><div className="catalogue-controls"><fieldset aria-label="Card presentation"><button className={cardMode === "hybrid" ? "selected" : ""} onClick={() => setCardMode("hybrid")}>Hybrid</button><button className={cardMode === "image" ? "selected" : ""} onClick={() => setCardMode("image")}>Image</button><button className={cardMode === "full" ? "selected" : ""} onClick={() => setCardMode("full")}>Detailed</button><button className={cardMode === "compact" ? "selected" : ""} onClick={() => setCardMode("compact")}>Compact text</button></fieldset><button onClick={() => setFilters(emptyFilters)}>Reset filters</button></div></div>
        <div className="filter-grid">
          <label>Card text<input value={filters.text} onChange={(event) => setFilters({ ...filters, text: event.target.value })} placeholder="Name or printed text" /></label>
          <label>Attack name<input value={filters.attack} onChange={(event) => setFilters({ ...filters, attack: event.target.value })} /></label>
          <label>Ability name<input value={filters.ability} onChange={(event) => setFilters({ ...filters, ability: event.target.value })} /></label>
          <label>Type<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option>{["Grass","Fire","Water","Lightning","Psychic","Fighting","Darkness","Metal","Dragon","Colorless","Fairy"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Supertype<select value={filters.supertype} onChange={(event) => setFilters({ ...filters, supertype: event.target.value })}><option value="">All</option><option>Pokémon</option><option>Trainer</option><option>Energy</option></select></label>
          <label>Stage<select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><option value="">All stages</option>{stages.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Set<select value={filters.set} onChange={(event) => setFilters({ ...filters, set: event.target.value })}><option value="">All sets</option>{sets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.code})</option>)}</select></label>
          <label>Regulation mark<select value={filters.regulation} onChange={(event) => setFilters({ ...filters, regulation: event.target.value })}><option value="">All marks</option>{marks.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Legality<select value={filters.legality} onChange={(event) => setFilters({ ...filters, legality: event.target.value })}><option value="">Any</option><option value="standard">Standard</option><option value="expanded">Expanded</option></select></label>
          <label>Rule box<select value={filters.ruleBox} onChange={(event) => setFilters({ ...filters, ruleBox: event.target.value })}><option value="">Any</option><option value="yes">ex / V / rule-box</option><option value="no">No rule box</option></select></label>
          <label>Simulation support<select value={filters.support} onChange={(event) => setFilters({ ...filters, support: event.target.value })}><option value="">Any</option>{(["complete","generated","partial","unsupported"] as SimulationSupport[]).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Sort<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as CatalogueSort })}><option value="name">Name</option><option value="set">Set</option><option value="hp">HP</option><option value="number">Collector number</option></select></label>
        </div>
        <div className={`catalogue-results catalogue-results--${cardMode}`}>{results.slice(0, 120).map((card) => cardMode === "image" ? <article className="catalogue-image-tile" key={card.id}><CardImage card={card} size="small" onOpen={() => setSelected(card)} /><button onClick={() => setQuantity(card.id, (deck.entries.find((entry) => entry.cardId === card.id)?.count ?? 0) + 1)}>+ Add {card.name}</button></article> : cardMode === "hybrid" ? <article className="catalogue-hybrid-tile" key={card.id}><CardImage card={card} size="thumbnail" onOpen={() => setSelected(card)} /><PrintedCard card={card} mode="compact" onOpen={() => setSelected(card)} onAdd={() => setQuantity(card.id, (deck.entries.find((entry) => entry.cardId === card.id)?.count ?? 0) + 1)} /></article> : <PrintedCard card={card} mode={cardMode} key={card.id} onOpen={() => setSelected(card)} onAdd={() => setQuantity(card.id, (deck.entries.find((entry) => entry.cardId === card.id)?.count ?? 0) + 1)} />)}</div>
        {results.length > 120 && <p className="result-limit">Refine the filters to view the remaining {(results.length - 120).toLocaleString()} matches.</p>}
      </section>

      <aside className="current-deck-panel">
        <div className="deck-editor-heading"><label>Deck name<input value={deck.name} onChange={(event) => setDeck({ ...deck, name: event.target.value })} /></label><button className={deck.favourite ? "favourite active" : "favourite"} onClick={() => setDeck({ ...deck, favourite: !deck.favourite })}>{deck.favourite ? "★ Favourite" : "☆ Favourite"}</button></div>
        <label>Format<select value={deck.format} onChange={(event) => setDeck({ ...deck, format: event.target.value as FormatProfile })}><option value="standard">Standard</option><option value="expanded">Expanded</option><option value="custom">Custom</option><option value="none">No legality enforcement</option></select></label>
        <div className="deck-counts"><strong>{analysis.total}<small>/ 60 cards</small></strong><span>Pokémon <b>{analysis.pokemon}</b></span><span>Trainers <b>{analysis.trainers}</b></span><span>Energy <b>{analysis.energy}</b></span></div>
        <div className="deck-toolbar"><button onClick={undoEdit} disabled={!undo.length}>Undo</button><button onClick={redoEdit} disabled={!redo.length}>Redo</button><button onClick={() => commitEntries([])} disabled={!deck.entries.length}>Clear</button><input value={deckSearch} onChange={(event) => setDeckSearch(event.target.value)} placeholder="Search deck" /><select value={deckSort} onChange={(event) => setDeckSort(event.target.value as DeckSort)}><option value="type">Sort by type</option><option value="name">Sort by name</option><option value="quantity">Sort by quantity</option></select></div>
        {(["Pokémon", "Trainer", "Energy"] as const).map((group) => { const rows = deckRows.filter(({ card }) => card.supertype === group); return rows.length ? <section className="deck-section" key={group}><h3>{group}</h3>{rows.map(({ entry, card }) => <div className="deck-row" key={card.id}><CardImage card={card} size="thumbnail" className="deck-row-thumbnail" onOpen={() => setSelected(card)} /><button className="deck-card-name" onClick={() => setSelected(card)}><span className="deck-card-title">{card.types?.[0] && <TypeBadge type={card.types[0]} />}<b>{card.name}</b></span><small>{(card.stage ?? card.subtypes.join(" · ")) || card.supertype}{card.hp ? ` · ${card.hp} HP` : ""} · {card.setCode} {card.collectorNumber}</small></button><SimulationSupportBadge card={card} /><div className="quantity"><button onClick={() => setQuantity(card.id, entry.count - 1)}>−</button><input aria-label={`${card.name} quantity`} type="number" min="0" max="99" value={entry.count} onChange={(event) => setQuantity(card.id, Number(event.target.value))} /><button onClick={() => setQuantity(card.id, entry.count + 1)}>+</button></div><button className="remove" onClick={() => setQuantity(card.id, 0)}>Remove</button></div>)}</section> : null; })}
        {!deck.entries.length && <p className="empty-state">Search the catalogue and add cards to begin.</p>}
        <section className="validation-panel"><h3>Construction checks</h3>{analysis.issues.length ? analysis.issues.slice(0, 20).map((issue) => <p className={issue.severity} key={issue.message}>{issue.severity === "error" ? "●" : "▲"} {issue.message}</p>) : <p className="valid">● Basic construction checks pass.</p>}<small>Errors and warnings never prevent saving or editing casual decks.</small></section>
        <div className="builder-actions"><button className="primary" onClick={save}>Save deck</button><button onClick={() => { setDeck(createBlankDeck()); setUndo([]); setRedo([]); setNotice("New blank deck created."); }}>New deck</button><button onClick={() => { const copy = duplicateDeck(deck); setDeck(copy); onSaved(); setNotice("Personal copy created."); }}>Duplicate and edit</button><button onClick={exportDeck}>Export deck list</button><button onClick={() => onPlay(deck)}>Play this deck</button><button onClick={() => onSimulate(deck)}>Simulate this deck</button>{deck.source === "saved" && <button className="danger" onClick={() => { deleteDeck(deck.id); setDeck(createBlankDeck()); onSaved(); setNotice("Deck deleted."); }}>Delete</button>}</div>
        {notice && <p className="notice">{notice}</p>}
      </aside>
    </div>
    {selected && <CardDetailsDialog card={selected} onClose={() => setSelected(undefined)} onAdd={() => setQuantity(selected.id, (deck.entries.find((entry) => entry.cardId === selected.id)?.count ?? 0) + 1)} onPrevious={selectedResultIndex > 0 ? () => setSelected(results[selectedResultIndex - 1]) : undefined} onNext={selectedResultIndex >= 0 && selectedResultIndex < results.length - 1 ? () => setSelected(results[selectedResultIndex + 1]) : undefined} />}
  </main>;
}
