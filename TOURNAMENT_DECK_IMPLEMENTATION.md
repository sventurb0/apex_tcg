# Tournament Deck Implementation

This wave keeps the checked-in tournament snapshots composition-exact while applying the repository's executable-behaviour gate. A source placement is provenance only; it is not a claim about simulated strength.

## Current gate

- 37 source-attributed snapshots are checked in (37 unique resolved compositions).
- All 37 manifests resolve to exactly 60 cards with zero unresolved printing copies.
- 5 source snapshots are simulation-ready: Rocket's Mewtwo (Jacob Peltier), Dragapult (Jack Moore), N's Zoroark (Benjamin Martinsen), Hydrapple (Ben Dobberstein), and Ogerpon Box (Nicholas Cucinelli). Each is composition-exact, 60 cards, and clears the executable-behaviour gate.
- The existing Skeledirge ex, Okidogi ex Poison, Team Rocket's Nidoking ex, Arcanine and Gengar Wave 1 decks remain the regression baseline.

## Priority implementation backlog

`npm run decks:coverage-plan` ranks missing families by blocked source decks, best placement and blocked copies. The remaining backlog is led by the Lillie's Clefairy, Dragapult Dusknoir, Mega Lucario, Slowking, and Crustle families. No effect is approximated to make a source deck appear ready.

## Verification

Run `npm run acceptance:meta-decks` after changing card behaviour. It validates mandatory source IDs, exact 60-card manifests, printing resolution accounting and the simulation-ready invariant. Runtime gauntlets should only be run for decks that clear that gate; the acceptance command reports blocked decks and their explicit blockers instead of silently substituting cards.

## Next wave

The five promoted decks are covered by `npm run acceptance:tournament-runtime-wave-1`. Continue with the ranked coverage plan, then re-run corpus resolution and promote each additional deck only after its complete 60-card runtime batch passes against Skeledirge, Okidogi, Team Rocket, and a mirror batch.
