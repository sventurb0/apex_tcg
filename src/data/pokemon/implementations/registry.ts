import type { CardImplementation, CardImplementationRegistry } from "../types";

const exactPrograms: Readonly<Record<string, string>> = {
  "sv1-41": "pokemon:armarouge", "sv4-26": "pokemon:charcadet", "sv1-37": "pokemon:crocalor", "sv2-35": "pokemon:fuecoco",
  "swsh12-16": "pokemon:radiant-tsareena", "sv2-37": "pokemon:skeledirge-ex", "swsh12-137": "pokemon:smeargle",
  "swsh12pt5-127": "trainer:energy-retrieval", "swsh5-125": "trainer:escape-rope", "swsh35-52": "trainer:great-ball",
  "sv4pt5-80": "trainer:iono", "sv1-175": "trainer:jacq", "swsh6-145": "trainer:klara", "swsh9-144": "stadium:magma-basin",
  "sv4pt5-84": "trainer:nest-ball", "sv1-189": "trainer:professors-research", "sv1-194": "trainer:switch",
  "sv4pt5-91": "trainer:ultra-ball", "sv1-198": "trainer:youngster", "sve-2": "energy:basic-fire",
  "sv6pt5-36": "pokemon:okidogi-ex", "sv6pt5-39": "pokemon:pecharunt-ex", "sv6-95": "pokemon:munkidori",
  "sv6pt5-37": "pokemon:munkidori-ex", "me2pt5-142": "pokemon:fezandipiti-ex", "svp-129": "pokemon:pecharunt",
  "sv6-131": "pokemon:tatsugiri", "sv8pt5-4": "pokemon:budew", "sv6pt5-59": "trainer:janines-secret-art",
  "me2pt5-192": "trainer:lillies-determination", "sv6pt5-57": "trainer:colress-tenacity", "me2pt5-183": "trainer:boss-orders",
  "sv8-170": "trainer:cyrano", "me1-131": "trainer:ultra-ball", "me3-81": "trainer:poke-pad",
  "zsv10pt5-84": "trainer:pokegear-3", "me1-115": "trainer:energy-switch", "me1-130": "trainer:switch",
  "sv6pt5-61": "trainer:night-stretcher", "sv5-153": "trainer:master-ball", "sv8pt5-95": "tool:binding-mochi",
  "sv8-177": "stadium:gravity-mountain", "sve-7": "energy:basic-darkness",
  "sv10-117": "pokemon:team-rocket-nidoran", "sv10-118": "pokemon:team-rocket-nidorino", "sv10-119": "pokemon:team-rocket-nidoking-ex",
  "sv6pt5-38": "pokemon:fezandipiti-ex", "sv6pt5-72": "pokemon:munkidori", "sv5-144": "trainer:buddy-buddy-poffin",
  "sv4-163": "trainer:earthen-vessel", "sv1-181": "trainer:nest-ball", "sv1-191": "trainer:rare-candy", "sv2-188": "trainer:super-rod",
  "sv10-170": "trainer:team-rocket-archer", "sv10-171": "trainer:team-rocket-ariana", "sv10-173": "stadium:team-rocket-factory",
  "sv10-174": "trainer:team-rocket-giovanni", "sv10-176": "trainer:team-rocket-petrel", "sv10-177": "trainer:team-rocket-proton",
  "sv10-178": "trainer:team-rocket-transceiver", "sv1-196": "trainer:ultra-ball", "sv10-182": "energy:team-rocket",
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
};

function exactImplementation(cardId: string, handlerId: string): CardImplementation {
  const okidogiIds = new Set(["sv6pt5-36","sv6pt5-39","sv6-95","sv6pt5-37","me2pt5-142","svp-129","sv6-131","sv8pt5-4","sv6pt5-59","me2pt5-192","sv6pt5-57","me2pt5-183","sv8-170","me1-131","me3-81","zsv10pt5-84","me1-115","me1-130","sv6pt5-61","sv5-153","sv8pt5-95","sv8-177","sve-7"]);
  const teamRocketIds = new Set(["sv10-117","sv10-118","sv10-119","sv6pt5-38","sv6pt5-39","sv6pt5-72","sv5-144","sv4-163","sv1-181","sv6pt5-61","sv1-191","sv2-188","sv10-170","sv10-171","sv10-173","sv10-174","sv10-176","sv10-177","sv10-178","sv1-196","sv10-182","sve-7"]);
  return { cardId, status: "complete", handlers: [{ kind: "custom", handlerId }], supportedMechanics: mechanics[cardId] ?? ["Exact executable effect program"], knownLimitations: [], tests: [cardId === "sv1-194" ? "tests/cards/switch-svi-194.test.ts" : teamRocketIds.has(cardId) ? "tests/cards/team-rocket-nidoking-cards.test.ts" : okidogiIds.has(cardId) ? "tests/cards/okidogi-deck-cards.test.ts" : "tests/cards/skeledirge-deck-cards.test.ts"] };
}

export const cardImplementationRegistry: CardImplementationRegistry = {
  ...Object.fromEntries(Object.entries(exactPrograms).map(([cardId, handlerId]) => [cardId, exactImplementation(cardId, handlerId)])),
  "sv1-166": { cardId: "sv1-166", status: "unsupported", handlers: [], supportedMechanics: [], knownLimitations: ["Requires independent Item and Pokémon Tool deck-search choices."], tests: [] },
  "sv1-188": { cardId: "sv1-188", status: "complete", handlers: [{ kind: "declarative", effectId: "heal-30-selected-pokemon" }], supportedMechanics: ["Select a damaged Pokémon", "Heal exactly 30 damage"], knownLimitations: [], tests: ["tests/cards/potion-svi-188.test.ts"] },
};
