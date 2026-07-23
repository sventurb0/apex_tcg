# Type Engine Library

Engines are defined by exact capabilities and requirements. Shared Pokémon type alone never creates a synergy edge.

| Engine | Energy | Roles | Providers | Requirements | Semantic edges | Sources | Status |
|---|---|---|---:|---:|---:|---:|---|
| Darkness Poison | Darkness | poison, acceleration, aggressive | 5 | 3 | 4 | 1 | reviewed |
| N's Zoroark | Darkness | discard, draw, toolbox | 2 | 3 | 0 | 4 | reviewed |
| Team Rocket Darkness/Psychic | Psychic, Darkness | setup, discard, aggressive | 3 | 3 | 1 | 3 | reviewed |
| Teal Mask Ogerpon / Hydrapple | Grass | acceleration, draw, healing, evolution | 5 | 4 | 5 | 2 | reviewed |
| Grass Evolution Acceleration | Grass | evolution, setup | 2 | 2 | 2 | 2 | reviewed |
| Crustle Defence | Grass | control, defence, single-prize | 1 | 2 | 0 | 3 | reviewed |
| Area Zero Multi-Type Toolbox | Grass, Water, Psychic, Darkness, Fighting, Fire, Metal | toolbox, bench-damage, setup | 3 | 3 | 1 | 3 | reviewed |
| Mega Greninja Damage Counters | Water | bench-damage, evolution, aggressive | 1 | 3 | 0 | 1 | reviewed |
| Wellspring Mask Ogerpon Toolbox | Water, Grass, Lightning, Psychic | toolbox, bench-damage, acceleration | 3 | 4 | 1 | 3 | reviewed |
| Alakazam Powerful Hand | Psychic | draw, evolution, control | 2 | 3 | 1 | 2 | reviewed |
| Slowking Seek Inspiration | Psychic | top-deck-control, toolbox, single-prize | 1 | 2 | 1 | 2 | reviewed |
| Lillie's Clefairy Multi-Type Bench | Psychic, Grass, Water, Lightning, Metal | toolbox, aggressive | 1 | 2 | 0 | 2 | reviewed |
| Dragapult Damage Spread | Fire, Psychic | damage-spread, evolution, bench-damage | 1 | 3 | 0 | 5 | reviewed |
| Joltik Multi-Energy Charge | Lightning, Grass, Psychic, Water, Metal | acceleration, toolbox | 1 | 3 | 1 | 1 | reviewed |
| Iono's Bellibolt | Lightning | acceleration, aggressive | 1 | 2 | 0 | 0 | reviewed |
| Mega Lucario Discard Acceleration | Fighting | acceleration, aggressive, discard | 1 | 3 | 0 | 1 | reviewed |
| Metagross Metal Energy | Metal | evolution, aggressive, single-prize | 1 | 3 | 0 | 1 | reviewed |
| Colorless Flexible Attackers | Colorless | toolbox, aggressive | 1 | 2 | 0 | 3 | reviewed |

## Darkness Poison

- ID: `darkness-poison`
- Core exact IDs: `sv6pt5-36`, `sv6pt5-39`, `sv6-95`, `sv8pt5-95`
- Required packages: darkness-poison-core
- Bench demand: 3; setup: fast; prizes: mixed
- Source decks: okidogi-ex-poison
- Review: Reviewed against exact executable Okidogi, Pecharunt, Munkidori and Binding Mochi text.

## N's Zoroark

- ID: `ns-zoroark`
- Core exact IDs: `sv9-97`, `sv9-98`
- Required packages: ns-zoroark-line, ns-pokemon-toolbox
- Bench demand: 4; setup: medium; prizes: mixed
- Source decks: limitless-28257, limitless-28260, limitless-28270, limitless-28274
- Review: Night Joker copies only attacks on Benched N's Pokémon; type matching alone is irrelevant.

## Team Rocket Darkness/Psychic

- ID: `team-rocket-psychic`
- Core exact IDs: `sv10-81`, `sv10-173`, `sv10-178`, `sv10-182`
- Required packages: team-rocket-trainer-core, team-rocket-board
- Bench demand: 4; setup: medium; prizes: mixed
- Source decks: limitless-28254, limitless-28351, team-rockets-nidoking-ex
- Review: Power Saver requires four Team Rocket's Pokémon in play. Off-trait support directly consumes scarce qualifying board spaces.

## Teal Mask Ogerpon / Hydrapple

- ID: `grass-ogerpon-hydrapple`
- Core exact IDs: `sv6-25`, `sv7-14`
- Required packages: ogerpon-hydrapple-core, bug-catching-grass, grass-energy-density
- Bench demand: 4; setup: medium; prizes: multi-prize
- Source decks: limitless-28266, limitless-28269
- Review: Both acceleration loops spend Basic Grass Energy from hand; high Energy density is a structured resource requirement.

## Grass Evolution Acceleration

- ID: `grass-fast-evolution`
- Core exact IDs: `me1-117`, `sv6-143`
- Required packages: forest-evolution, bug-catching-grass
- Bench demand: 3; setup: fast; prizes: mixed
- Source decks: limitless-28266, limitless-28269
- Review: Forest of Vitality removes the same-turn evolution delay for Grass-on-Grass evolution, except on the first turn.

## Crustle Defence

- ID: `grass-crustle-control`
- Core exact IDs: `sv10-12`
- Required packages: crustle-line
- Bench demand: 2; setup: medium; prizes: single-prize
- Source decks: limitless-28252, limitless-28267, limitless-28276
- Review: Mysterious Rock Inn prevents attack damage from opposing Pokémon ex, not effects or non-ex attackers.

## Area Zero Multi-Type Toolbox

- ID: `area-zero-toolbox`
- Core exact IDs: `sv7-131`, `sv7-133`, `sv6-64`
- Required packages: area-zero-toolbox, crispin-multitype
- Bench demand: 7; setup: medium; prizes: mixed
- Source decks: limitless-28262, limitless-28263, limitless-28692
- Review: Area Zero expansion requires a Tera Pokémon in play. Crispin requires two different Basic Energy types.

## Mega Greninja Damage Counters

- ID: `water-mega-greninja`
- Core exact IDs: `me4-22`
- Required packages: mega-greninja-line, rare-candy-stage-two
- Bench demand: 3; setup: medium; prizes: mixed
- Source decks: limitless-28571
- Review: Mortal Shuriken is Active-only and discards Basic Water Energy from hand as its cost.

## Wellspring Mask Ogerpon Toolbox

- ID: `water-wellspring-toolbox`
- Core exact IDs: `sv6-64`, `sv7-131`, `sv7-133`
- Required packages: wellspring-ogerpon, crispin-multitype
- Bench demand: 6; setup: medium; prizes: multi-prize
- Source decks: limitless-28262, limitless-28263, limitless-28692
- Review: Torrential Pump is a Water-inclusive toolbox attack: its Bench damage is conditional on shuffling three Energy from the attacker into the deck. Crispin supplies two different Basic Energy types; Area Zero requires a Tera Pokémon and competes for the Stadium slot.

## Alakazam Powerful Hand

- ID: `psychic-alakazam-hand`
- Core exact IDs: `me1-56`, `me3-88`
- Required packages: alakazam-line, rare-candy-stage-two, telepathic-psychic
- Bench demand: 4; setup: medium; prizes: single-prize
- Source decks: limitless-28405, limitless-28275
- Review: Powerful Hand scales from actual hand size; Psychic Draw triggers only on hand evolution.

## Slowking Seek Inspiration

- ID: `psychic-slowking-topdeck`
- Core exact IDs: `sv7-58`, `sv6pt5-54`
- Required packages: slowking-academy
- Bench demand: 3; setup: medium; prizes: single-prize
- Source decks: limitless-28251, limitless-28265
- Review: Seek Inspiration succeeds only when the discarded top card is a non-Rule-Box Pokémon; Academy at Night supplies reviewed top-deck ordering.

## Lillie's Clefairy Multi-Type Bench

- ID: `psychic-clefairy-bench`
- Core exact IDs: `sv9-56`
- Required packages: lillies-clefairy-multitype
- Bench demand: 5; setup: fast; prizes: multi-prize
- Source decks: limitless-28249, limitless-28675
- Review: Full Moon Rondo counts both Benches; its damage scaling is bench population, not shared type.

## Dragapult Damage Spread

- ID: `dragon-dragapult-spread`
- Core exact IDs: `sv6-128`, `sv6-129`, `sv6-130`
- Required packages: dragapult-line, rare-candy-stage-two
- Bench demand: 4; setup: medium; prizes: mixed
- Source decks: limitless-28236, limitless-28250, limitless-28255, limitless-28256, limitless-28259
- Review: Phantom Dive requires both Fire and Psychic Energy and distributes exactly six Bench damage counters.

## Joltik Multi-Energy Charge

- ID: `lightning-joltik-box`
- Core exact IDs: `sv7-50`, `sv8-57`
- Required packages: joltik-box, crispin-multitype
- Bench demand: 5; setup: fast; prizes: mixed
- Source decks: limitless-28692
- Review: Jolting Charge attaches up to two Grass and two Lightning Energy from deck, but consumes the attack for the turn.

## Iono's Bellibolt

- ID: `lightning-iono-bellibolt`
- Core exact IDs: `me2pt5-70`
- Required packages: ionos-bellibolt-line
- Bench demand: 3; setup: medium; prizes: multi-prize
- Source decks: none (catalogue-reviewed only)
- Review: Reviewed from exact local card text; no matching source-deck snapshot is in this wave, so Architect must label it catalogue-reviewed rather than tournament-backed. The behaviour family remains unsupported and must be surfaced as an exact blocker.

## Mega Lucario Discard Acceleration

- ID: `fighting-mega-lucario`
- Core exact IDs: `me1-77`
- Required packages: mega-lucario-line, fighting-energy-density
- Bench demand: 3; setup: fast; prizes: multi-prize
- Source decks: limitless-27961
- Review: Aura Jab accelerates Basic Fighting Energy from discard to Benched Pokémon; Mega Brave has a next-turn attack lock.

## Metagross Metal Energy

- ID: `metal-metagross`
- Core exact IDs: `me4-61`
- Required packages: metagross-line, metal-energy-density
- Bench demand: 3; setup: slow; prizes: mixed
- Source decks: limitless-28423
- Review: Metallic Hammer's optional 150 damage increase discards exactly three Metal Energy from Metagross.

## Colorless Flexible Attackers

- ID: `colorless-flex-attackers`
- Core exact IDs: `sv9-121`, `me3-62`
- Required packages: colorless-flex-attackers
- Bench demand: 3; setup: fast; prizes: multi-prize
- Source decks: limitless-28262, limitless-28405, limitless-27961
- Review: Colorless attack costs permit Energy-package flexibility but do not by themselves prove synergy; every included attacker still needs a structured role.
