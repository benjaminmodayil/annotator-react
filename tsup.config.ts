import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/register.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  splitting: false,
  banner: {
    js: '"use client";',
  },
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "sonner",
    "element-source",
    "bippy",
    "bippy/install-hook-only",
  ],
});
