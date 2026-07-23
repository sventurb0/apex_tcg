import type { PokemonCardMetadata } from "../../../types";
import { exactCardEffectText } from "../text";
import type { ReviewedTemplateMatch } from "../types";

function count(value: string): number { return /^(?:a|an)$/i.test(value) ? 1 : Number(value); }
function category(value: string): string {
  return value.toLowerCase().replace(/ cards?$/, "").replace(/ /g, "-");
}

export function matchWave1Trainer(card: PokemonCardMetadata): ReviewedTemplateMatch | undefined {
  if (card.supertype !== "Trainer" || card.subtypes.some((subtype) => /tool|stadium|technical machine/i.test(subtype))) return undefined;
  const text = exactCardEffectText(card);
  let match = text.match(/^draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "trainer-draw-fixed", programId: `template:trainer:draw-fixed:${match[1]}`, strategicTags: ["draw"], complexity: "low", supportedMechanic: `Draw exactly ${match[1]} cards` };
  match = text.match(/^discard your hand and draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "trainer-discard-hand-draw", programId: `template:trainer:discard-hand-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Discard the complete hand, then draw exactly ${match[1]} cards` };
  match = text.match(/^shuffle your hand into your deck\.? then,? draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "trainer-shuffle-hand-draw", programId: `template:trainer:shuffle-hand-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Shuffle the complete hand into the deck, then draw exactly ${match[1]} cards` };
  match = text.match(/^draw cards until you have (\d+) cards? in your hand\.?$/i);
  if (match) return { templateId: "trainer-draw-to", programId: `template:trainer:draw-to:${match[1]}`, strategicTags: ["draw"], complexity: "low", supportedMechanic: `Draw until the hand contains exactly ${match[1]} cards or the deck is empty` };
  match = text.match(/^each player shuffles their hand into their deck and draws (\d+) cards?\.?$/i);
  if (match) return { templateId: "trainer-both-shuffle-draw", programId: `template:trainer:both-shuffle-draw:${match[1]}`, strategicTags: ["draw", "hand-refresh"], complexity: "low", supportedMechanic: `Both players shuffle their complete hands into their decks and draw exactly ${match[1]} cards` };
  if (/^(?:switch your active pokemon with 1 of your benched pokemon|switch 1 of your active pokemon with 1 of your benched pokemon)\.?$/i.test(text)) return { templateId: "trainer-switch-active", programId: "trainer:switch", strategicTags: ["switching"], complexity: "low", supportedMechanic: "Switch the player's Active Pokémon with one selected Benched Pokémon" };
  if (/^(?:switch 1 of your opponent's benched pokemon with their active pokemon|switch in 1 of your opponent's benched pokemon to the active spot)\.?$/i.test(text)) return { templateId: "trainer-gust-opponent", programId: "trainer:boss-orders", strategicTags: ["gust"], complexity: "low", supportedMechanic: "Switch one selected opposing Benched Pokémon into the Active Spot" };
  if (/^move a basic energy card attached to 1 of your pokemon to another of your pokemon\.?$/i.test(text)) return { templateId: "trainer-move-basic-energy", programId: "trainer:energy-switch", strategicTags: ["energy-acceleration"], complexity: "low", supportedMechanic: "Move one Basic Energy between two different own Pokémon" };
  match = text.match(/^put (up to )?(\d+) basic energy cards? from your discard pile into your hand\.?$/i);
  if (match) return { templateId: "trainer-recover-basic-energy", programId: `template:trainer:recover-discard-to-hand:basic-energy:${match[2]}`, strategicTags: ["discard-recovery", "energy-search"], complexity: "low", supportedMechanic: `Recover up to ${match[2]} Basic Energy from the discard pile` };
  match = text.match(/^heal (\d+) damage from 1 of your pokemon\.?$/i);
  if (match) return { templateId: "trainer-heal-selected", programId: `template:trainer:heal-selected:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from one selected own Pokémon` };
  match = text.match(/^heal (\d+) damage from each of your pokemon\.?$/i);
  if (match) return { templateId: "trainer-heal-each-own", programId: `template:trainer:heal-each-own:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from each own Pokémon` };
  match = text.match(/^heal (\d+) damage and remove all special conditions from 1 of your pokemon\.?$/i)
    ?? text.match(/^heal (\d+) damage from 1 of your pokemon, and it recovers from all special conditions\.?$/i);
  if (match) return { templateId: "trainer-heal-selected-clear-conditions", programId: `template:trainer:heal-selected-clear:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage and remove all Special Conditions from one selected own Pokémon` };
  match = text.match(/^heal (\d+) damage from your active pokemon\.?$/i);
  if (match) return { templateId: "trainer-heal-active", programId: `template:trainer:heal-active:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from the player's Active Pokémon` };
  if (/^remove all special conditions from (?:your|each of your) active pokemon\.?$/i.test(text)) return { templateId: "trainer-clear-active-conditions", programId: "template:trainer:clear-active-conditions:0", strategicTags: ["healing"], complexity: "low", supportedMechanic: "Remove every Special Condition from the player's Active Pokémon" };
  match = text.match(/^search your deck for (?:up to )?(a|an|1|\d+) (basic pokemon|evolution pokemon|pokemon|trainer cards?|item cards?|supporter cards?|stadium cards?|basic energy cards?), (?:reveal|show) (?:it|them) to your opponent,? and put (?:it|them) into your hand\. (?:then,? shuffle your deck|shuffle your deck (?:afterward|afterwards))\.?$/i)
    ?? text.match(/^search your deck for (?:up to )?(a|an|1|\d+) (basic pokemon|evolution pokemon|pokemon|trainer cards?|item cards?|supporter cards?|stadium cards?|basic energy cards?), (?:reveal|show) (?:it|them),? and put (?:it|them) into your hand\. (?:then,? shuffle your deck|shuffle your deck (?:afterward|afterwards))\.?$/i);
  if (match) { const maximum = count(match[1]!); const selectedCategory = category(match[2]!); return { templateId: "trainer-search-deck-to-hand", programId: `template:trainer:search-deck-to-hand:${selectedCategory}:${maximum}`, strategicTags: [selectedCategory.includes("energy") ? "energy-search" : selectedCategory.includes("trainer") || ["item", "supporter", "stadium"].includes(selectedCategory) ? "trainer-search" : "pokemon-search"], complexity: "low", supportedMechanic: `Search for up to ${maximum} ${match[2]} and put the selected cards into hand` }; }
  match = text.match(/^search your deck for up to (\d+) basic pokemon and put them onto your bench\. (?:then,? shuffle your deck|shuffle your deck (?:afterward|afterwards))\.?$/i)
    ?? text.match(/^search your deck for (?:a|1) basic pokemon and put it onto your bench\. (?:then,? shuffle your deck|shuffle your deck (?:afterward|afterwards))\.?$/i);
  if (match) { const maximum = match[1] ? Number(match[1]) : 1; return { templateId: "trainer-search-basic-to-bench", programId: `template:trainer:search-basic-to-bench:${maximum}`, strategicTags: ["pokemon-search"], complexity: "low", supportedMechanic: `Search for up to ${maximum} Basic Pokémon and put them directly onto the Bench` }; }
  return undefined;
}
