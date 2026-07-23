import type { PrintedAttack } from "../../../types";
import { normalizeTemplateText } from "../text";
import type { ReviewedTemplateMatch } from "../types";

const conditionMap: Record<string, string> = { poisoned: "poisoned", burned: "burned", confused: "confused", asleep: "asleep", paralyzed: "paralyzed" };
export function matchWave1Attack(attack: PrintedAttack): ReviewedTemplateMatch | undefined {
  const text = normalizeTemplateText(attack.text);
  let match = text.match(/^(?:your opponent's active pokemon|the defending pokemon) is now (poisoned|burned|confused|asleep|paralyzed)\.?$/i);
  if (match) { const condition = conditionMap[match[1]!.toLowerCase()]!; return { templateId: "attack-apply-special-condition", programId: `template:attack:condition:${condition}`, strategicTags: ["special-condition", ...(condition === "poisoned" ? ["poison" as const] : [])], complexity: "low", supportedMechanic: `Apply ${condition} after damage if the target remains in play` }; }
  match = text.match(/^draw (?:a|1) card\.?$/i);
  if (match) return { templateId: "attack-draw-fixed", programId: "template:attack:draw-fixed:1", strategicTags: ["draw"], complexity: "low", supportedMechanic: "Draw exactly 1 card after damage" };
  match = text.match(/^draw (\d+) cards?\.?$/i);
  if (match) return { templateId: "attack-draw-fixed", programId: `template:attack:draw-fixed:${match[1]}`, strategicTags: ["draw"], complexity: "low", supportedMechanic: `Draw exactly ${match[1]} cards after damage` };
  match = text.match(/^heal (\d+) damage from this pokemon\.?$/i);
  if (match) return { templateId: "attack-heal-self-fixed", programId: `template:attack:heal-self:${match[1]}`, strategicTags: ["healing"], complexity: "low", supportedMechanic: `Heal exactly ${match[1]} damage from the attacker` };
  match = text.match(/^this pokemon also does (\d+) damage to itself\.?$/i);
  if (match) return { templateId: "attack-recoil-fixed", programId: `template:attack:recoil:${match[1]}`, strategicTags: ["primary-attacker"], complexity: "low", supportedMechanic: `Place exactly ${match[1]} recoil damage on the attacker before the KO checkpoint` };
  return undefined;
}
