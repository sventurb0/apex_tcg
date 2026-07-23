import type { CardType, SpecialCondition } from "../model/cards";

export type EffectPrimitive =
  | { type: "draw"; count: number }
  | { type: "search-deck"; category?: "pokemon" | "trainer" | "energy"; count: number }
  | { type: "reveal"; zone: "hand" | "deck" | "prizes"; count: number }
  | { type: "look-at-cards"; zone: "deck" | "prizes"; count: number; owner: "self" | "opponent" }
  | { type: "shuffle-deck" }
  | { type: "discard-from-hand"; count: number }
  | { type: "discard-from-deck"; count: number }
  | { type: "discard-attached-energy"; count: number }
  | { type: "attach-energy-from-hand"; energyType?: CardType }
  | { type: "attach-energy-from-discard"; energyType?: CardType }
  | { type: "accelerate-energy"; from: "deck" | "discard"; energyType?: CardType; count: number }
  | { type: "move-energy"; count: number }
  | { type: "switch-active" }
  | { type: "force-switch" }
  | { type: "heal"; amount: number }
  | { type: "add-damage-counters"; count: number }
  | { type: "deal-damage"; amount: number; target: "active" | "self" }
  | { type: "bench-damage"; amount: number; targets: number }
  | { type: "apply-special-condition"; condition: SpecialCondition }
  | { type: "remove-special-conditions" }
  | { type: "modify-attack-damage"; amount: number }
  | { type: "modify-retreat-cost"; amount: number }
  | { type: "modify-hp"; amount: number }
  | { type: "modify-prize-value"; amount: number }
  | { type: "copy-attack" }
  | { type: "disable-ability"; scope: "target" | "all-opponent" }
  | { type: "lock-items" }
  | { type: "lock-supporters" }
  | { type: "lock-retreat" }
  | { type: "prevent-damage" }
  | { type: "prevent-effects" }
  | { type: "return-to-hand"; count: number }
  | { type: "return-to-deck"; count: number }
  | { type: "recover-from-discard"; count: number }
  | { type: "evolve"; source: "hand" | "deck" }
  | { type: "devolve"; levels: number }
  | { type: "put-into-play"; source: "hand" | "deck" | "discard"; count: number }
  | { type: "coin-flip"; heads: EffectPrimitive[]; tails?: EffectPrimitive[] }
  | { type: "conditional"; conditionId: string; then: EffectPrimitive[]; otherwise?: EffectPrimitive[] }
  | { type: "once-per-turn"; markerId: string; effects: EffectPrimitive[] }
  | { type: "once-per-game"; markerId: string; effects: EffectPrimitive[] }
  | { type: "lasting-effect"; duration: "end-of-turn" | "opponents-next-turn" | "while-source-in-play"; effects: EffectPrimitive[] }
  | { type: "choose-target"; targetKind: string }
  | { type: "choose-cards"; zone: "hand" | "deck" | "discard"; count: number };

export type CustomEffectHandlerId = string;
