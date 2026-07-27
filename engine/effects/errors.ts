export class MissingEffectProgramError extends Error {
  readonly programId: string;
  readonly sourceCardId: string;
  constructor(programId: string, sourceCardId: string) {
    super(`Missing effect program '${programId}' for source card '${sourceCardId}'.`);
    this.name = "MissingEffectProgramError";
    this.programId = programId;
    this.sourceCardId = sourceCardId;
  }
}
