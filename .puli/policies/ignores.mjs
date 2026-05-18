export function ignoresPolicy() {
  return {
    ignores: [
      ".puli/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.fallow/**",
      "**/.tmp/**",
      "**/opensrc/**",
      "**/worktrees/**",
      "**/*.generated.*",
      "**/*.min.*",
    ],
  };
}
