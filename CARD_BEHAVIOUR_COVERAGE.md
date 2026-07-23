# Card Behaviour Coverage Factory

DeckLab keeps exact catalogue identity separate from executable behaviour. The Coverage Factory indexes exact Ability, attack-effect, Trainer-effect and Special Energy signatures, then relates them to behaviour families, functional reprints, premade/saved decks, Deck Architect candidates and the favourite-Pokémon list.

## Architecture

- `src/data/pokemon/coverage/signature-index.ts` creates deterministic normalized signature catalogues. Attack identity includes name, printed damage, exact effect text and cost shape.
- `prioritizer.ts` scores unsupported families by printing/name/reprint reach, Standard legality, deck/favourite references, reusable primitives and complexity.
- `favourite-card-audit.ts` inspects every exact gameplay variant of the 17 seeded favourites.
- `coverage-report.ts` reports printing, behaviour-family and signature status without conflating those units.
- `src/data/pokemon/implementations/templates/` contains strict full-text matchers. `batches/` is the reviewable Wave source of truth.
- `engine/effects/program-runner.ts` executes captured parameters through deterministic choices, exact targets and shared KO checkpoints.

## Exactness policy

A reviewed template must consume the full normalized non-reminder effect text. All values, categories, targets, timing restrictions and optional selections are explicit. An unmatched extra clause rejects the template. Strategic tags and prioritization inference never grant runtime support. A card with any unsupported Ability, attack, rule or effect remains partial or unsupported.

## Commands

```bash
npm run abilities:report
npm run attacks:report
npm run effects:report
npm run coverage:plan
npm run coverage:report
npm run acceptance:coverage-wave-1
```

Generated diagnostics live under `public/data/`; the in-app Development page rebuilds the same indexes and exposes type, status, complexity, format, favourite, saved/premade deck, strategic-role and printing-count filters.

## Adding Wave 2

1. Select a ranked low/medium family from `coverage:plan` and inspect all exact occurrences.
2. Add a full-text anchored matcher and a reviewable batch definition with examples, tests and limitations.
3. Add only the required typed engine primitive, including legal-action gating, deterministic RNG, choices, durations and KO checkpoints.
4. Add positive, near-match rejection, targeting/timing and functional-reprint tests.
5. Regenerate reports and run the full acceptance suite. Never lower a matcher boundary to reach a count.

High-complexity work intentionally remains unavailable: copied attacks, broad continuous modifiers, multi-target distribution, complex historical Pokémon Powers, Tool/Stadium lifecycle variants, Prize-conditioned formulas and most Special Energy restrictions/passives.
