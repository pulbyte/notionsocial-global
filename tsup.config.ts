import {defineConfig} from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    clean: true,
    name: "notionsocial-global",
    format: ["cjs", "esm"],
    platform: "node",
    external: ["@pulbyte/social-stack-lib", "firebase-admin", "sharp"],
  },
  {
    entry: ["src/browser.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    dts: true,
    clean: false,
    platform: "browser",
    external: ["net", "http", "https", "dns", "@pulbyte/social-stack-lib", "firebase-admin", "sharp"],
  },
]);
