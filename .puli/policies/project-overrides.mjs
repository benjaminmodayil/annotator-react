import tseslint from "typescript-eslint";

const currentCodebaseBaselineRules = {
  "@typescript-eslint/consistent-type-definitions": "off",
  "@typescript-eslint/no-deprecated": "off",
  "@typescript-eslint/no-confusing-void-expression": "off",
  "@typescript-eslint/no-misused-promises": "off",
  complexity: "off",
  "consistent-return": "off",
  "jsx-a11y/no-autofocus": "off",
  "jsx-a11y/prefer-tag-over-role": "off",
  "perfectionist/sort-sets": "off",
  "react-hooks/exhaustive-deps": "off",
  "react-hooks/refs": "off",
  "react-hooks/set-state-in-effect": "off",
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/non-nullable-type-assertion-style": "off",
  "@typescript-eslint/no-unnecessary-condition": "off",
  "@typescript-eslint/prefer-nullish-coalescing": "off",
  "@typescript-eslint/prefer-optional-chain": "off",
  "@typescript-eslint/strict-boolean-expressions": "off",
  "max-lines": "off",
  "max-lines-per-function": "off",
  "n/no-unsupported-features/node-builtins": "off",
  "no-console": "off",
  "perfectionist/sort-exports": "off",
  "perfectionist/sort-imports": "off",
  "perfectionist/sort-jsx-props": "off",
  "perfectionist/sort-modules": "off",
  "perfectionist/sort-named-exports": "off",
  "perfectionist/sort-named-imports": "off",
  "perfectionist/sort-object-types": "off",
  "perfectionist/sort-objects": "off",
  "perfectionist/sort-union-types": "off",
  "security/detect-object-injection": "off",
  "sonarjs/cognitive-complexity": "off",
  "sonarjs/no-duplicate-string": "off",
  "unicorn/consistent-function-scoping": "off",
};

export function projectOverridePolicies() {
  return [
    {
      files: ["src/**/*.{ts,tsx}", "examples/vite-react/src/**/*.{ts,tsx}"],
      rules: currentCodebaseBaselineRules,
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "@typescript-eslint/no-explicit-any": "off",
        ...currentCodebaseBaselineRules,
      },
    },
    {
      files: [
        "**/*.{config,conf}.{js,cjs,mjs,ts}",
        "**/*.config.{js,cjs,mjs,ts}",
        "**/scripts/**/*.{js,cjs,mjs,ts}",
      ],
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "@typescript-eslint/no-var-requires": "off",
        "n/no-process-env": "off",
        "no-console": "off",
        "no-restricted-syntax": "off",
        "security/detect-non-literal-fs-filename": "off",
        ...currentCodebaseBaselineRules,
      },
    },
    {
      files: [
        "**/*.generated.{js,jsx,ts,tsx}",
        "**/generated/**/*.{js,jsx,ts,tsx}",
      ],
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        ...currentCodebaseBaselineRules,
        "no-secrets/no-secrets": "off",
      },
    },
  ];
}
