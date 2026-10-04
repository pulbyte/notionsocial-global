import {defineConfig} from "vitest/config";

// Module tests live beside their code in src/<module>/; legacy tests in tests/ stay on jest.
export default defineConfig({test: {include: ["src/*/**/*.test.ts"]}});
