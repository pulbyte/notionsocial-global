import {defineConfig} from "vitest/config";

// Module tests live beside their code in src/<module>/; legacy tests in tests/ stay on jest.
// crypto.ts needs an AES key at import; tests use a fixed dummy key.
export default defineConfig({
  test: {
    include: ["src/*/**/*.test.ts"],
    env: {ENCRPT_KEY_VERSION: "0", ENCRYPTION_KEY_V0: "0".repeat(64)},
  },
});
