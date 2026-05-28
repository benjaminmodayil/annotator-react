export function packagePolicy() {
  return {
    files: ["**/*.{js,mjs,cjs,ts}"],
    rules: {
      "n/exports-style": "off",
      "n/no-extraneous-import": "error",
      "n/no-missing-import": "off",
      "n/no-unpublished-bin": "error",
      "n/no-unpublished-import": "warn",
      "n/no-unsupported-features/es-builtins": "warn",
      "n/no-unsupported-features/es-syntax": "warn",
      "n/no-unsupported-features/node-builtins": "warn",
    },
  };
}
