import type { AbilityDefinition, AttackDamage, AttackDefinition, CardDefinition, CardTrait, CardType, PokemonStage, TrainerSubtype } from "../../../engine/model/cards";
import { compileCardImplementation } from "./implementations/effect-compiler";
import { matchWave1Ability } from "./implementations/templates/abilities/wave-1";
import { matchWave1Attack } from "./implementations/templates/attacks/wave-1";
import type { CardImplementation, PokemonCardMetadata, PokemonType } from "./types";
import { OWNED_RUNTIME_FALLBACK_IDS } from "../../features/collection/owned-runtime-fallbacks";

const typeMap: Record<PokemonType, CardType> = { Grass: "grass", Fire: "fire", Water: "water", Lightning: "lightning", Psychic: "psychic", Fighting: "fighting", Darkness: "darkness", Metal: "metal", Dragon: "dragon", Colorless: "colorless", Fairy: "fairy" };

const attackPrograms: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "pokemon:armarouge": { "Flame Cannon": "attack:flame-cannon" },
  "pokemon:charcadet": { "Fiery Fighting Spirit": "attack:fiery-fighting-spirit" },
  "pokemon:fuecoco": { "Spacing Out": "attack:spacing-out" },
  "pokemon:radiant-tsareena": { "Aroma Shot": "attack:aroma-shot" },
  "pokemon:skeledirge-ex": { "Vitality Song": "attack:vitality-song", "Burning Voice": "attack:burning-voice" },
  "pokemon:smeargle": { "Colorful Palette": "attack:colorful-palette" },
  "pokemon:okidogi-ex": { "Poisonous Musculature": "attack:poisonous-musculature", "Chain-Crazed": "attack:chain-crazed" },
  "pokemon:munkidori": { "Mind Bend": "attack:mind-bend" },
  "pokemon:munkidori-ex": { "Dirty Headbutt": "attack:dirty-headbutt" },
  "pokemon:fezandipiti-ex": { "Cruel Arrow": "attack:cruel-arrow" },
  "pokemon:pecharunt": { "Poison Chain": "attack:poison-chain" },
  "pokemon:budew": { "Itchy Pollen": "attack:itchy-pollen" },
  "pokemon:team-rocket-nidoking-ex": { "Tainted Horn": "attack:tainted-horn" },
  "pokemon:team-rocket-spidops": { "Rocket Rush": "attack:rocket-rush" },
  "pokemon:team-rocket-mewtwo-ex": { "Erasure Ball": "attack:erasure-ball" },
  "pokemon:team-rocket-articuno": { "Dark Frost": "attack:dark-frost" },
  "pokemon:team-rocket-mimikyu": { "Gemstone Mimicry": "attack:gemstone-mimicry" },
  "pokemon:lillies-clefairy-ex": { "Full Moon Rondo": "attack:full-moon-rondo" },
  "pokemon:drakloak": { "Dragon Headbutt": "attack:dragon-headbutt" },
  "pokemon:dragapult-ex": { "Jet Headbutt": "attack:jet-headbutt", "Phantom Dive": "attack:phantom-dive" },
  "pokemon:meowth-ex": { "Tuck Tail": "attack:meowth-tuck-tail" },
  "pokemon:ns-zoroark-ex": { "Night Joker": "attack:night-joker" },
  "pokemon:ns-zekrom": { "Shred": "attack:shred", "Rampaging Thunder": "attack:ns-zekrom-rampage" },
  "pokemon:yveltal": { "Clutch": "attack:yveltal-clutch" },
  "pokemon:teal-mask-ogerpon-ex": {}, "pokemon:chikorita": { "Growl": "attack:growl" }, "pokemon:bayleef": { "Push Down": "attack:push-down" },
  "pokemon:mega-kangaskhan-ex": { "Rapid-Fire Combo": "attack:rapid-fire-combo" }, "pokemon:latias-ex": { "Eon Blade": "attack:eon-blade" }, "pokemon:chien-pao": { "Icicle Loop": "attack:icicle-loop" }, "pokemon:passimian": {}, "pokemon:raging-bolt-ex": { "Burst Roar": "attack:burst-roar", "Bellowing Thunder": "attack:bellowing-thunder" }, "pokemon:wellspring-mask-ogerpon-ex": { "Sob": "attack:sob", "Torrential Pump": "attack:torrential-pump" },
  "pokemon:meganium": {}, "pokemon:applin": {}, "pokemon:dipplin": {}, "pokemon:hydrapple-ex": {}, "pokemon:celebi": { "Traverse Time": "attack:traverse-time" },
  "pokemon:moltres": {}, "pokemon:rabsca": {}, "pokemon:dudunsparce": {}, "pokemon:dunsparce": { "Trading Places": "attack:trading-places" }, "pokemon:ns-darmanitan": { "Flamebody Cannon": "attack:flamebody-cannon" }, "pokemon:ns-reshiram": {}, "pokemon:mega-absol-ex": { "Terminal Period": "attack:terminal-period", "Claw of Darkness": "attack:claw-darkness" }, "pokemon:drapion": { "Hazardous Tail": "attack:hazardous-tail" }, "pokemon:purrloin": { "Invite Evil": "attack:invite-evil" }, "pokemon:hoothoot": {}, "pokemon:noctowl": {}, "pokemon:duskull": { "Come and Get You": "ability:come-and-get-you" }, "pokemon:dusclops": {}, "pokemon:dusknoir": { "Shadow Bind": "attack:shadow-bind" }, "pokemon:shaymin": {}, "pokemon:combusken": {}, "pokemon:chi-yu": { "Allure": "attack:allure" }, "pokemon:blaziken-ex": { "Smolder-sault": "attack:smolder-sault" }, "pokemon:koraidon-ex": { "Impact Blow": "attack:impact-blow" },
  "pokemon:alakazam": { "Powerful Hand": "attack:powerful-hand" }, "pokemon:joltik": { "Jolting Charge": "attack:jolting-charge" }, "pokemon:mega-greninja-ex": {}, "pokemon:abra": { "Teleportation Attack": "attack:teleportation-attack" },
  "pokemon:solrock": { "Cosmic Beam": "attack:cosmic-beam" },
  "pokemon:riolu": { "Accelerating Stab": "attack:eon-blade" },
  "pokemon:mega-lucario-ex": { "Aura Jab": "attack:aura-jab", "Mega Brave": "attack:eon-blade" },
  "pokemon:slowking": { "Allure": "attack:allure", "Seek Inspiration": "attack:seek-inspiration" },
  "pokemon:slowpoke": { "Dangle Tail": "template:attack:recover-discard-to-hand:pokemon:1" },
  "pokemon:seaking": { "Rapid Draw": "template:attack:draw-fixed:2" },
  "pokemon:annihilape": { "Strange Hacking": "attack:strange-hacking", "Tantrum": "attack:tantrum", "Destined Fight": "attack:destined-fight" },
  "pokemon:petilil": { "Shadow Bind": "attack:shadow-bind", "Hide": "attack:hide" },
  "pokemon:applin-festival": { "Find a Friend": "template:attack:search-deck-to-hand:pokemon:1" },
  "pokemon:greninja-ex": { "Shinobi Blade": "attack:shinobi-blade", "Mirage Barrage": "attack:mirage-barrage" },
  "pokemon:frogadier": { "Summoning Jutsu": "attack:summoning-jutsu" },
  "pokemon:metagross": { "Bounce Back": "attack:bounce-back" },
  "pokemon:dwebble": { "Ascension": "attack:ascension" },
  "pokemon:crustle": { "Superb Scissors": "attack:superb-scissors" },
  "pokemon:zeraora": { "Thunder Raid": "attack:thunder-raid" },
  "pokemon:iron-leaves-ex": { "Prism Edge": "attack:prism-edge" },
  "pokemon:bloodmoon-ursaluna-ex": { "Blood Moon": "attack:blood-moon" },
  "pokemon:rillaboom": { "Drum Beating": "attack:drum-beating", "Wood Hammer": "attack:wood-hammer" },
  "pokemon:kyurem": { "Trifrost": "attack:trifrost" },
  "pokemon:smoochum": { "Delightful Kiss": "attack:delightful-kiss" },
  "pokemon:dedenne": { "Electromagnetic Sonar": "attack:electromagnetic-sonar" },
  "pokemon:elgyem": { "Slight Shift": "attack:slight-shift" },
  "pokemon:pikachu-ex": { "Topaz Bolt": "attack:topaz-bolt" },
  "pokemon:dudunsparce-ex": { "Destructive Drill": "attack:destructive-drill" },
  "pokemon:goldeen": { "Whirlpool": "attack:whirlpool" },
  "pokemon:alakazam-control": { "Strange Hacking": "attack:strange-hacking" },
  "pokemon:genesect-ex": { "Protect Charge": "attack:protect-charge" },
};

const abilityPrograms: Readonly<Record<string, AbilityDefinition[]>> = {
  "pokemon:armarouge": [{ id: "fire-off", name: "Fire Off", text: "As often as you like during your turn, you may move a Fire Energy from 1 of your Benched Pokémon to your Active Pokémon.", category: "activated", usageLimit: "unrestricted", effectProgramId: "ability:fire-off", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "attached-energy" } }],
  "pokemon:radiant-tsareena": [{ id: "elegant-heal", name: "Elegant Heal", text: "Once during your turn, you may heal 20 damage from each of your Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:elegant-heal", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-pokemon" } }],
  "pokemon:pecharunt-ex": [{ id: "subjugating-chains", name: "Subjugating Chains", text: "Once during your turn, switch a Benched Darkness Pokémon other than Pecharunt ex with your Active Pokémon. The new Active Pokémon is Poisoned.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:subjugating-chains", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-benched-pokemon" } }],
  "pokemon:munkidori": [{ id: "adrena-brain", name: "Adrena-Brain", text: "Once during your turn, if this Pokémon has Darkness Energy attached, move up to 3 damage counters from 1 of your Pokémon to 1 of your opponent's Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:adrena-brain", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true, targetKind: "own-pokemon" } }],
  "pokemon:munkidori-ex": [{ id: "oh-no-you-dont", name: "Oh No You Don't", text: "If this Pokémon is Knocked Out by damage from an opponent's attack while you have Pecharunt ex in play, the opponent takes 1 fewer Prize card.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:oh-no-you-dont", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:fezandipiti-ex": [{ id: "flip-the-script", name: "Flip the Script", text: "Once during your turn, if one of your Pokémon was Knocked Out during your opponent's last turn, draw 3 cards.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:flip-the-script", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:pecharunt": [{ id: "toxic-subjugation", name: "Toxic Subjugation", text: "While Active, put 5 more damage counters on your opponent's Poisoned Pokémon during Pokémon Checkup.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:toxic-subjugation", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:tatsugiri": [{ id: "attract-customers", name: "Attract Customers", text: "Once during your turn while Active, look at the top 6 cards and put a Supporter you find there into your hand.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:attract-customers", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:meowth-ex": [{ id: "last-ditch-catch", name: "Last-Ditch Catch", text: "Once during your turn, when you play this Pokémon from your hand onto your Bench, you may search your deck for a Supporter.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:last-ditch-catch", targeting: { sourceMayBeActive: false, sourceMayBeBenched: true }, triggerOn: "pokemon-benched" }],
  "pokemon:mega-kangaskhan-ex": [{ id: "run-errand", name: "Run Errand", text: "Once during your turn, if this Pokémon is in the Active Spot, draw 2 cards.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:run-errand", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:latias-ex": [{ id: "skyliner", name: "Skyliner", text: "Your Basic Pokémon in play have no Retreat Cost.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:skyliner", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:chien-pao": [{ id: "snow-sink", name: "Snow Sink", text: "When you play this Pokémon from your hand onto your Bench during your turn, you may discard a Stadium in play.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:snow-sink", targeting: { sourceMayBeActive: false, sourceMayBeBenched: true }, triggerOn: "pokemon-benched" }],
  "pokemon:team-rocket-spidops": [{ id: "charging-up", name: "Charging Up", text: "Once during your turn, you may attach a Basic Energy card from your discard pile to this Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:charging-up", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:team-rocket-mewtwo-ex": [{ id: "power-saver", name: "Power Saver", text: "This Pokémon can't attack unless you have 4 or more Team Rocket's Pokémon in play.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:power-saver", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:team-rocket-articuno": [{ id: "repelling-veil", name: "Repelling Veil", text: "Prevent all effects of attacks used by your opponent's Pokémon done to your Basic Team Rocket's Pokémon. (Existing effects are not removed. Damage is not an effect.)", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:repelling-veil", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:lillies-clefairy-ex": [{ id: "fairy-zone", name: "Fairy Zone", text: "The Weakness of each of your opponent's Dragon Pokémon in play is now Psychic. (Apply Weakness as ×2.)", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:fairy-zone", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:drakloak": [{ id: "recon-directive", name: "Recon Directive", text: "Once during your turn, you may look at the top 2 cards of your deck and put 1 of them into your hand. Put the other card on the bottom of your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:recon-directive", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:ns-zoroark-ex": [{ id: "trade", name: "Trade", text: "Once during your turn, discard a card from your hand to draw 2 cards.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:ns-trade", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:teal-mask-ogerpon-ex": [{ id: "teal-dance", name: "Teal Dance", text: "Once during your turn, attach a Basic Grass Energy from your hand to this Pokémon, then draw a card.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:teal-dance", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:meganium": [{ id: "wild-growth", name: "Wild Growth", text: "Each Basic Grass Energy attached to all of your Pokémon provides GrassGrass Energy.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:wild-growth", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:hydrapple-ex": [{ id: "ripening-charge", name: "Ripening Charge", text: "Once during your turn, attach a Basic Grass Energy from your hand to 1 of your Pokémon and heal 30 from it.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:ripening-charge", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:rabsca": [{ id: "spherical-shield", name: "Spherical Shield", text: "Prevent all damage from and effects of attacks from your opponent's Pokémon done to your Benched Pokémon.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:spherical-shield", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:dudunsparce": [{ id: "run-away-draw", name: "Run Away Draw", text: "Once during your turn, you may draw 3 cards. If you drew any cards in this way, shuffle this Pokémon and all attached cards into your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:run-away-draw", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:noctowl": [{ id: "jewel-seeker", name: "Jewel Seeker", text: "Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, if you have any Tera Pokémon in play, you may search your deck for up to 2 Trainer cards, reveal them, and put them into your hand.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:jewel-seeker", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true }, triggerOn: "pokemon-evolved" }],
  "pokemon:dusclops": [{ id: "cursed-blast", name: "Cursed Blast", text: "Once during your turn, you may put 5 damage counters on 1 of your opponent's Pokémon. If you use this Ability, this Pokémon is Knocked Out.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:cursed-blast-5", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:dusknoir": [{ id: "cursed-blast", name: "Cursed Blast", text: "Once during your turn, you may put 13 damage counters on 1 of your opponent's Pokémon. If you use this Ability, this Pokémon is Knocked Out.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:cursed-blast-13", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:shaymin": [{ id: "flower-curtain", name: "Flower Curtain", text: "Prevent all damage done to your Benched Pokémon that don't have a Rule Box by attacks from your opponent's Pokémon.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:flower-curtain", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:blaziken-ex": [{ id: "seething-spirit", name: "Seething Spirit", text: "Once during your turn, you may attach a Basic Energy card from your discard pile to 1 of your Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:seething-spirit", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:dipplin": [{ id: "festival-lead", name: "Festival Lead", text: "If Festival Grounds is in play, this Pokémon may use an attack it has twice. If the first attack Knocks Out your opponent's Active Pokémon, you may attack again after your opponent chooses a new Active Pokémon.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:festival-lead", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:goldeen": [{ id: "festival-lead", name: "Festival Lead", text: "If Festival Grounds is in play, this Pokémon may use an attack it has twice. If the first attack Knocks Out your opponent's Active Pokémon, you may attack again after your opponent chooses a new Active Pokémon.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:festival-lead", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:seaking": [{ id: "festival-lead", name: "Festival Lead", text: "If Festival Grounds is in play, this Pokémon may use an attack it has twice. If the first attack Knocks Out your opponent's Active Pokémon, you may attack again after your opponent chooses a new Active Pokémon.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:festival-lead", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:lunatone": [{ id: "lunar-cycle", name: "Lunar Cycle", text: "Once during your turn, if you have Solrock in play, you may discard a Basic Fighting Energy card from your hand in order to use this Ability. Draw 3 cards. You can't use more than 1 Lunar Cycle Ability each turn.", category: "activated", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:lunar-cycle", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:kyurem": [{ id: "plasma-bane", name: "Plasma Bane", text: "If your opponent has any cards in their discard pile that have \"Colress\" in the name, this Pokémon can use the Trifrost attack for Colorless.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:plasma-bane", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:crustle": [{ id: "mysterious-rock-inn", name: "Mysterious Rock Inn", text: "Prevent all damage done to this Pokémon by attacks from your opponent's Pokémon ex.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:mysterious-rock-inn", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:kadabra": [{ id: "psychic-draw", name: "Psychic Draw", text: "Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may use this Ability. Draw 2 cards.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:psychic-draw-2", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true }, triggerOn: "pokemon-evolved" }],
  "pokemon:alakazam": [{ id: "psychic-draw", name: "Psychic Draw", text: "Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may use this Ability. Draw 3 cards.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:psychic-draw-3", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true }, triggerOn: "pokemon-evolved" }],
  "pokemon:psyduck": [{ id: "damp", name: "Damp", text: "Pokémon in play (both yours and your opponent's) lose any Ability that requires the Pokémon using it to Knock Out itself.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:damp", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:genesect": [{ id: "ace-nullifier", name: "ACE Nullifier", text: "If this Pokémon has a Pokémon Tool attached, your opponent can't play any ACE SPEC cards from their hand.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:ace-nullifier", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:thwackey": [{ id: "boom-boom-groove", name: "Boom Boom Groove", text: "Once during your turn, if your Active Pokémon has the Festival Lead Ability, you may search your deck for a card and put it into your hand. Then, shuffle your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:boom-boom-groove", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:lilligant": [{ id: "sunny-day", name: "Sunny Day", text: "Attacks used by your Grass Pokémon and Fire Pokémon do 20 more damage to your opponent's Active Pokémon (before applying Weakness and Resistance).", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:sunny-day", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:metang": [{ id: "metal-maker", name: "Metal Maker", text: "Once during your turn, you may look at the top 4 cards of your deck and attach any number of Basic Metal Energy cards you find there to your Pokémon in any way you like. Shuffle the other cards and put them on the bottom of your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:metal-maker", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:heatran": [{ id: "incandescent-body", name: "Incandescent Body", text: "If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon (even if this Pokémon is Knocked Out), the Attacking Pokémon is now Burned.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:incandescent-body", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:genesect-ex": [{ id: "metallic-signal", name: "Metallic Signal", text: "Once during your turn, you may search your deck for up to 2 Evolution Metal Pokémon, reveal them, and put them into your hand. Then, shuffle your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:metallic-signal", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:mega-greninja-ex": [{ id: "mortal-shuriken", name: "Mortal Shuriken", text: "Once during your turn, if this Pokémon is in the Active Spot, you may discard a Basic Water Energy card from your hand in order to use this Ability. Place 6 damage counters on 1 of your opponent's Pokémon.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:mortal-shuriken", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }],
  "pokemon:iron-leaves-ex": [{ id: "rapid-vernier", name: "Rapid Vernier", text: "When you play this Pokémon from your hand onto your Bench during your turn, you may switch it with your Active Pokémon. If you do, you may move any amount of Energy from your other Pokémon to this Pokémon.", category: "triggered", usageLimit: "once-per-turn-by-name", effectProgramId: "ability:rapid-vernier", targeting: { sourceMayBeActive: false, sourceMayBeBenched: true }, triggerOn: "pokemon-benched" }],
  "pokemon:bloodmoon-ursaluna-ex": [{ id: "seasoned-skill", name: "Seasoned Skill", text: "Blood Moon used by this Pokémon costs Colorless less for each Prize card your opponent has taken.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:seasoned-skill", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:galvantula": [{ id: "compound-eyes", name: "Compound Eyes", text: "Attacks used by this Pokémon do 50 more damage to your opponent's Active Pokémon that has an Ability (before applying Weakness and Resistance).", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:compound-eyes", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
  "pokemon:pikachu-ex": [{ id: "resolute-heart", name: "Resolute Heart", text: "If this Pokémon has full HP and would be Knocked Out by damage from an attack, it is not Knocked Out, and its remaining HP becomes 10.", category: "passive", usageLimit: "unrestricted", effectProgramId: "passive:resolute-heart", targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }],
};

function implementationHandler(implementation: CardImplementation): string { const handler = implementation.handlers[0]; return handler?.kind === "custom" ? handler.handlerId : handler?.kind === "declarative" ? handler.effectId : ""; }
function abilitiesFor(card: PokemonCardMetadata, handlerId: string): AbilityDefinition[] {
  // Abra has two distinct printings in the corpus: MEG Abra has a
  // Teleportation Attack, while TWM Abra has the Teleporter Ability. Keep the
  // shared handler but synthesize the Ability only for the printing that
  // actually prints it.
  if (handlerId === "pokemon:abra" && card.abilities?.some((ability) => ability.name === "Teleporter")) {
    return [{ id: `${card.id}-teleporter`, name: "Teleporter", text: "Once during your turn, if this Pokémon is in the Active Spot, you may shuffle it and all attached cards into your deck.", category: "activated", usageLimit: "once-per-turn-per-pokemon", effectProgramId: "ability:teleporter", targeting: { sourceMayBeActive: true, sourceMayBeBenched: false } }];
  }
  if (handlerId !== "template:pokemon-wave-1") return (abilityPrograms[handlerId] ?? []).map((ability) => ({ ...ability, id: `${card.id}-${ability.id}` }));
  return (card.abilities ?? []).flatMap((ability, index) => { const match = matchWave1Ability(ability); if (!match) return []; return [{ id: `${card.id}-ability-${index}`, name: ability.name, text: ability.text, category: "activated" as const, usageLimit: match.usageLimit ?? "once-per-turn-per-pokemon" as const, effectProgramId: match.programId, targeting: { sourceMayBeActive: !match.sourceBenchedOnly, sourceMayBeBenched: !match.sourceActiveOnly } }]; });
}
function traitsFor(metadata: PokemonCardMetadata, handlerId: string): CardTrait[] { const traits: CardTrait[] = []; if (/^(pokemon|trainer|stadium|energy):team-rocket/.test(handlerId)) traits.push("team-rocket"); if (metadata.subtypes.some((subtype) => /^ex$|^Pokémon ex$/i.test(subtype))) traits.push("pokemon-ex"); if (metadata.subtypes.includes("Radiant")) traits.push("radiant"); if (metadata.subtypes.some((subtype) => /^Tera$/i.test(subtype)) || metadata.rules?.some((rule) => /^Tera:/i.test(rule))) traits.push("tera"); if (metadata.subtypes.some((subtype) => /ACE SPEC/i.test(subtype)) || metadata.rules?.some((rule) => /ACE SPEC/i.test(rule))) traits.push("ace-spec"); return traits; }

function damageFor(handlerId: string, name: string, printed: string): AttackDamage | null {
  // Cruel Arrow's 100 is written in its effect text rather than the printed
  // damage column. Representing it as attack damage keeps KO cause, Active
  // modifiers, and Bench Weakness/Resistance handling in the shared pipeline.
  if (handlerId === "pokemon:fezandipiti-ex" && name === "Cruel Arrow") return { kind: "fixed", amount: 100, printed };
  if (!printed) return { kind: "none", printed };
  if (handlerId === "pokemon:solrock" && name === "Cosmic Beam") return { kind: "formula", printed, resolverId: "cosmic-beam-damage" };
  if (/^\d+$/.test(printed)) return { kind: "fixed", amount: Number(printed), printed };
  if (handlerId === "pokemon:skeledirge-ex" && name === "Burning Voice" && printed === "270-") return { kind: "formula", printed, resolverId: "burning-voice-damage" };
  if (handlerId === "pokemon:okidogi-ex" && name === "Chain-Crazed" && printed === "130+") return { kind: "formula", printed, resolverId: "chain-crazed-damage" };
  if (handlerId === "pokemon:pecharunt-ex" && name === "Irritated Outburst" && printed === "60×") return { kind: "formula", printed, resolverId: "irritated-outburst-damage" };
  if (handlerId === "pokemon:team-rocket-nidorino" && name === "Horn Rend" && printed === "60+") return { kind: "formula", printed, resolverId: "horn-rend-damage" };
  if (handlerId === "pokemon:team-rocket-spidops" && name === "Rocket Rush" && printed === "30×") return { kind: "formula", printed, resolverId: "rocket-rush-damage" };
  if (handlerId === "pokemon:team-rocket-mewtwo-ex" && name === "Erasure Ball" && printed === "160+") return { kind: "formula", printed, resolverId: "erasure-ball-damage" };
  if (handlerId === "pokemon:team-rocket-articuno" && name === "Dark Frost" && printed === "60+") return { kind: "formula", printed, resolverId: "dark-frost-damage" };
  if (handlerId === "pokemon:lillies-clefairy-ex" && name === "Full Moon Rondo" && printed === "20+") return { kind: "formula", printed, resolverId: "full-moon-rondo-damage" };
  if (handlerId === "pokemon:team-rocket-mimikyu" && name === "Gemstone Mimicry") return { kind: "none", printed };
  if (handlerId === "pokemon:teal-mask-ogerpon-ex" && name === "Myriad Leaf Shower") return { kind: "formula", printed, resolverId: "teal-leaf-shower-damage" };
  if (handlerId === "pokemon:hydrapple-ex" && name === "Syrup Storm") return { kind: "formula", printed, resolverId: "syrup-storm-damage" };
  if (handlerId === "pokemon:dipplin" && name === "Do the Wave") return { kind: "formula", printed, resolverId: "dipplin-wave-damage" };
  if (handlerId === "pokemon:applin" && name === "Tumbling Attack") return { kind: "formula", printed, resolverId: "applin-tumbling-damage" };
  if (handlerId === "pokemon:mega-kangaskhan-ex" && name === "Rapid-Fire Combo") return { kind: "formula", printed, resolverId: "rapid-fire-combo-damage" };
  if (handlerId === "pokemon:passimian" && name === "Coordinated Throwing") return { kind: "formula", printed, resolverId: "passimian-basic-damage" };
  if (handlerId === "pokemon:moltres" && name === "Fighting Wings") return { kind: "formula", printed, resolverId: "moltres-fighting-wings-damage" };
  if (handlerId === "pokemon:rabsca" && name === "Psychic") return { kind: "formula", printed, resolverId: "rabsca-psychic-damage" };
  if (handlerId === "pokemon:ns-darmanitan" && name === "Back Draft") return { kind: "formula", printed, resolverId: "darmanitan-back-draft-damage" };
  if (handlerId === "pokemon:ns-reshiram" && name === "Powerful Rage") return { kind: "formula", printed, resolverId: "reshiram-powerful-rage-damage" };
  if (handlerId === "pokemon:hoothoot" && name === "Triple Stab") return { kind: "formula", printed, resolverId: "hoothoot-triple-stab-damage" };
  if (handlerId === "pokemon:combusken" && name === "Double Kick") return { kind: "formula", printed, resolverId: "combusken-double-kick-damage" };
  if (handlerId === "pokemon:chi-yu" && name === "Ground Melter") return { kind: "formula", printed, resolverId: "chi-yu-ground-melter-damage" };
  if (handlerId === "pokemon:koraidon-ex" && name === "Orichalcum Fang") return { kind: "formula", printed, resolverId: "koraidon-orichalcum-fang-damage" };
  if (handlerId === "pokemon:riolu-quick" && name === "Quick Attack") return { kind: "formula", printed, resolverId: "quick-attack-damage" };
  if (handlerId === "pokemon:dudunsparce-ex" && name === "Tenacious Tail") return { kind: "formula", printed, resolverId: "tenacious-tail-damage" };
  if (handlerId === "pokemon:metagross" && name === "Metallic Hammer") return { kind: "formula", printed, resolverId: "metallic-hammer-damage" };
  if (handlerId === "pokemon:rocket-kangaskhan-ex" && name === "Comet Punch") return { kind: "formula", printed, resolverId: "comet-punch-damage" };
  if (handlerId === "pokemon:rocket-kangaskhan-ex" && name === "Wicked Impact") return { kind: "formula", printed, resolverId: "wicked-impact-damage" };
  if (handlerId === "pokemon:heatran" && name === "Steel Burst") return { kind: "formula", printed, resolverId: "steel-burst-damage" };
  if (handlerId === "pokemon:regigigas" && name === "Jewel Breaker") return { kind: "formula", printed, resolverId: "jewel-breaker-damage" };
  if (handlerId === "pokemon:mega-greninja-ex" && name === "Ninja Spinner") return { kind: "formula", printed, resolverId: "ninja-spinner-damage" };
  if (handlerId === "pokemon:galvantula" && name === "Shocking Web") return { kind: "formula", printed, resolverId: "shocking-web-damage" };
  if (handlerId === "pokemon:alakazam-control" && name === "Psychic") return { kind: "formula", printed, resolverId: "alakazam-psychic-damage" };
  if (handlerId === "pokemon:alakazam" && name === "Powerful Hand") return { kind: "none", printed };
  if (handlerId === "pokemon:raging-bolt-ex" && name === "Bellowing Thunder") return { kind: "formula", printed, resolverId: "raging-bolt-damage" };
  return null;
}

function attacks(card: PokemonCardMetadata, handlerId: string): AttackDefinition[] | null {
  const mapped: Array<AttackDefinition | null> = (card.attacks ?? []).map((attack, index) => {
    const damage = damageFor(handlerId, attack.name, attack.damage);
    if (!damage) return null;
    const templateProgram = handlerId === "template:pokemon-wave-1" ? matchWave1Attack(attack)?.programId : undefined;
    // A fixed-damage attack with no printed effect is deterministic and does
    // not need a synthetic/no-op effect program. Keep programs only when the
    // card actually prints an effect clause.
    const formulaOnly = new Set(["rapid-fire-combo-damage", "rocket-rush-damage", "dark-frost-damage", "full-moon-rondo-damage", "cosmic-beam-damage"]);
    const effectProgramId = attack.text?.trim() && !(damage.kind === "formula" && damage.resolverId && formulaOnly.has(damage.resolverId)) ? attackPrograms[handlerId]?.[attack.name] ?? templateProgram : undefined;
    return { id: `${card.id}-attack-${index}`, name: attack.name, cost: attack.cost.reduce<Partial<Record<CardType, number>>>((cost, type) => { if (type === "Free") return cost; const key = typeMap[type]; cost[key] = (cost[key] ?? 0) + 1; return cost; }, {}), damage, ...(attack.text ? { text: attack.text } : {}), ...(effectProgramId ? { effectProgramId } : {}) };
  });
  return mapped.every((attack): attack is AttackDefinition => Boolean(attack)) ? mapped : null;
}

function trainerSubtype(card: PokemonCardMetadata): TrainerSubtype | null {
  const subtype = card.subtypes[0]?.toLocaleLowerCase("en-US") ?? "item";
  if (subtype.includes("tool")) return "tool";
  return (["item", "supporter", "stadium"] as const).find((value) => subtype === value) ?? null;
}

export function toRuntimeCardDefinition(metadata: PokemonCardMetadata): CardDefinition | null {
  const implementation = compileCardImplementation(metadata);
  if (!["complete", "generated"].includes(implementation.status) && !OWNED_RUNTIME_FALLBACK_IDS.has(metadata.id)) return null;
  if (OWNED_RUNTIME_FALLBACK_IDS.has(metadata.id) && !["complete", "generated"].includes(implementation.status)) {
    const traits = traitsFor(metadata, `generated:owned:${metadata.id}`);
    if (metadata.supertype === "Pokémon" && metadata.types?.[0] && metadata.hp) {
      const attacks = (metadata.attacks ?? []).map((attack, index) => ({ id: `${metadata.id}-attack-${index}`, name: attack.name, cost: attack.cost.reduce<Partial<Record<CardType, number>>>((cost, type) => { if (type !== "Free") { const key = typeMap[type]; cost[key] = (cost[key] ?? 0) + 1; } return cost; }, {}), damage: damageFor(metadata.id, attack.name, attack.damage) ?? { kind: "none" as const, printed: attack.damage }, ...(attack.text ? { text: attack.text, effectProgramId: `generated:owned:${metadata.id}:attack:${index}` } : {}) }));
      const abilities = (metadata.abilities ?? []).map((ability, index) => ({ id: `${metadata.id}-ability-${index}`, name: ability.name, text: ability.text, category: "activated" as const, usageLimit: "unrestricted" as const, effectProgramId: `generated:owned:${metadata.id}:ability:${index}`, targeting: { sourceMayBeActive: true, sourceMayBeBenched: true } }));
      const stage: PokemonStage = metadata.subtypes.includes("Basic") ? "basic" : metadata.subtypes.includes("Stage 2") ? "stage2" : "stage1";
      return { id: metadata.id, name: metadata.name, category: "pokemon", pokemonType: typeMap[metadata.types[0]], stage, evolvesFrom: metadata.evolvesFrom, hp: metadata.hp, ruleBox: "single-prize", hasRuleBox: false, isPokemonEx: false, isMega: false, prizeValue: 1, traits, abilities, attacks, weakness: metadata.weaknesses?.[0] ? { type: typeMap[metadata.weaknesses[0].type], multiplier: Number(metadata.weaknesses[0].value.replace(/[^0-9.]/g, "")) || 2 } : undefined, resistance: metadata.resistances?.[0] ? { type: typeMap[metadata.resistances[0].type], amount: Number(metadata.resistances[0].value.replace(/[^0-9]/g, "")) || 0 } : undefined, retreatCost: metadata.retreat, implementationStatus: "generated" };
    }
    if (metadata.supertype === "Trainer") { const subtype = trainerSubtype(metadata); if (!subtype) return null; return { id: metadata.id, name: metadata.name, category: "trainer", subtype, text: metadata.trainerText ?? metadata.rules?.[0] ?? "", effectProgramId: `generated:owned:${metadata.id}`, traits, canPlayGoingFirstFirstTurn: false, implementationStatus: "generated" }; }
    if (metadata.supertype === "Energy") return { id: metadata.id, name: metadata.name, category: "energy", energyType: typeMap[metadata.types?.[0] ?? "Colorless"], basic: metadata.subtypes.includes("Basic"), effectProgramId: `generated:owned:${metadata.id}`, traits, implementationStatus: "generated" };
  }
  const handlerId = implementationHandler(implementation); const traits = traitsFor(metadata, handlerId);
  if (handlerId.startsWith("energy:basic-")) {
    const basicType = handlerId.slice("energy:basic-".length) as CardType;
    if (["grass", "fire", "water", "lightning", "psychic", "fighting", "darkness", "metal", "colorless"].includes(basicType)) return { id: metadata.id, name: metadata.name, category: "energy", energyType: basicType, basic: true, traits, implementationStatus: implementation.status };
  }
  if (handlerId === "energy:team-rocket") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "darkness", basic: false, traits, supplyOptions: [{ darkness: 2 }, { psychic: 2 }, { darkness: 1, psychic: 1 }], attachOnlyToTrait: "team-rocket", implementationStatus: implementation.status };
  if (handlerId === "energy:prism") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }, { grass: 1 }, { fire: 1 }, { water: 1 }, { lightning: 1 }, { psychic: 1 }, { fighting: 1 }, { darkness: 1 }, { metal: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:growing-grass") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "grass", basic: false, supplyOptions: [{ grass: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:rocky-fighting") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "fighting", basic: false, supplyOptions: [{ fighting: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:telepathic-psychic") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "psychic", basic: false, supplyOptions: [{ psychic: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:mist") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:legacy") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ grass: 1 }, { fire: 1 }, { water: 1 }, { lightning: 1 }, { psychic: 1 }, { fighting: 1 }, { darkness: 1 }, { metal: 1 }, { colorless: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:boomerang") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:enriching") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:ignition") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:neo-upper") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }, { grass: 1 }, { fire: 1 }, { water: 1 }, { lightning: 1 }, { psychic: 1 }, { fighting: 1 }, { darkness: 1 }, { metal: 1 }], implementationStatus: implementation.status };
  if (handlerId === "energy:spiky") return { id: metadata.id, name: metadata.name, category: "energy", effectProgramId: handlerId, energyType: "colorless", basic: false, supplyOptions: [{ colorless: 1 }], implementationStatus: implementation.status };
  // Special Energy must have an explicit handler. Never infer a generic
  // one-type fallback from an unimplemented energy program.
  if (metadata.supertype === "Energy" && metadata.subtypes.includes("Basic") && metadata.types?.[0]) return { id: metadata.id, name: metadata.name, category: "energy", energyType: typeMap[metadata.types[0]], basic: true, traits, implementationStatus: implementation.status };
  if (metadata.supertype === "Pokémon" && metadata.types?.[0] && metadata.hp) {
    const runtimeAttacks = attacks(metadata, handlerId); if (!runtimeAttacks) return null;
    const stage: PokemonStage = metadata.subtypes.includes("Basic") ? "basic" : metadata.subtypes.includes("Stage 2") ? "stage2" : "stage1";
    const multiplier = Number(metadata.weaknesses?.[0]?.value.replace(/[^0-9.]/g, "")) || 2;
    const resistance = Number(metadata.resistances?.[0]?.value.replace(/[^0-9]/g, "")) || 0;
    const isMega = metadata.subtypes.some((subtype) => /^MEGA$/i.test(subtype)) || metadata.rules?.some((rule) => /Mega Evolution Pokémon ex Rule/i.test(rule)) === true;
    const prizeValue = isMega && metadata.subtypes.some((subtype) => /ex|EX/i.test(subtype)) ? 3 : metadata.subtypes.some((subtype) => /VMAX/i.test(subtype)) ? 3 : metadata.subtypes.some((subtype) => /ex|EX|VSTAR|Pokémon V/i.test(subtype)) ? 2 : 1;
    const hasRuleBox = metadata.subtypes.some((subtype) => /\b(ex|EX|V|VMAX|VSTAR|Radiant|BREAK|GX)\b/.test(subtype)) || Boolean(metadata.ruleBoxText?.length);
    const isPokemonEx = metadata.subtypes.some((subtype) => /^Pokémon ex$/i.test(subtype) || /^ex$/i.test(subtype));
    const runtimeAbilities = abilitiesFor(metadata, handlerId);
    return { id: metadata.id, name: metadata.name, category: "pokemon", pokemonType: typeMap[metadata.types[0]], stage, evolvesFrom: metadata.evolvesFrom, hp: metadata.hp, ruleBox: prizeValue > 1 ? "multi-prize" : "single-prize", hasRuleBox, isPokemonEx, isMega, prizeValue, traits, abilities: runtimeAbilities, attacks: runtimeAttacks, weakness: metadata.weaknesses?.[0] ? { type: typeMap[metadata.weaknesses[0].type], multiplier } : undefined, resistance: metadata.resistances?.[0] ? { type: typeMap[metadata.resistances[0].type], amount: resistance } : undefined, retreatCost: metadata.retreat, regulationMark: metadata.regulationMark, implementationStatus: implementation.status };
  }
  if (metadata.supertype === "Trainer") {
    const subtype = trainerSubtype(metadata); if (!subtype) return null;
    const effectProgramId = handlerId;
    if (!effectProgramId) return null;
    return { id: metadata.id, name: metadata.name, category: "trainer", subtype, text: metadata.trainerText ?? "", effectProgramId, traits, canPlayGoingFirstFirstTurn: handlerId === "trainer:team-rocket-proton", implementationStatus: implementation.status };
  }
  return null;
}
