import type { GameAction } from "../../../engine/model/actions";
import type { CardInstance } from "../../../engine/model/cards";
import type { GameState } from "../../../engine/model/game-state";

export type ActionCategory = "setup" | "play-pokemon" | "attach-energy" | "evolve" | "trainers" | "abilities" | "stadium" | "combat" | "choice" | "turn-controls";

export interface PresentedAction {
  key: string;
  label: string;
  count: number;
  representative: GameAction;
  actions: GameAction[];
  category: ActionCategory;
}

export const actionCategoryLabels: Readonly<Record<ActionCategory, string>> = {
  setup: "Setup",
  "play-pokemon": "Play Pokémon",
  "attach-energy": "Attach Energy",
  evolve: "Evolve",
  trainers: "Trainers",
  abilities: "Abilities",
  stadium: "Stadium",
  combat: "Retreat and attacks",
  choice: "Choose",
  "turn-controls": "Turn controls",
};

export const actionCategoryOrder: readonly ActionCategory[] = [
  "setup", "play-pokemon", "attach-energy", "evolve", "trainers", "abilities", "stadium", "combat", "choice", "turn-controls",
];

function actionCategory(state: GameState, action: GameAction): ActionCategory {
  switch (action.type) {
    case "select-active":
    case "finish-setup":
    case "draw-mulligan": return "setup";
    case "bench-basic": return "play-pokemon";
    case "attach-energy": return "attach-energy";
    case "evolve": return "evolve";
    case "play-trainer": {
      const cardId = definitionId(state, action);
      const card = cardId ? state.cardDefinitions[cardId] : undefined;
      return card?.category === "trainer" && card.subtype === "stadium" ? "stadium" : "trainers";
    }
    case "use-ability": return "abilities";
    case "use-stadium": return "stadium";
    case "retreat":
    case "attack": return "combat";
    case "select-card":
    case "deselect-card":
    case "select-pokemon":
    case "select-effect-mode":
    case "increase-allocation":
    case "decrease-allocation":
    case "set-allocation":
    case "clear-allocation":
    case "confirm-allocation":
    case "confirm-choice":
    case "decline-optional-effect":
    case "choose-prize": return "choice";
    case "end-turn": return "turn-controls";
  }
}

function cardInstanceId(action: GameAction): string | undefined {
  switch (action.type) {
    case "select-active":
    case "bench-basic":
    case "attach-energy":
    case "evolve":
    case "play-trainer":
    case "use-stadium":
    case "choose-prize": return action.cardInstanceId;
    default: return undefined;
  }
}

function allInstances(state: GameState): CardInstance[] {
  const instances: CardInstance[] = [];
  for (const playerId of ["player-one", "player-two"] as const) {
    const player = state.players[playerId];
    instances.push(...player.hand, ...player.deck, ...player.discard, ...player.prizes);
    for (const pokemon of [player.active, ...player.bench]) {
      if (!pokemon) continue;
      instances.push(...pokemon.stack, ...pokemon.attachedEnergy);
      if (pokemon.tool) instances.push(pokemon.tool);
    }
  }
  if (state.stadium) instances.push(state.stadium);
  return instances;
}

function definitionId(state: GameState, action: GameAction): string | undefined {
  const instanceId = cardInstanceId(action);
  return instanceId ? allInstances(state).find((instance) => instance.instanceId === instanceId)?.cardId : undefined;
}

function semanticKey(state: GameState, action: GameAction): string {
  const cardId = definitionId(state, action);
  switch (action.type) {
    case "select-active": return `${action.type}|${cardId ?? action.cardInstanceId}`;
    case "bench-basic": return `${action.type}|${cardId ?? action.cardInstanceId}`;
    case "attach-energy": return `${action.type}|${cardId ?? action.cardInstanceId}|target:${action.targetId}`;
    case "evolve": return `${action.type}|${cardId ?? action.cardInstanceId}|target:${action.targetId}`;
    case "play-trainer": return `${action.type}|${cardId ?? action.cardInstanceId}|target:${action.targetId ?? ""}`;
    default: return `${action.type}|atomic:${action.id}`;
  }
}

function mayGroup(action: GameAction): boolean {
  return action.type === "select-active" || action.type === "bench-basic" || action.type === "attach-energy" || action.type === "evolve" || action.type === "play-trainer";
}

/** Presentation-only grouping. AI, reducers, history, and replay continue to receive atomic actions. */
export function groupLegalActions(state: GameState, actions: GameAction[]): PresentedAction[] {
  const zoneOrder = new Map(allInstances(state).map((instance, position) => [instance.instanceId, position]));
  const groups = new Map<string, PresentedAction>();
  for (const action of actions) {
    const category = actionCategory(state, action);
    const key = mayGroup(action) ? semanticKey(state, action) : `${action.type}|atomic:${action.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.actions.push(action);
      existing.count += 1;
      existing.label = `${existing.representative.description} ×${existing.count}`;
      continue;
    }
    groups.set(key, { key, label: action.description, count: 1, representative: action, actions: [action], category });
  }
  return [...groups.values()].map((group) => {
    group.actions.sort((left, right) => (zoneOrder.get(cardInstanceId(left) ?? "") ?? Number.MAX_SAFE_INTEGER) - (zoneOrder.get(cardInstanceId(right) ?? "") ?? Number.MAX_SAFE_INTEGER));
    group.representative = group.actions[0]!;
    group.label = group.count > 1 ? `${group.representative.description} ×${group.count}` : group.representative.description;
    return group;
  });
}
