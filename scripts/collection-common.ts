import { readFileSync } from "node:fs";
import type { CardDefinition } from "../engine/model/cards";
import type { DeckManifest } from "../src/data/decks/types";
import { importPortfolioCsv } from "../src/features/collection/import-portfolio";
import { buildOwnedCoverage, ownedCoverageSummary } from "../src/features/collection/collection-coverage";
import type { OwnedCollectionDocument } from "../src/features/collection/types";
import { createCatalogueIndex, toRuntimeCardDefinition, type PokemonCardCatalogue } from "../src/data/pokemon";

export const SOURCE_CSV = "src/data/collection/owned_collection_normalized_2026-07-27.csv";
export function loadCatalogue(): PokemonCardCatalogue { return JSON.parse(readFileSync("public/data/pokemon-cards.json", "utf8")) as PokemonCardCatalogue; }
export function loadCollection(): OwnedCollectionDocument { return JSON.parse(readFileSync("public/data/owned-collection.json", "utf8")) as OwnedCollectionDocument; }
export function importCurrentCollection(): OwnedCollectionDocument { return importPortfolioCsv(readFileSync(SOURCE_CSV, "utf8"), loadCatalogue()); }

export function runtimeCards(document: OwnedCollectionDocument, extraCardIds: readonly string[] = []): CardDefinition[] {
  const index = createCatalogueIndex(loadCatalogue().cards);
  const ids = [...new Set([...document.entries.map((entry) => entry.canonicalBehaviourCardId), ...extraCardIds, "sve-1", "sve-2", "sve-3", "sve-4", "sve-5", "sve-6", "sve-7", "sve-8"] )];
  return ids.map((id) => index.byId.get(id)).map((card) => card ? toRuntimeCardDefinition(card) : null).filter((card): card is CardDefinition => Boolean(card));
}
export function coverage(document: OwnedCollectionDocument) { return buildOwnedCoverage(document); }
export function coverageSummary(document: OwnedCollectionDocument) { return ownedCoverageSummary(coverage(document)); }

export type OwnedRouteRole = "primary-attacker" | "secondary-attacker" | "evolution-line" | "engine-core" | "basic-setup" | "evolution-search" | "draw" | "hand-refresh" | "energy-search" | "energy-recovery" | "switching" | "gust" | "pokemon-recovery" | "stadium-access" | "tool-access" | "control-disruption" | "energy";
export interface OwnedRouteRoleEdge { role: OwnedRouteRole; explanation: string; }
export interface OwnedRouteMissingCard { cardId: string; name: string; quantity: number; role: OwnedRouteRole; }
export interface OwnedDeckRoute {
  targetId: string;
  targetName: string;
  fullLibrary: DeckManifest;
  ownedOnly: DeckManifest;
  ownedOnlyBuildable: boolean;
  shopping: DeckManifest;
  missing: OwnedRouteMissingCard[];
  roleEdges: Record<string, OwnedRouteRoleEdge>;
  substitutions: Array<{ replacedCardId: string; ownedCardId: string; quantity: number; role: OwnedRouteRole }>;
}

interface SpecEntry { cardId: string; count: number; role: OwnedRouteRole; explanation: string; }
interface OwnedTargetSpec { id: string; name: string; entries: SpecEntry[]; plan: string[]; }
const e = (cardId: string, count: number, role: OwnedRouteRole, explanation: string): SpecEntry => ({ cardId, count, role, explanation });

const TRAINER = {
  ultra: e("me1-131", 4, "basic-setup", "Ultra Ball finds the exact Pokémon or evolution piece the target engine is missing."),
  buddy: e("sv5-144", 4, "basic-setup", "Buddy-Buddy Poffin establishes the low-HP Basic evolution bench."),
  research: e("sv9-155", 4, "draw", "Professor's Research supplies the deck's high-volume draw reset."),
  lillie: e("me1-119", 4, "hand-refresh", "Lillie's Determination rebuilds an unproductive setup hand."),
  switch3: e("me1-130", 3, "switching", "Switch preserves the intended attacker and frees trapped setup Pokémon."),
  switch4a: e("me1-130", 3, "switching", "Switch preserves the intended attacker and frees trapped setup Pokémon."),
  switch4b: e("swsh1-183", 1, "switching", "A functional Switch reprint supplies the fourth legal copy by card name."),
  nest: e("sv1-181", 4, "basic-setup", "Nest Ball establishes the target engine's Basic Pokémon."),
  retrieval2: e("swsh12pt5-127", 2, "energy-recovery", "Energy Retrieval restores discarded Basic Energy for another attack cycle."),
  retrieval3: e("swsh12pt5-127", 3, "energy-recovery", "Energy Retrieval restores discarded Basic Energy for another attack cycle."),
  night: e("sv6pt5-61", 2, "pokemon-recovery", "Night Stretcher recovers a discarded attacker or evolution component."),
  candy3: e("xy5-135", 3, "evolution-search", "Rare Candy reduces the Stage 2 engine's setup burden."),
  candy4: e("xy5-135", 4, "evolution-search", "Rare Candy reduces the Stage 2 engine's setup burden."),
  superRod: e("sv2-188", 1, "pokemon-recovery", "Super Rod returns exhausted Pokémon and Energy resources to the deck."),
  prime: e("sv8pt5-119", 1, "gust", "Prime Catcher creates one decisive gust-and-switch turn without competing ACE SPEC cards."),
  earthen2: e("sv4-163", 2, "energy-search", "Earthen Vessel fixes the bounded Basic Energy plan."),
  academy1: e("sv6pt5-54", 1, "stadium-access", "Academy at Night protects a required setup card on top of the deck."),
  colress2: e("sv6pt5-57", 2, "energy-search", "Colress's Tenacity finds the Stadium and Energy pieces used by the engine."),
  colress3: e("sv6pt5-57", 3, "energy-search", "Colress's Tenacity finds the Stadium and Energy pieces used by the engine."),
  janine: e("sv6pt5-59", 4, "energy-search", "Janine's Secret Art accelerates the Darkness Poison attacker."),
  mochi: e("sv6pt5-55", 4, "tool-access", "Binding Mochi converts the declared Poison state into additional attack damage."),
  jungle: e("sv5-156", 2, "stadium-access", "Perilous Jungle increases Poison pressure for the declared Poison route."),
  magma: e("swsh9-144", 4, "stadium-access", "Magma Basin accelerates Fire Energy to the Fire evolution engine."),
  rescue2: e("sv5-159", 2, "tool-access", "Rescue Board reduces retreat friction on setup Pokémon."),
  transceiver: e("me2pt5-209", 4, "basic-setup", "Team Rocket's Transceiver searches the named Team Rocket engine."),
  rocketBall: e("sv10-175", 3, "basic-setup", "Team Rocket's Great Ball searches the Team Rocket Pokémon package."),
  botherBot: e("sv10-172", 3, "control-disruption", "Team Rocket's Bother-Bot advances the route's control plan."),
  proton: e("sv10-177", 3, "draw", "Team Rocket's Proton supplies engine-specific draw and setup."),
  factory2: e("me2pt5-203", 2, "stadium-access", "Team Rocket's Factory is the dedicated Team Rocket Stadium engine."),
  factory3: e("me2pt5-203", 3, "stadium-access", "Team Rocket's Factory is the dedicated Team Rocket Stadium engine."),
  sacredAsh: e("sv10-168", 1, "pokemon-recovery", "Sacred Ash recycles the control deck's Team Rocket Pokémon."),
} as const;

const energy = (cardId: string, count: number, type: string) => e(cardId, count, "energy", `${type} Energy pays the defining attacks of this route.`);
const pokemon = (cardId: string, count: number, role: OwnedRouteRole, explanation: string) => e(cardId, count, role, explanation);

const TARGETS: OwnedTargetSpec[] = [
  { id: "owned-alakazam", name: "Owned Alakazam Hand Engine", plan: ["Open Abra", "Use search and Rare Candy/Kadabra to establish Alakazam", "Use Alakazam as the defining hand-based attacker"], entries: [
    pokemon("me1-54",4,"evolution-line","Abra is the required Basic for the selected Alakazam line."), pokemon("me1-55",4,"evolution-line","Kadabra is the legal Stage 1 path into Alakazam."), pokemon("me1-56",4,"primary-attacker","Alakazam is the selected anchor and defining attacker."),
    TRAINER.ultra,TRAINER.buddy,TRAINER.research,TRAINER.lillie,TRAINER.switch4a,TRAINER.switch4b,TRAINER.nest,TRAINER.retrieval3,TRAINER.night,TRAINER.candy4,TRAINER.superRod,TRAINER.prime,TRAINER.academy1,energy("sve-5",12,"Psychic"),
  ]},
  { id: "owned-okidogi-poison", name: "Owned Okidogi Poison", plan: ["Open Okidogi ex or Pecharunt ex", "Use Janine and the Poison package to turn on Chain-Crazed", "Recycle Darkness Energy and maintain Poison pressure"], entries: [
    pokemon("sv6pt5-36",3,"primary-attacker","Okidogi ex is the Poison-enabled primary attacker."), pokemon("sv6pt5-39",1,"engine-core","Pecharunt ex supplies the Poison engine and pivot utility."), pokemon("sv6pt5-37",1,"secondary-attacker","Munkidori ex is a Darkness-compatible secondary attacker."), pokemon("sv6-95",2,"engine-core","Munkidori converts damage counters into pressure that complements Poison."), pokemon("me2pt5-143",3,"engine-core","Pecharunt provides additional Darkness Poison setup bodies."),
    TRAINER.ultra,TRAINER.nest,TRAINER.research,TRAINER.janine,TRAINER.switch4a,TRAINER.switch4b,TRAINER.earthen2,TRAINER.retrieval3,TRAINER.night,TRAINER.mochi,TRAINER.jungle,TRAINER.prime,TRAINER.superRod,TRAINER.colress3,energy("sve-7",12,"Darkness"),
  ]},
  { id: "owned-team-rocket-nidoking", name: "Owned Team Rocket Nidoking/Nidoqueen", plan: ["Bench both Nidoran lines", "Use Team Rocket search plus Rare Candy to establish the Stage 2 pair", "Attack with Nidoking while Nidoqueen supplies the paired engine"], entries: [
    pokemon("sv10-117",4,"evolution-line","Team Rocket's Nidoran♂ begins the Nidoking line."), pokemon("sv10-118",3,"evolution-line","Team Rocket's Nidorino is the legal Stage 1 path."), pokemon("sv10-119",3,"primary-attacker","Team Rocket's Nidoking ex is the selected primary attacker."), pokemon("sv10-114",4,"evolution-line","Team Rocket's Nidoran♀ begins the Nidoqueen support line."), pokemon("sv10-115",2,"evolution-line","Team Rocket's Nidorina is the legal Stage 1 path."), pokemon("sv10-116",3,"engine-core","Team Rocket's Nidoqueen is the paired engine core."),
    TRAINER.transceiver,TRAINER.rocketBall,TRAINER.proton,TRAINER.research,TRAINER.ultra,TRAINER.switch3,TRAINER.candy4,TRAINER.factory2,TRAINER.night,energy("sve-7",12,"Darkness"),
  ]},
  { id: "owned-team-rocket-muk", name: "Owned Team Rocket Muk Control", plan: ["Establish Team Rocket's Grimer and Koffing", "Evolve into Muk and Weezing", "Use Bother-Bot and the Rocket package to sustain disruption"], entries: [
    pokemon("sv10-123",4,"evolution-line","Team Rocket's Grimer is the required Basic for Muk."), pokemon("sv10-124",4,"primary-attacker","Team Rocket's Muk is the selected control attacker."), pokemon("sv10-112",3,"evolution-line","Team Rocket's Ekans begins the Arbok disruption line."), pokemon("sv10-113",2,"control-disruption","Team Rocket's Arbok provides a complementary control attacker."), pokemon("sv10-125",2,"evolution-line","Team Rocket's Koffing begins the Weezing line."), pokemon("sv10-126",2,"control-disruption","Team Rocket's Weezing broadens the control package."),
    TRAINER.transceiver,TRAINER.rocketBall,TRAINER.botherBot,TRAINER.proton,TRAINER.research,TRAINER.ultra,TRAINER.switch3,TRAINER.factory3,TRAINER.night,TRAINER.prime,TRAINER.sacredAsh,energy("sve-7",12,"Darkness"),
  ]},
  { id: "owned-skeledirge-armarouge", name: "Owned Skeledirge Armarouge", plan: ["Open Fuecoco and Charcadet", "Use Rare Candy or Crocalor to establish Skeledirge ex", "Use Armarouge and Magma Basin to keep Fire Energy moving"], entries: [
    pokemon("sv2-35",4,"evolution-line","Fuecoco begins the Skeledirge line."), pokemon("sv1-37",3,"evolution-line","Crocalor is the legal Stage 1 path."), pokemon("sv2-37",2,"primary-attacker","Skeledirge ex is the selected Fire attacker."), pokemon("svp-34",1,"primary-attacker","A functional Skeledirge ex printing supplies the third anchor copy."), pokemon("sv4-26",2,"evolution-line","Charcadet begins the Armarouge support line."), pokemon("sv1-41",2,"engine-core","Armarouge moves Fire Energy into the active attacker."),
    TRAINER.ultra,TRAINER.buddy,TRAINER.research,TRAINER.lillie,TRAINER.switch3,TRAINER.nest,TRAINER.candy3,TRAINER.magma,TRAINER.earthen2,TRAINER.night,energy("sve-2",12,"Fire"),
  ]},
  { id: "owned-arcanine", name: "Owned Arcanine", plan: ["Open Growlithe or Charcadet", "Use Armarouge and Magma Basin to stage Fire Energy", "Attack with Arcanine while retaining the Hisuian colourless option"], entries: [
    pokemon("swsh12-19",1,"evolution-line","Growlithe is a legal Basic for Arcanine."), pokemon("sv1-30",1,"evolution-line","A second owned Growlithe printing improves Basic setup."), pokemon("sv10-28",2,"primary-attacker","Arcanine is the selected Fire attacker."), pokemon("swsh10-70",1,"evolution-line","Hisuian Growlithe begins the alternate Arcanine line."), pokemon("sv6-100",1,"secondary-attacker","Hisuian Arcanine provides a lower-Energy compatible attacker."), pokemon("sv4-26",2,"evolution-line","Charcadet begins the Fire acceleration line."), pokemon("sv1-41",2,"engine-core","Armarouge moves Magma Basin Energy to Arcanine."),
    TRAINER.ultra,TRAINER.buddy,TRAINER.research,TRAINER.lillie,TRAINER.switch4a,TRAINER.switch4b,TRAINER.nest,TRAINER.magma,TRAINER.earthen2,TRAINER.retrieval3,TRAINER.night,TRAINER.prime,TRAINER.rescue2,energy("sve-2",10,"Fire"),energy("sve-6",2,"Fighting"),
  ]},
  { id: "owned-swalot-poison", name: "Owned Swalot Poison", plan: ["Open Gulpin or Okidogi ex", "Evolve Swalot and enable the shared Poison package", "Use Binding Mochi and Perilous Jungle to amplify the Poison attackers"], entries: [
    pokemon("sv7-91",4,"evolution-line","Gulpin is the required Basic for Swalot."), pokemon("sv7-92",4,"primary-attacker","Swalot is the selected Poison attacker."), pokemon("sv6pt5-36",3,"secondary-attacker","Okidogi ex shares the Darkness Poison and Energy plan."), pokemon("sv6pt5-39",1,"engine-core","Pecharunt ex enables the compatible Poison pivot engine."),
    TRAINER.ultra,TRAINER.nest,TRAINER.research,TRAINER.janine,TRAINER.switch4a,TRAINER.switch4b,TRAINER.mochi,TRAINER.jungle,TRAINER.earthen2,TRAINER.retrieval3,TRAINER.night,TRAINER.prime,TRAINER.colress2,energy("sve-7",12,"Darkness"),
  ]},
  { id: "owned-team-rocket-crobat-spidops", name: "Owned Team Rocket Crobat/Spidops", plan: ["Establish Zubat and Tarountula", "Use Rocket search and Rare Candy to reach Crobat ex", "Use Spidops as the Grass control partner while Crobat applies Darkness pressure"], entries: [
    pokemon("sv10-120",4,"evolution-line","Team Rocket's Zubat begins the Crobat line."), pokemon("sv10-121",3,"evolution-line","Team Rocket's Golbat is the legal Stage 1 path."), pokemon("sv10-122",2,"primary-attacker","Team Rocket's Crobat ex is the selected anchor attacker."), pokemon("sv10-19",4,"evolution-line","Team Rocket's Tarountula begins the Spidops line."), pokemon("me2pt5-19",2,"control-disruption","Team Rocket's Spidops supplies the Grass control partner."), pokemon("sv10-20",2,"control-disruption","A second owned Spidops printing completes the four-copy functional pool."), pokemon("sv10-125",2,"evolution-line","Team Rocket's Koffing supplies a legal setup body for Weezing."), pokemon("sv10-126",2,"engine-core","Team Rocket's Weezing adds Darkness control support."),
    TRAINER.transceiver,TRAINER.rocketBall,TRAINER.proton,TRAINER.research,TRAINER.ultra,TRAINER.switch3,TRAINER.candy3,TRAINER.factory2,TRAINER.prime,energy("sve-7",8,"Darkness"),energy("sve-1",4,"Grass"),
  ]},
];

function ownedQuantities(document: OwnedCollectionDocument): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const entry of document.entries) quantities.set(entry.canonicalBehaviourCardId, (quantities.get(entry.canonicalBehaviourCardId) ?? 0) + entry.quantity);
  return quantities;
}

function manifest(spec: OwnedTargetSpec, suffix = ""): DeckManifest {
  return { id: `${spec.id}${suffix}`, name: `${spec.name}${suffix === "-reference" ? " — Full-library reference" : suffix === "-shopping" ? " — Owned plus shopping" : ""}`, description: spec.plan.join(" "), format: "expanded", source: "saved", entries: spec.entries.map(({ cardId, count }) => ({ cardId, count })), architect: { seed: 2800 + TARGETS.indexOf(spec), selectedCardIds: spec.entries.filter((entry) => entry.role === "primary-attacker" || entry.role === "engine-core").map((entry) => entry.cardId), mode: "simulation-ready", candidateScore: 100, explanation: spec.plan } };
}

export function buildOwnedRoutes(document: OwnedCollectionDocument): OwnedDeckRoute[] {
  const quantities = ownedQuantities(document);
  const index = createCatalogueIndex(loadCatalogue().cards);
  return TARGETS.map((target) => {
    const ownedOnly = manifest(target);
    const roleEdges = Object.fromEntries(target.entries.map((entry) => [entry.cardId, { role: entry.role, explanation: entry.explanation }]));
    const missing = target.entries.flatMap((entry) => /^sve-\d+$/.test(entry.cardId) ? [] : Math.max(0, entry.count - (quantities.get(entry.cardId) ?? 0)) > 0 ? [{ cardId: entry.cardId, name: index.byId.get(entry.cardId)?.name ?? entry.cardId, quantity: Math.max(0, entry.count - (quantities.get(entry.cardId) ?? 0)), role: entry.role }] : []);
    return { targetId: target.id, targetName: target.name, fullLibrary: manifest(target, "-reference"), ownedOnly, ownedOnlyBuildable: missing.length === 0, shopping: manifest(target, "-shopping"), missing, roleEdges, substitutions: [] };
  });
}

/** Compatibility view for legacy collection reports: these are now complete owned-only candidates, never fallback skeletons. */
export function buildOwnedDecks(document: OwnedCollectionDocument): DeckManifest[] { return buildOwnedRoutes(document).map((route) => route.ownedOnly); }
