import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { answerCorrectly, answerWrongly, signInAsDemo } from "./helpers";

/**
 * 画面確認用のスクリーンショットを testreport/screenshots/ に保存する(E2E_SCREENSHOTS=1 のときだけ実行)。
 *   E2E_SCREENSHOTS=1 pnpm e2e --grep screenshots
 */
const DIR = "testreport/screenshots";
test.skip(!process.env.E2E_SCREENSHOTS, "E2E_SCREENSHOTS=1 のときだけ実行");

test.describe("screenshots", () => {
  test("主要画面を撮影する", async ({ page }) => {
    await mkdir(DIR, { recursive: true });
    await page.goto("/login");
    await page.screenshot({ path: `${DIR}/01-login.png`, fullPage: true });
    await page.goto("/about");
    await page.screenshot({ path: `${DIR}/00-about.png`, fullPage: true });
    await page.screenshot({ path: `${DIR}/00-about-top.png` });

    await signInAsDemo(page);
    await page.screenshot({ path: `${DIR}/02-home.png`, fullPage: true });

    await page.goto("/session");
    await expect(page.getByTestId("prompt")).toBeVisible();
    await page.screenshot({
      path: `${DIR}/03-session-question.png`,
      fullPage: true,
    });
    await answerWrongly(page, 0);
    await page.screenshot({
      path: `${DIR}/04-session-feedback-wrong.png`,
      fullPage: true,
    });
    await page.getByTestId("next").click();
    await answerCorrectly(page, 0);
    await page.screenshot({
      path: `${DIR}/05-session-feedback-correct.png`,
      fullPage: true,
    });

    await page.goto("/subjects");
    await page.screenshot({ path: `${DIR}/06-subjects.png`, fullPage: true });
    await page.goto("/subjects/typescript");
    await page.screenshot({
      path: `${DIR}/07-subject-detail.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: /is not assignable to/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({
      path: `${DIR}/08-card-detail.png`,
      fullPage: true,
    });

    await page.goto("/dictionary?q=default");
    await page.getByTestId("dictionary-input").focus();
    await page.screenshot({ path: `${DIR}/12-dictionary.png` });
    await page.goto("/");
    await page.getByTestId("goal-subject").click();
    await page.getByTestId("focus-nextjs").click();
    await expect(page.getByTestId("today-session")).toBeVisible();
    await page.screenshot({
      path: `${DIR}/13-home-subject.png`,
      fullPage: true,
    });

    await page.goto("/dashboard");
    await page.screenshot({ path: `${DIR}/09-dashboard.png`, fullPage: true });
    await page.goto("/settings");
    await page.screenshot({ path: `${DIR}/10-settings.png`, fullPage: true });
    await page.locator("label", { hasText: "ライト" }).click();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("status")).toContainText("保存しました");
    await page.goto("/");
    await page.screenshot({ path: `${DIR}/11-home-light.png`, fullPage: true });
  });
});
