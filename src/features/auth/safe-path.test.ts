import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-path";

describe("safeNextPath", () => {
  it("サイト内の相対パスだけを許可する", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/session?subject=nextjs")).toBe(
      "/session?subject=nextjs",
    );
  });

  it("外部 URL・プロトコル相対・バックスラッシュは / に落とす", () => {
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n//evil.example")).toBe("/");
    expect(safeNextPath("/%0a//evil.example")).toBe("/%0a//evil.example");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
