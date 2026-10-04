// Strict type check for modules in src/<module>/ only (CODE-RULES.md, "Enforcement").
// tsc has no per-folder strict mode, so check everything strictly and keep module errors;
// flat legacy files in src/*.ts keep their loose config until their logic moves.
import {spawnSync} from "node:child_process";

const run = spawnSync(
  "npx",
  ["tsc", "-p", "tsconfig.modules.json", "--pretty", "false"],
  {encoding: "utf8"},
);
// A config error has no file path; it would hide every module error, so it fails the check too.
const configErrors = run.stdout.split("\n").filter((line) => line.startsWith("error TS"));
const moduleErrors = run.stdout.split("\n").filter((line) => /^src\/[^/]+\/.+\(\d+,\d+\): error/.test(line));

for (const line of [...configErrors, ...moduleErrors]) console.error(line);
console.log(`check-types: ${moduleErrors.length} error(s) in module code`);
process.exit(configErrors.length || moduleErrors.length ? 1 : 0);
