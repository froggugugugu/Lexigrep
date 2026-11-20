import { describe, expect, it } from "vitest";
import { siteConfig, siteConfigSchema } from "./config";

describe("siteConfigSchema", () => {
  it("同梱の site.config.ts を受け付ける", () => {
    expect(siteConfig.name).toBe("Lexigrep");
    expect(siteConfig.baseCourse.shortName).not.toBe("");
  });

  it("紹介ページの見本は、実文の中に対象語句が文字どおり含まれるものだけ受け付ける", () => {
    const base = structuredClone(siteConfig);
    expect(siteConfig.sample.sentence).toContain(siteConfig.sample.target);
    expect(
      siteConfigSchema.safeParse({
        ...base,
        sample: { ...base.sample, target: "not in the sentence" },
      }).success,
    ).toBe(false);
    expect(
      siteConfigSchema.safeParse({
        ...base,
        sample: { ...base.sample, meaning: "" },
      }).success,
    ).toBe(false);
  });

  it("空文字と長すぎる値を拒否する", () => {
    const base = structuredClone(siteConfig);
    expect(siteConfigSchema.safeParse({ ...base, name: "  " }).success).toBe(
      false,
    );
    expect(
      siteConfigSchema.safeParse({ ...base, description: "a".repeat(201) })
        .success,
    ).toBe(false);
    expect(
      siteConfigSchema.safeParse({
        ...base,
        baseCourse: { ...base.baseCourse, goalTitle: "" },
      }).success,
    ).toBe(false);
  });
});
