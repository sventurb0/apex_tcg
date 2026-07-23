import skeledirge from "./skeledirge-armarouge.json";
import nidoking from "./team-rockets-nidoking.json";
import okidogi from "./okidogi-ex-poison.json";
import type { DeckManifest, PremadeSlot } from "../types";

export const premadeDecks = [skeledirge, okidogi, nidoking] as DeckManifest[];
export const premadeSlots: PremadeSlot[] = [
  "Alolan Muk control", "Mega Gengar poison", "Alakazam",
  "Iono’s Bellibolt", "Corviknight VMAX", "Machamp", "Dragapult benchmark",
].map((name) => ({ id: name.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), name, status: "planned" }));
