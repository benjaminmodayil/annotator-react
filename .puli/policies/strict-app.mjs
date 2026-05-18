import {
  mergeRestrictedSyntaxRules,
  restrictedSyntaxSelectors,
} from "./restricted-syntax.mjs";

const providerBoundarySelectors = [
  {
    message:
      "Import provider SDKs only through local adapter modules; configure provider restrictions in your app template.",
    selector:
      "ImportDeclaration[source.value=/^(stripe|resend|posthog-node|@posthog\\/)/]",
  },
];

export function strictAppPolicy(options = {}) {
  const providerSelectors =
    options.restrictProviders === true ? providerBoundarySelectors : [];

  return {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: {
      "n/no-process-env": "error",
      "no-console": "error",
      "no-restricted-syntax": mergeRestrictedSyntaxRules(
        "error",
        restrictedSyntaxSelectors.processEnvBoundary,
        restrictedSyntaxSelectors.directConsole,
        restrictedSyntaxSelectors.throwingBareError,
        ...providerSelectors
      ),
    },
  };
}
