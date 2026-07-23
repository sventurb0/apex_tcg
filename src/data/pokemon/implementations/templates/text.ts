import { normalizeCardName } from "../../catalogue";
import type { PokemonCardMetadata } from "../../types";

const reminder = /^(you may play (?:any number of|as many) item cards|you may play only 1 supporter card|you may play only 1 stadium card|attach a pokemon tool to 1 of your pokemon)/i;
export function normalizeTemplateText(value: string): string { return normalizeCardName(value).replace(/\s*([.,;:!?])\s*/g, "$1 ").replace(/\s+/g, " ").trim(); }
export function exactCardEffectText(card: PokemonCardMetadata): string {
  const rules = (card.rules ?? []).map(normalizeTemplateText).filter((rule) => rule && !reminder.test(rule));
  if (rules.length) return rules.join(" | ");
  const raw = card.supertype === "Trainer" ? card.trainerText ?? "" : card.energyText ?? "";
  return normalizeTemplateText(raw).split(/(?<=[.!?])\s+/u).filter((sentence) => sentence && !reminder.test(sentence)).join(" ");
}
