# Optional deck import and export

Deck Builder remains the primary workflow. Import accepts quantity plus an untouched card descriptor; it does not guess that the descriptor's last two words are a printing.

Supported examples:

```text
Pokémon (6)
4x Fuecoco PAL 035
2 Skeledirge ex (PAL 037)

Trainer: 2
2 Switch SVI 194

Energy (12)
12 Fire Energy
```

Set aliases accept both public codes (`PAL`) and dataset IDs (`sv2`). Numeric collector numbers ignore leading zeroes and optional `/set-total` suffixes; alphanumeric values such as `TG01/TG30` retain their meaningful prefix and zeroes.

## Name-only resolution

Name-only candidates are grouped by a gameplay signature that excludes set, collector number, rarity and other cosmetic identity. One gameplay variant resolves automatically. Multiple genuinely different variants remain ambiguous and are shown as one selectable representative per variant.

Within a gameplay variant, the preferred printing policy is stable:

1. Standard legal, then Expanded legal.
2. Regular main-set printing before promos or known cosmetic rarities.
3. Newest release date.
4. Lowest collector number and canonical ID as deterministic tie-breakers.

The upstream rarity field is not perfectly consistent across eras, so legacy printing selection also relies on deterministic set/date/number ordering. Users can optionally select another cosmetic printing without blocking import.

## Basic Energy

`Fire Energy` and `Basic Fire Energy`—and the equivalent Grass, Water, Lightning, Psychic, Fighting, Darkness and Metal names—resolve to the configured regular Scarlet & Violet Energies printings `sve-1` through `sve-8`. Exact IDs live centrally in `src/data/pokemon/catalogue.ts`.

The catalogue build infers a type only for verified Basic Energy names. It never infers Special Energy behaviour from a name.

## Saving and reports

Card identity, construction and simulation support are independent. A 20-card deck or a deck with unsupported effects can be saved and opened in Deck Builder. Parser errors, unknown identities and unresolved gameplay variants are the only import-save blockers.

Exports always include the selected exact name, set code and collector number, and automated round-trip coverage verifies that IDs and quantities survive re-import.
