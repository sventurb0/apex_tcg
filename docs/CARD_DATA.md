# Card data

The development-time source is the raw English JSON in [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data). `npm run cards:sync` maintains a shallow sparse checkout in `.cache/pokemon-tcg-data`; this cache is excluded from version control.

`npm run cards:build` combines 174 per-set card files with `sets/en.json`, removes artwork and unrelated collection metadata, and writes one local compact catalogue to `public/data/pokemon-cards.json`.

The compact schema retains canonical source ID, English name, set ID/name/code, collector number, supertypes/subtypes, HP, type, stage/evolution, Abilities, attacks and costs, damage/effect text, Weakness, Resistance, retreat, Trainer/Energy/rule-box text, regulation mark and legalities.

Because the upstream SVE records omit `types` on many Basic Energy printings, catalogue generation assigns exactly one Energy type only when the English name is one of the verified ordinary Basic Energy names. Catalogue validation rejects a Basic Energy record without exactly one valid type.

Metadata is independent of executable behaviour. Every catalogue record can be displayed, searched, added, saved, exported and construction-validated. `compileCardImplementation` separately reports `complete`, `generated`, `partial` or `unsupported` for game launch.

No card artwork or image URL is emitted into the generated catalogue.
