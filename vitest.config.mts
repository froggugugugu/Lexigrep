import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "pipeline/**/*.{test,spec}.ts",
      "scripts/**/*.{test,spec}.ts",
      "supabase/**/*.{test,spec}.ts",
    ],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "testreport/coverage",
      include: ["src/**/*.{ts,tsx}", "pipeline/**/*.ts", "scripts/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/app/**/layout.tsx",
        "src/app/**/manifest.ts",
        "src/app/**/icon.tsx",
        "**/*.d.ts",
      ],
    },
  },
});
