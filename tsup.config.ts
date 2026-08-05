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
    noExternal: [],
    treeshake: true,
    splitting: false,
  },
  {
    entry: ["src/browser.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    dts: true,
    clean: false,
    platform: "browser",
    external: [
      "net",
      "http",
      "https",
      "dns",
      "url-metadata",
      "@pulbyte/social-stack-lib",
      "firebase-admin",
      "sharp",
      "@google-cloud/storage",
    ],
  },
  {
    // Lightweight paypal-only entry (plan ids + pricing): safe for edge
    // runtimes (Cloudflare Workers) that can't load the full browser bundle's
    // node-builtin dependencies (e.g. twitter-text → node:punycode).
    entry: ["src/paypal.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    dts: true,
    clean: false,
    platform: "neutral",
    treeshake: true,
    external: ["@pulbyte/social-stack-lib"],
  },
]);
