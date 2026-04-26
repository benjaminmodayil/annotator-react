import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootNodeModules = (name: string) => fileURLToPath(new URL(`../../node_modules/${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@mikuexe/annotator-react/register": fileURLToPath(new URL("../../src/register.ts", import.meta.url)),
      "@mikuexe/annotator-react": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
      react: rootNodeModules("react"),
      "react-dom": rootNodeModules("react-dom"),
    },
  },
});
