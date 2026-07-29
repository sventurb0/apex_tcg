import type { GameRunSummary } from "../../../engine/simulation/game-runner";
import type { CatalogueIndex } from "../../data/pokemon";
import type { AnchorContribution, AnchorIntendedRole, ArchitectCandidate, SelectedCardRole } from "./types";

const DEFINING_EVENT_TYPES = new Set([
  "ability-used", "stadium-ability-used", "attack-used", "damage-dealt", "damage-healed",
  "damage-counters-moved", "damage-allocation", "special-condition-applied", "enhanced-poison-applied",
  "poison-checkup-damage", "energy-attached-by-effect", "energy-moved", "damage-modifier-applied",
  "temporary-effect-applied", "prize-modified",
]);

function intendedRole(candidate: ArchitectCandidate, cardId: string, index: CatalogueIndex): AnchorIntendedRole {
  const selected = candidate.selectedRoles?.[cardId] as SelectedCardRole | undefined;
  if (selected === "primary-attacker" || selected === "secondary-attacker" || selected === "engine-core" || selected === "support" || selected === "control-piece") return selected;
  if (selected === "tech") return "control-piece";
  const card = index.byId.get(cardId);
  const abilityText = card?.abilities?.map((ability) => ability.text).join(" ") ?? "";
  const maximumDamage = Math.max(0, ...(card?.attacks?.map((attack) => Number.parseInt(attack.damage || "0", 10) || 0) ?? []));
  if (card?.abilities?.length && maximumDamage < 100) return /switch|retreat|prevent|confus|poison|discard/i.test(abilityText) ? "control-piece" : "engine-core";
  return "primary-attacker";
}

export function measureAnchorContribution(candidate: ArchitectCandidate, cardId: string, games: readonly GameRunSummary[], index: CatalogueIndex): AnchorContribution {
  const role = intendedRole(candidate, cardId, index);
  let enteredPlayGames = 0, evolvedGames = 0, abilityActivations = 0, attackUses = 0, attackUseGames = 0, knockOuts = 0, definingEventCount = 0, contributingGames = 0, abilityOrDefiningEventGames = 0;
  const readyTurns: number[] = [];
  for (const game of games) {
    const events = game.playerOneEvents.filter((event) => event.sourceCardId === cardId);
    const entered = game.playerOneSetupCardIds.includes(cardId) || events.some((event) => event.type === "pokemon-benched" || event.type === "pokemon-evolved");
    const evolved = events.some((event) => event.type === "pokemon-evolved");
    const abilities = events.filter((event) => event.type === "ability-used").length;
    const attacks = events.filter((event) => event.type === "attack-used").length;
    const kos = events.filter((event) => event.type === "pokemon-knocked-out").length;
    const defining = events.filter((event) => DEFINING_EVENT_TYPES.has(event.type)).length;
    if (entered) enteredPlayGames += 1;
    if (evolved) evolvedGames += 1;
    if (abilities) abilityActivations += abilities;
    if (attacks) { attackUses += attacks; attackUseGames += 1; }
    knockOuts += kos;
    definingEventCount += defining;
    if (defining) { contributingGames += 1; readyTurns.push(Math.min(...events.filter((event) => DEFINING_EVENT_TYPES.has(event.type)).map((event) => event.turn))); }
    if (abilities || defining) abilityOrDefiningEventGames += 1;
  }
  const rate = (count: number) => games.length ? count / games.length * 100 : 0;
  const card = index.byId.get(cardId);
  const isStageTwo = card?.subtypes.includes("Stage 2") ?? false;
  const failureReasons: string[] = [];
  if (role === "primary-attacker" || role === "secondary-attacker") {
    if (rate(enteredPlayGames) < (isStageTwo ? 30 : 50)) failureReasons.push(`entered play in ${rate(enteredPlayGames).toFixed(1)}% of games`);
    const minimumAttackRate = isStageTwo && rate(evolvedGames) >= 25 ? 20 : 30;
    if (rate(attackUseGames) < minimumAttackRate) failureReasons.push(`used an attack in ${rate(attackUseGames).toFixed(1)}% of games`);
  } else {
    if (rate(enteredPlayGames) < 40) failureReasons.push(`entered play in ${rate(enteredPlayGames).toFixed(1)}% of games`);
    if (rate(abilityOrDefiningEventGames) < 25) failureReasons.push(`produced a defining event in ${rate(abilityOrDefiningEventGames).toFixed(1)}% of games`);
  }
  if (!definingEventCount) failureReasons.push("produced zero defining events");
  return {
    cardId, intendedRole: role, enteredPlayGames, enteredPlayRate: rate(enteredPlayGames), evolvedGames, evolvedRate: rate(evolvedGames),
    abilityActivations, attackUses, attackUseGames, knockOuts, definingEventCount, contributingGames,
    contributionRate: rate(contributingGames), firstReadyTurn: readyTurns.length ? readyTurns.reduce((sum, turn) => sum + turn, 0) / readyTurns.length : null,
    abilityOrDefiningEventGames, passesRoleGate: failureReasons.length === 0, failureReasons,
  };
}
