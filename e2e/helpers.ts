import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const DEMO_SESSION_COOKIE = "lexigrep-demo-session";

/**
 * テストごとに別ユーザーとしてログインする(memory モードは Cookie の UUID = ユーザー ID)。
 * 並列実行するテスト同士で学習状態が混ざらないようにする。
 */
export async function signInAsDemo(page: Page): Promise<string> {
  const userId = randomUUID();
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3100}`;
  await page
    .context()
    .addCookies([{ name: DEMO_SESSION_COOKIE, value: userId, url: baseURL }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  return userId;
}

/** ログイン画面のボタンから入る(固定のデモユーザー) */
export async function signInViaButton(
  page: Page,
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByTestId("demo-sign-in").click();
}

/** 現在の設問に正解で答える(data-option-index が choices.answer と一致するボタンを押す) */
export async function answerCorrectly(
  page: Page,
  answerIndex: number,
): Promise<void> {
  await page
    .locator(`[data-testid="option"][data-option-index="${answerIndex}"]`)
    .click();
  await expect(page.getByTestId("feedback")).toHaveAttribute(
    "data-correct",
    "true",
  );
}

export async function answerWrongly(
  page: Page,
  answerIndex: number,
): Promise<void> {
  const wrong = page
    .locator(`[data-testid="option"]:not([data-option-index="${answerIndex}"])`)
    .first();
  await wrong.click();
  await expect(page.getByTestId("feedback")).toHaveAttribute(
    "data-correct",
    "false",
  );
}
