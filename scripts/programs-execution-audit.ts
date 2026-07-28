import { effectProgramRegistry } from "../engine/effects/program-registry";

const entries = Object.values(effectProgramRegistry);
const registryOnly = entries.filter((entry) => !entry.implementationKind || !entry.testReferences.length);
const untested = entries.filter((entry) => !entry.testReferences.length);
const report = {
  totalPrograms: entries.length,
  registryOnly: registryOnly.map((entry) => entry.id),
  untested: untested.map((entry) => entry.id),
  missingLocators: entries.filter((entry) => !entry.implementationLocator).length,
  focusedTestIds: entries.reduce((count, entry) => count + (entry.focusedTestIds?.length ?? 0), 0),
};
console.log(JSON.stringify(report, null, 2));
if (registryOnly.length || untested.length) process.exitCode = 1;
