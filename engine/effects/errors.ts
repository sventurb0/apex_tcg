export class MissingEffectProgramError extends Error {
  readonly programId: string;
  readonly sourceCardId: string;
  turn?: number;
  actingPlayerId?: string;
  actionHistory?: readonly unknown[];
  constructor(programId: string, sourceCardId: string) {
    super(`Missing effect program '${programId}' for source card '${sourceCardId}'.`);
    this.name = "MissingEffectProgramError";
    this.programId = programId;
    this.sourceCardId = sourceCardId;
  }
}
