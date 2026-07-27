# Dragapult Dusknoir implementation matrix

Source snapshots: `28236`, `28259` · runtime status: simulation-ready.

| Surface | Exact runtime evidence | Choice semantics | Acceptance |
|---|---|---|---|
| Dragapult / Dusknoir line | All manifest card IDs resolve to executable runtime definitions | Damage placement and evolution choices are represented as pending choices | 80-game tournament smoke included |
| Dusknoir ability family | Ability legality is checked against board state before exposing an action | No target means the ability is unavailable, never an empty choice | `choices:audit` clean |
