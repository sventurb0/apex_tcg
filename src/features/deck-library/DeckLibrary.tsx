import { useMemo, useState } from "react";
import { CardImage } from "../../components/cards";
import type { DeckCorpusDocument, NormalizedCorpusDeck } from "../../data/decks/corpus/types";
import type { DeckManifest } from "../../data/decks/types";
import { compileCardImplementation, type CatalogueIndex } from "../../data/pokemon";
import { analyseDeck } from "../deck-builder/validation";
import { exportDeckList } from "../deck-import/deck-io";

type LibraryKind = "personal" | "premade" | "tournament" | "standard" | "creative";
interface LibraryItem { id: string; kind: LibraryKind; deck: DeckManifest; corpus?: NormalizedCorpusDeck; simulationReady: boolean; supportedCopies: number; missingCount: number; energyTypes: string[]; strategic: string[]; prizeProfile?: string; }
interface Props {
  corpus: DeckCorpusDocument;
  personalDecks: DeckManifest[];
  premadeDecks: DeckManifest[];
  index: CatalogueIndex;
  onEdit: (deck: DeckManifest) => void;
  onDuplicate: (deck: DeckManifest) => void;
  onPlay: (deck: DeckManifest) => void;
  onSelectOpponent: (deck: DeckManifest) => void;
  onSimulate: (deck: DeckManifest) => void;
  onArchitectTemplate: (deck: DeckManifest) => void;
}

function download(name: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function itemFor(deck: DeckManifest, kind: LibraryKind, index: CatalogueIndex): LibraryItem {
  const analysis = analyseDeck(deck, index);
  const supportedCopies = deck.entries.reduce((sum, entry) => { const card = index.byId.get(entry.cardId); return sum + (card && ["complete","generated"].includes(compileCardImplementation(card).status) ? entry.count : 0); }, 0);
  // Keep the filter useful for both typed Energy and Pokémon whose type defines
  // the deck's engine (for example a Colorless toolbox with no basic Energy
  // metadata on every list). Tournament tags may provide a more authoritative
  // energy classification and are merged by the caller below.
  const energyTypes = [...new Set(deck.entries.flatMap((entry) => {
    const card = index.byId.get(entry.cardId);
    return card?.types ?? [];
  }))].sort();
  return { id:`${kind}:${deck.id}`,kind,deck,simulationReady:analysis.simulationReady,supportedCopies,missingCount:analysis.unsupported.length,energyTypes,strategic:kind === "creative" ? ["experimental"] : [],prizeProfile:undefined };
}

export function DeckLibrary({ corpus, personalDecks, premadeDecks, index, onEdit, onDuplicate, onPlay, onSelectOpponent, onSimulate, onArchitectTemplate }: Props) {
  const [kind, setKind] = useState<LibraryKind | "all">("all"); const [readyOnly, setReadyOnly] = useState(false); const [type, setType] = useState("all"); const [archetype, setArchetype] = useState(""); const [event, setEvent] = useState(""); const [player, setPlayer] = useState(""); const [maxPlacement, setMaxPlacement] = useState(""); const [strategic, setStrategic] = useState("all"); const [prize, setPrize] = useState("all"); const [favouritesOnly, setFavouritesOnly] = useState(false); const [maxMissing, setMaxMissing] = useState(999); const [compareIds, setCompareIds] = useState<string[]>([]);
  const items = useMemo<LibraryItem[]>(() => {
    const personal = personalDecks.map((deck) => itemFor(deck, deck.format === "custom" ? "creative" : "personal", index));
    const supplied = premadeDecks.map((deck) => itemFor(deck, "premade", index));
    const tournament = corpus.decks.flatMap((corpusDeck) => corpusDeck.manifest ? [{ id:`tournament:${corpusDeck.id}`,kind:"tournament" as const,deck:corpusDeck.manifest,corpus:corpusDeck,simulationReady:corpusDeck.simulationReady,supportedCopies:corpusDeck.supportCounts.complete + corpusDeck.supportCounts.generated,missingCount:corpusDeck.missingBehaviourFamilyIds.length,energyTypes:corpusDeck.tags.energyTypes,strategic:corpusDeck.tags.strategic,prizeProfile:corpusDeck.tags.prizeProfile }] : []);
    return [...personal, ...supplied, ...tournament];
  }, [corpus.decks, index, personalDecks, premadeDecks]);
  const filtered = items.filter((item) => {
    const snapshot = item.corpus?.snapshot;
    const categoryMatch = kind === "all" || item.kind === kind || kind === "standard" && item.deck.format === "standard";
    return categoryMatch && (!readyOnly || item.simulationReady) && (type === "all" || item.energyTypes.includes(type)) && (!archetype || (snapshot?.archetype ?? item.deck.name).toLowerCase().includes(archetype.toLowerCase())) && (!event || snapshot?.eventName?.toLowerCase().includes(event.toLowerCase())) && (!player || snapshot?.player?.toLowerCase().includes(player.toLowerCase())) && (!maxPlacement || (snapshot?.placement ?? Number.MAX_SAFE_INTEGER) <= Number(maxPlacement)) && (strategic === "all" || item.strategic.includes(strategic)) && (prize === "all" || item.prizeProfile === prize) && (!favouritesOnly || item.deck.favourite) && item.missingCount <= maxMissing;
  });
  const compare = compareIds.map((id) => items.find((item) => item.id === id)).filter((item): item is LibraryItem => Boolean(item));
  const allTypes = [...new Set(items.flatMap((item) => item.energyTypes))].sort();
  return <main className="deck-library-page"><header className="page-heading"><div><p className="eyebrow">PERSONAL · PREMADE · SOURCE-ATTRIBUTED</p><h1>Deck Library</h1></div><p>Browse every exact manifest. Tournament lists remain visible when runtime work is missing; blockers are shown rather than replaced with guessed effects.</p></header>
    <section className="library-summary diagnostic-stats"><article><strong>{items.length}</strong><span>visible manifests</span></article><article><strong>{corpus.decks.length}</strong><span>source snapshots</span></article><article><strong>{new Set(corpus.decks.map((deck) => deck.compositionFingerprint)).size}</strong><span>unique compositions</span></article><article><strong>{items.filter((item) => item.simulationReady).length}</strong><span>simulation ready</span></article><article><strong>{new Date(corpus.generatedAt).toLocaleDateString()}</strong><span>last source sync</span></article></section>
    <section className="library-filters panel"><div className="filter-grid"><label>Library<select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">All</option><option value="personal">Personal</option><option value="premade">Premade</option><option value="tournament">Tournament</option><option value="standard">Standard</option><option value="creative">Creative / experimental</option></select></label><label>Type / energy<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{allTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label>Archetype<input value={archetype} onChange={(e) => setArchetype(e.target.value)} /></label><label>Event<input value={event} onChange={(e) => setEvent(e.target.value)} /></label><label>Player<input value={player} onChange={(e) => setPlayer(e.target.value)} /></label><label>Best placement<input type="number" min="1" value={maxPlacement} onChange={(e) => setMaxPlacement(e.target.value)} placeholder="Any" /></label><label>Plan<select value={strategic} onChange={(e) => setStrategic(e.target.value)}><option value="all">All</option><option value="aggressive">Aggressive</option><option value="control">Control</option><option value="setup">Setup</option><option value="toolbox">Toolbox</option></select></label><label>Prize profile<select value={prize} onChange={(e) => setPrize(e.target.value)}><option value="all">All</option><option value="single-prize">Single-Prize</option><option value="mixed">Mixed</option><option value="multi-prize">Multi-Prize</option></select></label><label>Maximum missing<input type="number" min="0" value={maxMissing} onChange={(e) => setMaxMissing(Math.max(0, Number(e.target.value) || 0))} /></label><label className="check-label"><input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} />Simulation-ready only</label><label className="check-label"><input type="checkbox" checked={favouritesOnly} onChange={(e) => setFavouritesOnly(e.target.checked)} />Favourite decks only</label></div><p>{filtered.length} matching decks.</p></section>
    {compare.length === 2 && <section className="library-compare panel"><header><h2>Deck comparison</h2><button onClick={() => setCompareIds([])}>Clear</button></header><div>{compare.map((item) => { const other = compare.find((candidate) => candidate.id !== item.id)!; const otherIds = new Set(other.deck.entries.map((entry) => entry.cardId)); return <article key={item.id}><h3>{item.deck.name}</h3><p>{item.deck.entries.filter((entry) => !otherIds.has(entry.cardId)).length} unique printings · {item.supportedCopies}/60 supported · {item.missingCount} missing families</p><p>{item.energyTypes.join(", ") || "No typed Energy metadata"}</p></article>; })}</div></section>}
    <section className="library-grid">{filtered.map((item) => { const deck = item.deck; const snapshot = item.corpus?.snapshot; const pokemon = deck.entries.flatMap((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" ? [card] : []; }).slice(0,3); return <article className="library-card" key={item.id}><header><span className={`support-badge ${item.simulationReady ? "generated" : "partial"}`}>{item.simulationReady ? "simulation-ready" : "runtime blocked"}</span><label><input type="checkbox" checked={compareIds.includes(item.id)} disabled={!compareIds.includes(item.id) && compareIds.length >= 2} onChange={(e) => setCompareIds(e.target.checked ? [...compareIds,item.id] : compareIds.filter((id) => id !== item.id))} />Compare</label></header><div className="deck-preview-images">{pokemon.map((card) => <CardImage card={card} size="thumbnail" key={card.id} />)}</div><p className="eyebrow">{item.kind}{snapshot?.placement ? ` · PLACE ${snapshot.placement}` : ""}</p><h2>{snapshot?.archetype ?? deck.name}</h2>{snapshot?.player && <p><b>{snapshot.player}</b></p>}<p>{snapshot ? `${snapshot.eventName ?? "Tournament"} · ${snapshot.eventDate ?? "date unavailable"} · ${snapshot.format ?? deck.format}` : deck.description}</p><dl><div><dt>Exact cards supported</dt><dd>{item.supportedCopies} / 60</dd></div><div><dt>Missing families</dt><dd>{item.missingCount}</dd></div><div><dt>Energy</dt><dd>{item.energyTypes.join(", ") || "flexible / none"}</dd></div><div><dt>Prize plan</dt><dd>{item.prizeProfile ?? "not classified"}</dd></div></dl><div className="tile-actions"><button onClick={() => onEdit(deck)}>View list / builder</button><button onClick={() => onDuplicate(deck)}>Duplicate and edit</button><button disabled={!item.simulationReady} onClick={() => onPlay(deck)}>Play</button><button disabled={!item.simulationReady} onClick={() => onSelectOpponent(deck)}>Select as AI opponent</button><button disabled={!item.simulationReady} onClick={() => onSimulate(deck)}>Simulate</button><button onClick={() => onArchitectTemplate(deck)}>Use as Architect template</button><button onClick={() => download(`${deck.id}.txt`,exportDeckList(deck,index),"text/plain")}>Export</button></div>{snapshot && <p className="source-attribution"><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Limitless source deck {snapshot.sourceDeckId}</a><span>Accessed {new Date(snapshot.accessedAt).toLocaleDateString()}</span></p>}<details><summary>{item.simulationReady ? "Resolved list" : "Exact blockers and resolved list"}</summary>{item.corpus?.blockers.slice(0,30).map((blocker) => <small key={blocker}>{blocker}</small>)}{deck.entries.map((entry) => { const card = index.byId.get(entry.cardId); return <small key={entry.cardId}>{entry.count}× {card ? `${card.name} · ${card.setCode} ${card.collectorNumber}` : entry.cardId}</small>; })}</details></article>; })}</section>
  </main>;
}
