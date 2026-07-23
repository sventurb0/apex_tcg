# Card Behaviour Coverage — Wave 1

Wave 1 is a strict reusable-template expansion, not full historical card support.

## Exact coverage result

| Measure | Pre-pass | Wave 1 | Delta |
|---|---:|---:|---:|
| Exact printings | 20,444 | 20,444 | 0 |
| Explicit complete | 63 | 63 | 0 |
| Functional inherited complete | 165 | 405 | +240 |
| Reviewed-template complete | 0 | 671 | +671 |
| Safely generated | 1,700 | 1,700 | 0 |
| Simulation-ready exact printings | 1,928 | 2,839 | +911 |
| Behaviour families | 1,343 | 2,014 | +671 |
| Complete Ability signatures | 8 | 55 | +47 |
| Complete attack signatures | — | 4,386 | 1,098 reviewed nontrivial effect signatures plus fixed/explicit families |
| Complete Trainer/Energy signatures | 39 | 80 | +41 net complete |
| Favourite Pokémon with a ready variant | 1 | 2 | +1 |

Remaining unsupported signatures: 1,990 Ability, 13,041 attack, 1,436 Trainer and 130 Special Energy. Another 562 Ability signatures are partial because an exact signature is executable but one or more containing cards still have unsupported behaviour.

## Reviewed Wave 1 template families

Abilities: fixed draw, draw-to hand size, Active-only draw, discard-hand draw, discard-one draw, self/team/Active/selected healing, own switching, self-to-Active switching, fixed opposing damage counters, Active-only Special Conditions, exact-category deck search and Basic-Pokémon Bench setup.

Attacks: fixed draw, exact Special Condition, self-heal and recoil after damage. Together with fixed/no-text attack compilation these cover 4,386 exact attack signatures; 1,098 are reviewed nontrivial effect signatures.

Trainers: fixed draw, discard/shuffle hand refresh, draw-to, both-player shuffle/draw, exact-category deck search, Basic-to-Bench search, Basic Energy recovery/movement, own switch, gust, selected/Active/team healing and Special Condition removal. No new Special Energy template was enabled: the remaining signatures require attachment restrictions, multi-unit supply or passive modifiers beyond the safe Wave 1 model.

## Favourite archetypes

- Arcanine `swsh8-33`: exact 60-card simulation-ready Architect shell; human-playable, AI-playable and batch-simulation-ready. Deep result: 41–259 (13.7%) over 300 games, zero unresolved and zero safety-limit games.
- Gengar `sv4pt5-57`: exact 60-card simulation-ready Architect shell; human-playable, AI-playable and batch-simulation-ready. Deep result: 40–260 (13.3%) over 300 games, zero unresolved and zero safety-limit games.

Both repeated replay batches were byte-for-byte deterministic. The low win rates and low favourite-event readiness show these are experimental executable shells, not competitive recommendations.

Gengar disruption/Poison, Bellibolt Lightning, Alolan Muk/Swalot control, Corviknight defensive, Alakazam Psychic and Annihilape/Machamp Fighting remain Creative-mode targets except for the simple executable Gengar variant above. Their exact blockers are listed in `FAVOURITE_CARD_COVERAGE.md` and the generated coverage plan.

## Recommended Wave 2

Prioritize deterministic coin/status attacks, Basic-to-Bench attacks, common variable-damage resolvers, Potion-era healing wording, Judge-style hand disruption variants, Energy Retrieval/search variants, Boss/gust variants, and one reviewed Special Energy supply model. Favourite-focused work should target Bellibolt, Alolan Muk/Swalot and Corviknight only after their complete evolution lines and every selected 60-card shell are executable.
