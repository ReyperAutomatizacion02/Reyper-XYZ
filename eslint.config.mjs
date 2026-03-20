import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Disable formatting rules that conflict with Prettier
  prettier,

  // Project-specific rules
  {
    rules: {
      // Prevent accidental console.log in production (warn, not error, to avoid blocking builds)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Catch common mistakes
      "no-duplicate-imports": "error",
      "no-template-curly-in-string": "warn",

      // TypeScript-specific
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
