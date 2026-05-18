import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

import { baseRuntimePolicy } from "./policies/base.mjs";
import { brutalPolicy } from "./policies/brutal.mjs";
import { dataFilePolicies } from "./policies/data-files.mjs";
import { typedTsConfigs } from "./policies/environment.mjs";
import { ignoresPolicy } from "./policies/ignores.mjs";
import { packagePolicy } from "./policies/package.mjs";
import { projectOverridePolicies } from "./policies/project-overrides.mjs";
import { reactPolicy } from "./policies/react.mjs";
import { strictAppPolicy } from "./policies/strict-app.mjs";
import { testPolicy } from "./policies/test.mjs";

export function baseProfile() {
  return tseslint.config(...sharedFoundation());
}

export function brutalProfile() {
  return tseslint.config(
    ...sharedFoundation(),
    reactPolicy(),
    brutalPolicy(),
    testPolicy(),
    ...dataFilePolicies(),
    ...projectOverridePolicies()
  );
}

export function packageProfile() {
  return tseslint.config(
    ...sharedFoundation(),
    packagePolicy(),
    testPolicy(),
    ...dataFilePolicies(),
    ...projectOverridePolicies()
  );
}

export function reactProfile() {
  return tseslint.config(
    ...sharedFoundation(),
    reactPolicy(),
    testPolicy(),
    ...dataFilePolicies(),
    ...projectOverridePolicies()
  );
}

export function strictAppProfile() {
  return tseslint.config(
    ...sharedFoundation(),
    reactPolicy(),
    strictAppPolicy(),
    testPolicy(),
    ...dataFilePolicies(),
    ...projectOverridePolicies()
  );
}

function sharedFoundation() {
  return [
    ignoresPolicy(),
    js.configs.recommended,
    ...typedTsConfigs,
    perfectionist.configs["recommended-natural"],
    prettier,
    baseRuntimePolicy(),
  ];
}
