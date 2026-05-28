import { packagePolicy } from "./.puli/policies/package.mjs";
import { projectOverridePolicies } from "./.puli/policies/project-overrides.mjs";
import { reactProfile } from "./.puli/profiles.mjs";

export default [
  ...reactProfile(),
  packagePolicy(),
  ...projectOverridePolicies(),
];
