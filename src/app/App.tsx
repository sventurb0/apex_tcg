import { useEffect, useMemo, useRef, useState } from "react";
import { applyAction, createGame, createPlayerObservation, getLegalActions, type GameState } from "../../engine";
import { heuristicAgent } from "../../engine/ai/heuristic-agent";
import type { CardDefinition } from "../../engine/model/cards";
import type { DeckDefinition } from "../../engine/model/decks";
import type { SimulationReport } from "../../engine/simulation/metrics";
import { GameBoard } from "../components/board/GameBoard";
import { DeckEligibilityPanel } from "../components/board/DeckEligibilityPanel";
import { SimulationReportView } from "../components/reports/SimulationReportView";
import { CardImage } from "../components/cards";
import { premadeDecks, premadeSlots } from "../data/decks/premade";
import { deckCorpus, tournamentDeckManifests } from "../data/decks/corpus";
import type { DeckManifest } from "../data/decks/types";
import { buildCoveragePlan, buildCoverageReport, buildCoverageSignatureIndex, buildFavouriteCoverage, createCatalogueIndex, loadCardCatalogue, toRuntimeCardDefinition, type CatalogueIndex, type CoverageComplexity, type CoverageEffectKind, type PokemonCardCatalogue, type SignatureSupport } from "../data/pokemon";
import { prefetchDeckCardImages } from "../data/pokemon/image-cache";
import { DeckBuilder } from "../features/deck-builder/DeckBuilder";
import { analyseDeck } from "../features/deck-builder/validation";
import { deckOptionLabel, resolveDeckLaunchEligibility } from "../features/deck-builder/launch-eligibility";
import { deleteDeck, duplicateDeck, loadSavedDecks, SAVED_DECKS_STORAGE_KEY, saveDeck } from "../features/deck-builder/storage";
import { DeckImportView } from "../features/deck-import/DeckImportView";
import { DeckArchitect } from "../features/deck-architect/DeckArchitect";
import { DeckLibrary } from "../features/deck-library";

type View = "home" | "builder" | "architect" | "library" | "saved" | "premade" | "play" | "simulation" | "import" | "development";

const ROUTES: readonly View[] = ["home", "builder", "architect", "library", "saved", "premade", "play", "simulation", "import", "development"];

function viewFromHash(hash: string): View {
  const candidate = hash.replace(/^#/, "") as View;
  return ROUTES.includes(candidate) ? candidate : "home";
}

function createSimulationWorker(): Worker { return new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), { type: "module" }); }
function eventTimestamp(): number { return Date.now(); }
function randomChoice<T>(items: readonly T[]): T | undefined { return items[Math.floor(Math.random() * items.length)]; }

function engineDeck(deck: DeckManifest): DeckDefinition {
  return { id: deck.id, name: deck.name, description: deck.description, entries: deck.entries, available: true };
}

function runtimeCards(decks: DeckManifest[], index: CatalogueIndex): CardDefinition[] | null {
  const ids = new Set(decks.flatMap((deck) => deck.entries.map((entry) => entry.cardId)));
  const definitions = [...ids].map((id) => index.byId.get(id)).map((card) => card ? toRuntimeCardDefinition(card) : null);
  return definitions.every((card): card is CardDefinition => Boolean(card)) ? definitions : null;
}

function Home({ navigate }: { navigate: (view: View) => void }) {
  return <main className="home"><section className="hero"><p className="eyebrow">PRIVATE · LOCAL · TEXT ONLY</p><h1>Build. Play.<br />Test ideas.</h1><p>Search the complete English Pokémon TCG text catalogue, create and save decks, copy premades, then test simulation-ready lists against the AI.</p><div className="hero-actions"><button className="primary" onClick={() => navigate("builder")}>Open Deck Builder</button><button onClick={() => navigate("premade")}>Browse premade decks</button></div></section><section className="feature-grid home-workflows">
    <button onClick={() => navigate("builder")}><span>01</span><strong>Deck Builder</strong><small>Search cards, inspect printed text, and build without simulation restrictions.</small></button>
    <button onClick={() => navigate("play")}><span>02</span><strong>Play versus AI</strong><small>Launch any deck whose gameplay effects are fully supported.</small></button>
    <button onClick={() => navigate("architect")}><span>03</span><strong>Deck Architect</strong><small>Build explainable, validated candidates around favourite Pokémon.</small></button>
    <button onClick={() => navigate("simulation")}><span>04</span><strong>Simulation Lab</strong><small>Run balanced batches through the existing Web Worker engine.</small></button>
    <button onClick={() => navigate("saved")}><span>05</span><strong>Saved Decks</strong><small>Rename, favourite, duplicate, delete and resume local decks.</small></button>
    <button onClick={() => navigate("library")}><span>06</span><strong>Deck Library</strong><small>Browse personal, premade and source-attributed tournament snapshots with exact blockers.</small></button>
    <button onClick={() => navigate("premade")}><span>07</span><strong>Premade Decks</strong><small>Start with supplied real lists, then duplicate and modify them.</small></button>
  </section></main>;
}

function DeckTiles({ decks, index, onEdit, onChanged, premade = false }: { decks: DeckManifest[]; index: CatalogueIndex; onEdit: (deck: DeckManifest) => void; onChanged: () => void; premade?: boolean }) {
  return <section className="deck-grid">{decks.map((deck) => { const analysis = analyseDeck(deck, index); const previews = deck.entries.flatMap((entry) => { const card = index.byId.get(entry.cardId); return card?.supertype === "Pokémon" ? [card] : []; }).slice(0, 3); return <article className="deck-tile available" key={deck.id}><span className={`support-badge ${analysis.simulationReady ? "generated" : "partial"}`}>{analysis.simulationReady ? "simulation-ready" : "buildable"}</span><div className="deck-preview-images">{previews.map((card) => <CardImage card={card} size="thumbnail" key={card.id} />)}</div><h2>{deck.favourite ? "★ " : ""}{deck.name}</h2><p>{deck.description}</p><dl><div><dt>Cards</dt><dd>{analysis.total}</dd></div><div><dt>Unique printings</dt><dd>{deck.entries.length}</dd></div><div><dt>Unsupported effects</dt><dd>{analysis.unsupported.length}</dd></div><div><dt>Simulation-ready</dt><dd>{analysis.simulationReady ? "Yes" : "No"}</dd></div></dl><div className="tile-actions"><button onClick={() => onEdit(deck)}>Open in builder</button><button className="primary" onClick={() => { const copy = duplicateDeck(deck); onChanged(); onEdit(copy); }}>Duplicate and edit</button>{!premade && <><button onClick={() => { saveDeck({ ...deck, favourite: !deck.favourite }); onChanged(); }}>{deck.favourite ? "Unfavourite" : "Favourite"}</button><button className="danger" onClick={() => { deleteDeck(deck.id); onChanged(); }}>Delete</button></>}</div>{!analysis.simulationReady && <details><summary>Simulation development status</summary>{analysis.unsupported.slice(0, 12).map((card) => <small key={card.id}>{card.name} · {card.setCode} {card.collectorNumber}</small>)}{analysis.unsupported.length > 12 && <small>+ {analysis.unsupported.length - 12} more</small>}</details>}</article>; })}</section>;
}

function SavedDecks({ decks, index, onEdit, onChanged }: { decks: DeckManifest[]; index: CatalogueIndex; onEdit: (deck: DeckManifest) => void; onChanged: () => void }) {
  return <main><header className="page-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h1>Saved Decks</h1></div><p>These decks persist in this browser. Construction errors or unsupported effects never prevent saving and editing.</p></header>{decks.length ? <DeckTiles decks={decks} index={index} onEdit={onEdit} onChanged={onChanged} /> : <p className="empty-state">No saved decks yet. Create one in Deck Builder or duplicate a premade deck.</p>}</main>;
}

function PremadeDecks({ index, onEdit, onChanged }: { index: CatalogueIndex; onEdit: (deck: DeckManifest) => void; onChanged: () => void }) {
  return <main><header className="page-heading"><div><p className="eyebrow">EDITABLE STARTING POINTS</p><h1>Premade Decks</h1></div><p>Premades are ordinary exact-ID manifests. Duplicate one to create a personal editable copy.</p></header><DeckTiles decks={premadeDecks} index={index} onEdit={onEdit} onChanged={onChanged} premade /><details className="planned-decks"><summary>Additional premade slots</summary><div>{premadeSlots.map((slot) => <span key={slot.id}>{slot.name} · planned</span>)}</div></details></main>;
}

export function PlayView({ decks, index, preferredDeckId, preferredOpponentId, onEditDeck, onDevelopment, onGameActiveChange }: { decks: DeckManifest[]; index: CatalogueIndex; preferredDeckId?: string; preferredOpponentId?: string; onEditDeck: (deck: DeckManifest) => void; onDevelopment: () => void; onGameActiveChange: (active: boolean) => void }) {
  const eligibility = useMemo(() => decks.map((deck) => resolveDeckLaunchEligibility(deck, index)), [decks, index]);
  const ready = useMemo(() => eligibility.filter((item) => item.playable).map((item) => item.deck), [eligibility]);
  const [subjectId, setSubjectId] = useState(() => eligibility.find((item) => item.deck.id === preferredDeckId)?.deck.id ?? eligibility.find((item) => item.playable)?.deck.id ?? eligibility[0]?.deck.id ?? "");
  const [opponentId, setOpponentId] = useState(() => eligibility.some((item) => item.playable && item.deck.id === preferredOpponentId) ? preferredOpponentId! : "random"); const [state, setState] = useState<GameState>(); const [error, setError] = useState(""); const [activeMatchup, setActiveMatchup] = useState<[string, string]>();
  const selectedEligibility = eligibility.find((item) => item.deck.id === subjectId);
  function launch(): void {
    const subject = ready.find((deck) => deck.id === subjectId); const opponents = opponentId === "random-no-mirror" ? ready.filter((deck) => deck.id !== subjectId) : ready; const opponent = opponentId.startsWith("random") ? randomChoice(opponents) : ready.find((deck) => deck.id === opponentId);
    if (!subject) { setError(selectedEligibility?.reason ?? "Choose a playable deck."); return; }
    if (!opponent) { setError(opponentId === "random-no-mirror" ? "No different simulation-ready AI deck is available. Choose Random, mirrors allowed." : "Choose an available AI deck."); return; }
    const cards = runtimeCards([subject, opponent], index); if (!cards) { setError("Runtime card conversion is incomplete for this matchup."); return; }
    prefetchDeckCardImages(index, [subject, opponent]);
    setError(""); setActiveMatchup([subject.name, opponent.name]); setState(createGame({ seed: eventTimestamp(), playerOneDeck: engineDeck(subject), playerTwoDeck: engineDeck(opponent), cards, startingPlayer: "player-one" }));
  }
  const gameActive = Boolean(state);
  useEffect(() => { onGameActiveChange(gameActive); return () => onGameActiveChange(false); }, [gameActive, onGameActiveChange]);
  useEffect(() => { if (!state || state.result) return; const acting = state.pendingChoice?.playerId ?? state.activePlayerId; if (acting !== "player-two") return; const timer = window.setTimeout(() => { const observation = createPlayerObservation(state, "player-two"); if (!observation.legalActions.length) return; const decision = heuristicAgent.selectAction(observation, state.rngState); setState(applyAction(state, decision.action)); }, 180); return () => window.clearTimeout(timer); }, [state]);
  const actions = state && (state.pendingChoice?.playerId ?? state.activePlayerId) === "player-one" ? getLegalActions(state, "player-one") : [];
  if (state) return <main className="play-page play-page-active"><header className="game-toolbar"><button onClick={() => { setState(undefined); setActiveMatchup(undefined); }}>End game</button><span><small>Player</small><b>{activeMatchup?.[0]}</b></span><span><small>Opponent</small><b>{activeMatchup?.[1]}</b></span><span><small>Turn</small><b>{state.turn}</b></span><span><small>Acting</small><b>{state.pendingChoice?.playerId ?? state.activePlayerId}</b></span><span><small>Phase</small><b>{state.phase}</b></span><span><small>Seed</small><b>{state.seed}</b></span></header><GameBoard state={state} index={index} actions={actions} onAction={(action) => setState(applyAction(state, action))} /></main>;
  return <main className="play-page"><header className="page-heading"><div><p className="eyebrow">HUMAN VERSUS AI</p><h1>Play</h1></div><p>Every premade, saved and current editor deck remains visible. Launch is enabled only when construction and exact runtime checks pass.</p></header><section className="lab-panel"><div className="launch-grid"><label>Your deck<select aria-label="Your deck" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setError(""); }}><option value="">Select deck</option>{eligibility.map((item) => <option value={item.deck.id} disabled={!item.playable} key={item.deck.id}>{deckOptionLabel(item)}</option>)}</select></label><label>AI deck<select aria-label="AI deck" value={opponentId} onChange={(event) => { setOpponentId(event.target.value); setError(""); }}><option value="random">Random, mirrors allowed</option><option value="random-no-mirror">Random, exclude mirror</option>{eligibility.map((item) => <option value={item.deck.id} disabled={!item.playable} key={item.deck.id}>{deckOptionLabel(item)}</option>)}</select></label></div>{selectedEligibility && <DeckEligibilityPanel eligibility={selectedEligibility} onEdit={() => onEditDeck(selectedEligibility.deck)} onDevelopment={onDevelopment} />}<button className="primary" disabled={!selectedEligibility?.playable} onClick={launch}>Start game</button>{error && <p className="error-callout">{error}</p>}{!ready.length && <p className="development-gate">No visible deck currently clears the construction and exact-effect launch gate.</p>}</section></main>;
}

export function SimulationLab({ decks, index, preferredDeckId, onEditDeck, onDevelopment }: { decks: DeckManifest[]; index: CatalogueIndex; preferredDeckId?: string; onEditDeck: (deck: DeckManifest) => void; onDevelopment: () => void }) {
  const eligibility = useMemo(() => decks.map((deck) => resolveDeckLaunchEligibility(deck, index)), [decks, index]);
  const ready = useMemo(() => eligibility.filter((item) => item.playable).map((item) => item.deck), [eligibility]);
  const [subjectId, setSubjectId] = useState(() => eligibility.find((item) => item.deck.id === preferredDeckId)?.deck.id ?? eligibility.find((item) => item.playable)?.deck.id ?? eligibility[0]?.deck.id ?? ""); const [mode, setMode] = useState("all"); const [selected, setSelected] = useState<string[]>([]); const [games, setGames] = useState(100); const [balanced, setBalanced] = useState(true); const [reports, setReports] = useState<Record<string, SimulationReport>>({}); const [progress, setProgress] = useState(0); const [error, setError] = useState(""); const workers = useRef<Worker[]>([]);
  const selectedEligibility = eligibility.find((item) => item.deck.id === subjectId);
  useEffect(() => () => workers.current.forEach((worker) => worker.terminate()), []);
  async function run(): Promise<void> {
    const subject = ready.find((deck) => deck.id === subjectId); if (!subject) { setError(selectedEligibility?.reason ?? "Choose a simulation-ready subject deck."); return; }
    const candidates = ready.filter((deck) => deck.id !== subject.id); const opponents = mode === "all" ? candidates : mode === "selected" ? candidates.filter((deck) => selected.includes(deck.id)) : mode === "random-mirror" ? [randomChoice(ready)].filter((deck): deck is DeckManifest => Boolean(deck)) : [randomChoice(candidates)].filter((deck): deck is DeckManifest => Boolean(deck));
    if (!opponents.length) { setError(mode === "random-mirror" ? "No simulation-ready opponent is available." : "No different simulation-ready opponent is available. Choose Random, mirrors allowed to run a mirror."); return; } setError(""); setReports({}); setProgress(0); workers.current.forEach((worker) => worker.terminate()); workers.current = [];
    let finished = 0; let totalProgress = 0;
    for (const opponent of opponents) {
      const cards = runtimeCards([subject, opponent], index); if (!cards) continue; const worker = createSimulationWorker(); workers.current.push(worker);
      worker.onmessage = (event: MessageEvent<{ type: string; completed?: number; total?: number; report?: SimulationReport }>) => { if (event.data.type === "progress" && event.data.completed && event.data.total) { totalProgress += event.data.completed / event.data.total; setProgress(Math.min(99, Math.round(totalProgress / opponents.length * 100))); } if (event.data.type === "complete" && event.data.report) { finished += 1; setReports((current) => ({ ...current, [opponent.id]: event.data.report! })); setProgress(Math.round(finished / opponents.length * 100)); worker.terminate(); } };
      const seed = eventTimestamp(); worker.postMessage({ type: "start", requestId: `${seed}-${opponent.id}`, games, baseSeed: seed + finished, subjectDeck: engineDeck(subject), opponentDeck: engineDeck(opponent), cards, agentType: "heuristic", firstPlayerPolicy: balanced ? "alternate" : "random" });
    }
  }
  return <main><header className="page-heading"><div><p className="eyebrow">AI VERSUS AI</p><h1>Simulation Lab</h1></div><p>Every premade, saved and current editor deck remains visible; only exact-runtime-ready selections can start workers.</p></header><section className="lab-panel"><div className="launch-grid"><label>Subject deck<select aria-label="Subject deck" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setError(""); }}><option value="">Select deck</option>{eligibility.map((item) => <option value={item.deck.id} disabled={!item.playable} key={item.deck.id}>{deckOptionLabel(item)}</option>)}</select></label><label>Opponents<select value={mode} onChange={(event) => { setMode(event.target.value); setError(""); }}><option value="all">All ready opponents</option><option value="selected">Several selected opponents</option><option value="random">Random, exclude mirror</option><option value="random-mirror">Random, mirrors allowed</option></select></label></div>{selectedEligibility && <DeckEligibilityPanel eligibility={selectedEligibility} onEdit={() => onEditDeck(selectedEligibility.deck)} onDevelopment={onDevelopment} />}{mode === "selected" && <div className="opponent-checks">{eligibility.filter((item) => item.deck.id !== subjectId).map((item) => <label className={!item.playable ? "unavailable" : ""} key={item.deck.id}><input type="checkbox" disabled={!item.playable} checked={selected.includes(item.deck.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.deck.id] : selected.filter((id) => id !== item.deck.id))} />{deckOptionLabel(item)}</label>)}</div>}<div className="presets">Games per opponent {[10,100,500,1000].map((value) => <button className={games === value ? "selected" : ""} onClick={() => setGames(value)} key={value}>{value}</button>)}<label><input type="checkbox" checked={balanced} onChange={(event) => setBalanced(event.target.checked)} />Balanced first/second</label></div><button className="primary" disabled={!selectedEligibility?.playable} onClick={() => void run()}>Run simulations</button>{error && <p className="error-callout">{error}</p>}{progress > 0 && <div className="progress"><div style={{ width: `${progress}%` }} /><span>{progress}%</span></div>}{!ready.length && <p className="development-gate">No visible deck currently clears the construction and exact-effect launch gate.</p>}</section>{Object.entries(reports).map(([id, report]) => <div key={id}><h2>{ready.find((deck) => deck.id === id)?.name}</h2><SimulationReportView report={report} /></div>)}</main>;
}

function Development({ catalogue, index, decks }: { catalogue: PokemonCardCatalogue; index: CatalogueIndex; decks: DeckManifest[] }) {
  const [kind, setKind] = useState<CoverageEffectKind | "all">("all");
  const [status, setStatus] = useState<SignatureSupport | "all">("unsupported");
  const [complexity, setComplexity] = useState<CoverageComplexity | "all">("all");
  const [format, setFormat] = useState<"all" | "standard">("all");
  const [favourite, setFavourite] = useState("all");
  const [deck, setDeck] = useState("all");
  const [role, setRole] = useState("");
  const [minimumPrintings, setMinimumPrintings] = useState(1);
  const deckReferences = useMemo(() => Object.fromEntries(decks.map((item) => [item.name, item.entries.map((entry) => entry.cardId)])), [decks]);
  const signatures = useMemo(() => buildCoverageSignatureIndex(catalogue.cards, deckReferences), [catalogue.cards, deckReferences]);
  const favourites = useMemo(() => buildFavouriteCoverage(catalogue.cards, signatures), [catalogue.cards, signatures]);
  const report = useMemo(() => buildCoverageReport(catalogue.cards, signatures, favourites), [catalogue.cards, signatures, favourites]);
  const plan = useMemo(() => buildCoveragePlan(signatures), [signatures]);
  const allSignatures = useMemo(() => [...signatures.abilities, ...signatures.attacks, ...signatures.trainerEffects, ...signatures.energyEffects], [signatures]);
  const filtered = allSignatures.filter((signature) => (kind === "all" || signature.kind === kind) && (status === "all" || signature.support === status) && (complexity === "all" || signature.complexity === complexity) && (format === "all" || signature.standardLegalPrintings > 0) && (favourite === "all" || signature.favouriteNames.includes(favourite)) && (deck === "all" || signature.referencedByDecks.includes(deck)) && (!role.trim() || signature.strategicTags.some((tag) => tag.includes(role.trim().toLowerCase()))) && signature.exactOccurrenceCount >= minimumPrintings);
  const commonTrainers = signatures.trainerEffects.filter((signature) => signature.support === "complete").slice(0, 40);
  return <main className="coverage-page"><header className="page-heading"><div><p className="eyebrow">DEVELOPMENT · DIAGNOSTICS</p><h1>Card Behaviour Coverage</h1></div><p>Exact catalogue availability is separate from executable behaviour. Signature support is granted only by explicit handlers, reviewed templates, functional inheritance or the fixed no-text compiler.</p></header>
    <div className="diagnostic-stats"><article><strong>{report.totalExactPrintings.toLocaleString()}</strong><span>exact printings</span></article><article><strong>{report.totalSimulationReadyPrintings.toLocaleString()}</strong><span>simulation ready</span></article><article><strong>{report.behaviourFamilies.toLocaleString()}</strong><span>behaviour families</span></article><article><strong>{report.functionalInheritedCompletePrintings.toLocaleString()}</strong><span>inherited</span></article><article><strong>{report.safelyGeneratedPrintings.toLocaleString()}</strong><span>safe generated</span></article></div>
    <section className="coverage-summary-grid">{(["ability","attack","trainer","energy"] as const).map((value) => <article key={value}><h2>{value}</h2><strong>{report.signatures[value].complete.toLocaleString()} / {report.signatures[value].total.toLocaleString()}</strong><span>complete signatures</span><small>{report.signatures[value].partial.toLocaleString()} partial · {report.signatures[value].unsupported.toLocaleString()} unsupported</small></article>)}<article><h2>Favourites</h2><strong>{report.favouritePokemonWithSimulationReadyVariant} / {favourites.length}</strong><span>with an executable variant</span><small>{report.favouritePokemonFullyUnsupported} fully unsupported</small></article></section>
    <section className="coverage-filters panel"><h2>Signature explorer</h2><div className="filter-grid"><label>Card type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">All</option>{(["ability","attack","trainer","energy"] as const).map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All</option>{(["complete","partial","unsupported"] as const).map((value) => <option key={value}>{value}</option>)}</select></label><label>Complexity<select value={complexity} onChange={(event) => setComplexity(event.target.value as typeof complexity)}><option value="all">All</option>{(["low","medium","high"] as const).map((value) => <option key={value}>{value}</option>)}</select></label><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}><option value="all">All formats</option><option value="standard">Standard legal</option></select></label><label>Favourite Pokémon<select value={favourite} onChange={(event) => setFavourite(event.target.value)}><option value="all">All</option>{favourites.map((row) => <option key={row.name}>{row.name}</option>)}</select></label><label>Saved / premade deck<select value={deck} onChange={(event) => setDeck(event.target.value)}><option value="all">All</option>{decks.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Strategic role<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="draw, poison, search…" /></label><label>Minimum printings<input type="number" min="1" value={minimumPrintings} onChange={(event) => setMinimumPrintings(Math.max(1, Number(event.target.value) || 1))} /></label></div><p>{filtered.length.toLocaleString()} matching signatures. Showing the first 100.</p><div className="support-table-wrap"><table className="support-table"><thead><tr><th>Family</th><th>Type / status</th><th>Exact effect</th><th>Coverage</th><th>Strategy</th></tr></thead><tbody>{filtered.slice(0, 100).map((signature) => <tr key={signature.id}><td><b>{signature.displayName}</b><code>{signature.id}</code></td><td>{signature.kind} · {signature.support}<small>{signature.complexity}</small></td><td>{signature.normalizedText || `[printed damage ${signature.printedDamage || "none"}]`}<small>{signature.proposedTemplate ?? "custom family"}</small></td><td>{signature.exactOccurrenceCount} printings<small>{signature.cardNames.slice(0, 4).join(", ")}</small></td><td>{signature.strategicTags.join(", ") || "unclassified"}</td></tr>)}</tbody></table></div></section>
    <section className="coverage-two-column"><article className="panel"><h2>Favourite Pokémon coverage</h2>{favourites.map((row) => <details key={row.name}><summary>{row.name} · {row.completePrintings + row.safelyGeneratedPrintings}/{row.exactPrintings} ready</summary><p>{row.gameplayVariants} gameplay variants · effort {row.estimatedImplementationEffort}</p><p>Best exact runtime variant: <code>{row.bestSimulationReadyCardId ?? "none"}</code></p><p>Missing: {[...row.missingAbilityFamilies, ...row.missingAttackFamilies].slice(0, 8).join(", ") || "none"}</p></details>)}</article><article className="panel"><h2>Saved and premade deck blockers</h2>{decks.map((item) => { const analysis = analyseDeck(item, index); return <details key={item.id}><summary>{item.name} · {analysis.unsupported.length} blockers</summary>{analysis.unsupported.map((card) => <p key={card.id}>{card.name} · <code>{card.id}</code></p>)}</details>; })}</article></section>
    <section className="panel"><h2>Common executable Trainers</h2><p>{report.commonExecutableTrainerFamilies} exact Trainer-effect families are executable. The table shows the most widely printed reviewed families.</p><div className="support-table-wrap"><table className="support-table"><thead><tr><th>Card</th><th>Functional family</th><th>Exact printings</th><th>Strategic roles</th><th>Format / simulation</th></tr></thead><tbody>{commonTrainers.map((signature) => <tr key={signature.id}><td>{signature.displayName}</td><td><code>{signature.implementedTemplateId ?? signature.id}</code></td><td>{signature.exactOccurrenceCount}</td><td>{signature.strategicTags.join(", ") || "general"}</td><td>{signature.standardLegalPrintings ? `${signature.standardLegalPrintings} Standard` : "legacy"}<small>complete</small></td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Ranked next implementation families</h2>{plan.slice(0, 20).map((entry) => <details key={entry.familyId}><summary>#{entry.rank} · {entry.kind} · {entry.exampleCards.join(", ")} · score {entry.score}</summary><p>{entry.normalizedText}</p><p>{entry.printingCount} printings · {entry.complexity} · {entry.proposedTemplate}</p><p>{entry.reasons.join(" ")}</p></details>)}</section>
    <section className="replay-box"><h2>Dataset</h2><p>Source commit <code>{catalogue.source.commit}</code>. Generated {new Date(catalogue.generatedAt).toLocaleString()} with no artwork bundled.</p></section></main>;
}

export function App() {
  const [view, setView] = useState<View>(() => viewFromHash(location.hash)); const [catalogue, setCatalogue] = useState<PokemonCardCatalogue>(); const [loadError, setLoadError] = useState(""); const [savedDecks, setSavedDecks] = useState<DeckManifest[]>(() => loadSavedDecks()); const [editorDeck, setEditorDeck] = useState<DeckManifest>(); const [architectTemplate, setArchitectTemplate] = useState<DeckManifest>(); const [preferredOpponentId, setPreferredOpponentId] = useState<string>(); const [playGameActive, setPlayGameActive] = useState(false);
  useEffect(() => { void loadCardCatalogue().then(setCatalogue).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error))); }, []);
  useEffect(() => {
    const refreshSavedDecks = () => setSavedDecks(loadSavedDecks());
    const storageChanged = (event: StorageEvent) => { if (!event.key || event.key === SAVED_DECKS_STORAGE_KEY) refreshSavedDecks(); };
    window.addEventListener("tcg-decks-changed", refreshSavedDecks); window.addEventListener("storage", storageChanged);
    return () => { window.removeEventListener("tcg-decks-changed", refreshSavedDecks); window.removeEventListener("storage", storageChanged); };
  }, []);
  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const index = useMemo(() => catalogue ? createCatalogueIndex(catalogue.cards) : undefined, [catalogue]); const allDecks = useMemo(() => [...new Map([...premadeDecks, ...tournamentDeckManifests, ...savedDecks, ...(editorDeck ? [editorDeck] : [])].map((deck) => [deck.id, deck])).values()], [savedDecks, editorDeck]);
  const refresh = () => setSavedDecks(loadSavedDecks()); const navigate = (next: View) => { location.hash = next; setView(next); };
  const edit = (deck: DeckManifest) => { setEditorDeck(structuredClone(deck)); navigate("builder"); };
  if (loadError) return <main className="blocked-mode"><h1>Catalogue unavailable</h1><p>{loadError}</p><code>npm run cards:sync &amp;&amp; npm run cards:build</code></main>;
  if (!catalogue || !index) return <main className="loading"><p className="eyebrow">LOADING LOCAL DATA</p><h1>Opening the card catalogue…</h1></main>;
  let content;
  if (view === "builder") content = <DeckBuilder key={editorDeck?.id ?? "new-deck"} catalogue={catalogue} index={index} initialDeck={editorDeck} onSaved={refresh} onPlay={(deck) => { setEditorDeck(deck); navigate("play"); }} onSimulate={(deck) => { setEditorDeck(deck); navigate("simulation"); }} />;
  else if (view === "architect") content = <DeckArchitect catalogue={catalogue} index={index} opponents={[...premadeDecks, ...tournamentDeckManifests]} templateDeck={architectTemplate} onSaved={refresh} onEdit={edit} onPlay={(deck) => { setEditorDeck(deck); navigate("play"); }} onSimulate={(deck) => { setEditorDeck(deck); navigate("simulation"); }} />;
  else if (view === "library") content = <DeckLibrary corpus={deckCorpus} personalDecks={savedDecks} premadeDecks={premadeDecks} index={index} onEdit={edit} onDuplicate={(deck) => edit(duplicateDeck(deck))} onPlay={(deck) => { setEditorDeck(deck); setPreferredOpponentId(undefined); navigate("play"); }} onSelectOpponent={(deck) => { setPreferredOpponentId(deck.id); navigate("play"); }} onSimulate={(deck) => { setEditorDeck(deck); navigate("simulation"); }} onArchitectTemplate={(deck) => { setArchitectTemplate(deck); navigate("architect"); }} />;
  else if (view === "saved") content = <SavedDecks decks={savedDecks} index={index} onEdit={edit} onChanged={refresh} />;
  else if (view === "premade") content = <PremadeDecks index={index} onEdit={edit} onChanged={refresh} />;
  else if (view === "play") content = <PlayView decks={allDecks} index={index} preferredDeckId={editorDeck?.id} preferredOpponentId={preferredOpponentId} onEditDeck={edit} onDevelopment={() => navigate("development")} onGameActiveChange={setPlayGameActive} />;
  else if (view === "simulation") content = <SimulationLab decks={allDecks} index={index} preferredDeckId={editorDeck?.id} onEditDeck={edit} onDevelopment={() => navigate("development")} />;
  else if (view === "import") content = <DeckImportView index={index} onSaved={refresh} onEdit={edit} />;
  else if (view === "development") content = <Development catalogue={catalogue} index={index} decks={allDecks} />;
  else content = <Home navigate={navigate} />;
  const navigation: [View, string][] = [["home","Home"],["builder","Deck Builder"],["architect","Deck Architect"],["library","Deck Library"],["play","Play"],["simulation","Simulation Lab"],["saved","Saved Decks"],["premade","Premade"],["import","Import"],["development","Development"]];
  return <div className={`app-shell ${playGameActive ? "game-active" : ""}`}><nav className="top-nav"><button className="brand" onClick={() => navigate("home")}><span>DL</span><b>Pokémon TCG DeckLab</b></button><div>{navigation.map(([id,label]) => <button className={view === id ? "active" : ""} onClick={() => navigate(id)} key={id}>{label}</button>)}</div></nav>{content}{!playGameActive && <footer><span>{catalogue.cards.length.toLocaleString()} local text-only card records</span><span>Deck construction always available · Exact simulation at launch</span></footer>}</div>;
}
