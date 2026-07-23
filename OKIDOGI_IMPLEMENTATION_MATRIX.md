# Okidogi ex Poison implementation matrix

Pinned printed-text source: `public/data/pokemon-cards.json`.

| Exact ID | Card | Printed gameplay identity | Reusable primitives | Exact handler | Focused tests |
|---|---|---|---|---|---|
| sv6pt5-36 | Okidogi ex | Poisonous Musculature (no damage); Chain-Crazed 130+ | optional deck search, effect attachment, self-Poison, formula damage, ex Prizes | attack programs + `chain-crazed-damage` | acceleration, zero choice, 130/260/300 |
| sv6pt5-39 | Pecharunt ex | Subjugating Chains; Irritated Outburst 60× | shared Ability-name limit, Darkness Bench filtering, switch, Poison, Prize-count formula | Ability program + `irritated-outburst-damage` | targets, shared limit, 0–300 |
| sv6-95 | Munkidori | Adrena-Brain; Mind Bend 60 | per-Pokémon limit, attached-type check, multi-step Pokémon/counter choice, KO checkpoint, Confusion | Ability + attack programs | attachment gate, move 1–3, KO, Confusion |
| sv6pt5-37 | Munkidori ex | Oh No You Don't; Dirty Headbutt 190 | passive Prize modifier, KO cause, in-play predicate, Pokémon attack lock | passive resolver + attack program | attack KO only, other causes, next-turn lock |
| me2pt5-142 | Fezandipiti ex | Flip the Script; Cruel Arrow (100 to any Pokémon) | prior-opponent-turn KO events, shared limit, targeted attack, Bench damage | Ability + attack target program | event gate, draw 3, Bench target/WR |
| svp-129 | Pecharunt | Toxic Subjugation; Poison Chain 10 | Active passive, Checkup Poison modifier, Pokémon retreat lock | Checkup modifier + attack program | Active-only 60 Poison, retreat boundary |
| sv6-131 | Tatsugiri | Attract Customers; Surf 50 | Active-only per-Pokémon Ability, top-6 subset search/shuffle | Ability program | Active gate, Supporter filter, zero choice |
| sv8pt5-4 | Budew | Itchy Pollen 10; cost Free | empty attack cost, player Item lock and expiry | attack program | no Energy, Items blocked only |
| sv6pt5-59 | Janine's Secret Art | Up to 2 Darkness Pokémon; attach one Basic Darkness each; Poison Active if attached | distinct target selection, typed search/attachment, Supporter rule | multi-step Trainer program | zero/two targets, distinct, Active Poison |
| me2pt5-192 | Lillie's Determination | shuffle hand; draw 8 at exactly 6 Prizes, else 6 | deterministic hand shuffle/draw | Trainer program | 8/6 boundary |
| sv6pt5-57 | Colress's Tenacity | Stadium and Energy search | independent typed selections, reveal/shuffle | multi-step Trainer program | max one each, independent empty categories |
| me2pt5-183 | Boss's Orders | gust opponent Bench | opponent target, forced switch | Trainer program | exact chosen target, condition clearing |
| sv8-170 | Cyrano | up to 3 Pokémon ex search | Rule Box/ex predicate, optional multi-search | Trainer program | ex-only, max 3 |
| me1-131 | Ultra Ball | discard 2; Pokémon search | existing exact Ultra Ball continuation | `trainer:ultra-ball` | exact printing reuse and cost |
| me3-81 | Poké Pad | one Pokémon without Rule Box | rule-box predicate, optional search/shuffle | Trainer program | excludes ex/multi-Prize |
| zsv10pt5-84 | Pokégear 3.0 | top 7; optional Supporter | revealed subset and shuffle remainder | Trainer program | top-7 scope, zero choice |
| me1-115 | Energy Switch | move one Basic Energy between own Pokémon | exact attached CardInstance movement, source/target steps | Trainer program | Basic only, different targets, identity preserved |
| me1-130 | Switch | switch Active with Bench | existing Switch path | `trainer:switch` | exact printing reuse |
| sv6pt5-61 | Night Stretcher | Pokémon or Basic Energy from discard to hand | typed discard recovery | Trainer program | eligible types, Special Energy exclusion |
| sv5-153 | Master Ball | one Pokémon search; ACE SPEC | general Pokémon search, category-wide deck validation | Trainer program | search, ACE SPEC total limit |
| sv8pt5-95 | Binding Mochi | Poisoned holder attacks +40 to opponent Active | Tool continuous damage modifier before W/R | central modifier pipeline | Poison gate, Active-only damage, no counters/Bench |
| sv8-177 | Gravity Mountain | Stage 2 Pokémon get -30 HP | dynamic max HP, Stadium entry/evolution KO checkpoint | central modifier pipeline | both players, entry/evolution KO, exit restore |
| sve-7 | Basic Darkness Energy | Basic Darkness Energy | Darkness/Colorless payment, Basic filters | basic Energy runtime | payment/search/recovery filters |

Deck-level acceptance tests cover 23/23 complete runtime definitions, 60/60 instances, construction/ACE SPEC validity, AI strategy exercise, deterministic batches, and replay identity.
