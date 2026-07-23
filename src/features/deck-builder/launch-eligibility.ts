import type { DeckManifest } from "../../data/decks/types";
import type { CatalogueIndex, PokemonCardMetadata } from "../../data/pokemon";
import { analyseDeck } from "./validation";

export interface DeckLaunchEligibility {
  deck: DeckManifest;
  playable: boolean;
  cardCount: number;
  constructionErrors: string[];
  unsupportedCards: PokemonCardMetadata[];
  reason: string;
}

export function resolveDeckLaunchEligibility(deck: DeckManifest, index: CatalogueIndex): DeckLaunchEligibility {
  const analysis = analyseDeck(deck, index);
  const constructionErrors = analysis.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  const reason = constructionErrors.length
    ? constructionErrors[0]!
    : analysis.unsupported.length
      ? `${analysis.unsupported.length} exact card printing${analysis.unsupported.length === 1 ? " is" : "s are"} not executable yet.`
      : "Ready to play and simulate.";
  return { deck, playable: analysis.simulationReady, cardCount: analysis.total, constructionErrors, unsupportedCards: analysis.unsupported, reason };
}

export function deckOptionLabel(eligibility: DeckLaunchEligibility): string {
  const name = `${eligibility.deck.favourite ? "★ " : ""}${eligibility.deck.name}`;
  if (eligibility.playable) return name;
  if (eligibility.cardCount !== 60) return `${name} — ${eligibility.cardCount} / 60 cards`;
  if (eligibility.constructionErrors.length) return `${name} — ${eligibility.constructionErrors.length} construction error${eligibility.constructionErrors.length === 1 ? "" : "s"}`;
  return `${name} — ${eligibility.unsupportedCards.length} effect${eligibility.unsupportedCards.length === 1 ? "" : "s"} not coded`;
}
