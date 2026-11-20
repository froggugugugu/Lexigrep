import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers";

test.describe("題材ブラウザ・カード詳細・設定", () => {
  test("題材一覧 → 題材詳細 → カード詳細 → 間違い報告", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/subjects");
    const list = page.getByTestId("subject-list");
    await expect(list).toContainText("TypeScript");
    await expect(list).toContainText("Next.js");

    await list.getByRole("link", { name: /TypeScript/ }).click();
    await expect(page).toHaveURL(/\/subjects\/typescript$/);
    await expect(page.getByTestId("layer-list")).toContainText("表現パターン");
    await expect(
      page.getByRole("link", { name: "この題材で学習する" }),
    ).toHaveAttribute("href", "/session?subject=typescript");

    await page.getByRole("link", { name: /is not assignable to/ }).click();
    await expect(page).toHaveURL(/\/cards\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "is not assignable to",
    );
    await expect(page.locator("mark.lg-target")).toHaveText(
      "is not assignable to",
    );
    await expect(
      page.getByRole("link", { name: "Everyday Types" }),
    ).toHaveAttribute("href", /typescriptlang\.org/);
    // 関連パターン
    await expect(page.getByRole("link", { name: /inferred/ })).toBeVisible();

    await page
      .getByLabel("間違い・不自然な点を報告")
      .fill("訳語が文脈に合っていない気がします");
    await page.getByRole("button", { name: "報告する" }).click();
    await expect(page.getByRole("status")).toContainText(
      "報告を受け付けました",
    );
  });

  test("存在しないカードは 404", async ({ page }) => {
    await signInAsDemo(page);
    const res = await page.goto("/cards/00000000-0000-4000-8000-00000000dead");
    expect(res?.status()).toBe(404);
  });

  test("設定でセッション枚数とテーマを保存できる", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/settings");
    // ラジオは sr-only なので、ラベル(タップ領域)をクリックする
    await page.locator("label", { hasText: "8枚" }).click();
    await page.locator("label", { hasText: "ライト" }).click();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("status")).toContainText("保存しました");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.goto("/");
    await expect(page.getByTestId("today-session")).toContainText("4 枚");
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: /^8枚/ })).toBeChecked();
  });

  test("PWA manifest が配信され、インストールに必要な項目を持つ", async ({
    request,
  }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBe("Lexigrep");
    expect(manifest.display).toBe("standalone");
    expect(
      manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
    ).toBe(true);
    const icon = await request.get("/icon/192");
    expect(icon.ok()).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  });
});
