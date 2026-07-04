import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Phase 16B: Prisma 7 generated client is machine-generated, not linted.
    "lib/generated/**",
    // Netlify build output (bundled functions) — build artifact, not source.
    ".netlify/**",
  ]),
]);

export default eslintConfig;
