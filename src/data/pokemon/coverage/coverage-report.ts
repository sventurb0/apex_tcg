import { compileCardImplementation, implementationResolver } from "../implementations/effect-compiler";
import type { PokemonCardMetadata } from "../types";
import type { CoverageEffectKind, CoverageReport, CoverageSignature, CoverageSignatureIndex, FavouriteCoverageRow } from "./types";

function signatureCounts(signatures: readonly CoverageSignature[]) {
  return {
    total: signatures.length,
    complete: signatures.filter((signature) => signature.support === "complete").length,
    partial: signatures.filter((signature) => signature.support === "partial").length,
    unsupported: signatures.filter((signature) => signature.support === "unsupported").length,
  };
}

export function buildCoverageReport(cards: readonly PokemonCardMetadata[], index: CoverageSignatureIndex, favourites: readonly FavouriteCoverageRow[]): CoverageReport {
  const implementations = cards.map(compileCardImplementation);
  const effects = [...index.trainerEffects, ...index.energyEffects];
  const completeFrom = (source: string) => implementations.filter((implementation) => implementation.status === "complete" && implementation.implementationSource === source).length;
  return {
    generatedAt: new Date().toISOString(),
    totalExactPrintings: cards.length,
    explicitCompletePrintings: completeFrom("explicit"),
    functionalInheritedCompletePrintings: completeFrom("functional-reprint"),
    reviewedTemplateCompletePrintings: completeFrom("reviewed-template"),
    safelyGeneratedPrintings: implementations.filter((implementation) => implementation.status === "generated").length,
    totalSimulationReadyPrintings: implementations.filter((implementation) => ["complete", "generated"].includes(implementation.status)).length,
    partialPrintings: implementations.filter((implementation) => implementation.status === "partial").length,
    unsupportedPrintings: implementations.filter((implementation) => implementation.status === "unsupported").length,
    behaviourFamilies: implementationResolver()?.families().length ?? 0,
    signatures: {
      ability: signatureCounts(index.abilities),
      attack: signatureCounts(index.attacks),
      trainer: signatureCounts(index.trainerEffects),
      energy: signatureCounts(index.energyEffects),
    } satisfies Record<CoverageEffectKind, ReturnType<typeof signatureCounts>>,
    favouritePokemonWithSimulationReadyVariant: favourites.filter((row) => row.bestSimulationReadyCardId).length,
    favouritePokemonFullyUnsupported: favourites.filter((row) => row.exactPrintings > 0 && row.completePrintings + row.safelyGeneratedPrintings === 0).length,
    commonExecutableTrainerFamilies: effects.filter((signature) => signature.kind === "trainer" && signature.support === "complete").length,
  };
}
