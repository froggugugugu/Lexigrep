import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "testreport/e2e/html", open: "never" }],
    ["json", { outputFile: "testreport/e2e/results.json" }],
  ],
  outputDir: "testreport/e2e/artifacts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // CI では本番ビルドで起動して初回コンパイルの揺れを避ける
    command: process.env.CI
      ? `pnpm build && pnpm start --port ${PORT}`
      : `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // E2E は Supabase に接続せず、メモリ内リポジトリとデモユーザーで動かす
      LEXIGREP_DATA_SOURCE: "memory",
      // CI は本番ビルドで起動する。本番では memory モードを既定で拒否するので明示的に許可する
      LEXIGREP_ALLOW_MEMORY: "1",
      // 本番ではログイン後の戻り先の origin を推定しないので、E2E のサーバー自身を指定する
      NEXT_PUBLIC_SITE_URL: baseURL,
      // 固定のフィクスチャ(content/ の実コンテンツに依存しない)。LEXIGREP_CONTENT_DIR=content で実コンテンツを使える
      LEXIGREP_CONTENT_DIR:
        process.env.LEXIGREP_CONTENT_DIR ?? "e2e/fixtures/content",
    },
  },
});
