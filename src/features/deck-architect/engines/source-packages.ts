import type { DeckCorpusDocument } from "../../../data/decks/corpus/types";
import type { SourceBackedPackage } from "./types";

interface PackageSpec { id: string; name: string; cardIds: string[]; match?: "all" | "any"; status: SourceBackedPackage["status"]; explanation: string; }
export const reviewedPackageSpecs: readonly PackageSpec[] = [
  { id:"dragapult-line",name:"Dreepy / Drakloak / Dragapult ex",cardIds:["sv6-128","sv6-129","sv6-130"],status:"mandatory",explanation:"Complete Stage 2 line for Phantom Dive; the line is semantic setup, not Dragon-type aggregation." },
  { id:"dusknoir-line",name:"Duskull / Dusclops / Dusknoir",cardIds:["sv8pt5-35","sv8pt5-36","sv8pt5-37"],status:"optional",explanation:"Reviewed damage-counter evolution package used by source Dragapult Dusknoir lists." },
  { id:"ogerpon-hydrapple-core",name:"Teal Mask Ogerpon ex / Hydrapple ex",cardIds:["sv6-25","sv7-14"],status:"mandatory",explanation:"Hand-based Grass attachment providers plus an all-board Grass Energy scaling attacker." },
  { id:"slowking-academy",name:"Slowpoke / Slowking / Academy at Night",cardIds:["sv7-57","sv7-58","sv6pt5-54"],status:"mandatory",explanation:"Academy orders a non-Rule-Box Pokémon for Seek Inspiration's exact top-deck requirement." },
  { id:"ns-zoroark-line",name:"N's Zorua / N's Zoroark ex",cardIds:["sv9-97","sv9-98"],status:"mandatory",explanation:"Evolution line with Trade and a Bench-dependent N's Pokémon attack-copy requirement." },
  { id:"team-rocket-trainer-core",name:"Team Rocket Trainer / Factory / Transceiver",cardIds:["sv10-173","sv10-178"],status:"mandatory",explanation:"Factory and Transceiver form the reviewed Team Rocket setup spine; Supporter choices remain deck-specific." },
  { id:"lillies-clefairy-multitype",name:"Lillie's Clefairy Multi-Type Energy",cardIds:["sv9-56","sve-5"],status:"mandatory",explanation:"Psychic requirement plus flexible supporting types; Bench population, not type matching, drives damage." },
  { id:"area-zero-toolbox",name:"Area Zero Toolbox",cardIds:["sv7-131"],status:"mandatory",explanation:"Expanded Bench package valid only with a Tera Pokémon in play." },
  { id:"munkidori-damage-move",name:"Munkidori Damage-Counter Package",cardIds:["sv6-95","sve-7"],status:"optional",explanation:"Adrena-Brain requires Darkness Energy attached before counters can move." },
  { id:"meowth-support",name:"Meowth ex Support",cardIds:["me3-62"],status:"optional",explanation:"Common support card tracked as corpus evidence; its exact semantics must be implemented before use." },
  { id:"fezandipiti-comeback",name:"Fezandipiti ex Comeback Draw",cardIds:["me2pt5-142"],status:"optional",explanation:"Flip the Script is conditional on a prior-turn Knock Out and limited across copies." },
  { id:"buddy-poffin-setup",name:"Buddy-Buddy Poffin Low-HP Setup",cardIds:["sv5-144"],status:"optional",explanation:"Exact low-HP Basic search package." },
  { id:"rare-candy-stage-two",name:"Rare Candy Stage 2",cardIds:["me1-125"],status:"optional",explanation:"Stage 2 acceleration package whose legality and target line are validated separately." },
  { id:"bug-catching-grass",name:"Bug Catching Set Grass",cardIds:["sv6-143"],status:"mandatory",explanation:"Top-seven Grass Pokémon / Basic Grass Energy selection package." },
  { id:"crispin-multitype",name:"Crispin Multi-Type Energy",cardIds:["sv7-133"],status:"mandatory",explanation:"Two different Basic Energy types are required; one enters hand and the other is attached." },
  { id:"tool-damage",name:"Tool Damage",cardIds:["sv8pt5-95"],status:"optional",explanation:"Binding Mochi modifies damage only for its Poisoned holder." },
  { id:"stadium-dependent",name:"Stadium-Dependent Engines",cardIds:["sv6pt5-54","sv7-131","me1-117"],match:"any",status:"mandatory",explanation:"Central Stadium packages are alternatives and may conflict; co-occurrence does not make them interchangeable." },
  { id:"ace-spec-by-archetype",name:"ACE SPEC by Archetype",cardIds:["me4-82","sv6-165","sv8-185","sv5-152"],match:"any",status:"optional",explanation:"Alternative one-per-deck ACE SPEC selections are tracked per source archetype, never combined by popularity." },
];

export function deriveSourcePackages(corpus: DeckCorpusDocument): SourceBackedPackage[] {
  return reviewedPackageSpecs.map((spec) => {
    const evidence = corpus.decks.filter((deck) => {
      const ids = new Set(deck.manifest?.entries.map((entry) => entry.cardId) ?? []);
      return spec.match === "any" ? spec.cardIds.some((id) => ids.has(id)) : spec.cardIds.every((id) => ids.has(id));
    });
    const counts = Object.fromEntries(spec.cardIds.map((id) => {
      const values = evidence.map((deck) => deck.manifest?.entries.find((entry) => entry.cardId === id)?.count ?? 0);
      return [id, values];
    }));
    return {
      id: spec.id, name: spec.name, cardIds: spec.cardIds, sourceDeckIds: evidence.map((deck) => deck.id), sourceDeckCount: evidence.length,
      weightedTournamentSuccess: Number(evidence.reduce((sum, deck) => sum + (deck.snapshot.placement ? 100 / Math.sqrt(deck.snapshot.placement) : 1), 0).toFixed(2)),
      averageCounts: Object.fromEntries(Object.entries(counts).map(([id, values]) => [id, values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0])),
      countRanges: Object.fromEntries(Object.entries(counts).map(([id, values]) => [id, { minimum: values.length ? Math.min(...values) : 0, maximum: values.length ? Math.max(...values) : 0 }])),
      status: spec.status, archetypes: [...new Set(evidence.map((deck) => deck.snapshot.archetype))].sort(), semanticExplanation: spec.explanation,
      // Corpus popularity is evidence, not proof.  Require repeated
      // co-occurrence or a high-placing list before labelling a package
      // reviewed; one low-confidence snapshot remains a candidate package.
      reviewed: evidence.length >= 2 || evidence.some((deck) => (deck.snapshot.placement ?? Number.POSITIVE_INFINITY) <= 8),
    } satisfies SourceBackedPackage;
  });
}
