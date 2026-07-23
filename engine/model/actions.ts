export type PlayerId = "player-one" | "player-two";

interface ActionBase { id: string; playerId: PlayerId; description: string; }

export type GameAction =
  | (ActionBase & { type: "select-active"; cardInstanceId: string })
  | (ActionBase & { type: "bench-basic"; cardInstanceId: string })
  | (ActionBase & { type: "finish-setup" })
  | (ActionBase & { type: "draw-mulligan" })
  | (ActionBase & { type: "attach-energy"; cardInstanceId: string; targetId: string })
  | (ActionBase & { type: "evolve"; cardInstanceId: string; targetId: string })
  | (ActionBase & { type: "play-trainer"; cardInstanceId: string; targetId?: string })
  | (ActionBase & { type: "use-stadium"; targetId: string; cardInstanceId: string })
  | (ActionBase & { type: "attack"; attackId: string; targetId?: string })
  | (ActionBase & { type: "retreat"; targetId: string })
  | (ActionBase & { type: "choose-prize"; cardInstanceId: string })
  | (ActionBase & { type: "select-card"; selectionId: string })
  | (ActionBase & { type: "deselect-card"; selectionId: string })
  | (ActionBase & { type: "select-pokemon"; selectionId: string })
  | (ActionBase & { type: "confirm-choice" })
  | (ActionBase & { type: "decline-optional-effect" })
  | (ActionBase & { type: "select-effect-mode"; mode: string })
  | (ActionBase & { type: "increase-allocation"; targetId: string; amount?: number })
  | (ActionBase & { type: "decrease-allocation"; targetId: string; amount?: number })
  | (ActionBase & { type: "set-allocation"; targetId: string; amount: number })
  | (ActionBase & { type: "clear-allocation" })
  | (ActionBase & { type: "confirm-allocation" })
  | (ActionBase & { type: "use-ability"; sourcePokemonId: string; abilityId: string; targetId?: string; cardInstanceId?: string })
  | (ActionBase & { type: "end-turn" });
