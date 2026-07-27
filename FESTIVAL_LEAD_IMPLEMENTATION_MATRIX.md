# Festival Lead implementation matrix

Source snapshot: `28371` · runtime status: simulation-ready.

| Surface | Exact runtime evidence | Choice semantics | Acceptance |
|---|---|---|---|
| Festival Lead family | Festival Pokémon, Stadium, and support cards compile from the exact manifest | Stadium/search branches expose only matching cards | 80-game tournament smoke included |
| Festival energy engine | Shared energy handlers preserve selected card identity | No eligible card produces no pending choice | `choices:audit` clean |
