#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CHANGESET_FILE = /^\.changeset\/(?!README\.md$).+\.md$/;
const NO_CHANGESET_LABEL = "no-changeset-needed";
const PUBLIC_CHANGE_FILES = new Set(["README.md", "tsup.config.ts"]);
const PUBLIC_PACKAGE_FIELDS = [
  "name",
  "description",
  "keywords",
  "engines",
  "main",
  "module",
  "types",
  "files",
  "sideEffects",
  "exports",
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "publishConfig",
];

if (!existsSync(".changeset/config.json")) {
  process.exit(0);
}

const event = readGithubEvent();
const labels = event?.pull_request?.labels?.map((label) => label.name) ?? [];
const title = event?.pull_request?.title ?? "";
const headRef =
  event?.pull_request?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? "";

if (labels.includes(NO_CHANGESET_LABEL)) {
  console.log(
    `Skipping changeset check because PR has '${NO_CHANGESET_LABEL}' label.`
  );
  process.exit(0);
}

if (
  title.toLowerCase().startsWith("chore: version packages") ||
  headRef.startsWith("changeset-release/")
) {
  console.log("Skipping changeset check for Changesets version PR.");
  process.exit(0);
}

const baseRef = getBaseRef();
const changedFiles = getChangedFiles(baseRef);

if (changedFiles.some((file) => CHANGESET_FILE.test(file))) {
  console.log("Changeset found.");
  process.exit(0);
}

const userFacingFiles = changedFiles.filter((file) =>
  isUserFacingChange(file, baseRef)
);

if (userFacingFiles.length === 0) {
  console.log(
    "No user-facing package changes detected; changeset not required."
  );
  process.exit(0);
}

console.error("User-facing package changes detected without a changeset:");
for (const file of userFacingFiles) {
  console.error(`- ${file}`);
}
console.error("");
console.error(
  "Run `npm run changeset` and commit the generated .changeset/*.md file."
);
console.error(
  `If this PR truly does not need a release note, add the '${NO_CHANGESET_LABEL}' label.`
);
process.exit(1);

function getBaseRef() {
  return getExplicitBaseRef() ?? getGithubBaseRef() ?? getDefaultBaseRef();
}

function getExplicitBaseRef() {
  const explicitBaseIndex = process.argv.indexOf("--base");
  return explicitBaseIndex === -1 ? null : process.argv[explicitBaseIndex + 1];
}

function getGithubBaseRef() {
  return process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : null;
}

function getDefaultBaseRef() {
  return gitSucceeds(["rev-parse", "--verify", "origin/main"])
    ? "origin/main"
    : "HEAD~1";
}

function getChangedFiles(baseRef) {
  const output = git(["diff", "--name-only", `${baseRef}...HEAD`]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isUserFacingChange(file, baseRef) {
  return (
    PUBLIC_CHANGE_FILES.has(file) ||
    isPublicPackageJsonChange(file, baseRef) ||
    isRuntimeSourceFile(file)
  );
}

function isPublicPackageJsonChange(file, baseRef) {
  return file === "package.json" && hasPublicPackageFieldChanges(baseRef);
}

function isRuntimeSourceFile(file) {
  return (
    file.startsWith("src/") &&
    !file.includes("/__tests__/") &&
    !/\.test\.[tj]sx?$/.test(file)
  );
}

function hasPublicPackageFieldChanges(baseRef) {
  const current = readJson("package.json");
  const previousText = gitOptional(["show", `${baseRef}:package.json`]);

  if (!previousText) {
    return true;
  }

  const previous = JSON.parse(previousText);
  return PUBLIC_PACKAGE_FIELDS.some(
    (field) =>
      stableStringify(previous[field]) !== stableStringify(current[field])
  );
}

function readGithubEvent() {
  if (
    !process.env.GITHUB_EVENT_PATH ||
    !existsSync(process.env.GITHUB_EVENT_PATH)
  ) {
    return null;
  }

  return readJson(process.env.GITHUB_EVENT_PATH);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stableStringify(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortJson(nested)])
    );
  }

  return value;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function gitOptional(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function gitSucceeds(args) {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}
