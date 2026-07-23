import type { PrintedAbility } from "../../../types";
import { normalizeTemplateText } from "../text";
import type { ReviewedTemplateMatch } from "../types";

function amount(value: string): number { return /^a$/i.test(value) ? 1 : Number(value); }
function category(value: string): string { return value.toLowerCase().replace(/ cards?$/, "").replace(/ /g, "-"); }
const conditionMap: Record<string, string> = { poisoned: "poisoned", burned: "burned", confused: "confused", asleep: "asleep", paralyzed: "paralyzed" };

export function matchWave1Ability(ability: PrintedAbility): ReviewedTemplateMatch | undefined {
  const text = normalizeTemplateText(ability.text);
  let match = text.match(/^once during your turn(?: \(before your attack\))?,? you may draw (a|\d+) cards?\.?$/i);
  if (match) { const count = amount(match[1]!); return { templateId: "ability-once-draw-fixed", programId: `template:ability:draw-fixed:${count}`, strategicTags: ["draw"], complexity: "low", supportedMechanic: `Once-per-turn draw exactly ${count} cards` }; }
  match = text.match(/^once during your turn(?: \(before your attack\))?,? you may draw cards until you have (\d+) cards? in your hand\.?$/i);
  if (match) return { templateId: "ability-once-draw-to", programId: `template:ability:draw-to:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Once-per-turn draw until the hand contains ${match[1]} cards` };
  match = text.match(/^once during your turn,? if this pokemon is (?:in the active spot|your active pokemon),? you may draw (a|\d+) cards?\.?$/i);
  if (match) { const count = amount(match[1]!); return { templateId: "ability-active-draw-fixed", programId: `template:ability:active-draw-fixed:${count}`, strategicTags: ["draw"], complexity: "low", supportedMechanic: `While Active, draw exactly ${count} cards once per turn`, sourceActiveOnly: true }; }
  match = text.match(/^once during your turn,? you may discard your hand and draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "ability-discard-hand-draw", programId: `template:ability:discard-hand-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Discard the complete hand, then draw exactly ${match[1]} cards` };
  match = text.match(/^once during your turn(?: \(before your attack\))?,? you may discard (?:a|1) card from your hand\. if you do,? draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "ability-discard-one-draw", programId: `template:ability:discard-one-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Discard exactly one card from hand, then draw exactly ${match[1]} cards` };
  match = text.match(/^you must discard (?:a|1) card from your hand in order to use this ability\. once during your turn,? you may draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "ability-discard-one-draw", programId: `template:ability:discard-one-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Discard exactly one card from hand, then draw exactly ${match[1]} cards` };
  match = text.match(/^once during your turn(?: \(before your attack\))?,? you may heal (\d+) damage from this pokemon\.?$/i);
  if (match) return { templateId: "ability-heal-self", programId: `template:ability:heal-self:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from this Pokémon` };
  match = text.match(/^once during your turn(?: \(before your attack\))?,? you may heal (\d+) damage from (?:each|all) of your pokemon\.?$/i);
  if (match) return { templateId: "ability-heal-each-own", programId: `template:ability:heal-each-own:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from each own Pokémon` };
  match = text.match(/^once during your turn,? you may heal (\d+) damage from your active pokemon\.?$/i);
  if (match) return { templateId: "ability-heal-active", programId: `template:ability:heal-active:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from the player's Active Pokémon` };
  match = text.match(/^once during your turn,? if this pokemon is in the active spot,? you may heal (\d+) damage from 1 of your pokemon\.?$/i);
  if (match) return { templateId: "ability-active-heal-selected", programId: `template:ability:active-heal-selected:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `While Active, heal exactly ${match[1]} damage from one selected own Pokémon`, sourceActiveOnly: true };
  if (/^once during your turn(?: \(before your attack\))?,? you may (?:use this ability\. )?switch your active pokemon with 1 of your benched pokemon\.?$/i.test(text)) return { templateId: "ability-switch-active", programId: "template:ability:switch-active:0", strategicTags: ["switching"], complexity: "low", supportedMechanic: "Switch the player's Active Pokémon with one selected Benched Pokémon" };
  if (/^once during your turn(?: \(before your attack\))?,? if this pokemon is on your bench,? you may switch (?:this pokemon|it) with your active pokemon\.?$/i.test(text)) return { templateId: "ability-switch-self-active", programId: "template:ability:switch-self-active:0", strategicTags: ["switching"], complexity: "low", supportedMechanic: "Switch this exact Benched Pokémon with the player's Active Pokémon", sourceBenchedOnly: true };
  match = text.match(/^once during your turn(?: \(before your attack\))?,? you may put (\d+) damage counters? on 1 of your opponent's pokemon\.?$/i);
  if (match) return { templateId: "ability-place-opponent-damage-counters", programId: `template:ability:place-opponent-counters:${match[1]}`, strategicTags: ["damage-counter-movement"], complexity: "low", supportedMechanic: `Place exactly ${match[1]} damage counters on one selected opposing Pokémon` };
  match = text.match(/^once during your turn,? if this pokemon is in the active spot,? you may make your opponent's active pokemon (poisoned|burned|confused|asleep|paralyzed)\.?$/i);
  if (match) { const condition = conditionMap[match[1]!.toLowerCase()]!; return { templateId: "ability-active-apply-condition", programId: `template:ability:active-condition:${condition}`, strategicTags: ["special-condition", ...(condition === "poisoned" ? ["poison" as const] : [])], complexity: "low", supportedMechanic: `While Active, apply ${condition} to the opposing Active Pokémon`, sourceActiveOnly: true }; }
  match = text.match(/^once during your turn,? you may search your deck for (?:up to )?(a|an|1|\d+) (basic pokemon|evolution pokemon|pokemon|trainer cards?|item cards?|supporter cards?|stadium cards?|basic energy cards?), (?:reveal|show) (?:it|them)(?: to your opponent)?,? and put (?:it|them) into your hand\. then,? shuffle your deck\.?$/i);
  if (match) { const maximum = /^a|an$/i.test(match[1]!) ? 1 : Number(match[1]); const selectedCategory = category(match[2]!); return { templateId: "ability-search-deck-to-hand", programId: `template:ability:search-deck-to-hand:${selectedCategory}:${maximum}`, strategicTags: [selectedCategory.includes("energy") ? "energy-search" : selectedCategory.includes("trainer") || ["item", "supporter", "stadium"].includes(selectedCategory) ? "trainer-search" : "pokemon-search"], complexity: "low", supportedMechanic: `Search for up to ${maximum} ${match[2]} and put the selected cards into hand` }; }
  match = text.match(/^once during your turn,? you may search your deck for up to (\d+) basic pokemon and put them onto your bench\. then,? shuffle your deck\.?$/i);
  if (match) return { templateId: "ability-search-basic-to-bench", programId: `template:ability:search-basic-to-bench:${match[1]}`, strategicTags: ["pokemon-search", "setup"], complexity: "low", supportedMechanic: `Search for up to ${match[1]} Basic Pokémon and put them onto the Bench` };
  return undefined;
}
