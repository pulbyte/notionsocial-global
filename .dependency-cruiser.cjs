// Module boundaries (docs: backend/docs/engineering/CODE-RULES.md, "Module shape").
// A module is a folder src/<module>/; others reach it only through its index.ts.
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Legacy src/*.ts files already import in circles; only module code is held to this.",
      severity: "error",
      from: {path: "^src/[^/]+/"},
      // Type-only imports are erased at build; a cycle through them never runs.
      to: {circular: true, viaOnly: {dependencyTypesNot: ["type-only"]}},
    },
    {
      name: "module-internals",
      comment: "Import another module through its index.ts only.",
      severity: "error",
      from: {path: "^src/([^/]+)/"},
      to: {path: "^src/[^/]+/", pathNot: ["^src/$1/", "^src/[^/]+/index\\.ts$"]},
    },
    {
      name: "legacy-to-module-internals",
      comment: "Legacy files in src/*.ts call a module through its index.ts only.",
      severity: "error",
      from: {path: "^src/[^/]+\\.ts$"},
      to: {path: "^src/[^/]+/", pathNot: "^src/[^/]+/index\\.ts$"},
    },
  ],
  options: {
    doNotFollow: {path: "node_modules"},
    tsPreCompilationDeps: true,
    tsConfig: {fileName: "tsconfig.json"},
    enhancedResolveOptions: {extensions: [".ts", ".js"]},
  },
};
