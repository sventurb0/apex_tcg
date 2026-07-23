import type { SimulationReport } from "../../../engine/simulation/metrics";

function display(value: number | null, suffix = ""): string {
  return value === null ? "Not collected" : `${value.toFixed(1)}${suffix}`;
}

export function SimulationReportView({ report }: { report: SimulationReport }) {
  const metrics = [
    ["Games", report.gamesPlayed], ["Wins", report.wins], ["Losses", report.losses], ["Unresolved", report.drawsOrUnresolved],
    ["Win rate", display(report.winPercentage, "%")], ["Average turns", display(report.averageTurnCount)], ["Median turns", display(report.medianTurnCount)],
    ["Avg. Prizes taken", display(report.averagePrizesTaken)], ["Mulligans / game", display(report.mulliganRate)],
    ["First attack turn", display(report.averageTurnOfFirstAttack)], ["First KO turn", display(report.averageTurnOfFirstKnockOut)],
    ["No-attachment turns", display(report.energyStarvationTurnPercentage, "%")], ["Errors / unresolved", report.errorOrUnresolvedCount],
  ];
  return (
    <section className="report" aria-live="polite">
      <h3>Simulation report</h3>
      <div className="metric-grid">{metrics.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p><b>Loss conditions:</b> deck-out {report.deckOutLosses}, no Pokémon in play {report.noPokemonLosses}, Prize race {report.prizeRaceLosses}.</p>
      {report.unresolvedSeeds.length > 0 && <details><summary>Reproducible unresolved seeds</summary><code>{report.unresolvedSeeds.join(", ")}</code></details>}
      <p className="disclosure">Card-use, stranded-card, and primary-attacker readiness metrics are intentionally marked uncollected until semantic card event tracing is added.</p>
    </section>
  );
}
