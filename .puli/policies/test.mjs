import vitest from "@vitest/eslint-plugin";
import jestDom from "eslint-plugin-jest-dom";
import testingLibrary from "eslint-plugin-testing-library";

export function testPolicy() {
  return {
    files: [
      "**/*.{test,spec}.{js,jsx,ts,tsx}",
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      "jest-dom": jestDom,
      "testing-library": testingLibrary,
      vitest,
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "jest-dom/prefer-enabled-disabled": "warn",
      "jest-dom/prefer-in-document": "warn",
      "jest-dom/prefer-required": "warn",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "no-console": "off",
      "no-restricted-syntax": "off",
      "testing-library/await-async-queries": "error",
      "testing-library/no-await-sync-events": "error",
      "testing-library/no-container": "warn",
      "testing-library/no-debugging-utils": "warn",
      "testing-library/no-node-access": "warn",
      "testing-library/prefer-find-by": "warn",
      "testing-library/prefer-presence-queries": "warn",
      "testing-library/prefer-screen-queries": "warn",
      "testing-library/prefer-user-event": "warn",
      "vitest/expect-expect": "warn",
      "vitest/no-conditional-expect": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
      "vitest/valid-expect": "error",
    },
  };
}
