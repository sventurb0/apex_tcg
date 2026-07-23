import type { ReviewedTemplateDefinition } from "../templates/types";
export const wave1AttackTemplates: ReviewedTemplateDefinition[] = [
  { templateId: "attack-apply-special-condition", kind: "attack", exactPattern: "The Defending/Active Pokémon is now CONDITION.", strategicTags: ["special-condition"], complexity: "low", tests: ["tests/cards/wave-1-templates.test.ts"], notes: "Condition is applied only if the target survives attack damage." },
  { templateId: "attack-draw-fixed", kind: "attack", exactPattern: "Draw N cards.", strategicTags: ["draw"], complexity: "low", tests: ["tests/cards/wave-1-templates.test.ts"], notes: "Runs after attack damage and before final turn completion." },
  { templateId: "attack-heal-self-fixed", kind: "attack", exactPattern: "Heal N damage from this Pokémon.", strategicTags: ["healing"], complexity: "low", tests: ["tests/cards/wave-1-templates.test.ts"], notes: "Heals only the exact attacker." },
  { templateId: "attack-recoil-fixed", kind: "attack", exactPattern: "This Pokémon also does N damage to itself.", strategicTags: ["primary-attacker"], complexity: "low", tests: ["tests/cards/wave-1-templates.test.ts"], notes: "Self damage resolves before the shared KO checkpoint." },
];
