import { compileCardImplementation, type CatalogueIndex } from "../../data/pokemon";
import { buildCardRoleProfile } from "./card-profile";
import type { SynergyEdge } from "./types";

const reviewed: ReadonlyArray<{ from: string; to: string; score: number; reasons: string[] }> = [
  { from: "sv1-41", to: "sv2-37", score: 10, reasons: ["Fire Off moves Fire Energy to the Active Skeledirge ex attacker."] },
  { from: "sv6pt5-39", to: "sv6pt5-36", score: 10, reasons: ["Subjugating Chains switches Okidogi ex Active and Poisons it for Chain-Crazed."] },
  { from: "sv8pt5-95", to: "sv6pt5-36", score: 9, reasons: ["Binding Mochi adds attack damage while Okidogi ex is Poisoned."] },
  { from: "sv1-191", to: "sv10-119", score: 10, reasons: ["Rare Candy skips Nidorino to establish Nidoking ex earlier."] },
  { from: "sve-7", to: "sv6pt5-72", score: 8, reasons: ["Darkness Energy enables Adrena-Brain."] },
  { from: "sv10-177", to: "sv10-117", score: 9, reasons: ["Proton searches Basic Team Rocket Pokémon, including Nidoran."] },
];

export function buildSynergyGraph(cardIds: readonly string[], index: CatalogueIndex, creative = false): SynergyEdge[] {
  const selected = new Set(cardIds); const edges: SynergyEdge[] = [];
  for (const edge of reviewed) if (selected.has(edge.from) && selected.has(edge.to)) edges.push({ fromCardId: edge.from, toCardId: edge.to, score: edge.score, reasons: edge.reasons, confidence: "reviewed" });
  const cards = cardIds.flatMap((id) => index.byId.get(id) ?? []); const profiles = cards.map((card) => buildCardRoleProfile(card, index));
  for (let left = 0; left < cards.length; left += 1) for (let right = left + 1; right < cards.length; right += 1) {
    const a = cards[left]!, b = cards[right]!, pa = profiles[left]!, pb = profiles[right]!;
    if (a.types?.some((type) => b.types?.includes(type)) && pa.attackCosts.some((cost) => cost >= 2) && (pb.abilityTags.includes("energy-acceleration") || pb.trainerEnergyRoles.includes("energy-search"))) edges.push({ fromCardId: b.id, toCardId: a.id, score: 5, reasons: [`${b.name} supports ${a.name}'s ${a.types?.join("/")} Energy requirements.`], confidence: "derived" });
    if (a.evolvesFrom === b.name || b.evolvesFrom === a.name) edges.push({ fromCardId: a.evolvesFrom === b.name ? b.id : a.id, toCardId: a.evolvesFrom === b.name ? a.id : b.id, score: 8, reasons: ["Cards form a legal evolution chain."], confidence: "derived" });
    if (creative && [a,b].some((card) => !["complete","generated"].includes(compileCardImplementation(card).status))) { const shared = pa.abilityTags.filter((tag) => pb.attackTags.includes(tag)); if (shared.length) edges.push({ fromCardId: a.id, toCardId: b.id, score: 2, reasons: [`Printed text suggests ${shared.join(", ")} synergy; runtime support is incomplete.`], confidence: "inferred" }); }
  }
  return [...new Map(edges.map((edge) => [`${edge.fromCardId}:${edge.toCardId}:${edge.reasons[0]}`, edge])).values()].sort((a, b) => b.score - a.score);
}
