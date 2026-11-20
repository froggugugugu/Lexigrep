import { describe, expect, it } from "vitest";
import { categoryLabel } from "./labels";

describe("categoryLabel", () => {
  it("題材が表示名を指定していればそれを使う", () => {
    expect(categoryLabel({ category: "cloud", category_label: "AWS" })).toBe(
      "AWS",
    );
  });

  it("指定がなければ既知の表示名を使う", () => {
    expect(
      categoryLabel({ category: "language_fw", category_label: null }),
    ).toBe("言語/FW");
  });

  it("未知のカテゴリは値そのものを出す", () => {
    expect(categoryLabel({ category: "object-storage" })).toBe(
      "object-storage",
    );
    expect(categoryLabel({ category: "constructor" })).toBe("constructor");
  });
});
