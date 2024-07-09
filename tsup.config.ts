import {defineConfig} from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    clean: true,
    name: "notionsocial-global",
    format: ["cjs", "esm"],
  },
  {
    entry: ["src/browser.ts"],
    format: ["esm"],
    outDir: "dist",
    dts: true,
    clean: false,
    platform: "browser",
  },
]);
