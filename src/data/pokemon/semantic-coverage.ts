import type { CardDefinition } from "../../../engine/model/cards";
import type { CardImplementation, PokemonCardMetadata } from "./types";
import { isRegisteredEffectProgram } from "../../../engine/effects/program-registry";

export type SemanticClauseKind = "ability" | "attack" | "rule" | "trainer" | "energy";

export interface SemanticClause {
  id: string;
  kind: SemanticClauseKind;
  name: string;
  text: string;
}

export interface PrintedAbilityClause extends SemanticClause { kind: "ability"; }
export interface PrintedAttackClause extends SemanticClause { kind: "attack"; damage: string; effectText: string; }
export interface PrintedEffectClause extends SemanticClause { kind: "trainer" | "energy"; }
export interface RuntimeClauseBinding {
  id: string;
  kind: SemanticClauseKind;
  name: string;
  programId?: string;
  damageFormula?: boolean;
  text?: string;
  reviewed?: boolean;
}

export interface CardSemanticCoverage {
  cardId: string;
  behaviourFamilyId: string;
  printed: {
    abilities: PrintedAbilityClause[];
    attacks: PrintedAttackClause[];
    rules: SemanticClause[];
    trainerClauses: PrintedEffectClause[];
    energyClauses: PrintedEffectClause[];
  };
  runtime: {
    abilities: RuntimeClauseBinding[];
    attacks: RuntimeClauseBinding[];
    rules: RuntimeClauseBinding[];
    trainerClauses: RuntimeClauseBinding[];
    energyClauses: RuntimeClauseBinding[];
  };
  unmatchedPrintedClauses: SemanticClause[];
  orphanRuntimeHandlers: RuntimeClauseBinding[];
  choiceSemantics: "exact" | "deterministic-no-choice" | "requires-review";
  complete: boolean;
}

const nonEmpty = (value: string | undefined): string => value?.trim() ?? "";

function isUniversalRule(text: string): boolean {
  return /You may play any number of Item cards during your turn\./i.test(text)
    || /You may play only 1 Supporter card during your turn\./i.test(text)
    || /You may play only 1 Stadium card during your turn\./i.test(text)
    || /(?:Pokémon|Pokemon) ex rule: when your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards\./i.test(text)
    || /Mega Evolution Pokémon ex Rule: when your Mega Evolution Pokémon ex is Knocked Out, your opponent takes 3 Prize cards\./i.test(text)
    || /^Tera:/i.test(text)
    || /ACE SPEC/i.test(text);
}

export function printedClauses(card: PokemonCardMetadata): CardSemanticCoverage["printed"] {
  const abilities = (card.abilities ?? []).map((ability, index) => ({ id: `${card.id}:ability:${index}`, kind: "ability" as const, name: ability.name, text: ability.text }));
  const attacks = (card.attacks ?? []).map((attack, index) => ({ id: `${card.id}:attack:${index}`, kind: "attack" as const, name: attack.name, text: attack.text, damage: attack.damage, effectText: nonEmpty(attack.text) }));
  const trainerText = nonEmpty(card.trainerText);
  const rules = [...new Set([...(card.rules ?? []), ...(card.ruleBoxText ?? [])].filter(nonEmpty))]
    // Trainer metadata commonly repeats the complete effect in both rules and
    // trainerText. The card-specific trainer binding is the single source of
    // truth; universal play/deck rules are handled globally.
    .filter((text) => card.supertype !== "Trainer" || !trainerText || !trainerText.includes(text))
    .map((text, index) => ({ id: `${card.id}:rule:${index}`, kind: "rule" as const, name: "Rule", text }));
  const trainerClauses = card.supertype === "Trainer" && nonEmpty(card.trainerText) ? [{ id: `${card.id}:trainer:0`, kind: "trainer" as const, name: card.name, text: card.trainerText! }] : [];
  const energyClauses = card.supertype === "Energy" && nonEmpty(card.energyText) ? [{ id: `${card.id}:energy:0`, kind: "energy" as const, name: card.name, text: card.energyText! }] : [];
  return { abilities, attacks, rules, trainerClauses, energyClauses };
}

function runtimeBindings(card: PokemonCardMetadata, runtime: CardDefinition | null): CardSemanticCoverage["runtime"] {
  if (!runtime) return { abilities: [], attacks: [], rules: [], trainerClauses: [], energyClauses: [] };
  if (runtime.category === "pokemon") {
    return {
      abilities: runtime.abilities.map((ability) => ({ id: `${card.id}:ability:${ability.name}`, kind: "ability", name: ability.name, programId: ability.effectProgramId })),
      attacks: runtime.attacks.map((attack) => ({ id: `${card.id}:attack:${attack.name}`, kind: "attack", name: attack.name, programId: attack.effectProgramId, damageFormula: attack.damage.kind === "formula" })),
      rules: printedClauses(card).rules.map((rule) => ({ id: `${card.id}:rule:${rule.id}`, kind: "rule" as const, name: "Rule", text: rule.text, reviewed: isUniversalRule(rule.text) || runtime.hasRuleBox })),
      trainerClauses: [],
      energyClauses: [],
    };
  }
  if (runtime.category === "trainer") return { abilities: [], attacks: [], rules: printedClauses(card).rules.map((rule) => ({ id: `${card.id}:rule:${rule.id}`, kind: "rule" as const, name: "Rule", text: rule.text, reviewed: isUniversalRule(rule.text) })), trainerClauses: [{ id: `${card.id}:trainer:runtime`, kind: "trainer", name: card.name, programId: runtime.effectProgramId }], energyClauses: [] };
  return { abilities: [], attacks: [], rules: printedClauses(card).rules.map((rule) => ({ id: `${card.id}:rule:${rule.id}`, kind: "rule" as const, name: "Rule", text: rule.text, reviewed: isUniversalRule(rule.text) || Boolean(runtime.effectProgramId) })), trainerClauses: [], energyClauses: [{ id: `${card.id}:energy:runtime`, kind: "energy", name: card.name, programId: runtime.effectProgramId ?? card.id, reviewed: card.subtypes.includes("Basic") }] };
}

function matchByName(printed: SemanticClause[], runtime: RuntimeClauseBinding[]): SemanticClause[] {
  const consumed = new Set<number>();
  return printed.filter((clause) => {
    const index = runtime.findIndex((binding, candidateIndex) => !consumed.has(candidateIndex) && binding.name.toLocaleLowerCase("en-US") === clause.name.toLocaleLowerCase("en-US"));
    if (index < 0) return true;
    consumed.add(index);
    return false;
  });
}

function matchRules(printed: SemanticClause[], runtime: RuntimeClauseBinding[]): SemanticClause[] {
  const consumed = new Set<number>();
  return printed.filter((clause) => {
    const index = runtime.findIndex((binding, candidateIndex) => !consumed.has(candidateIndex) && binding.reviewed && binding.text === clause.text);
    if (index < 0) return true;
    consumed.add(index);
    return false;
  });
}

export function buildCardSemanticCoverage(card: PokemonCardMetadata, runtime: CardDefinition | null, implementation: CardImplementation, programIds: ReadonlySet<string>, reviewedAttackNames: ReadonlySet<string> = new Set()): CardSemanticCoverage {
  const printed = printedClauses(card);
  const bound = runtimeBindings(card, runtime);
  const unmatched: SemanticClause[] = [];
  unmatched.push(...matchByName(printed.abilities, bound.abilities));
  unmatched.push(...printed.attacks.filter((attack) => attack.effectText && !bound.attacks.some((binding) => binding.name.toLocaleLowerCase("en-US") === attack.name.toLocaleLowerCase("en-US") && (binding.programId || binding.damageFormula || reviewedAttackNames.has(`${card.id}:${attack.name}`)))).map((attack) => ({ id: attack.id, kind: "attack" as const, name: attack.name, text: attack.text })));
  unmatched.push(...matchRules(printed.rules, bound.rules));
  unmatched.push(...matchByName(printed.trainerClauses, bound.trainerClauses));
  unmatched.push(...matchByName(printed.energyClauses, bound.energyClauses));
  const allRuntime = [...bound.abilities, ...bound.attacks, ...bound.rules, ...bound.trainerClauses, ...bound.energyClauses];
  const orphanRuntimeHandlers = allRuntime.filter((binding) => binding.programId && !programIds.has(binding.programId) && !isRegisteredEffectProgram(binding.programId) && !binding.reviewed);
  const hasMeaningfulChoice = printed.abilities.length > 0 || printed.attacks.some((attack) => attack.effectText) || printed.trainerClauses.length > 0 || printed.energyClauses.length > 0;
  const runtimeProgramsKnown = allRuntime.length > 0 && allRuntime.every((binding) => !binding.programId || programIds.has(binding.programId) || isRegisteredEffectProgram(binding.programId) || binding.damageFormula || binding.reviewed);
  const choiceSemantics = card.supertype === "Energy" && card.subtypes.includes("Basic") || !hasMeaningfulChoice ? "deterministic-no-choice" : implementation.choiceSemantics ?? (runtimeProgramsKnown ? "exact" : "requires-review");
  return { cardId: card.id, behaviourFamilyId: implementation.behaviourFamilyId ?? `unimplemented:${card.id}`, printed, runtime: bound, unmatchedPrintedClauses: unmatched, orphanRuntimeHandlers, choiceSemantics, complete: unmatched.length === 0 && orphanRuntimeHandlers.length === 0 && choiceSemantics !== "requires-review" };
}
