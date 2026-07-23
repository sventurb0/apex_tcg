import type { AttackDamage, CardDefinition } from "../../engine/model/cards";

const fixed = (amount: number): AttackDamage => ({ kind: "fixed", amount, printed: String(amount) });

// Isolated fictional fixtures. Production code must never import this module.
export const fixtureCardList: CardDefinition[] = [
  { id: "demo-001", name: "Cinder Cub", category: "pokemon", pokemonType: "fire", stage: "basic", hp: 70, abilities: [], attacks: [{ id: "warm-pounce", name: "Warm Pounce", cost: { fire: 1 }, damage: fixed(20) }], weakness: { type: "water", multiplier: 2 }, retreatCost: 1, implementationStatus: "complete" },
  { id: "demo-002", name: "Cinder Lynx", category: "pokemon", pokemonType: "fire", stage: "stage1", evolvesFrom: "Cinder Cub", hp: 120, abilities: [], attacks: [{ id: "flare-rush", name: "Flare Rush", cost: { fire: 2 }, damage: fixed(60) }], weakness: { type: "water", multiplier: 2 }, retreatCost: 2, implementationStatus: "complete" },
  { id: "demo-003", name: "Ashwing", category: "pokemon", pokemonType: "fire", stage: "basic", hp: 60, abilities: [], attacks: [{ id: "glide", name: "Glide", cost: { colorless: 1 }, damage: fixed(10) }], weakness: { type: "water", multiplier: 2 }, resistance: { type: "fighting", amount: 20 }, retreatCost: 0, implementationStatus: "complete" },
  { id: "demo-011", name: "Brook Pup", category: "pokemon", pokemonType: "water", stage: "basic", hp: 80, abilities: [], attacks: [{ id: "ripple-bite", name: "Ripple Bite", cost: { water: 1 }, damage: fixed(20) }], weakness: { type: "lightning", multiplier: 2 }, resistance: { type: "fire", amount: 20 }, retreatCost: 1, implementationStatus: "complete" },
  { id: "demo-012", name: "Torrent Hound", category: "pokemon", pokemonType: "water", stage: "stage1", evolvesFrom: "Brook Pup", hp: 130, abilities: [], attacks: [{ id: "surging-bite", name: "Surging Bite", cost: { water: 2 }, damage: fixed(60) }], weakness: { type: "lightning", multiplier: 2 }, resistance: { type: "fire", amount: 20 }, retreatCost: 2, implementationStatus: "complete" },
  { id: "demo-013", name: "Static Finch", category: "pokemon", pokemonType: "lightning", stage: "basic", hp: 60, abilities: [], attacks: [{ id: "small-spark", name: "Small Spark", cost: { lightning: 1 }, damage: fixed(20) }], weakness: { type: "fighting", multiplier: 2 }, retreatCost: 0, implementationStatus: "complete" },
  { id: "demo-e-fire", name: "Basic Fire Energy", category: "energy", energyType: "fire", basic: true, implementationStatus: "complete" },
  { id: "demo-e-water", name: "Basic Water Energy", category: "energy", energyType: "water", basic: true, implementationStatus: "complete" },
  { id: "demo-e-lightning", name: "Basic Lightning Energy", category: "energy", energyType: "lightning", basic: true, implementationStatus: "complete" },
  { id: "demo-t-001", name: "Field Notes", category: "trainer", subtype: "supporter", text: "Draw 2 cards.", effectProgramId: "draw-two", implementationStatus: "complete" },
  { id: "demo-t-002", name: "Quick Route", category: "trainer", subtype: "item", text: "Switch.", effectProgramId: "trainer:switch", implementationStatus: "complete" },
  { id: "demo-t-003", name: "Care Kit", category: "trainer", subtype: "item", text: "Heal 20.", effectProgramId: "heal-30-selected-pokemon", implementationStatus: "complete" },
  { id: "demo-t-004", name: "Training Ground", category: "trainer", subtype: "stadium", text: "Test Stadium.", effectProgramId: "training-ground", implementationStatus: "partial" },
  { id: "demo-t-005", name: "Light Boots", category: "trainer", subtype: "tool", text: "Retreat reduction.", effectProgramId: "light-boots", implementationStatus: "complete" },
  { id: "demo-t-006", name: "Supply Map", category: "trainer", subtype: "item", text: "Search Basic.", effectProgramId: "search-basic", implementationStatus: "complete" },
];
