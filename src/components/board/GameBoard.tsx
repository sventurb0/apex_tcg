import { useMemo, useState } from "react";
import type { GameAction, PlayerId } from "../../../engine/model/actions";
import type { CardInstance } from "../../../engine/model/cards";
import type { AllocationChoice, EffectChoice, GameState, PlayerState } from "../../../engine/model/game-state";
import { currentCatalogueIndex, type CatalogueIndex, type PokemonCardMetadata } from "../../data/pokemon";
import { CardDetailsDialog } from "../cards/CardDetailsDialog";
import { actionCategoryLabels, actionCategoryOrder, groupLegalActions } from "./action-presentation";
import { groupHandCards } from "./battle-card-presentation";
import { ActiveBattleCard, BenchBattleCard, EmptyBattleCard, HandBattleCard, type GameCardDisplay } from "./BattleCard";

const DISPLAY_KEY = "tcg-decklab-game-card-display";

function ZoneSummary({ player, opponent = false }: { player: PlayerState; opponent?: boolean }) {
  return <div className="zone-summary" aria-label={`${opponent ? "Opponent" : "Player"} zone counts`}>
    <span>Hand <b>{player.hand.length}</b></span><span>Deck <b>{player.deck.length}</b></span><span>Discard <b>{player.discard.length}</b></span><span>Prizes <b>{player.prizes.length}</b></span>
  </div>;
}

function PlayerField({ state, index, playerId, hidden, onOpen, display }: { state: GameState; index: CatalogueIndex; playerId: PlayerId; hidden?: boolean; onOpen: (card: PokemonCardMetadata) => void; display: GameCardDisplay }) {
  const player = state.players[playerId];
  return <section className={`player-field ${hidden ? "opponent" : "player"}`}>
    <ZoneSummary player={player} opponent={hidden} />
    <div className="field-row">
      <div className="active-slot"><h4>Active</h4>{player.active ? <ActiveBattleCard state={state} index={index} pokemon={player.active} onOpen={onOpen} display={display} /> : <EmptyBattleCard />}</div>
      <div className="bench"><h4>Bench ({player.bench.length}/5)</h4><div className="card-row bench-row">{player.bench.map((pokemon) => <BenchBattleCard state={state} index={index} pokemon={pokemon} onOpen={onOpen} display={display} key={pokemon.stack.at(-1)!.instanceId} />)}</div></div>
    </div>
    {!hidden && <div className="hand-zone"><h4>Your hand · {player.hand.length}</h4><div className="card-row hand">{groupHandCards(player.hand).map((group) => <HandBattleCard index={index} group={group} onOpen={onOpen} display={display} key={group.cardId} />)}</div></div>}
    {hidden && <div className="hidden-hand" aria-label={`${player.hand.length} hidden cards`}>{Array.from({ length: Math.min(10, player.hand.length) }, (_, position) => <span key={position} />)}</div>}
    {player.discard.length > 0 && <details className="discard-inspector"><summary>{hidden ? "Opponent" : "Your"} discard · {player.discard.length}</summary><div className="card-row discard-row">{groupHandCards(player.discard).map((group) => <HandBattleCard index={index} group={group} onOpen={onOpen} display={display} key={group.cardId} />)}</div></details>}
  </section>;
}

function findInstance(state: GameState, instanceId: string): CardInstance | undefined {
  for (const playerId of ["player-one", "player-two"] as const) {
    const player = state.players[playerId];
    for (const zone of [player.hand, player.deck, player.discard, player.prizes]) {
      const instance = zone.find((candidate) => candidate.instanceId === instanceId);
      if (instance) return instance;
    }
    for (const pokemon of [player.active, ...player.bench]) {
      if (!pokemon) continue;
      const instance = [...pokemon.stack, ...pokemon.attachedEnergy, ...(pokemon.tool ? [pokemon.tool] : [])].find((candidate) => candidate.instanceId === instanceId);
      if (instance) return instance;
    }
  }
  return state.stadium?.instanceId === instanceId ? state.stadium : undefined;
}

function PendingCardChoices({ state, index, choice, actions, onAction }: { state: GameState; index: CatalogueIndex; choice: EffectChoice; actions: GameAction[]; onAction: (action: GameAction) => void }) {
  const groups = useMemo(() => {
    const byCard = new Map<string, string[]>();
    for (const instanceId of choice.eligibleIds) {
      const cardId = findInstance(state, instanceId)?.cardId ?? instanceId;
      byCard.set(cardId, [...(byCard.get(cardId) ?? []), instanceId]);
    }
    return [...byCard].map(([cardId, instanceIds]) => ({ cardId, instanceIds }));
  }, [choice.eligibleIds, state]);
  return <div className="pending-quantity-choices" aria-label="Card choices">
    {groups.map(({ cardId, instanceIds }) => {
      const selected = instanceIds.filter((id) => choice.selectedIds.includes(id));
      const addId = instanceIds.find((id) => !choice.selectedIds.includes(id));
      const removeId = [...selected].reverse()[0];
      const add = actions.find((action) => action.type === "select-card" && action.selectionId === addId);
      const remove = actions.find((action) => action.type === "deselect-card" && action.selectionId === removeId);
      const name = index.byId.get(cardId)?.name ?? state.cardDefinitions[cardId]?.name ?? cardId;
      return <div className="pending-quantity-row" key={cardId}><span><b>{name}</b><small>×{instanceIds.length} eligible · Selected: {selected.length}</small></span><span className="pending-stepper"><button disabled={!remove} onClick={() => remove && onAction(remove)} aria-label={`Remove one ${name}`}>−</button><b>{selected.length}</b><button disabled={!add} onClick={() => add && onAction(add)} aria-label={`Select one ${name}`}>+</button></span></div>;
    })}
  </div>;
}

function PendingAllocationChoice({ state, choice, actions, onAction }: { state: GameState; choice: AllocationChoice; actions: GameAction[]; onAction: (action: GameAction) => void }) {
  const opponent = state.players[choice.playerId === "player-one" ? "player-two" : "player-one"];
  const target = (id: string) => [opponent.active, ...opponent.bench].find((pokemon) => pokemon && pokemon.stack.at(-1)?.instanceId === id);
  return <div className="pending-allocation-choices" aria-label="Damage counter allocation">
    <div className="allocation-summary"><strong>{choice.instruction}</strong><span>Remaining: {choice.remainingUnits}</span></div>
    {choice.eligibleIds.map((targetId) => {
      const pokemon = target(targetId); const assigned = choice.allocations[targetId] ?? 0; const card = pokemon ? state.cardDefinitions[pokemon.stack.at(-1)!.cardId] : undefined; const increase = actions.find((action) => action.type === "increase-allocation" && action.targetId === targetId); const decrease = actions.find((action) => action.type === "decrease-allocation" && action.targetId === targetId); return <div className="allocation-row" key={targetId}><span><b>{card?.name ?? targetId}</b><small>Current damage {pokemon?.damage ?? 0} · Assigned {assigned} · Projected {((pokemon?.damage ?? 0) + assigned * 10)} / {pokemon ? card?.category === "pokemon" ? card.hp : "?" : "?"}</small></span><span className="pending-stepper"><button disabled={!decrease} onClick={() => decrease && onAction(decrease)} aria-label={`Remove one ${card?.name ?? "target"} damage counter`}>−</button><b>{assigned}</b><button disabled={!increase} onClick={() => increase && onAction(increase)} aria-label={`Assign one ${card?.name ?? "target"} damage counter`}>+</button></span></div>;
    })}
    <div className="allocation-actions">{actions.filter((action) => action.type === "clear-allocation" || action.type === "confirm-allocation").map((action) => <button className={action.type === "confirm-allocation" ? "primary" : ""} key={action.id} onClick={() => onAction(action)}>{action.description}</button>)}</div>
  </div>;
}

export interface GameBoardProps { state: GameState; index?: CatalogueIndex; actions: GameAction[]; onAction: (action: GameAction) => void; }

export function GameBoard({ state, index = currentCatalogueIndex(), actions, onAction }: GameBoardProps) {
  const [selected, setSelected] = useState<PokemonCardMetadata>();
  const [display, setDisplay] = useState<GameCardDisplay>(() => { const saved = localStorage.getItem(DISPLAY_KEY); return saved === "images" || saved === "text" || saved === "hybrid" ? saved : "hybrid"; });
  const chooseDisplay = (value: GameCardDisplay) => { localStorage.setItem(DISPLAY_KEY, value); setDisplay(value); };
  const quantityChoice = state.pendingChoice?.type === "effect-choice" && state.pendingChoice.selectionKind === "card" ? state.pendingChoice : undefined;
  const allocationChoice = state.pendingChoice?.type === "allocation-choice" ? state.pendingChoice : undefined;
  const presented = groupLegalActions(state, quantityChoice ? actions.filter((action) => action.type !== "select-card" && action.type !== "deselect-card") : actions);
  const endTurn = presented.find((action) => action.representative.type === "end-turn");
  if (!index) return <div className="board-panel">Card catalogue metadata is unavailable.</div>;
  return <div className="game-layout" data-testid="compact-game-board">
    <div className="board-panel">
      <PlayerField state={state} index={index} playerId="player-two" hidden onOpen={setSelected} display={display} />
      <div className="turn-strip"><span>Turn <b>{state.turn}</b></span><span>Phase <b>{state.phase}</b></span><span>Acting <b>{state.pendingChoice?.playerId ?? state.activePlayerId}</b></span><span>Energy {state.players["player-one"].energyAttachedThisTurn ? "used" : "ready"}</span><span>Supporter {state.players["player-one"].supporterPlayedThisTurn ? "used" : "ready"}</span></div>
      <PlayerField state={state} index={index} playerId="player-one" onOpen={setSelected} display={display} />
    </div>
    <aside className="actions-panel">
      <div className="actions-scroll">
        <h2>Legal actions</h2><fieldset className="game-display-pref" aria-label="Card display preference">{(["images","text","hybrid"] as const).map((value) => <button className={display === value ? "selected" : ""} onClick={() => chooseDisplay(value)} key={value}>{value === "text" ? "Compact text" : value === "images" ? "Card images" : "Hybrid"}</button>)}</fieldset>
        {state.pendingChoice?.type === "effect-choice" && <div className="effect-choice-status" role="status"><strong>{state.pendingChoice.instruction}</strong><span>{state.pendingChoice.optional ? "Optional" : "Mandatory"} · select {state.pendingChoice.min}–{state.pendingChoice.max}</span><span>{state.pendingChoice.selectedIds.length} selected</span><small>Resolving {state.pendingChoice.sourceEffectId}</small></div>}
        {allocationChoice && <PendingAllocationChoice state={state} choice={allocationChoice} actions={actions} onAction={onAction} />}
        {quantityChoice && <PendingCardChoices state={state} index={index} choice={quantityChoice} actions={actions} onAction={onAction} />}
        {state.events.at(-1)?.type === "coin-flip" && <div className="coin-result">Coin flip: <b>{state.events.at(-1)?.detail}</b></div>}
        {state.result && <div className="result"><strong>{state.result.winnerId === "player-one" ? "Victory" : "Defeat"}</strong><span>{state.result.reason}</span></div>}
        {!state.result && actions.length === 0 && <p className="computer-status">Computer is deciding…</p>}
        {actionCategoryOrder.filter((category) => category !== "turn-controls").map((category) => {
          const sectionActions = presented.filter((action) => action.category === category);
          return sectionActions.length ? <section className="action-group" key={category}><h3>{actionCategoryLabels[category]}</h3>{sectionActions.map((action) => <button className={`action action-${action.representative.type}`} data-action-count={action.count} key={action.key} onClick={() => onAction(action.representative)}>{action.label}</button>)}</section> : null;
        })}
        <details className="action-log-details"><summary>Details / Log · {state.actionLog.length}</summary><ol className="action-log">{state.actionLog.slice(-50).reverse().map((entry) => <li key={entry.index}><span>T{entry.turn}</span>{entry.description}</li>)}</ol></details>
      </div>
      {endTurn && <div className="sticky-turn-control"><button className="action action-end-turn primary" onClick={() => onAction(endTurn.representative)}>{endTurn.label}</button></div>}
    </aside>
    {selected && <CardDetailsDialog card={selected} onClose={() => setSelected(undefined)} />}
  </div>;
}
