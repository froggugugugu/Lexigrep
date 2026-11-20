import { describe, expect, it } from "vitest";
import { parseTheme, parseTimeZone } from "./theme";

describe("parseTheme", () => {
  it("不正値は system にフォールバックする", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("neon")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });
});

describe("parseTimeZone", () => {
  it("妥当な IANA 名だけを受け付ける", () => {
    expect(parseTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(parseTimeZone("America/New_York")).toBe("America/New_York");
    expect(parseTimeZone("Mars/Olympus")).toBe("Asia/Tokyo");
    expect(parseTimeZone(undefined)).toBe("Asia/Tokyo");
  });
});
