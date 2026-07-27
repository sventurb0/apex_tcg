# Metagross implementation matrix

Source snapshot: `28423` · runtime status: simulation-ready.

| Surface | Exact runtime evidence | Choice semantics | Acceptance |
|---|---|---|---|
| Metagross line | Metallic Hammer and supporting Metal cards resolve from exact IDs | Attack damage and optional discard branches are represented in the reducer | 80-game tournament smoke included |
| Metal acceleration | Energy effects preserve selected physical instances | No discard target leaves no pending choice | `choices:audit` clean |
