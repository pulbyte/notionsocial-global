import {createRequire} from "node:module";
import {defineConfig} from "vitest/config";

const require = createRequire(import.meta.url);

// Module tests live beside their code in src/<module>/; legacy tests in tests/ stay on jest.
// crypto.ts needs an AES key at import; tests use a fixed dummy key.
// social-stack-lib's ESM build calls require() and fails under vitest; tests load its CJS build.
export default defineConfig({
  resolve: {alias: {"@pulbyte/social-stack-lib": require.resolve("@pulbyte/social-stack-lib")}},
  test: {
    include: ["src/*/**/*.test.ts"],
    env: {ENCRPT_KEY_VERSION: "0", ENCRYPTION_KEY_V0: "0".repeat(64)},
  },
});
