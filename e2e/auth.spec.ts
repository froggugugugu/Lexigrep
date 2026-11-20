import { expect, test } from "@playwright/test";
import { signInViaButton } from "./helpers";

test.describe("認証", () => {
  test("未ログインでホームを開くとログイン画面へリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Lexigrep" })).toBeVisible();
  });

  test("保護ページは未ログインではすべてログインへ送られる", async ({
    page,
  }) => {
    for (const path of ["/session", "/subjects", "/dashboard", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("紹介ページは未ログインで読め、ログイン画面と行き来できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("about-link").click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByTestId("about-hero")).toBeVisible();
    await expect(page.getByTestId("about-sample")).toBeVisible();
    await expect(page.getByTestId("about-steps").locator("li")).toHaveCount(4);
    await page.getByTestId("about-start").click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("デモユーザーでログインし、ログアウトできる", async ({ page }) => {
    await signInViaButton(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("today-session")).toBeVisible();
    await page.goto("/settings");
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ログイン後は next パラメータの相対パスへ戻り、外部 URL は無視される", async ({
    page,
  }) => {
    await signInViaButton(page, "/subjects");
    await expect(page).toHaveURL(/\/subjects$/);
    await page.goto("/settings");
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login$/);
    await signInViaButton(page, "https://example.com/evil");
    await expect(page).toHaveURL(/\/$/);
  });
});
