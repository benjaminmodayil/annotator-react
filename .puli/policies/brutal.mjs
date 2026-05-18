export function brutalPolicy() {
  return {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: {
      complexity: ["error", 7],
      "max-depth": ["error", 3],
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 45, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["error", 3],
      "sonarjs/cognitive-complexity": ["error", 8],
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }],
    },
  };
}
