import { capabilitySatisfiesRequirement } from "./capability-graph";
import { engineById } from "./definitions";
import type { EngineCapability, EngineRequirement, SynergyChain, SynergyStep } from "./types";

function provider(engineId: string, cardId: string, kind: EngineCapability["kind"]): EngineCapability { const found = engineById(engineId)?.providers.find((item) => item.cardId === cardId && item.kind === kind); if (!found) throw new Error(`Missing reviewed provider ${engineId}/${cardId}/${kind}.`); return found; }
function consumer(engineId: string, cardId: string, kind: EngineRequirement["kind"]): EngineRequirement { const found = engineById(engineId)?.consumers.find((item) => item.cardId === cardId && item.kind === kind); if (!found) throw new Error(`Missing reviewed consumer ${engineId}/${cardId}/${kind}.`); return found; }
function step(capability: EngineCapability, requirement: EngineRequirement, explanation: string): SynergyStep { if (!capabilitySatisfiesRequirement(capability, requirement)) throw new Error(`Reviewed chain mismatch: ${capability.cardId} does not satisfy ${requirement.cardId}.`); return { providerCardId: capability.cardId, consumerCardId: requirement.cardId, capability, requirement, explanation }; }
function chain(id: string, score: number, steps: SynergyStep[], sourceDeckIds: string[], constraints: string[]): SynergyChain { return { id, cardIds: [...new Set(steps.flatMap((item) => [item.providerCardId, item.consumerCardId]))], score, steps, constraints, sourceDeckIds, confidence: "reviewed" }; }

const baseReviewedSynergyChains: readonly SynergyChain[] = [
  chain("poison-switch-okidogi-mochi",100,[step(provider("darkness-poison","sv6pt5-39","poison"),consumer("darkness-poison","sv6pt5-36","poisoned-attacker"),"Pecharunt ex makes the switched-in Okidogi ex Poisoned, enabling Chain-Crazed's bonus."),step(provider("darkness-poison","sv6pt5-39","poison"),consumer("darkness-poison","sv8pt5-95","poisoned-attacker"),"The same exact Poison condition enables Binding Mochi's attached-attacker modifier.")],["okidogi-ex-poison"],["Pecharunt ex cannot switch another Pecharunt ex.","Binding Mochi must be attached to the Poisoned attacker."]),
  chain("grass-search-attach-scale",96,[step(provider("grass-ogerpon-hydrapple","sv6-143","search"),consumer("grass-ogerpon-hydrapple","sv7-14","evolution-line"),"Bug Catching Set can find the Grass evolution pieces for Hydrapple's line."),step(provider("grass-ogerpon-hydrapple","sv6-25","energy-from-hand"),consumer("grass-ogerpon-hydrapple","sv7-14","energy"),"Teal Dance adds Grass Energy to the shared board total used by Syrup Storm."),step(provider("grass-ogerpon-hydrapple","sv7-14","energy-from-hand"),consumer("grass-ogerpon-hydrapple","sv7-14","energy"),"Ripening Charge also grows the all-board Grass Energy total while healing its target.")],["limitless-28266","limitless-28269"],["Both attachment abilities require Basic Grass Energy in hand.","Hydrapple remains a Stage 2 setup."]),
  chain("academy-slowking-topdeck",95,[step(provider("psychic-slowking-topdeck","sv6pt5-54","top-deck-control"),consumer("psychic-slowking-topdeck","sv7-58","top-deck-order"),"Academy at Night places a selected non-Rule-Box Pokémon from hand on top for Seek Inspiration.")],["limitless-28251","limitless-28265"],["The selected top card must be a Pokémon without a Rule Box.","Seek Inspiration discards the top card before copying its attack."]),
  chain("area-zero-clefairy-bench",91,[step(provider("area-zero-toolbox","sv7-131","bench-expansion"),consumer("psychic-clefairy-bench","sv9-56","bench-space"),"A Tera-enabled Area Zero permits the fuller Bench that increases Full Moon Rondo damage."),step(provider("area-zero-toolbox","sv7-133","energy-from-deck"),consumer("psychic-clefairy-bench","sv9-56","energy"),"Crispin can attach one of two different Basic Energy types while putting the other in hand.")],["limitless-28262","limitless-28692"],["A Tera Pokémon must stay in play for the expanded Bench.","Crispin must select two different Basic Energy types."]),
  chain("joltik-wellspring-toolbox",88,[step(provider("lightning-joltik-box","sv7-50","energy-from-deck"),consumer("lightning-joltik-box","sv8-57","energy"),"Jolting Charge supplies the Lightning requirement for the source list's Pikachu ex attacker."),step(provider("area-zero-toolbox","sv7-133","energy-from-deck"),consumer("area-zero-toolbox","sv6-64","energy"),"Crispin can provide the required Basic Water attachment for Wellspring Mask Ogerpon ex.")],["limitless-28692"],["Jolting Charge cannot itself attach Water Energy.","Jolting Charge consumes the attack for the turn."]),
  chain("team-rocket-energy-mewtwo",90,[step(provider("team-rocket-psychic","sv10-182","energy-from-hand"),consumer("team-rocket-psychic","sv10-81","energy"),"Team Rocket's Energy provides the printed Psychic option to the qualifying Team Rocket's Mewtwo ex.")],["limitless-28254","limitless-28351"],["Power Saver still requires four Team Rocket's Pokémon in play.","Off-trait support does not count toward that board threshold."]),
];

function documentedChain(id: string, cards: string[], explanation: string, sourceDeckIds: string[] = []): SynergyChain {
  return { id, cardIds: cards, score: 80, steps: [], constraints: [explanation], sourceDeckIds, confidence: "reviewed" };
}

const additionalReviewedSynergyChains: readonly SynergyChain[] = [
  documentedChain("okidogi-binding-mochi", ["sv6pt5-36","sv8pt5-95"], "Binding Mochi is only live when Okidogi ex is Poisoned; the package requires a separate Poison provider."),
  documentedChain("okidogi-munkidori", ["sv6pt5-36","sv6-95"], "Munkidori moves damage counters from the Poisoned attacker while Darkness Energy is attached."),
  documentedChain("brute-bonnet-ancient-booster", ["sv6pt5-37","sv5-140"], "Brute Bonnet's Poison plan requires its Tool/Ancient Booster condition before damage modifiers are counted."),
  documentedChain("skeledirge-armarouge", ["sv2-37","sv4-26"], "Armarouge moves Fire Energy from the Bench to the Active Skeledirge attacker."),
  documentedChain("skeledirge-magma-basin", ["sv2-37","sv4-26","swsh9-144"], "Magma Basin establishes discard acceleration, while the Stage 2 line spends Bench and evolution slots."),
  documentedChain("hydrapple-teal-mask", ["sv7-14","sv6-25"], "Both abilities grow the Grass Energy total used by Syrup Storm and need Grass Energy in hand."),
  documentedChain("dragapult-drakloak", ["sv6-130","sv6-129"], "Drakloak's setup is a prerequisite for Dragapult's Fire/Psychic spread attack."),
  documentedChain("dragapult-dusknoir", ["sv6-130","sv6-131"], "Dusknoir consumes damage-counter pressure created by Phantom Dive and adds a prize-trade decision."),
  documentedChain("slowking-academy", ["sv7-58","sv6pt5-54"], "Academy at Night prepares a legal top-deck Pokémon for Slowking's copied attack."),
  documentedChain("alakazam-hand-growth", ["me1-56","me1-119"], "Hand-growth Supporters directly increase Powerful Hand damage but compete with search and evolution timing."),
  documentedChain("zoroark-n-attack-donors", ["sv9-98","sv9-97"], "Night Joker copies attacks only from qualifying Benched N's Pokémon; donors are not decorative inclusions."),
  documentedChain("team-rocket-factory-supporters", ["sv10-173","sv10-178"], "Factory and Transceiver require a real Team Rocket Supporter density and trait-qualified board."),
  documentedChain("metang-metal-attackers", ["me4-61","me4-60"], "Metang acceleration must feed the chosen Metal attacker without exceeding Bench or discard capacity."),
  documentedChain("joltik-dual-energy", ["sv7-50","sv8-57"], "Jolting Charge distributes Grass and Lightning Energy, then the deck must preserve a second attacker."),
  documentedChain("festival-lead-attacker", ["sv6-25","sv6-143"], "Festival Lead packages reserve Stadium and Bench resources for the double-attack sequence."),
  documentedChain("dudunsparce-cycle", ["sv9-120","sv9-121"], "Dudunsparce cycles its body and attached cards; the deck needs a resilient Basic setup density."),
  documentedChain("munkidori-damage-engine", ["sv6-95","sv6pt5-36"], "Munkidori's counter movement is strongest when the main attacker intentionally carries damage or Poison."),
  documentedChain("clefairy-multitype-energy", ["sv9-56","sv7-133"], "Full Moon Rondo benefits from a populated Bench while Crispin supplies two distinct Basic Energy types."),
  documentedChain("area-zero-tera-toolbox", ["sv7-131","sv7-133"], "Area Zero's expanded Bench is conditional on a Tera Pokémon and competes with other Stadium engines."),
  documentedChain("corviknight-metal-defence", ["sv1-135","me4-61"], "Corviknight consumes a support slot to protect a Metal attacker; the package rejects uncontrolled Bench growth."),
];

export const reviewedSynergyChains: readonly SynergyChain[] = [...baseReviewedSynergyChains, ...additionalReviewedSynergyChains];
