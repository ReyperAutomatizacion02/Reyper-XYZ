import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Disable formatting rules that conflict with Prettier
  prettier,

  // Degrade pre-existing legacy errors to warnings so they don't block commits.
  // These will be fixed progressively — treating them as errors would block
  // all development work on a large existing codebase.
  {
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],

      // React
      "react/no-children-prop": "warn",
      "react/no-unescaped-entities": "warn",

      // React Hooks (includes React Compiler rules)
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",

      // General JS
      "no-use-before-define": "warn",
      "no-duplicate-imports": "warn",
      "prefer-const": "warn",
      "no-template-curly-in-string": "warn",

      // Allow console.log in scripts; warn elsewhere
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Scripts can use console.log freely
  { files: ["scripts/**/*.ts"], rules: { "no-console": "off" } },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
