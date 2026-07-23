import type { StrategicTag } from "../../ability-coverage";

export interface ReviewedTemplateMatch {
  templateId: string;
  programId: string;
  strategicTags: StrategicTag[];
  complexity: "low" | "medium";
  supportedMechanic: string;
  usageLimit?: "once-per-turn-per-pokemon" | "once-per-turn-by-name" | "unrestricted";
  sourceActiveOnly?: boolean;
  sourceBenchedOnly?: boolean;
}

export interface ReviewedTemplateDefinition {
  templateId: string;
  kind: "ability" | "attack" | "trainer" | "energy";
  exactPattern: string;
  strategicTags: StrategicTag[];
  complexity: "low" | "medium" | "high";
  tests: string[];
  notes: string;
}
