# Simulation implementation model

All 20,444 generated card records are available to Deck Builder. Simulation behaviour is a separate four-state contract:

- `complete`: explicit exact implementation with focused tests.
- `generated`: safely composed from recognized reusable templates.
- `partial`: some printed behaviour is represented, but gameplay-relevant text remains.
- `unsupported`: no safe executable mapping exists.

The reusable compiler generates Basic Energy, plain numerical-damage Pokémon and simple exact heal/switch templates. Exact-printing registry entries make all 20 cards in Skeledirge ex / Armarouge, all 23 in Okidogi ex Poison and all 22 in Team Rocket's Nidoking ex executable.

## Presentation metadata is not runtime behaviour

The generated catalogue preserves and displays every source Ability in its `abilities` array, every printed attack, full Trainer and Special Energy rules, Weakness, Resistance, retreat, set identity, rarity, regulation mark, illustrator, release date, legality and small/large image metadata. The card catalogue, deck rows, details dialog and game-board inspection all read that presentation metadata by exact card ID. Image loading is optional presentation: allow-listed HTTPS validation and stable text fallbacks keep catalogue, deck construction and play usable when an asset is missing or fails.

The runtime adapter intentionally does not map catalogue `abilities` automatically. The runtime supports an `abilities` array, but only exact Abilities with an explicit category, usage limit, targeting rules, effect program and focused tests are mapped. Fire Off and Elegant Heal are mapped; Skeledirge ex PAL 037 correctly has no Ability. Presentation completeness therefore never implies simulation support.

## Executable effect architecture

`engine/effects/program-runner.ts` runs exact effect programs and pauses by placing an `effect-choice` in `GameState`. A choice contains its owner, min/max selections, eligible and selected IDs, optionality, source card/effect, instruction, variables and continuation step. `select-card`, `select-pokemon`, `select-effect-mode`, `confirm-choice` and `decline-optional-effect` are ordinary engine actions, so React and AI consume identical legality.

Runtime attacks keep their exact printed damage and use a typed `none`, `fixed` or named `formula` representation. Burning Voice uses `burning-voice-damage` and bottoms at zero. Runtime Pokémon support multiple executable Abilities; no placeholder Ability action exists.

The attack pipeline applies typed damage, exact attack effects, Knock Out checkpoints, Prize choices and promotion, then Pokémon Checkup and the next Knock Out checkpoint before starting the next turn. Burn applies 20 damage and a deterministic recovery flip. Switching, retreating and evolving clear Special Conditions.

Iono uses a documented deterministic policy: each hand is independently shuffled with the game RNG, then appended to the bottom of its owner's deck in that shuffled order before Prize-count draws. Youngster instead merges the remaining hand into the deck and shuffles the whole deck.

Run:

```bash
npm run cards:report
```

The report enumerates every unsupported exact printing referenced by supplied premades. All three supplied decks are human-playable, AI-playable and simulation-ready. Team Rocket's Nidoking additionally has a 300-game acceptance gate covering Skeledirge, Okidogi and mirror matchups, deterministic replay, core-event exercise, unresolved-state safety and numeric integrity.
