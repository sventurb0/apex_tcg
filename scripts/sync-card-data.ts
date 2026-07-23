import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { DATASET_ROOT } from "./card-data-utils";

const repository = "https://github.com/PokemonTCG/pokemon-tcg-data.git";

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

function git(args: string[], cwd?: string): void {
  const result = spawnSync("git", args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
}

if (!(await exists(`${DATASET_ROOT}/.git`))) {
  await mkdir(dirname(DATASET_ROOT), { recursive: true });
  git(["clone", "--depth", "1", "--filter=blob:none", "--sparse", repository, DATASET_ROOT]);
  git(["sparse-checkout", "set", "cards/en", "sets"], DATASET_ROOT);
} else {
  git(["pull", "--ff-only"], DATASET_ROOT);
  git(["sparse-checkout", "set", "cards/en", "sets"], DATASET_ROOT);
}

console.log(`Pokémon TCG source data is current at ${DATASET_ROOT}.`);
console.log("Run npm run cards:build to regenerate the local text-only catalogue.");
