# Deck Architect and functional implementation families

Deck Architect is a first-class DeckLab workflow for building explainable, deterministic 60-card candidates around one to four selected cards. It preserves exact printing IDs in manifests, images, replays, imports and exports while resolving executable behavior through catalogue-wide functional families.

## Behaviour identity

`gameplaySignature(card)` includes every printed gameplay property and excludes cosmetic/set identity. `createImplementationResolver()` indexes signatures once, selects an explicitly complete canonical printing where one exists, and safely shares that handler with identical alternate arts or reprints. An inherited printing remains `status: "complete"`, carries `implementationSource: "functional-reprint"`, and keeps its own exact card ID at runtime.

The confirmed example is `sv2-233` Skeledirge ex. It resolves to canonical behavior from `sv2-37` and receives `pokemon:skeledirge-ex`, Vitality Song, Burning Voice and the two-Prize rule while retaining PAL 233 artwork and metadata.

Safe generation is deliberately narrow. Basic Energy and Pokémon with no Ability, only blank-effect attacks, and only fixed integer or no printed damage are executable. Variable damage, effect text, special rules and unreviewed Trainer/Energy semantics remain partial or unsupported.

## Ability knowledge

`npm run abilities:report` generates `public/data/ability-signatures.json`. Signatures use normalized Ability name, type and exact text; same-name Abilities with different text remain distinct. Reviewed handler metadata supplies executable strategic tags. A conservative offline classifier may add `inferredTags` for unsupported cards, but inference never grants runtime support.

Wave 1 enables strict full-text Ability templates before runtime conversion. Exact executable variants are shown first, functional reprints remain artwork choices, unsupported variants list blocking signature IDs, and low/medium families already in the plan are marked “Implementable soon.” No match-time natural-language interpretation is used.

## Candidate pipeline

Generation is seeded and deterministic:

1. Lock the selected exact printings or chosen functional printings.
2. Add required pre-evolutions.
3. Select a reviewed engine package for Fire Stage 2, Darkness Poison, Team Rocket or generic setup.
4. Add search, draw, switching, recovery and compatible Tools/Stadiums.
5. Estimate Energy from attack costs, attacker count, acceleration and recovery.
6. Apply meaningful setup, recovery, disruption, damage and Energy variations.
7. Fill to exactly 60, validate construction and runtime support, remove duplicates, score and rank.

Score breakdowns distinguish required-card inclusion, favourite contribution, evolution, Basic count, search, draw, Energy, attack readiness, bench pressure, Prize liability, synergy, recovery and unsupported/dead-card penalties. These are consistency estimates, not win rates.

Reviewed packages and synergy edges explain concrete interactions such as Fire Off to Skeledirge ex, Subjugating Chains to Chain-Crazed, Binding Mochi to Okidogi ex, Rare Candy to Nidoking ex, Darkness Energy to Adrena-Brain and Proton to Team Rocket Basics.

Simulation-ready mode admits only complete, functionally inherited or safely generated cards. Creative mode may use unsupported cards, clearly blocks simulation and exports a strategically ordered Markdown/JSON implementation backlog.

## Simulation and handoff

Quick tests run 20 balanced first/second games per premade opponent. The UI also offers 100 per opponent, exactly 500 total, and a custom per-opponent count. Results include matchup and first/second win rates, mulligans, setup failures, first attack and Knock Out turns, selected-card readiness, Energy starvation, deck-outs, Prizes, loss reasons, card event presence, Ability use and attack use. Small samples retain an uncertainty warning.

Candidates can be saved, favourited, duplicated, opened in Deck Builder, exported with Architect metadata, regenerated from the same seed, played against AI or opened in Simulation Lab.

## Wave 1 coverage snapshot

- Explicit complete exact printings: 63
- Additional complete functional reprints: 405
- Reviewed-template complete printings: 671
- Safely generated exact printings: 1,700
- Simulation-ready exact printings available to Architect: 2,839
- Functional behaviour families: 2,014
- Exact printings containing Abilities: 4,076
- Distinct Ability signatures: 2,607
- Executable Ability signatures: 55
- Unsupported Ability signatures: 1,990 (562 more are partial at the containing-card level)
- Reviewed deck packages: 8

These counts distinguish exact printings from unique functional families. Re-run the reports after catalogue updates rather than treating this snapshot as permanent.

Arcanine `swsh8-33` and Gengar `sv4pt5-57` now produce distinct exact-ID 60-card simulation-ready candidates. Their 300-game deep acceptance batches were deterministic with no unresolved or safety-limit games, but only 13.7% and 13.3% directional win rates respectively; the UI must not present them as competitive lists.

## Acceptance

`npm run acceptance:deck-architect` covers:

- Scenario A: three deterministic PAL 233 candidates, exact ID retained, 60 cards, PAL 37 behavior inherited.
- Scenario B: three Okidogi ex/Pecharunt ex candidates with named Poison synergy and a 60-game, three-deck quick gauntlet.
- Scenario C: an unsupported Ability favourite rejected in simulation-ready mode, allowed only as a blocked creative candidate, with backlog export.
- Scenario D: three simulation-ready candidates around a safely generated fixed/no-text Basic attacker.

Focused tests live in `tests/cards/functional-reprints.test.ts` and `tests/decks/deck-architect.test.ts`.
