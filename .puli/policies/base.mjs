import tanstackQuery from "@tanstack/eslint-plugin-query";
import n from "eslint-plugin-n";
import noSecrets from "eslint-plugin-no-secrets";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import regexp from "eslint-plugin-regexp";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";

import { hasTsconfig, tsconfigRootDir, typedRules } from "./environment.mjs";
import {
  restrictedSyntaxRule,
  restrictedSyntaxSelectors,
} from "./restricted-syntax.mjs";

const baseRuntimeRules = {
  ...typedRules,
  "@tanstack/query/exhaustive-deps": "error",
  "@tanstack/query/no-rest-destructuring": "warn",
  "@tanstack/query/no-unstable-deps": "error",
  "@tanstack/query/stable-query-client": "error",
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      minimumDescriptionLength: 8,
      "ts-check": false,
      "ts-expect-error": "allow-with-description",
      "ts-ignore": true,
      "ts-nocheck": true,
    },
  ],
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { fixStyle: "separate-type-imports" },
  ],
  "@typescript-eslint/no-empty-object-type": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/prefer-nullish-coalescing": hasTsconfig ? "warn" : "off",
  "@typescript-eslint/prefer-optional-chain": hasTsconfig ? "warn" : "off",
  "@typescript-eslint/require-await": hasTsconfig ? "error" : "off",
  "array-callback-return": "error",
  complexity: ["warn", 10],
  "consistent-return": "error",
  curly: ["error", "all"],
  eqeqeq: ["error", "smart"],
  "guard-for-in": "error",
  "max-depth": ["error", 4],
  "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "warn",
    { max: 90, skipBlankLines: true, skipComments: true },
  ],
  "max-params": ["warn", 4],
  "n/no-missing-import": "off",
  "n/no-process-env": "warn",
  "no-alert": "error",
  "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  "no-eval": "error",
  "no-implicit-coercion": ["error", { allow: ["!!"] }],
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-param-reassign": ["error", { props: true }],
  "no-promise-executor-return": "error",
  "no-restricted-syntax": restrictedSyntaxRule(
    "warn",
    restrictedSyntaxSelectors.jsonParseBoundary
  ),
  "no-secrets/no-secrets": "warn",
  "no-template-curly-in-string": "error",
  "no-unmodified-loop-condition": "error",
  "no-unreachable-loop": "error",
  "no-unsanitized/method": "error",
  "no-unsanitized/property": "error",
  "no-unused-private-class-members": "error",
  "no-use-before-define": "off",
  "object-shorthand": "error",
  "prefer-const": "error",
  "prefer-template": "error",
  "regexp/no-super-linear-backtracking": "error",
  "regexp/no-useless-escape": "warn",
  "require-atomic-updates": "error",
  "security/detect-child-process": "warn",
  "security/detect-non-literal-fs-filename": "warn",
  "security/detect-non-literal-regexp": "warn",
  "security/detect-object-injection": "warn",
  "sonarjs/cognitive-complexity": ["warn", 12],
  "sonarjs/no-duplicate-string": "warn",
  "unicorn/consistent-function-scoping": "warn",
  "unicorn/no-array-for-each": "off",
  "unicorn/no-null": "off",
  "unicorn/prefer-module": "off",
  "unicorn/prevent-abbreviations": "off",
};

export function baseRuntimePolicy() {
  return {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
      parserOptions: hasTsconfig
        ? {
            projectService: {
              allowDefaultProject: ["*.mjs", "scripts/*.mjs"],
            },
            tsconfigRootDir,
          }
        : {},
      sourceType: "module",
    },
    plugins: {
      "@tanstack/query": tanstackQuery,
      n,
      "no-secrets": noSecrets,
      "no-unsanitized": noUnsanitized,
      regexp,
      security,
      sonarjs,
      unicorn,
    },
    rules: baseRuntimeRules,
  };
}
