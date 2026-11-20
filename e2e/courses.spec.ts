import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers";

test.describe("学習の 2 軸とメニュー", () => {
  test("IT 英語全般: 題材横断の土台と題材の特有語が分かれて表示され、特有語は別コースで学べる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await expect(page.getByTestId("goal-general")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("base-layers")).toContainText("頻出単語");
    await page
      .getByTestId("subject-terms")
      .getByRole("link", { name: /Next\.js/ })
      .click();
    await expect(page.getByTestId("session-course")).toContainText(
      "Next.js / 題材特有語",
    );
    await expect(page.getByTestId("remaining")).toContainText("残り 1 枚");
  });

  test("題材を絞る: 選んだ題材が保存され、セッションはその題材だけになる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.getByTestId("goal-subject").click();
    await page.getByTestId("focus-nextjs").click();
    await expect(page.getByTestId("today-session")).toContainText(
      "Next.js のセッション",
    );
    await expect(page.getByTestId("today-session")).toContainText("2 枚");
    await page.reload();
    await expect(page.getByTestId("focus-nextjs")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("link", { name: "セッションを始める" }).click();
    await expect(page.getByTestId("session-course")).toContainText("Next.js");
    await expect(page.getByTestId("remaining")).toContainText("残り 2 枚");
  });

  test("セッション中もメニューで他の画面へ移動できる", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/session");
    await expect(
      page
        .getByRole("navigation", { name: "主要ナビゲーション" })
        .getByRole("link", { name: "ホーム" }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("navigation", { name: "主要ナビゲーション" })
      .getByRole("link", { name: "辞書" })
      .click();
    await expect(page).toHaveURL(/\/dictionary$/);
    await page
      .getByRole("navigation", { name: "主要ナビゲーション" })
      .getByRole("link", { name: "記録" })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("辞書", () => {
  test("入力でサジェストが絞り込まれ、選ぶと語句の詳細へ移動する", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/dictionary");
    await expect(page.getByTestId("dictionary-count")).toContainText("6 語");
    await page.getByTestId("dictionary-input").fill("assign");
    await expect(page.getByTestId("dictionary-suggestion")).toHaveCount(1);
    await page.getByTestId("dictionary-suggestion").click();
    await expect(page).toHaveURL(/\/dictionary\/is%20not%20assignable%20to$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "is not assignable to",
    );
    await expect(page.getByTestId("dictionary-examples")).toContainText(
      "TypeScript",
    );
  });

  test("日本語の意味でも引け、キーボードで選べる", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/dictionary");
    const input = page.getByTestId("dictionary-input");
    await input.fill("既定");
    await expect(page.getByTestId("dictionary-suggestion")).toContainText(
      "by default",
    );
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "by default",
    );
  });

  test("層と題材で絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/dictionary");
    await page
      .getByRole("group", { name: "層で絞り込む" })
      .getByRole("button", { name: "題材特有語" })
      .click();
    await expect(page.getByTestId("dictionary-count")).toContainText("2 語");
    await page
      .getByRole("group", { name: "題材で絞り込む" })
      .getByRole("button", { name: "Next.js" })
      .click();
    await expect(page.getByTestId("dictionary-count")).toContainText("1 語");
  });
});
