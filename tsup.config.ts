import {dev, prod} from "./src/env";
import {defineConfig} from "tsup";

export default defineConfig({
  // watch: dev,
  entry: ["src/index.ts"],
  dts: true,
  name: "notionsocial-global",
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  // splitting: true, // Enable splitting
  // clean: true,
  // skipNodeModulesBundle: true,
  // outDir: "dist",
  // minify: true,
  // bundle: prod,
  // Generate declaration file (.d.ts)
});
