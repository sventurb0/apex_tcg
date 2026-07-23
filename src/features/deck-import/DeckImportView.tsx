import { useMemo, useState } from "react";
import type { DeckManifest } from "../../data/decks/types";
import { compileCardImplementation, type CatalogueIndex, type PokemonCardMetadata } from "../../data/pokemon";
import { saveDeck } from "../deck-builder/storage";
import { manifestFromImport } from "./deck-io";
import { importDeckList } from "./resolver";
import type { FormatProfile, GameplayVariant } from "./types";

export const IMPORT_EXAMPLE = `Pokémon\n\n4 Fuecoco PAL 035\n2 Skeledirge ex PAL 037\n\nTrainer\n\n2 Switch SVI 194\n\nEnergy\n\n12 Basic Fire Energy`;

function variantLabel(variant: GameplayVariant): string {
  const card = variant.recommended;
  const abilities = card.abilities?.map((ability) => ability.name).join(", ");
  const attacks = card.attacks?.map((attack) => attack.name).join(", ");
  return `${card.name} · ${card.setCode} ${card.collectorNumber}${card.hp ? ` · ${card.hp} HP` : ""}${card.types?.length ? ` · ${card.types.join("/")}` : ""}${abilities ? ` · Ability: ${abilities}` : ""}${attacks ? ` · Attacks: ${attacks}` : ""}${card.regulationMark ? ` · ${card.regulationMark}` : ""} · ${compileCardImplementation(card).status}`;
}

function PrintingOption({ card }: { card: PokemonCardMetadata }) {
  return <option value={card.id}>{card.setCode} {card.collectorNumber} · {card.setName}{card.regulationMark ? ` · ${card.regulationMark}` : ""}</option>;
}

export function DeckImportView({ index, onSaved, onEdit }: { index: CatalogueIndex; onSaved: () => void; onEdit: (deck: DeckManifest) => void }) {
  const [input, setInput] = useState(IMPORT_EXAMPLE);
  const [name, setName] = useState("Imported deck");
  const [format, setFormat] = useState<FormatProfile>("custom");
  const [selections, setSelections] = useState<Record<number, string>>({});
  const report = useMemo(() => importDeckList(input, format, index, selections), [input, format, index, selections]);

  function saveImported(): void {
    const deck = manifestFromImport(report, name, format);
    saveDeck(deck); onSaved(); onEdit(deck);
  }

  return <main><header className="page-heading"><div><p className="eyebrow">OPTIONAL WORKFLOW</p><h1>Import a deck list</h1></div><p>Card identity, deck construction and simulation readiness are reported separately. Incomplete or unsupported decks can still be saved and edited.</p></header>
    <section className="import-layout"><div className="import-editor"><label>Deck name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as FormatProfile)}><option value="standard">Standard</option><option value="expanded">Expanded</option><option value="custom">Custom</option><option value="none">No legality enforcement</option></select></label><label>Deck list<textarea value={input} onChange={(event) => { setInput(event.target.value); setSelections({}); }} spellCheck={false} /></label><div className="import-actions"><button onClick={() => setSelections({})}>Use recommended printings</button><button className="primary" disabled={!report.canSave} onClick={saveImported}>Save and edit imported deck</button></div><p className="disclosure">Set-coded exports preserve the selected exact printing. Ordinary Basic Energy and mechanically identical reprints use deterministic recommended printings automatically.</p></div>
      <aside className="import-report"><div className="import-summary"><article className={report.identity.canSave ? "ready" : "blocked"}><b>Card identity</b><strong>{report.identity.resolvedLines}/{report.identity.parsedLines} lines</strong><span>{report.identity.resolvedCopies} copies · {report.identity.unresolvedLines} unknown · {report.identity.ambiguousLines} ambiguous</span></article><article><b>Construction</b><strong>{report.construction.currentSize} / {report.construction.targetSize}</strong><span>{report.construction.errors.length} errors · {report.construction.warnings.length} warnings</span></article><article className={report.simulation.ready ? "ready" : "warning-state"}><b>Simulation</b><strong>{report.simulation.ready ? "Ready" : "Incomplete"}</strong><span>{report.simulation.counts.complete} complete · {report.simulation.counts.generated} generated · {report.simulation.counts.partial} partial · {report.simulation.counts.unsupported} unsupported</span></article></div>
        {report.identity.parserErrors.map((error) => <div className="issue" key={error}><b>Unrecognised line</b><span>{error}</span></div>)}
        {report.unknown.map((line) => <div className="issue" key={line.lineNumber}><b>Line {line.lineNumber}: {line.descriptor}</b><span>{line.reason}</span></div>)}
        {report.ambiguous.map((line) => <div className="ambiguity-card" key={line.lineNumber}><b>Line {line.lineNumber}: {line.descriptor}</b><span>{line.variants.length} different gameplay variants</span><select value={selections[line.lineNumber] ?? ""} onChange={(event) => setSelections((current) => ({ ...current, [line.lineNumber]: event.target.value }))}><option value="">Choose a gameplay variant…</option>{line.variants.map((variant) => <option key={variant.signature} value={variant.recommended.id}>{variantLabel(variant)}</option>)}</select></div>)}
        <section className="recognised-lines"><h3>Recognised lines</h3>{report.resolved.map((line) => <div key={line.lineNumber}><span>✓ {line.quantity} {line.card.name}</span><code>{line.card.id}</code>{line.equivalentPrintings.length > 1 && <label>Printing<select value={line.card.id} onChange={(event) => setSelections((current) => ({ ...current, [line.lineNumber]: event.target.value }))}>{line.equivalentPrintings.map((card) => <PrintingOption card={card} key={card.id} />)}</select></label>}</div>)}</section>
        <section className="report-section construction-report"><h3>Deck construction</h3>{report.construction.errors.map((error) => <p className="error" key={error}>● {error}</p>)}{report.construction.warnings.map((warning) => <p className="warning-text" key={warning}>▲ {warning}</p>)}{!report.construction.errors.length && !report.construction.warnings.length && <p className="valid">✓ Construction checks pass.</p>}</section>
        <section className="report-section simulation-report"><h3>Simulation support</h3>{report.simulation.ready ? <p className="valid">✓ Every printing has complete or generated behaviour.</p> : <><p>Deck building and saving remain available.</p>{report.simulation.partialCardIds.length > 0 && <p><b>Partial:</b> {report.simulation.partialCardIds.join(", ")}</p>}{report.simulation.unsupportedCardIds.length > 0 && <p><b>Unsupported:</b> {report.simulation.unsupportedCardIds.join(", ")}</p>}</>}</section>
      </aside></section></main>;
}
