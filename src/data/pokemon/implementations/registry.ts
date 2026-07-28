import type { CardImplementation, CardImplementationRegistry } from "../types";

const exactPrograms: Readonly<Record<string, string>> = {
  "sv1-41": "pokemon:armarouge", "sv4-26": "pokemon:charcadet", "sv1-37": "pokemon:crocalor", "sv2-35": "pokemon:fuecoco",
  "swsh12-16": "pokemon:radiant-tsareena", "sv2-37": "pokemon:skeledirge-ex", "swsh12-137": "pokemon:smeargle",
  "swsh12pt5-127": "trainer:energy-retrieval", "swsh5-125": "trainer:escape-rope", "swsh35-52": "trainer:great-ball",
  "sv4pt5-80": "trainer:iono", "sv1-175": "trainer:jacq", "swsh6-145": "trainer:klara", "swsh9-144": "stadium:magma-basin",
  "sv2-185": "trainer:iono", "me1-119": "trainer:lillies-determination", "sv9-155": "trainer:professors-research",
  "sv4pt5-84": "trainer:nest-ball", "sv1-189": "trainer:professors-research", "sv1-194": "trainer:switch",
  "swsh12pt5-132": "trainer:great-ball", "me2pt5-198": "trainer:poke-pad", "sv1-182": "trainer:pal-pad",
  "swsh1-183": "trainer:switch", "swsh12pt5-141": "trainer:rare-candy", "xy5-135": "trainer:rare-candy",
  "sv4pt5-91": "trainer:ultra-ball", "sv1-198": "trainer:youngster", "sve-2": "energy:basic-fire",
  "sv6pt5-36": "pokemon:okidogi-ex", "sv6pt5-39": "pokemon:pecharunt-ex", "sv6-95": "pokemon:munkidori",
  "sv6pt5-37": "pokemon:munkidori-ex", "me2pt5-142": "pokemon:fezandipiti-ex", "svp-129": "pokemon:pecharunt",
  "sv6-131": "pokemon:tatsugiri", "sv8pt5-4": "pokemon:budew", "sv6pt5-59": "trainer:janines-secret-art",
  "me2pt5-192": "trainer:lillies-determination", "sv6pt5-57": "trainer:colress-tenacity", "me2pt5-183": "trainer:boss-orders",
  "sv8-170": "trainer:cyrano", "me1-131": "trainer:ultra-ball", "me3-81": "trainer:poke-pad",
  "zsv10pt5-84": "trainer:pokegear-3", "me1-115": "trainer:energy-switch", "me1-130": "trainer:switch",
  "sv1-173": "trainer:energy-switch", "swsh1-162": "trainer:energy-switch", "swsh12pt5-129": "trainer:energy-switch",
  "sv6pt5-61": "trainer:night-stretcher", "sv5-153": "trainer:master-ball", "sv8pt5-95": "tool:binding-mochi",
  "me1-173": "trainer:night-stretcher", "sv8pt5-119": "trainer:prime-catcher", "sv6pt5-55": "tool:binding-mochi",
  "sv8-177": "stadium:gravity-mountain", "sve-7": "energy:basic-darkness",
  "sv10-117": "pokemon:team-rocket-nidoran", "sv10-118": "pokemon:team-rocket-nidorino", "sv10-119": "pokemon:team-rocket-nidoking-ex",
  "sv6pt5-38": "pokemon:fezandipiti-ex", "sv6pt5-72": "pokemon:munkidori", "sv5-144": "trainer:buddy-buddy-poffin",
  "sv4-163": "trainer:earthen-vessel", "sv1-181": "trainer:nest-ball", "sv1-191": "trainer:rare-candy", "sv2-188": "trainer:super-rod",
  "sv10-170": "trainer:team-rocket-archer", "sv10-171": "trainer:team-rocket-ariana", "sv10-173": "stadium:team-rocket-factory",
  "sv10-174": "trainer:team-rocket-giovanni", "sv10-176": "trainer:team-rocket-petrel", "sv10-177": "trainer:team-rocket-proton",
  "sv10-178": "trainer:team-rocket-transceiver", "sv1-196": "trainer:ultra-ball", "sv10-182": "energy:team-rocket",
  "me2pt5-201": "trainer:team-rocket-archer", "me2pt5-202": "trainer:team-rocket-ariana", "me2pt5-204": "trainer:team-rocket-giovanni", "me2pt5-207": "trainer:team-rocket-petrel", "me2pt5-209": "trainer:team-rocket-transceiver", "me2pt5-203": "stadium:team-rocket-factory",
  "me3-62": "pokemon:meowth-ex", "sv9-98": "pokemon:ns-zoroark-ex", "me2pt5-155": "pokemon:ns-zekrom", "me1-88": "pokemon:yveltal",
  "sv6-25": "pokemon:teal-mask-ogerpon-ex", "me2pt5-8": "pokemon:chikorita", "me1-9": "pokemon:bayleef", "me1-10": "pokemon:meganium", "sv6-17": "pokemon:applin", "sv6-18": "pokemon:dipplin", "sv7-14": "pokemon:hydrapple-ex", "me1-12": "pokemon:celebi",
  "sv6-155": "trainer:lanas-aid", "sv7-132": "trainer:briar", "me2-87": "trainer:dawn", "sv6-143": "trainer:bug-catching-set", "me1-117": "stadium:forest-of-vitality", "sv9-143": "tool:black-belt-training", "sv9-157": "trainer:ruffian", "sv9-153": "trainer:ns-pp-up", "sv6-163": "trainer:secret-box", "sv9-152": "stadium:ns-castle", "sv5-145": "trainer:ciphermaniac-codebreaking", "me3-71": "trainer:crushing-hammer", "sv6-165": "trainer:unfair-stamp", "me4-82": "trainer:special-red-card", "sv7-131": "stadium:area-zero-underdepths",
  "sv10-20": "pokemon:team-rocket-spidops", "sv10-81": "pokemon:team-rocket-mewtwo-ex", "sv10-51": "pokemon:team-rocket-articuno", "sv10-87": "pokemon:team-rocket-mimikyu", "sv9-56": "pokemon:lillies-clefairy-ex", "sv5-154": "tool:maximum-belt", "me4-80": "stadium:prism-tower", "sv6-129": "pokemon:drakloak", "sv6-130": "pokemon:dragapult-ex", "me2pt5-16": "pokemon:budew", "sv7-133": "trainer:crispin", "sv10-180": "stadium:team-rocket-watchtower",
  "me1-104": "pokemon:mega-kangaskhan-ex", "sv8-76": "pokemon:latias-ex", "sv8-56": "pokemon:chien-pao", "sv8-111": "pokemon:passimian", "sv5-123": "pokemon:raging-bolt-ex", "sv6-64": "pokemon:wellspring-mask-ogerpon-ex", "sv7-135": "trainer:glass-trumpet",
  "me2-14": "pokemon:moltres", "sv5-24": "pokemon:rabsca", "sv5-129": "pokemon:dudunsparce", "sv9-120": "pokemon:dunsparce", "sv9-27": "pokemon:ns-darmanitan", "sv9-116": "pokemon:ns-reshiram", "me1-86": "pokemon:mega-absol-ex", "me3-52": "pokemon:drapion", "rsv10pt5-55": "pokemon:purrloin", "sv7-114": "pokemon:hoothoot", "sv7-115": "pokemon:noctowl", "sv8pt5-35": "pokemon:duskull", "sv8pt5-36": "pokemon:dusclops", "sv8pt5-37": "pokemon:dusknoir", "sv10-10": "pokemon:shaymin", "sv10-41": "pokemon:combusken", "sv6-39": "pokemon:chi-yu", "sv9-24": "pokemon:blaziken-ex", "me2pt5-121": "pokemon:koraidon-ex",
  "sv6-158": "tool:lucky-helmet", "sv6-150": "tool:handheld-fan", "me1-127": "stadium:risky-ruins", "sv6-153": "stadium:jamming-tower", "me3-84": "trainer:rosas-encouragement", "me4-83": "trainer:transformation-tome", "sv6pt5-64": "trainer:xerosics-machinations", "me2pt5-181": "tool:air-balloon", "sv9-151": "tool:lillies-pearl", "me2pt5-216": "energy:prism", "sv5-152": "tool:hero-cape", "sv9-146": "trainer:brocks-scouting", "rsv10pt5-84": "trainer:hilda",
  "me1-54": "pokemon:abra", "sv6-80": "pokemon:abra", "me1-116": "trainer:fighting-gong", "me1-124": "trainer:premium-power-pro", "me1-74": "pokemon:lunatone", "me1-75": "pokemon:solrock", "me1-76": "pokemon:riolu", "me1-77": "pokemon:mega-lucario-ex", "me3-87": "energy:rocky-fighting", "sv6-167": "energy:legacy", "sv8pt5-50": "pokemon:riolu-quick", "sv9-121": "pokemon:dudunsparce-ex", "me2-94": "trainer:wondrous-patch", "me3-88": "energy:telepathic-psychic", "sv5-157": "trainer:prime-catcher", "sv8-175": "trainer:dusk-ball", "me4-61": "pokemon:metagross", "rsv10pt5-80": "tool:brave-bangle", "sv10-78": "pokemon:zeraora", "sv6-166": "energy:boomerang", "sv6pt5-47": "pokemon:kyurem", "sv6pt5-54": "stadium:academy-at-night", "sv7-57": "pokemon:slowpoke", "sv7-58": "pokemon:slowking", "me2-91": "trainer:jumbo-ice-cream", "me3-86": "energy:growing-grass", "sv10-11": "pokemon:dwebble", "sv10-12": "pokemon:crustle", "sv5-142": "trainer:biancas-devotion", "sv5-146": "trainer:eri", "sv5-150": "trainer:hand-trimmer", "sv5-161": "energy:mist", "sv6-146": "stadium:community-center", "sv6-149": "stadium:festival-grounds", "sv8-179": "trainer:lisias-appeal", "sv9-159": "energy:spiky", "me1-55": "pokemon:kadabra", "me1-56": "pokemon:alakazam", "sv8-100": "pokemon:annihilape", "sv10-92": "pokemon:annihilape", "sv8-187": "trainer:surfer", "sv8-75": "pokemon:smoochum", "me2pt5-39": "pokemon:psyduck", "me3-77": "stadium:lumiose-city", "me3-78": "trainer:lumiose-galette", "me2pt5-197": "stadium:nighttime-mine", "sv10-168": "trainer:sacred-ash", "sv6-148": "trainer:enhanced-hammer", "sv6pt5-40": "pokemon:genesect", "sv8-191": "energy:enriching", "sv8-87": "pokemon:dedenne", "zsv10pt5-40": "pokemon:elgyem", "me2pt5-162": "pokemon:rocket-kangaskhan-ex", "sv6-126": "pokemon:applin-festival", "sv6-15": "pokemon:thwackey", "sv6-154": "trainer:kieran", "sv6-16": "pokemon:rillaboom", "sv6-44": "pokemon:goldeen", "sv8-174": "trainer:drayton", "sv8pt5-21": "pokemon:seaking", "sv9-7": "pokemon:lilligant", "zsv10pt5-6": "pokemon:petilil", "sv6-82": "pokemon:alakazam-control", "sv10-164": "trainer:energy-recycler", "sv5-114": "pokemon:metang", "sv6-123": "pokemon:heatran", "sv8-185": "trainer:precious-trolley", "sv8pt5-86": "pokemon:regigigas", "zsv10pt5-67": "pokemon:genesect-ex", "me1-129": "stadium:surfing-beach", "me4-21": "pokemon:frogadier", "me4-22": "pokemon:mega-greninja-ex", "me4-76": "trainer:azs-tranquility", "rsv10pt5-86": "energy:ignition", "sv5-162": "energy:neo-upper", "sv6-106": "pokemon:greninja-ex", "me2pt5-191": "tool:light-ball", "sv5-25": "pokemon:iron-leaves-ex", "sv6-141": "pokemon:bloodmoon-ursaluna-ex", "sv6pt5-2": "pokemon:galvantula", "sv7-50": "pokemon:joltik", "sv8-57": "pokemon:pikachu-ex",
  "sv10-28": "pokemon:arcanine", "sv1-30": "pokemon:growlithe", "sv6-100": "pokemon:hisuian-arcanine", "swsh10-70": "pokemon:hisuian-growlithe",
  "sv7-92": "pokemon:swalot", "sm12-131": "pokemon:alolan-muk", "sv10-124": "pokemon:team-rocket-muk", "sv10-113": "pokemon:team-rocket-arbok", "sv10-121": "pokemon:team-rocket-golbat", "sv10-125": "pokemon:team-rocket-koffing", "sv10-122": "pokemon:team-rocket-crobat-ex", "me2pt5-19": "pokemon:team-rocket-spidops",
  "sv10-116": "pokemon:team-rocket-nidoqueen", "sv2-79": "pokemon:bellibolt-ex", "sv3-77": "pokemon:bellibolt", "sv2-148": "pokemon:corviknight", "sv3pt5-68": "pokemon:machamp", "sv3pt5-130": "pokemon:gyarados", "sv3pt5-149": "pokemon:dragonite", "swsh12-98": "pokemon:hawlucha",
  "me5-27": "pokemon:mega-zeraora-ex", "sv4-177": "tool:technical-machine-devolution", "sv4-178": "tool:technical-machine-evolution",
  "sv1-32": "pokemon:arcanine-ex", "sv4pt5-175": "pokemon:hawlucha-flying-entry",
};

const mechanics: Readonly<Record<string, string[]>> = {
  "sv1-41": ["Fire Off Energy movement", "Flame Cannon damage and Burn"],
  "sv4-26": ["Basic Fire Energy search and effect attachment", "Fixed damage"],
  "swsh12-16": ["Once-per-turn team healing", "Special Condition recovery"],
  "sv2-37": ["Team healing", "Damage-counter-based Burning Voice", "Two-Prize rule"],
  "swsh12-137": ["Top-five revealed subset", "Multi-Energy attachment to one target"],
  "swsh9-144": ["Per-player Stadium activation", "Discard Energy attachment", "Bench damage and Knock Out"],
  "sv6pt5-36": ["Darkness Energy acceleration", "Self-Poison", "Poison damage formula"],
  "sv6pt5-39": ["Shared Ability-name usage", "Darkness switching", "Prize-count damage"],
  "sv6-95": ["Damage-counter movement", "Per-Pokémon Ability limit", "Immediate Knock Out checkpoint"],
  "sv6pt5-37": ["Attack-damage-only Prize reduction", "Per-instance attack lock"],
  "me2pt5-142": ["Prior-turn Knock Out trigger", "Targeted Bench attack"],
  "svp-129": ["Active passive Poison modifier", "Per-Pokémon retreat lock"],
  "sv8pt5-95": ["Poison-gated Tool damage modifier"],
  "sv8-177": ["Dynamic Stage 2 maximum HP modifier", "Immediate modifier Knock Outs"],
  "sv10-118": ["Horn Rend pre-damage conditional formula"], "sv10-119": ["Enhanced Poison intensity", "Two-Prize rule"],
  "sv10-182": ["Team Rocket attachment restriction", "Two-unit Psychic/Darkness supply options"],
  "sv10-20": ["Charging Up discard Energy attachment", "Rocket Rush Team Rocket count"], "sv10-81": ["Power Saver Team Rocket gate", "Erasure Ball Benched Energy discard"], "sv10-51": ["Repelling Veil attack-effect prevention", "Dark Frost Team Rocket Energy bonus"], "sv10-87": ["Gemstone Mimicry Tera attack copy"], "sv9-56": ["Fairy Zone Dragon Weakness override", "Full Moon Rondo Bench scaling"], "sv5-154": ["Active Pokémon ex damage bonus"], "me4-80": ["Discard two draw one Stadium ability"], "sv6-129": ["Recon Directive top-two selection"], "sv6-130": ["Phantom Dive Bench damage counters", "Tera Bench damage prevention"], "sv7-133": ["Two different Basic Energy search and attach"], "sv10-180": ["Colorless Ability lock"],
  "me3-62": ["Last-Ditch Catch hand-to-Bench trigger", "Tuck Tail return-to-hand"], "sv9-98": ["Trade discard one draw two", "Night Joker N's attack copy"], "me2pt5-155": ["Shred damage immunity", "Rampaging Thunder attack lock"], "me1-88": ["Clutch retreat lock", "Dark Feather fixed damage"],
  "sv6-25": ["Teal Dance Grass acceleration and draw", "Tera Bench protection"], "me1-10": ["Wild Growth doubled Basic Grass supply"], "sv6-18": ["Festival Lead second attack"], "sv7-14": ["Ripening Charge attach and heal", "Syrup Storm Grass scaling"], "me1-12": ["Traverse Time Grass Pokémon/Stadium search"], "sv6-155": ["Recover non-Rule-Box Pokémon and Basic Energy"], "sv7-132": ["Briar exact two-Prize extra Prize"], "me2-87": ["Basic/Stage1/Stage2 search"], "sv6-143": ["Top-seven Grass search"], "me1-117": ["Same-turn Grass evolution"],
};

const extraMechanics: Readonly<Record<string, string[]>> = {
  "me1-104": ["Run Errand draw", "Rapid-Fire Combo coin scaling", "Mega three-Prize rule"], "sv8-76": ["Basic Pokémon free retreat", "Eon Blade attack lock"], "sv8-56": ["Snow Sink Stadium discard", "Icicle Loop Energy recovery"], "sv8-111": ["Basic Pokémon board scaling"], "sv5-123": ["Burst Roar hand refresh", "Bellowing Thunder arbitrary Basic Energy discard"], "sv6-64": ["Torrential Pump Energy shuffle and Bench damage", "Tera Bench protection"], "sv7-135": ["Tera-gated Basic Energy recovery to Benched Colorless Pokémon"],
};

function exactImplementation(cardId: string, handlerId: string): CardImplementation {
  const okidogiIds = new Set(["sv6pt5-36","sv6pt5-39","sv6-95","sv6pt5-37","me2pt5-142","svp-129","sv6-131","sv8pt5-4","sv6pt5-59","me2pt5-192","sv6pt5-57","me2pt5-183","sv8-170","me1-131","me3-81","zsv10pt5-84","me1-115","me1-130","sv6pt5-61","sv5-153","sv8pt5-95","sv8-177","sve-7"]);
  const teamRocketIds = new Set(["sv10-117","sv10-118","sv10-119","sv10-20","sv10-81","sv10-51","sv10-87","sv6pt5-38","sv6pt5-39","sv6pt5-72","sv5-144","sv4-163","sv1-181","sv6pt5-61","sv1-191","sv2-188","sv10-170","sv10-171","sv10-173","sv10-174","sv10-176","sv10-177","sv10-178","sv1-196","sv10-182","sve-7"]);
  return { cardId, status: "complete", handlers: [{ kind: "custom", handlerId }], supportedMechanics: mechanics[cardId] ?? extraMechanics[cardId] ?? ["Exact executable effect program"], knownLimitations: [], tests: [cardId === "sv1-194" ? "tests/cards/switch-svi-194.test.ts" : ["sv10-20","sv10-81","sv10-51","sv10-87","sv9-56","sv5-154","me4-80","sv6-129","sv6-130","me2pt5-16","me3-62","sv7-133","me3-71","sv6-165","me4-82","sv10-180"].includes(cardId) ? "tests/cards/rocket-mewtwo-dragapult-runtime.test.ts" : teamRocketIds.has(cardId) ? "tests/cards/team-rocket-nidoking-cards.test.ts" : okidogiIds.has(cardId) ? "tests/cards/okidogi-deck-cards.test.ts" : "tests/cards/skeledirge-deck-cards.test.ts"], choiceSemantics: "exact" };
}

export const cardImplementationRegistry: CardImplementationRegistry = {
  ...Object.fromEntries(Object.entries(exactPrograms).map(([cardId, handlerId]) => [cardId, exactImplementation(cardId, handlerId)])),
  "sv6pt5-55": { ...exactImplementation("sv6pt5-55", "tool:binding-mochi"), allowFunctionalInheritance: true },
  "sv1-166": { cardId: "sv1-166", status: "unsupported", handlers: [], supportedMechanics: [], knownLimitations: ["Requires independent Item and Pokémon Tool deck-search choices."], tests: [] },
  "sv1-188": { cardId: "sv1-188", status: "complete", handlers: [{ kind: "declarative", effectId: "heal-30-selected-pokemon" }], supportedMechanics: ["Select a damaged Pokémon", "Heal exactly 30 damage"], knownLimitations: [], tests: ["tests/cards/potion-svi-188.test.ts"] },
};
