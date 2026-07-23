import { compileCardImplementation, currentCatalogueIndex, type CardImplementation, type PokemonCardMetadata, type SimulationSupport } from "../../data/pokemon";

const SUPPORT_COPY: Readonly<Record<SimulationSupport, { label: string; explanation: string }>> = {
  complete: { label: "Simulation ready", explanation: "This exact printing has an explicit tested runtime implementation." },
  generated: { label: "Simulation ready — standard effect", explanation: "This exact printing safely uses a recognized standard runtime effect." },
  partial: { label: "Partially coded", explanation: "Some printed gameplay behaviour is represented, but listed effects remain uncoded." },
  unsupported: { label: "Effect not coded", explanation: "The printed card is fully available for building, but its gameplay effect is not executable." },
};

function supportFor(card: PokemonCardMetadata): CardImplementation { return compileCardImplementation(card); }

export function SimulationSupportBadge({ card, implementation = supportFor(card) }: { card: PokemonCardMetadata; implementation?: CardImplementation }) {
  const inherited = implementation.implementationSource === "functional-reprint" && implementation.canonicalCardId;
  const canonical = inherited ? implementationResolverCard(implementation.canonicalCardId!) : undefined;
  const copy = inherited ? { label: `Simulation ready — same gameplay as ${canonical ? `${canonical.setCode} ${canonical.collectorNumber}` : implementation.canonicalCardId}`, explanation: "This printing inherits the tested runtime implementation from a gameplay-identical printing." } : SUPPORT_COPY[implementation.status];
  return <span className={`support-badge ${implementation.status}`} title={copy.explanation} aria-label={`${copy.label}. ${copy.explanation}`}>{copy.label}</span>;
}

function implementationResolverCard(cardId: string): PokemonCardMetadata | undefined {
  return currentCatalogueIndex()?.byId.get(cardId);
}

export function SimulationSupportDetails({ card }: { card: PokemonCardMetadata }) {
  const implementation = supportFor(card);
  if (!implementation.knownLimitations.length) return null;
  return <div className="support-limitations"><strong>Not represented in simulation</strong><ul>{implementation.knownLimitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>;
}
