import { describe, expect, it } from "vitest";
import { isDemoSource, resolveDataSource } from "./data-source";

const supa = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("resolveDataSource", () => {
  it("開発では Supabase 未設定なら memory にフォールバックする", () => {
    expect(resolveDataSource({ NODE_ENV: "development" })).toBe("memory");
    expect(resolveDataSource({ NODE_ENV: "test" })).toBe("memory");
  });

  it("Supabase の環境変数があれば supabase", () => {
    expect(resolveDataSource({ NODE_ENV: "development", ...supa })).toBe(
      "supabase",
    );
    expect(resolveDataSource({ NODE_ENV: "production", ...supa })).toBe(
      "supabase",
    );
  });

  it("本番では memory を既定で拒否する(環境変数欠落で黙ってデモになるのを防ぐ)", () => {
    expect(() => resolveDataSource({ NODE_ENV: "production" })).toThrow(
      /memory/,
    );
    expect(() =>
      resolveDataSource({
        NODE_ENV: "production",
        LEXIGREP_DATA_SOURCE: "memory",
      }),
    ).toThrow(/memory/);
  });

  it("本番でも LEXIGREP_ALLOW_MEMORY=1 なら memory を許可する", () => {
    expect(
      resolveDataSource({ NODE_ENV: "production", LEXIGREP_ALLOW_MEMORY: "1" }),
    ).toBe("memory");
  });

  it("明示的な supabase 指定で環境変数が無ければ失敗する", () => {
    expect(() =>
      resolveDataSource({
        NODE_ENV: "development",
        LEXIGREP_DATA_SOURCE: "supabase",
      }),
    ).toThrow(/未設定/);
  });

  it("不正な値は拒否する", () => {
    expect(() => resolveDataSource({ LEXIGREP_DATA_SOURCE: "sqlite" })).toThrow(
      /supabase \/ memory \/ local/,
    );
  });

  it("local を明示でき、本番では memory と同じく既定で拒否する", () => {
    expect(
      resolveDataSource({
        NODE_ENV: "development",
        LEXIGREP_DATA_SOURCE: "local",
      }),
    ).toBe("local");
    expect(() =>
      resolveDataSource({
        NODE_ENV: "production",
        LEXIGREP_DATA_SOURCE: "local",
      }),
    ).toThrow(/local/);
    expect(
      resolveDataSource({
        NODE_ENV: "production",
        LEXIGREP_DATA_SOURCE: "local",
        LEXIGREP_ALLOW_MEMORY: "1",
      }),
    ).toBe("local");
  });

  it("memory と local はデモユーザーで動く", () => {
    expect(isDemoSource("memory")).toBe(true);
    expect(isDemoSource("local")).toBe(true);
    expect(isDemoSource("supabase")).toBe(false);
  });
});
