# Pokémon TCG DeckLab

Pokémon TCG DeckLab is a private, local deck builder, human-versus-AI game and AI simulation lab. The normal workflow is:

```text
Open Deck Builder → search the catalogue → add cards → save or duplicate → play or simulate when supported
```

Deck construction is never blocked by missing executable effects. The exactness gate applies only when a game or simulation is launched.

## Included

- 20,444 English exact-printing records generated from `PokemonTCG/pokemon-tcg-data` commit `8b4e387930ead7be6595b4d4c59b7ba7a3a79f08`.
- Text, attack, Ability, type, stage, set, regulation, legality, rule-box and simulation-support filters.
- Exact upstream small/large image URLs with lazy thumbnails, hybrid/text/image display modes, large-card details and resilient text fallbacks. No artwork is downloaded or bundled.
- Deck quantities, grouping, undo/redo, construction diagnostics, formats and local persistent saving.
- Rename, favourite, duplicate, delete, import and export workflows.
- Three supplied 60-card premades: Skeledirge ex / Armarouge, Okidogi ex Poison and Team Rocket's Nidoking ex.
- Skeledirge ex / Armarouge, Okidogi ex Poison and Team Rocket's Nidoking ex are exact-runtime-ready for human play, deck-specific heuristic AI and deterministic Worker simulations.
- Human/AI and Worker simulation selectors automatically include decks once all required exact-printing effects are complete or safely generated.
- Development diagnostics and exact missing-effect reports kept outside the primary workflow.
- A Card Behaviour Coverage Factory with strict Ability/attack/Trainer templates, ranked implementation planning, favourite audits and a filterable Development dashboard.
- Experimental exact 60-card Arcanine and Gengar Architect candidates that are human-playable, AI-playable and simulation-ready (with explicit weak-performance warnings).

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Card-data pipeline

```bash
npm run cards:sync       # clone/update raw English JSON under .cache/
npm run cards:build      # generate public/data/pokemon-cards.json
npm run cards:validate   # validate every compact record
npm run cards:report     # exact premade simulation-effect gaps
npm run abilities:report # exact Ability signature coverage
npm run attacks:report   # exact attack-effect signature coverage
npm run effects:report   # Trainer and Special Energy coverage
npm run coverage:plan    # ranked unsupported-family plan
npm run coverage:report  # exact coverage snapshot and favourite audit
```

The React application reads the generated local JSON. It does not call a card API when opening. Image metadata preserves the pinned upstream HTTPS URLs and the UI loads only allow-listed `images.pokemontcg.io` assets on demand.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx tsx scripts/verify-okidogi-acceptance.ts
npm run acceptance:team-rocket
npm run acceptance:deck-architect
npm run acceptance:coverage-wave-1
```

## Architecture

- `public/data/pokemon-cards.json`: generated compact catalogue.
- `scripts/`: dataset sync, build, validation and missing-effect reporting.
- `src/data/decks/premade/`: editable exact-ID deck manifests.
- `src/data/pokemon/`: catalogue types/loading, runtime adapter, reusable effect compiler and explicit overrides.
- `src/data/pokemon/coverage/`: exact signature indexes, prioritizer, reports and favourite audit.
- `src/data/pokemon/implementations/templates/` and `batches/`: reviewed full-text template matchers and explicit Wave source.
- `src/features/deck-builder/`: visual builder, validation and persistent browser storage.
- `src/features/deck-import/`: optional set-code/name importer.
- `engine/`: framework-independent reducer, rules, AI and deterministic simulations.
- `engine/effects/program-runner.ts`: exact effect programs with engine-owned multi-step selections and continuation state.
- `engine/model/cards.ts`: multiple executable Abilities and typed fixed/none/formula attack damage.
- `src/workers/`: preserved batch-simulation Worker.
- `tests/fixtures/`: fictional data used only for isolated engine regression tests.

See [docs/CARD_DATA.md](docs/CARD_DATA.md), [docs/ACCURACY_POLICY.md](docs/ACCURACY_POLICY.md), [docs/DECK_IMPORT.md](docs/DECK_IMPORT.md), and [CARD_IMPLEMENTATION.md](CARD_IMPLEMENTATION.md).

Coverage-specific design and results are documented in [CARD_BEHAVIOUR_COVERAGE.md](CARD_BEHAVIOUR_COVERAGE.md), [COVERAGE_WAVE_1.md](COVERAGE_WAVE_1.md), and [FAVOURITE_CARD_COVERAGE.md](FAVOURITE_CARD_COVERAGE.md).

The engine records structured gameplay events independently from the human-readable action log. Setup placement, search/recovery selections, attack effects, Pokémon Checkup, Knock Outs, Prize choices and promotion all use the same legal-action API for humans and AI.
