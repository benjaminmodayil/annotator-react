import { existsSync } from "node:fs";
import { join } from "node:path";
import tseslint from "typescript-eslint";

export const tsconfigRootDir = process.cwd();
export const hasTsconfig = existsSync(join(tsconfigRootDir, "tsconfig.json"));

export const typedTsConfigs = hasTsconfig
  ? [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ]
  : [...tseslint.configs.recommended];

export const typedRules = hasTsconfig
  ? {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowBoolean: true, allowNullish: true, allowNumber: true },
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "warn",
        { allowNullableBoolean: true, allowNullableObject: true },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    }
  : {};
