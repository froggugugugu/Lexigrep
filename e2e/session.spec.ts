import { expect, test } from "@playwright/test";
import { answerCorrectly, answerWrongly, signInAsDemo } from "./helpers";

/**
 * フィクスチャ(e2e/fixtures/content)の正解インデックスはすべて 0。
 * 既定のコースは IT 英語ベースで、題材の特有語(system_term)2 枚を除く 4 枚が出題される。
 */
const ANSWER = 0;

test.describe("学習セッション(主要フロー)", () => {
  test("ログイン → セッション完了 → 進捗が反映される", async ({ page }) => {
    await signInAsDemo(page);

    // ホームに今日のセッション見込みが出る
    const today = page.getByTestId("today-session");
    await expect(today).toContainText("4 枚");
    await expect(page.getByTestId("streak")).toContainText("0");

    await page.getByRole("link", { name: "セッションを始める" }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByTestId("remaining")).toContainText("残り 4 枚");

    // 1 枚目: 不正解 → 再出題がキューに積まれる(残り枚数が 1 増える)
    await answerWrongly(page, ANSWER);
    await expect(page.getByTestId("feedback")).toContainText("不正解");
    await page.getByTestId("next").click();
    await expect(page.getByTestId("remaining")).toContainText("残り 4 枚");

    // 残り 3 枚を正解で回答
    for (let i = 0; i < 3; i++) {
      await answerCorrectly(page, ANSWER);
      await page.getByTestId("next").click();
    }

    // 再出題の 1 枚
    await expect(page.getByTestId("remaining")).toContainText("(再出題)");
    await answerCorrectly(page, ANSWER);
    await page.getByTestId("next").click();

    // 完了画面: 結果は最初の回答のみ(3/4)
    const done = page.getByTestId("session-complete");
    await expect(done).toBeVisible();
    await expect(done).toContainText("3 / 4");
    await expect(page.getByTestId("session-saved")).toBeVisible();

    // ダッシュボードに反映
    await page.getByRole("link", { name: "ダッシュボードを見る" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("dashboard-streak")).toContainText("1 日");
    await expect(page.getByTestId("dashboard-learned")).toContainText("4 / 6");
    await expect(page.getByTestId("recent-sessions")).toContainText("3/4");

    // ホームの連続日数も 1 日に
    await page.goto("/");
    await expect(page.getByTestId("streak")).toContainText("1");
  });

  test("題材・層で絞ったセッションは対象カードだけを出題する", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/session?subject=nextjs&layer=vocab");
    await expect(page.getByTestId("remaining")).toContainText("残り 1 枚");
    await expect(page.getByTestId("prompt")).toContainText(
      "ハイライト部分の意味は?",
    );
    await answerCorrectly(page, ANSWER);
    await page.getByTestId("next").click();
    await expect(page.getByTestId("session-complete")).toContainText("1 / 1");
  });

  test("fill_blank は設問中は空欄で、回答後にハイライト表示へ切り替わる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/session?subject=typescript&layer=vocab");
    await expect(page.getByTestId("prompt")).toContainText("空欄に入る語句は?");
    await expect(page.getByLabel("空欄")).toBeVisible();
    await answerCorrectly(page, ANSWER);
    await expect(page.locator("mark.lg-target")).toHaveText("inferred");
  });

  test("出題できるカードが無いときは空のセッションとして案内する", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/session?subject=nextjs&layer=idiom");
    await expect(page.getByTestId("session-complete")).toContainText(
      "今日出題できるカードがありません",
    );
  });
});
