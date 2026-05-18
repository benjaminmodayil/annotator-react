import * as jsoncParser from "jsonc-eslint-parser";
import tseslint from "typescript-eslint";
import * as ymlParser from "yaml-eslint-parser";

export function dataFilePolicies() {
  return [
    {
      files: ["**/*.{json,jsonc}"],
      languageOptions: { parser: jsoncParser },
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "no-unused-expressions": "off",
      },
    },
    {
      files: ["**/*.{yaml,yml}"],
      languageOptions: { parser: ymlParser },
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "no-irregular-whitespace": "off",
      },
    },
  ];
}
