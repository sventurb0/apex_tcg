# Roadmap

## Product foundations — complete

- Full local English text catalogue generated from structured upstream JSON.
- First-class searchable Deck Builder with detailed filters and printed-card drawer.
- Persistent saved decks, favourites, rename/edit, duplication, deletion, import and export.
- Three supplied canonical-ID 60-card premade manifests plus planned slots.
- Construction validation independent from simulation support.
- Play and Simulation Lab selectors backed by the existing reducer, AI and Worker architecture.
- Exact pinned upstream image metadata, allow-listed lazy loading, text fallbacks, scoped match prefetching and user-selectable hybrid/image/text play presentation.

## First executable deck — complete

- All 20 exact printings and 60 copies in Skeledirge ex / Armarouge convert to runtime definitions.
- Multiple executable Abilities use explicit category, usage-limit, targeting and program references; printed Abilities without handlers never become legal actions.
- Attack damage supports no damage, fixed damage and named formulas. Burning Voice resolves `max(0, 270 - current damage)` before Weakness and Resistance.
- Engine-owned continuation choices cover deck/discard/hand selection, revealed subsets, Pokémon targets, optional selections, exact costs and Klara mode selection.
- Setup supports Active, up to five Benched Basics, explicit completion and optional mulligan bonus draws.
- Attack completion now flows through effects, reusable Knock Out checkpoints, Prizes, promotion and integrated Pokémon Checkup.
- Structured events support future simulation metrics without parsing display strings.
- A 100-game deterministic Skeledirge mirror acceptance batch has zero unresolved games.

## Simulation breadth — complete for supplied decks

- Okidogi ex Poison is the second complete deck: 23 exact printings and 60 runtime copies, reusable passives/triggers, temporary locks, continuous modifiers, KO causes and deck-specific AI.
- Its deterministic acceptance gate runs 100 balanced games against Skeledirge and 100 mirrors with replay equality and unresolved/numeric safety checks.
- Team Rocket's Nidoking ex is the third complete deck: 22 exact printings and 60 runtime copies with shared traits, restricted flexible two-unit Energy, enhanced Poison, Rare Candy, conditional Supporters, Factory and deck-specific AI.
- Its deterministic acceptance gate runs 100 games against Skeledirge, 100 against Okidogi and 100 mirrors; required deck paths are exercised with zero unresolved or invalid-numeric games and exact replay equality.

## Simulation breadth — next

- Close advanced simultaneous Knock Out and tiebreak gaps.
- Expand exact runtime support beyond the three supplied decks using `npm run cards:report` as the prioritized backlog.

Use `npm run cards:report` as the prioritized exact effect backlog for the supplied decks.
