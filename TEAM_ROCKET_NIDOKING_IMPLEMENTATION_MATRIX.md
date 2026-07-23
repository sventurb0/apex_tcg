# Team Rocket's Nidoking ex implementation matrix

Source of truth: `public/data/pokemon-cards.json`, exact manifest `src/data/decks/premade/team-rockets-nidoking.json` (14 Pokémon / 36 Trainers / 10 Energy; 60 cards; 22 printings).

| Exact ID | Printed identity | Executable primitives / handler | Focused verification |
|---|---|---|---|
| sv10-117 | Team Rocket's Nidoran♂; Pierce 10; Hammer In 30 | Team Rocket trait; fixed attacks | Costs and damage |
| sv10-118 | Team Rocket's Nidorino; Hammer In 30; Horn Rend 60+ | Team Rocket trait; `horn-rend-damage` formula | 60 undamaged / 120 damaged |
| sv10-119 | Team Rocket's Nidoking ex; Tainted Horn 100; Kingly Impact 240 | ex trait; enhanced Poison condition; fixed attacks | 100 + 8-counter Poison; 240; 2 Prizes |
| sv6pt5-38 | Fezandipiti ex; Flip the Script; Cruel Arrow | Reuse reviewed Flip/Cruel signature | trigger and targeted damage |
| sv6pt5-39 | Pecharunt ex; Subjugating Chains; Irritated Outburst 60× | Reuse existing exact implementation | shared use/switch/formula |
| sv6pt5-72 | Munkidori; Adrena-Brain; Mind Bend 60 | Reuse reviewed TWM gameplay signature | Energy gate/counter move/Confusion |
| sv5-144 | Buddy-Buddy Poffin | Bench-space-aware Basic ≤70 HP deck search | 0–2 direct Bench targets |
| sv4-163 | Earthen Vessel | exact discard cost; Basic Energy search | playability, cost, 0–2 search |
| sv1-181 | Nest Ball | Reuse existing direct-to-Bench search | exact reprint registration |
| sv6pt5-61 | Night Stretcher | Reuse existing Pokémon/Basic Energy recovery | exact printing regression |
| sv1-191 | Rare Candy | validated Basic→Stage 2 family evolution | timing, preservation, invalid family |
| sv2-188 | Super Rod | Pokémon/Basic Energy discard recovery + seeded shuffle | mixed 0–3, Special Energy excluded |
| sv10-170 | Team Rocket's Archer | prior-opponent-turn Team Rocket KO trigger; shuffle/draw 5–3 | structured trigger and deterministic hands |
| sv10-171 | Team Rocket's Ariana | all-in-play Team Rocket predicate; draw-to 5/8 | mixed-board condition |
| sv10-173 | Team Rocket's Factory | per-player Stadium activation after Team Rocket Supporter | qualification and once/turn |
| sv10-174 | Team Rocket's Giovanni | sequential own Team Rocket switch then opponent gust | target legality and ordering |
| sv10-176 | Team Rocket's Petrel | any-Trainer deck search | Item/Supporter/Stadium/Tool eligibility |
| sv10-177 | Team Rocket's Proton | reviewed first-player-turn Supporter exception; Basic Team Rocket search | exception and exact trait filter |
| sv10-178 | Team Rocket's Transceiver | Team Rocket Supporter deck search | exact trait/subtype filter |
| sv1-196 | Ultra Ball | Reuse exact discard-two Pokémon search | exact reprint registration |
| sv10-182 | Team Rocket's Energy | restricted attachment; one physical card with 2-unit Psychic/Darkness supply options | all cost combinations and invalid attachment |
| sve-7 | Basic Darkness Energy | Reuse Basic Darkness supply/filter | Basic-only filters and Colorless payment |

Shared facilities: reviewed card traits, capability-based Supporter timing, multi-option Energy-cost solver, attachment-validity checkpoint, structured Poison intensity, structured prior-turn events, deterministic continuation choices, semantic events, and deck-specific AI scoring.

## Shared runtime models

- **Team Rocket identity:** `CardTrait` is populated only for reviewed exact IDs. Predicates cover Team Rocket Pokémon, Team Rocket Supporters, Basic Team Rocket Pokémon and all-Pokémon-in-play checks without parsing imported names.
- **Multi-unit Energy:** one physical Team Rocket's Energy instance exposes mutually exclusive 2 Darkness, 2 Psychic or 1 Darkness + 1 Psychic supply profiles. The shared solver selects at most one profile per instance, can spend those units as Colorless and never duplicates the `CardInstance`. Attachment legality is checked for manual/effect attachment and again as a reusable state-based checkpoint.
- **Enhanced Poison:** Poison owns a structured `countersPerCheckup` and optional source ID. A later Poison application replaces the prior base intensity deterministically; Toxic Subjugation remains a separate continuous bonus. Switching, retreating and evolving clear both the condition and stored intensity.
- **Proton timing:** a reviewed `canPlayGoingFirstFirstTurn` capability supplies Proton's exception while the generic Supporter rule still limits the player to one Supporter. No generic rule branches on Proton's exact ID.
- **Reviewed reuse:** Fezandipiti ex, Pecharunt ex, Munkidori, Nest Ball, Night Stretcher, Ultra Ball and Basic Darkness Energy reuse existing handlers only after their exact printed gameplay signatures were checked.

## Deliberate policies and remaining limits

Giovanni is legal when the required own Team Rocket switch exists. If the opponent has no Bench, the own switch resolves and the optional second sequence ends without a gust target. The supplied deck has no known gameplay limitations and all 22 registry entries therefore report an empty `knownLimitations` list. Broader engine work remains for advanced simultaneous-KO/tiebreak scenarios outside this manifest.
