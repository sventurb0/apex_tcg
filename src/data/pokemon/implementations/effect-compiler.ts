import { cardImplementationRegistry } from "./registry";
import type { CardImplementation, PokemonCardMetadata } from "../types";
import { currentCatalogueIndex } from "../catalogue";
import { createImplementationResolver } from "./resolver";
import { compileSafeGeneratedImplementation } from "./safe-compiler";

let cachedCards: readonly PokemonCardMetadata[] | undefined;
let cachedResolver: ReturnType<typeof createImplementationResolver> | undefined;

export function implementationResolver(cards = currentCatalogueIndex()?.cards): ReturnType<typeof createImplementationResolver> | undefined { if (!cards) return undefined; if (cachedCards !== cards) { cachedCards = cards; cachedResolver = createImplementationResolver(cards); } return cachedResolver; }

export function compileCardImplementation(card: PokemonCardMetadata): CardImplementation {
  const exact = cardImplementationRegistry[card.id];
  const resolver = implementationResolver();
  if (resolver && currentCatalogueIndex()?.byId.has(card.id)) return resolver.resolve(card);
  if (exact) return { ...exact, implementationSource: exact.status === "complete" ? "explicit" : exact.status, canonicalCardId: card.id, equivalentPrintingCount: 1 };
  return compileSafeGeneratedImplementation(card);
}
