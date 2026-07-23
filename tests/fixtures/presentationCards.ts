import type { PokemonCardMetadata } from "../../src/data/pokemon";

const base = { setId: "tst", setName: "Presentation Test", setCode: "TST", retreat: 0, releaseDate: "2026/07/22", legalities: { standard: "Legal", expanded: "Legal" } } as const;

export const firePresentationCard: PokemonCardMetadata = {
  ...base, id: "tst-1", name: "Ember Scholar", collectorNumber: "1", supertype: "Pokémon", subtypes: ["Stage 1"], stage: "Stage 1", evolvesFrom: "Cinder Student", hp: 130, types: ["Fire"],
  abilities: [{ name: "Archive Flame", type: "Ability", text: "Once during your turn, you may draw a card." }, { name: "Warm Insight", type: "Ability", text: "This Pokémon takes 10 less damage from attacks." }],
  attacks: [{ name: "Careful Spark", cost: ["Fire", "Colorless"], energy: 2, damage: "40", text: "You may return an Energy from this Pokémon to your hand." }, { name: "Study Blaze", cost: ["Fire", "Fire", "Colorless"], energy: 3, damage: "120", text: "" }],
  weaknesses: [{ type: "Water", value: "×2" }], resistances: [{ type: "Grass", value: "-30" }], retreatCost: ["Colorless", "Colorless"], rarity: "Rare", regulationMark: "I", artist: "Test Illustrator", flavorText: "It records every spark it sees.",
};

export const fightingPresentationCard: PokemonCardMetadata = { ...base, id: "tst-2", name: "Granite Guard", collectorNumber: "2", supertype: "Pokémon", subtypes: ["Basic"], stage: "Basic", hp: 100, types: ["Fighting"], attacks: [{ name: "Guard", cost: ["Fighting"], energy: 1, damage: "20", text: "" }] };
export const waterPresentationCard: PokemonCardMetadata = { ...base, id: "tst-3", name: "Tide Reader", collectorNumber: "3", supertype: "Pokémon", subtypes: ["Basic"], stage: "Basic", hp: 90, types: ["Water"], attacks: [{ name: "Wave", cost: ["Water"], energy: 1, damage: "20", text: "" }] };
export const itemPresentationCard: PokemonCardMetadata = { ...base, id: "tst-4", name: "Field Kit", collectorNumber: "4", supertype: "Trainer", subtypes: ["Item"], trainerText: "Heal 10 damage from 1 of your Pokémon.", rules: ["Heal 10 damage from 1 of your Pokémon.", "You may play any number of Item cards during your turn."], artist: "Tool Studio", rarity: "Uncommon", regulationMark: "I" };
export const supporterPresentationCard: PokemonCardMetadata = { ...base, id: "tst-5", name: "Research Partner", collectorNumber: "5", supertype: "Trainer", subtypes: ["Supporter"], rules: ["Draw 3 cards.", "You may play only 1 Supporter card during your turn."] };
export const stadiumPresentationCard: PokemonCardMetadata = { ...base, id: "tst-6", name: "Quiet Arena", collectorNumber: "6", supertype: "Trainer", subtypes: ["Stadium"], rules: ["Each player draws 1 fewer card at the start of their turn."] };
export const toolPresentationCard: PokemonCardMetadata = { ...base, id: "tst-7", name: "Technical Machine: Test", collectorNumber: "7", supertype: "Trainer", subtypes: ["Pokémon Tool", "Technical Machine"], rules: ["The Pokémon this card is attached to can use the attack on this card.", "Discard this card at the end of your turn."] };
export const basicEnergyPresentationCard: PokemonCardMetadata = { ...base, id: "tst-8", name: "Basic Fire Energy", collectorNumber: "8", supertype: "Energy", subtypes: ["Basic"], types: ["Fire"] };
export const specialEnergyPresentationCard: PokemonCardMetadata = { ...base, id: "tst-9", name: "Alliance Energy", collectorNumber: "9", supertype: "Energy", subtypes: ["Special"], energyText: "This card provides 2 Energy only while attached to an Alliance Pokémon.", rules: ["This card provides 2 Energy only while attached to an Alliance Pokémon."] };
